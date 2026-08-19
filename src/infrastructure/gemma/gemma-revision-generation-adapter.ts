import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { RevisionGenerationPort } from "../../application/ports/revision-generation-port";
import {
  assembleEvidenceFirstAssessment,
  createEvidenceFirstAssessmentPlan,
} from "../../application/services/evidence-first-assessment-builder";
import type { ActivitySet } from "../../domain/assessments/mcq";
import { validateRevisionQuestion } from "../../domain/assessments/evidence-first-validation";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { RevisionItem } from "../../domain/revision/revision-plan";
import { ProviderError } from "../../shared/errors/provider-error";
import {
  evidenceFirstMcqProviderJsonSchema,
  evidenceFirstMcqProviderTransportSchema,
  evidenceFirstWrittenQuestionProviderJsonSchema,
  evidenceFirstWrittenQuestionProviderTransportSchema,
} from "../../shared/schemas/evidence-first-question-schemas";
import {
  revisionItemCandidateProviderJsonSchema,
  revisionItemCandidateProviderSchema,
} from "../../shared/schemas/revision-schemas";
import {
  buildRevisionItemPrompt,
  REVISION_PROMPT_VERSIONS,
} from "./revision-prompts";
import { buildEvidenceFirstAssessmentPrompt } from "./learning-content-prompts";

const MODEL = "gemma-4-26b-a4b-it" as const;
type RetryRepairPromptContext = NonNullable<
  Parameters<typeof buildEvidenceFirstAssessmentPrompt>[0]["repair"]
>;

