import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { WrittenEvaluationPort } from "../../application/ports/written-evaluation-port";
import type { WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import { ProviderError } from "../../shared/errors/provider-error";
import { writtenEvaluationProviderJsonSchema, writtenEvaluationProviderSchema } from "../../shared/schemas/written-evaluation-schemas";
import { buildWrittenEvaluationPrompt, WRITTEN_EVALUATION_PROMPT_VERSIONS } from "./written-evaluation-prompts";

const MODEL = "gemma-4-26b-a4b-it" as const;

export class GemmaWrittenEvaluationAdapter implements WrittenEvaluationPort {
  constructor(private readonly model: GenerativeModelPort, private readonly timeoutMs = 90_000) {}

  async evaluateWrittenAnswer(input: Parameters<WrittenEvaluationPort["evaluateWrittenAnswer"]>[0]): Promise<WrittenAnswerEvaluation> {
    const promptVersion = input.repair === undefined ? WRITTEN_EVALUATION_PROMPT_VERSIONS.evaluate : WRITTEN_EVALUATION_PROMPT_VERSIONS.repair;
    const result = await this.model.generateStructured({
      task: "structured_generation", modelId: MODEL, promptVersion, schemaVersion: "written-evaluation.v1",
      thinkingLevel: "high", temperature: 0.1, maxOutputTokens: 3_500, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildWrittenEvaluationPrompt(input) }], outputMode: "native",
      jsonSchema: writtenEvaluationProviderJsonSchema, schema: writtenEvaluationProviderSchema, maxSchemaRepairs: 1,
    });
    const criterionResults = input.question.rubric.map((criterion, index) => {
      const awardedMarks = result.value.criterionAwardedMarks[index];
      const state = result.value.criterionStates[index];
      const reason = result.value.criterionReasons[index];
      if (awardedMarks === undefined || state === undefined || reason === undefined) throw new ProviderError("INVALID_OUTPUT");
      return { criterionId: criterion.id, awardedMarks, maximumMarks: criterion.maximumMarks, state, reason };
    });
    return {
      schemaVersion: "written-evaluation.v1",
      questionId: input.question.id,
      sourceVersionId: input.question.sourceVersionId,
      awardedMarks: result.value.awardedMarks,
      maximumMarks: 5,
      status: result.value.status,
      criterionResults,
      coveredConceptIds: result.value.coveredConceptIds,
      missingConceptIds: result.value.missingConceptIds,
      incorrectClaims: result.value.incorrectClaims,
      unsupportedClaims: result.value.unsupportedClaims,
      feedback: result.value.feedback,
      evidence: result.value.evidenceSegmentIds.map((segmentId) => ({ segmentId })),
      recommendedRevisionConceptIds: result.value.recommendedRevisionConceptIds,
      artifact: {
        provider: "gemini_api", modelId: MODEL, task: "written_evaluation", promptVersion,
        schemaVersion: "written-evaluation.v1", thinkingLevel: "high", requestId: input.requestId,
        createdAt: new Date().toISOString(), latencyMs: result.metadata.latencyMs, repaired: result.repaired || input.repair !== undefined,
      },
    };
  }
}
