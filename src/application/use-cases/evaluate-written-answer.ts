import type { ShortWrittenQuestion } from "../../domain/assessments/mcq";
import {
  createEmptyWrittenEvaluation,
  validateWrittenEvaluation,
  type WrittenAnswerEvaluation,
} from "../../domain/assessments/written-evaluation";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import { ApplicationError } from "../../shared/errors/application-error";
import type { WrittenEvaluationPort } from "../ports/written-evaluation-port";

function failuresOf(
  source: ConfirmedSource,
  question: ShortWrittenQuestion,
  evaluation: WrittenAnswerEvaluation,
): string[] {
  return validateWrittenEvaluation(source, question, evaluation)
    .map((failure) => `${failure.path}: ${failure.reason}`);
}

export class EvaluateWrittenAnswer {
  constructor(private readonly evaluator: WrittenEvaluationPort) {}

  async execute(input: {
    readonly source: ConfirmedSource;
    readonly question: ShortWrittenQuestion;
    readonly studentAnswer: string;
    readonly requestId: string;
  }): Promise<WrittenAnswerEvaluation> {
    if (input.question.sourceVersionId !== input.source.sourceVersionId) {
      throw new ApplicationError("SOURCE_VERSION_MISMATCH");
    }
    if (input.studentAnswer.length > 3_000) throw new ApplicationError("PAYLOAD_TOO_LARGE");
    if (input.studentAnswer.trim().length === 0) {
      return createEmptyWrittenEvaluation({ question: input.question, requestId: input.requestId });
    }

    const allowedIds = new Set([
      ...input.question.evidence.map((reference) => reference.segmentId),
      ...input.question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
    ]);
    const suppliedIds = new Set(input.source.segments.map((segment) => segment.id));
    if (allowedIds.size !== suppliedIds.size || [...allowedIds].some((id) => !suppliedIds.has(id))) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }

    const first = await this.evaluator.evaluateWrittenAnswer(input);
    const firstFailures = failuresOf(input.source, input.question, first);
    if (firstFailures.length === 0) return first;

    const repaired = await this.evaluator.evaluateWrittenAnswer({
      ...input,
      repair: { invalidArtifact: first, validationErrors: firstFailures },
    });
    if (failuresOf(input.source, input.question, repaired).length > 0) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }
    return repaired;
  }
}
