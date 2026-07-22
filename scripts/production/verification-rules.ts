export interface ProductionFlowReleaseChecks {
  readonly activityValidationFailures: number;
  readonly writtenValidationFailures: number;
  readonly conceptPerformanceCount: number;
  readonly groundingFailures: number;
  readonly quoteFailures: number;
  readonly conceptReferenceFailures: number;
  readonly reconciliationFailures: number;
  readonly sourceOrAnswerLoss: number;
  readonly persistedResult: boolean;
  readonly mcqCorrect: boolean;
  readonly writtenAnswerPresent: boolean;
  readonly writtenStatus: string;
  readonly awardedMarks: number;
  readonly totalsReconcile: boolean;
  readonly weakConceptCount: number;
}

export function productionFlowPasses(input: ProductionFlowReleaseChecks): boolean {
  // weakConceptCount remains reportable diagnostics; deterministic mastery is
  // valid even when the written component is non-perfect.
  return input.activityValidationFailures === 0
    && input.writtenValidationFailures === 0
    && input.conceptPerformanceCount > 0
    && input.groundingFailures === 0
    && input.quoteFailures === 0
    && input.conceptReferenceFailures === 0
    && input.reconciliationFailures === 0
    && input.sourceOrAnswerLoss === 0
    && input.persistedResult
    && input.mcqCorrect
    && input.writtenAnswerPresent
    && input.writtenStatus === "partially_correct"
    && input.awardedMarks > 0
    && input.awardedMarks < 5
    && input.totalsReconcile;
}
