import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { LearningContentGenerationPort } from "../../application/ports/learning-content-port";
import type { RevisionGenerationPort } from "../../application/ports/revision-generation-port";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { RevisionItem } from "../../domain/revision/revision-plan";
import { ProviderError } from "../../shared/errors/provider-error";
import {
  revisionItemCandidateProviderJsonSchema,
  revisionItemCandidateProviderSchema,
} from "../../shared/schemas/revision-schemas";
import { buildRevisionItemPrompt, REVISION_PROMPT_VERSIONS } from "./revision-prompts";

const MODEL = "gemma-4-26b-a4b-it" as const;

function retryIdentity(activity: ActivitySet): ActivitySet {
  const written = activity.questions[1];
  return {
    ...activity,
    id: `retry-activity-${activity.sourceVersionId}`,
    questions: [
      { ...activity.questions[0], id: "retry-question-001" },
      {
        ...written,
        id: "retry-question-002",
        rubric: written.rubric.map((criterion, index) => ({
          ...criterion,
          id: `criterion-retry-${String(index + 1).padStart(3, "0")}`,
        })),
      },
    ],
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
    private readonly learningContent: LearningContentGenerationPort,
    private readonly timeoutMs = 90_000,
  ) {}

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

    const generatedRetry = await this.learningContent.generateMixedAssessment({
      source: input.source,
      preparationMap: input.preparationMap,
      selectedConceptIds: input.selection.targetConceptIds,
      title: `${input.selection.mode === "weak_area" ? "Weak-area" : input.selection.mode === "reinforcement" ? "Reinforcement" : "Challenge"} retry · ${input.preparationMap.title}`.slice(0, 160),
      difficulty: input.selection.mode === "challenge" ? "hard" : "medium",
      requestId: input.requestId,
      ...(input.repair === undefined ? {} : {
        repair: {
          invalidArtifact: input.repair.invalidArtifact.retryActivity,
          validationErrors: input.repair.validationErrors,
        },
      }),
    });
    const retryActivity = retryIdentity(generatedRetry);
    const latencyMs = itemResults.reduce((sum, result) => sum + result.metadata.latencyMs, 0) + retryActivity.artifact.latencyMs;
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
      repaired: input.repair !== undefined || itemResults.some((result) => result.repaired) || retryActivity.artifact.repaired,
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
