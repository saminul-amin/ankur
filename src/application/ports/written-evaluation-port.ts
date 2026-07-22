import type { ShortWrittenQuestion } from "../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import type { EvidenceRepairContext } from "./learning-content-port";

export interface WrittenEvaluationPort {
  evaluateWrittenAnswer(input: {
    readonly source: ConfirmedSource;
    readonly question: ShortWrittenQuestion;
    readonly studentAnswer: string;
    readonly requestId: string;
    readonly repair?: EvidenceRepairContext<WrittenAnswerEvaluation>;
  }): Promise<WrittenAnswerEvaluation>;
}