const RETRY_MCQ_OUTPUT_TOKEN_BUDGET = 1_800;
const RETRY_WRITTEN_OUTPUT_TOKEN_BUDGET = 1_800;

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
    const title = `${input.selection.mode === "weak_area" ? "Weak-area" : input.selection.mode === "reinforcement" ? "Reinforcement" : "Challenge"} retry · ${input.preparationMap.title}`.slice(0, 160);
    const difficulty = input.selection.mode === "challenge" ? "hard" : "medium";
    let evidencePlan;
    try {
      evidencePlan = createEvidenceFirstAssessmentPlan({
        source: input.source,
        preparationMap: input.preparationMap,
        selectedConceptIds: input.selection.targetConceptIds,
        idPrefix: "retry",
      });
    } catch (error) {
      throw new ProviderError("INVALID_OUTPUT", { cause: error });
    }
    const originalPrompts = input.originalActivity.questions.map((question) => question.prompt);
    const generate = async (repair?: RetryRepairPromptContext) => {
      const mcqResult = await this.model.generateStructured({
        task: "structured_generation",
        modelId: MODEL,
        promptVersion,
        schemaVersion: "retry-mcq-semantic.v3",
        thinkingLevel: "high",
        temperature: 0.1,
        maxOutputTokens: RETRY_MCQ_OUTPUT_TOKEN_BUDGET,
        timeoutMs: this.timeoutMs,
        contents: [{
          kind: "text",
          text: buildEvidenceFirstAssessmentPrompt({
            source: input.source,
            title,
            difficulty,
            target: "mcq",
            canonicalAnswer: evidencePlan.mcqCanonicalAnswer,
            excludedPrompts: originalPrompts,
            retryMode: input.selection.mode,
            ...(repair === undefined ? {} : { repair }),
          }),
        }],
        outputMode: "native",
        jsonSchema: evidenceFirstMcqProviderJsonSchema,
        schema: evidenceFirstMcqProviderTransportSchema,
        maxSchemaRepairs: repair === undefined ? 1 : 0,
      });
      const writtenResult = await this.model.generateStructured({
        task: "structured_generation",
        modelId: MODEL,
        promptVersion,
        schemaVersion: "retry-written-semantic.v3",
        thinkingLevel: "high",
        temperature: 0.1,
        maxOutputTokens: RETRY_WRITTEN_OUTPUT_TOKEN_BUDGET,
        timeoutMs: this.timeoutMs,
        contents: [{
          kind: "text",
          text: buildEvidenceFirstAssessmentPrompt({
            source: input.source,
            title,
            difficulty,
            target: "written_question",
            canonicalAnswer: evidencePlan.writtenCanonicalAnswer,
            priorMcqPrompt: mcqResult.value.prompt,
            excludedPrompts: originalPrompts,
            retryMode: input.selection.mode,
            ...(repair === undefined ? {} : { repair }),
          }),
        }],
        outputMode: "native",
        jsonSchema: evidenceFirstWrittenQuestionProviderJsonSchema,
        schema: evidenceFirstWrittenQuestionProviderTransportSchema,
        maxSchemaRepairs: repair === undefined ? 1 : 0,
      });
      const placeholderMetadata: ModelArtifactMetadata = {
        provider: "gemini_api",
        modelId: MODEL,
        task: "revision_generation",
        promptVersion,
        schemaVersion: "activity-set.v2",
        thinkingLevel: "high",
        requestId: input.requestId,
        createdAt: new Date().toISOString(),
        latencyMs: 0,
        repaired: repair !== undefined,
      };
      const latencyMs =
        mcqResult.metadata.latencyMs +
        writtenResult.metadata.latencyMs;
      const repaired =
        repair !== undefined ||
        mcqResult.repaired ||
        writtenResult.repaired;
      const artifact: ModelArtifactMetadata = {
        ...placeholderMetadata,
        latencyMs,
        repaired,
      };
      const assembled = assembleEvidenceFirstAssessment({
        source: input.source,
        plan: evidencePlan,
        mcqProvider: mcqResult.value,
        writtenQuestionProvider: writtenResult.value,
        title,
        difficulty,
        metadata: artifact,
        idPrefix: "retry-question",
        criterionIdPrefix: "retry",
      });
      const acceptedBank = input.originalActivity.questions.map((question) => ({
        recordId: question.id,
        prompt: question.prompt,
        materialId: evidencePlan.mcqCanonicalAnswer.materialId,
        pipeline: "ankur_structured" as const,
        operationId: input.originalActivity.id,
        kind: "assessment" as const,
      }));
      const revisionFailures = [
        ...validateRevisionQuestion(
          input.source,
          evidencePlan.mcqCanonicalAnswer,
          {
            schemaVersion: "revision-question.v2",
            id: assembled.mcq.id,
            originalQuestionId: input.originalActivity.questions[0].id,
            retryMode: input.selection.mode,
            materialId: assembled.mcq.materialId,
            sourceVersionId: assembled.mcq.sourceVersionId,
            prompt: assembled.mcq.prompt,
            canonicalAnswerId: assembled.mcq.canonicalAnswerId,
            requiredClaimIds: assembled.mcq.requiredClaimIds,
            requiredConceptIds: assembled.mcq.conceptIds,
            evidenceReferences: assembled.mcq.evidenceReferences,
            questionType: "single_mcq",
          },
          acceptedBank,
        ),
        ...validateRevisionQuestion(
          input.source,
          evidencePlan.writtenCanonicalAnswer,
          {
            schemaVersion: "revision-question.v2",
            id: assembled.writtenQuestion.id,
            originalQuestionId: input.originalActivity.questions[1].id,
            retryMode: input.selection.mode,
            materialId: assembled.writtenQuestion.materialId,
            sourceVersionId: assembled.writtenQuestion.sourceVersionId,
            prompt: assembled.writtenQuestion.prompt,
            canonicalAnswerId: assembled.writtenQuestion.canonicalAnswerId,
            requiredClaimIds: assembled.writtenQuestion.requiredClaimIds,
            requiredConceptIds: assembled.writtenQuestion.conceptIds,
            evidenceReferences: assembled.writtenQuestion.evidenceReferences,
            questionType: "short_written",
          },
          acceptedBank,
        ),
      ];
      return {
        assembled,
        failures: [...assembled.failures, ...revisionFailures],
        latencyMs,
        repaired,
      };
    };
    let result = await generate();
    if (result.failures.length > 0) {
      if (result.repaired) throw new ProviderError("INVALID_OUTPUT");
      const failureCodes = [...new Set(result.failures.map((failure) => failure.code))];
      result = await generate({
        artifactType: "revision_item",
        outputSchemaVersion: "revision-question.v2",
        failureCodes,
        invalidArtifact: {
          mcq: result.assembled.mcq,
          writtenQuestion: result.assembled.writtenQuestion,
          rubric: result.assembled.rubric,
        },
        mutableFields: [
          "prompt", "misconception1", "misconception2", "misconception3",
          "expectedLength",
        ],
        lockedOutputFields: {},
        referenceContext: {
          canonicalAnswer: evidencePlan.writtenCanonicalAnswer.canonicalAnswer,
          requiredClaims: evidencePlan.writtenCanonicalAnswer.requiredClaims.map((claim) => claim.text),
          permittedEvidence: evidencePlan.writtenCanonicalAnswer.evidenceReferences,
          language: evidencePlan.writtenCanonicalAnswer.language,
        },
      });
      if (result.failures.length > 0) {
        throw new ProviderError("INVALID_OUTPUT", {
          cause: new Error(
            result.failures.map((failure) => `${failure.code}:${failure.path}`).join(","),
          ),
        });
      }
    }
    return {
      activity: {
        ...result.assembled.activitySet,
        id: `retry-activity-${input.source.sourceVersionId}`,
      },
      latencyMs: result.latencyMs,
      repaired: result.repaired,
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
        maxSchemaRepairs: input.repair === undefined ? 1 : 0,
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
