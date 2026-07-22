import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { RevisionGenerationPort } from "../../application/ports/revision-generation-port";
import type { ActivitySet, McqOption } from "../../domain/assessments/mcq";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import { normalizeSourceText } from "../../domain/source/confirmed-source";
import type { RevisionItem } from "../../domain/revision/revision-plan";
import { ProviderError } from "../../shared/errors/provider-error";
import {
  createMcqCandidateProviderJsonSchema,
  createWrittenQuestionCandidateProviderJsonSchema,
  createWrittenRubricCandidateProviderJsonSchema,
  mcqCandidateProviderSchema,
  writtenQuestionCandidateProviderSchema,
  writtenRubricCandidateProviderSchema,
} from "../../shared/schemas/learning-content-schemas";
import {
  revisionItemCandidateProviderJsonSchema,
  revisionItemCandidateProviderSchema,
} from "../../shared/schemas/revision-schemas";
import {
  buildRevisionItemPrompt,
  buildRevisionRetryPrompt,
  REVISION_PROMPT_VERSIONS,
  type RevisionRetryGroundingAssignment,
} from "./revision-prompts";

const MODEL = "gemma-4-26b-a4b-it" as const;

const RETRY_OUTPUT_TOKEN_BUDGET = 900;

function optionsWithDistinctOrder(input: {
  readonly values: readonly [string, string, string, string];
  readonly correctOptionId: McqOption["id"];
  readonly original: ActivitySet["questions"][0];
}): { readonly options: readonly [McqOption, McqOption, McqOption, McqOption]; readonly correctOptionId: McqOption["id"] } {
  const ids = ["A", "B", "C", "D"] as const;
  const sameOrder = input.values.every((value, index) =>
    normalizeSourceText(value).toLocaleLowerCase() ===
      normalizeSourceText(input.original.options[index]?.text ?? "").toLocaleLowerCase(),
  );
  const orderedValues = sameOrder
    ? [input.values[1], input.values[2], input.values[3], input.values[0]] as const
    : input.values;
  const originalCorrectIndex = ids.indexOf(input.correctOptionId);
  const correctIndex = sameOrder ? (originalCorrectIndex + 3) % 4 : originalCorrectIndex;
  return {
    options: ids.map((id, index) => ({ id, text: orderedValues[index] })) as [McqOption, McqOption, McqOption, McqOption],
    correctOptionId: ids[correctIndex] ?? input.correctOptionId,
  };
}

function learnerIssueSummary(input: {
  readonly name: string;
  readonly mode: "weak_area" | "reinforcement" | "challenge";
  readonly strength: string;
  readonly percentage: number;
  readonly missing: boolean;
}): string {
  if (input.mode === "challenge") {
    return `${input.name} was mastered at ${String(input.percentage)}% in the original result. This is an optional challenge, not a weakness.`;
  }
  if (input.mode === "reinforcement") {
    return `${input.name} was developing at ${String(input.percentage)}% in the original result. This is reinforcement, not a fabricated weakness.`;
  }
  if (input.missing) return `The original written evaluation marked ${input.name} as missing.`;
  return `The original result classified ${input.name} as ${input.strength.replaceAll("_", " ")} at ${String(input.percentage)}%.`;
}

export class GemmaRevisionGenerationAdapter implements RevisionGenerationPort {
  constructor(
    private readonly model: GenerativeModelPort,
    private readonly timeoutMs = 90_000,
  ) {}

