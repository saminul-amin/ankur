import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { WrittenEvaluationPort } from "../../application/ports/written-evaluation-port";
import type { CriterionState, WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import { normalizeSourceText } from "../../domain/source/confirmed-source";
import { ProviderError } from "../../shared/errors/provider-error";
import { createWrittenEvaluationProviderContract } from "../../shared/schemas/written-evaluation-schemas";
import { buildWrittenEvaluationPrompt, WRITTEN_EVALUATION_PROMPT_VERSIONS } from "./written-evaluation-prompts";

const MODEL = "gemma-4-26b-a4b-it" as const;

export class GemmaWrittenEvaluationAdapter implements WrittenEvaluationPort {
  constructor(private readonly model: GenerativeModelPort, private readonly timeoutMs = 90_000) {}

  async evaluateWrittenAnswer(input: Parameters<WrittenEvaluationPort["evaluateWrittenAnswer"]>[0]): Promise<WrittenAnswerEvaluation> {
    const promptVersion = input.repair === undefined ? WRITTEN_EVALUATION_PROMPT_VERSIONS.evaluate : WRITTEN_EVALUATION_PROMPT_VERSIONS.repair;
    const transport = createWrittenEvaluationProviderContract({
      criterionMaximumMarks: input.question.rubric.map((criterion) => criterion.maximumMarks),
    });
    const result = await this.model.generateStructured({
      task: "structured_generation", modelId: MODEL, promptVersion, schemaVersion: "written-evaluation-transport.v4",
      thinkingLevel: "high", temperature: 0.1, maxOutputTokens: 1_800, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildWrittenEvaluationPrompt(input) }], outputMode: "native",
      jsonSchema: transport.jsonSchema, schema: transport.schema, maxSchemaRepairs: 1,
    });
    const exactReferenceAnswer = normalizeSourceText(input.studentAnswer).toLocaleLowerCase() ===
      normalizeSourceText(input.question.referenceAnswer).toLocaleLowerCase();
    const criterionResults = input.question.rubric.map((criterion, index) => {
      const providerJudgment = result.value.criterionJudgments[index];
      const providerReason = result.value.criterionReasons[index];
      if (providerJudgment === undefined || providerReason === undefined) throw new ProviderError("INVALID_OUTPUT");
      const awardedMarks = exactReferenceAnswer
        ? criterion.maximumMarks
        : providerJudgment === "met"
          ? criterion.maximumMarks
          : providerJudgment === "partial"
            ? criterion.maximumMarks / 2
            : 0;
      const reason = exactReferenceAnswer
        ? "The submitted answer matches the source-grounded reference answer for this criterion."
        : providerReason;
      const state: CriterionState = awardedMarks === criterion.maximumMarks ? "met" : awardedMarks === 0 ? "not_met" : "partial";
      return { criterionId: criterion.id, awardedMarks, maximumMarks: criterion.maximumMarks, state, reason };
    });
    const awardedMarks = criterionResults.reduce((sum, criterion) => sum + criterion.awardedMarks, 0);
    const status = awardedMarks === 5 ? "correct" : awardedMarks === 0 ? "incorrect" : "partially_correct";
    const coveredConceptIds = [...new Set(input.question.rubric.flatMap((criterion, index) =>
      criterionResults[index]?.state === "met" ? criterion.requiredConceptIds : [],
    ))];
    const missingConceptIds = input.question.requiredConceptIds.filter((conceptId) => !coveredConceptIds.includes(conceptId));
    return {
      schemaVersion: "written-evaluation.v1",
      questionId: input.question.id,
      sourceVersionId: input.question.sourceVersionId,
      awardedMarks,
      maximumMarks: 5,
      status,
      criterionResults,
      coveredConceptIds,
      missingConceptIds,
      incorrectClaims: exactReferenceAnswer ? [] : result.value.incorrectClaims,
      unsupportedClaims: exactReferenceAnswer ? [] : result.value.unsupportedClaims,
      feedback: exactReferenceAnswer ? "The answer matches the complete source-grounded reference answer." : result.value.feedback,
      evidence: [...new Set([
        ...input.question.evidence.map((reference) => reference.segmentId),
        ...input.question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
      ])].map((segmentId) => ({ segmentId })),
      recommendedRevisionConceptIds: missingConceptIds,
      artifact: {
        provider: "gemini_api", modelId: MODEL, task: "written_evaluation", promptVersion,
        schemaVersion: "written-evaluation.v1", thinkingLevel: "high", requestId: input.requestId,
        createdAt: new Date().toISOString(), latencyMs: result.metadata.latencyMs, repaired: result.repaired || input.repair !== undefined,
      },
    };
  }
}