  private async generateRetryActivity(
    input: Parameters<RevisionGenerationPort["generateRevisionPlan"]>[0],
    promptVersion: (typeof REVISION_PROMPT_VERSIONS)[keyof typeof REVISION_PROMPT_VERSIONS],
  ): Promise<{ readonly activity: ActivitySet; readonly latencyMs: number; readonly repaired: boolean }> {
    const allowedSegmentIds = new Set(input.source.segments.map((segment) => segment.id));
    const groundedConcepts = input.selection.targetConceptIds.flatMap((conceptId) => {
      const concept = input.preparationMap.concepts.find((candidate) => candidate.id === conceptId);
      const evidence = concept?.evidence.find((reference) => allowedSegmentIds.has(reference.segmentId));
      return concept === undefined || evidence === undefined ? [] : [{ concept, evidence }];
    });
    if (groundedConcepts.length !== input.selection.targetConceptIds.length || groundedConcepts.length === 0) {
      throw new ProviderError("INVALID_OUTPUT");
    }
    const assignmentFor = (index: number): RevisionRetryGroundingAssignment["mcq"] => {
      const grounded = groundedConcepts[index % groundedConcepts.length];
      if (grounded === undefined) throw new ProviderError("INVALID_OUTPUT");
      return {
        conceptId: grounded.concept.id,
        conceptName: grounded.concept.name,
        conceptDescription: grounded.concept.description,
        evidenceSegmentId: grounded.evidence.segmentId,
      };
    };
    const assignment: RevisionRetryGroundingAssignment = {
      mcq: assignmentFor(0),
      writtenCriteria: [assignmentFor(0), assignmentFor(1), assignmentFor(2)],
    };
    const title = `${input.selection.mode === "weak_area" ? "Weak-area" : input.selection.mode === "reinforcement" ? "Reinforcement" : "Challenge"} retry · ${input.preparationMap.title}`.slice(0, 160);
    const difficulty = input.selection.mode === "challenge" ? "hard" : "medium";
    const basePromptInput = {
      source: input.source,
      originalActivity: input.originalActivity,
      retryMode: input.selection.mode,
      title,
      difficulty,
      ...(input.repair === undefined ? {} : { repair: input.repair }),
    } as const;
    const mcqResult = await this.model.generateStructured({
      task: "structured_generation", modelId: MODEL, promptVersion, schemaVersion: "revision-retry-mcq.v1",
      thinkingLevel: "high", temperature: 0.1, maxOutputTokens: RETRY_OUTPUT_TOKEN_BUDGET, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildRevisionRetryPrompt(basePromptInput, "mcq", assignment) }], outputMode: "native",
      jsonSchema: createMcqCandidateProviderJsonSchema(), schema: mcqCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const writtenResult = await this.model.generateStructured({
      task: "structured_generation", modelId: MODEL, promptVersion, schemaVersion: "revision-retry-written-question.v1",
      thinkingLevel: "high", temperature: 0.1, maxOutputTokens: RETRY_OUTPUT_TOKEN_BUDGET, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildRevisionRetryPrompt(basePromptInput, "written_question", assignment, mcqResult.value.prompt) }], outputMode: "native",
      jsonSchema: createWrittenQuestionCandidateProviderJsonSchema(), schema: writtenQuestionCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const referenceAnswer = [...new Set(groundedConcepts.map(({ concept }) => concept.description))]
      .join(" ").slice(0, 1_200).trim();
    if (referenceAnswer.length === 0) throw new ProviderError("INVALID_OUTPUT");
    const rubricResult = await this.model.generateStructured({
      task: "structured_generation", modelId: MODEL, promptVersion, schemaVersion: "revision-retry-rubric.v1",
      thinkingLevel: "high", temperature: 0.1, maxOutputTokens: RETRY_OUTPUT_TOKEN_BUDGET, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildRevisionRetryPrompt(basePromptInput, "written_rubric", assignment, referenceAnswer) }], outputMode: "native",
      jsonSchema: createWrittenRubricCandidateProviderJsonSchema(), schema: writtenRubricCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const optionResult = optionsWithDistinctOrder({
      values: [mcqResult.value.optionA, mcqResult.value.optionB, mcqResult.value.optionC, mcqResult.value.optionD],
      correctOptionId: mcqResult.value.correctOptionId,
      original: input.originalActivity.questions[0],
    });
    const criterionDescription = (
      grounding: RevisionRetryGroundingAssignment["mcq"],
      providerDescription: string,
    ) => `${grounding.conceptName}: ${grounding.conceptDescription.slice(0, 220)} — ${providerDescription.slice(0, 160)}`.slice(0, 400);
    const rubric = [
      {
        id: "criterion-retry-001", description: criterionDescription(assignment.writtenCriteria[0], rubricResult.value.criterion1Description), maximumMarks: 2,
        requiredConceptIds: [assignment.writtenCriteria[0].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[0].evidenceSegmentId }],
      },
      {
        id: "criterion-retry-002", description: criterionDescription(assignment.writtenCriteria[1], rubricResult.value.criterion2Description), maximumMarks: 2,
        requiredConceptIds: [assignment.writtenCriteria[1].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[1].evidenceSegmentId }],
      },
      {
        id: "criterion-retry-003", description: criterionDescription(assignment.writtenCriteria[2], rubricResult.value.criterion3Description), maximumMarks: 1,
        requiredConceptIds: [assignment.writtenCriteria[2].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[2].evidenceSegmentId }],
      },
    ] as const;
    const writtenConceptIds = [...new Set(rubric.flatMap((criterion) => criterion.requiredConceptIds))];
    const writtenEvidence = [...new Set(rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)))]
      .map((segmentId) => ({ segmentId }));
    const latencyMs = mcqResult.metadata.latencyMs + writtenResult.metadata.latencyMs + rubricResult.metadata.latencyMs;
    const repaired = input.repair !== undefined || mcqResult.repaired || writtenResult.repaired || rubricResult.repaired;
    const artifact: ModelArtifactMetadata = {
      provider: "gemini_api", modelId: MODEL, task: "revision_generation", promptVersion, schemaVersion: "activity-set.v2",
      thinkingLevel: "high", requestId: input.requestId, createdAt: new Date().toISOString(), latencyMs, repaired,
    };
    return {
      activity: {
        schemaVersion: "activity-set.v2", id: `retry-activity-${input.source.sourceVersionId}`,
        sourceVersionId: input.source.sourceVersionId, title,
        questions: [
          {
            id: "retry-question-001", type: "single_mcq", sourceVersionId: input.source.sourceVersionId,
            prompt: mcqResult.value.prompt, conceptIds: [assignment.mcq.conceptId], difficulty, marks: 1,
            explanation: mcqResult.value.explanation, options: optionResult.options, correctOptionId: optionResult.correctOptionId,
            evidence: [{ segmentId: assignment.mcq.evidenceSegmentId }], artifact,
          },
          {
            id: "retry-question-002", type: "short_written", sourceVersionId: input.source.sourceVersionId,
            prompt: writtenResult.value.prompt, conceptIds: writtenConceptIds, difficulty, marks: 5,
            explanation: writtenResult.value.explanation, expectedLength: writtenResult.value.expectedLength,
            referenceAnswer, requiredConceptIds: writtenConceptIds, evidence: writtenEvidence, rubric, artifact,
          },
        ],
        warnings: [], artifact,
      },
      latencyMs,
      repaired,
    };
  }

  async generateRevisionPlan(input: Parameters<RevisionGenerationPort["generateRevisionPlan"]>[0]) {
    const promptVersion = input.repair === undefined ? REVISION_PROMPT_VERSIONS.generate : REVISION_PROMPT_VERSIONS.repair;
    const conceptById = new Map(input.preparationMap.concepts.map((concept) => [concept.id, concept]));
    const performanceById = new Map(input.performance.map((performance) => [performance.conceptId, performance]));
    const itemResults = [];
    const items: RevisionItem[] = [];
    for (const [index, conceptId] of input.selection.targetConceptIds.entries()) {
      const concept = conceptById.get(conceptId);
      const performance = performanceById.get(conceptId);
      if (concept === undefined || performance === undefined) throw new ProviderError("INVALID_OUTPUT");
      const result = await this.model.generateStructured({
        task: "structured_generation",
        modelId: MODEL,
        promptVersion,
        schemaVersion: "revision-item.v1",
        thinkingLevel: "high",
        temperature: 0.1,
        maxOutputTokens: 650,
        timeoutMs: Math.min(this.timeoutMs, 55_000),
        contents: [{
          kind: "text",
          text: buildRevisionItemPrompt({
            source: input.source,
            concept,
            performance,
            retryMode: input.selection.mode,
            missing: input.writtenEvaluation.missingConceptIds.includes(conceptId),
            recommended: input.writtenEvaluation.recommendedRevisionConceptIds.includes(conceptId),
            claimCount: input.writtenEvaluation.incorrectClaims.length + input.writtenEvaluation.unsupportedClaims.length,
            ...(input.repair === undefined ? {} : { repair: input.repair }),
          }),
        }],
        outputMode: "native",
        jsonSchema: revisionItemCandidateProviderJsonSchema,
        schema: revisionItemCandidateProviderSchema,
        maxSchemaRepairs: 1,
      });
      itemResults.push(result);
      const evidence = concept.evidence.filter((reference) =>
        input.source.segments.some((segment) => segment.id === reference.segmentId),
      ).slice(0, 3);
      const firstReference = evidence[0];
      const segment = input.source.segments.find((candidate) => candidate.id === firstReference?.segmentId);
      const importantFact = firstReference?.quote ?? segment?.text.slice(0, 600);
      if (evidence.length === 0 || importantFact === undefined || importantFact.trim().length === 0) {
        throw new ProviderError("INVALID_OUTPUT");
      }
      items.push({
        id: `revision-item-${String(index + 1).padStart(3, "0")}`,
        conceptId,
        learnerIssueSummary: learnerIssueSummary({
          name: concept.name,
          mode: input.selection.mode,
          strength: performance.strength,
          percentage: performance.percentage,
          missing: input.writtenEvaluation.missingConceptIds.includes(conceptId),
        }),
        correctedConcept: concept.description,
        explanation: concept.description,
        importantFact,
        memoryAid: `Memory aid (not evidence): ${result.value.memoryCue}`,
        modelAnswerOutline: `Use this source-backed point: ${concept.description}`,
        evidence,
        linkedClaims: [...input.writtenEvaluation.incorrectClaims, ...input.writtenEvaluation.unsupportedClaims].slice(0, 8),
      });
    }

    const retry = await this.generateRetryActivity(input, promptVersion);
    const retryActivity = retry.activity;
    const latencyMs = itemResults.reduce((sum, result) => sum + result.metadata.latencyMs, 0) + retry.latencyMs;
    const metadata: ModelArtifactMetadata = {
      provider: "gemini_api",
      modelId: MODEL,
      task: "revision_generation",
      promptVersion,
      schemaVersion: "revision-plan.v1",
      thinkingLevel: "high",
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
      latencyMs,
      repaired: input.repair !== undefined || itemResults.some((result) => result.repaired) || retry.repaired,
    };
    return {
      schemaVersion: "revision-plan.v1" as const,
      id: `revision-${input.source.sourceVersionId}`,
      sourceVersionId: input.source.sourceVersionId,
      originalActivitySetId: input.originalActivity.id,
      originalResultId: input.originalResultId,
      retryMode: input.selection.mode,
      targetConceptIds: input.selection.targetConceptIds,
      items,
      retryActivity,
      warnings: [],
      artifact: metadata,
    };
  }
}
