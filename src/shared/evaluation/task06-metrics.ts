import type {
  AdaptiveLoopRecord,
  AggregateMetrics,
  BaselineRecord,
  EvaluationMaterial,
  ExtractionRecord,
  GeneratedQuestionRecord,
  HumanQuestionAnnotation,
  HumanWrittenAnnotation,
  ProviderOperation,
  WrittenGradingRecord,
} from "./task06-schemas";

function ratio(
  count: number,
  denominator: number,
  status: "measured" | "pending_human_review" | "not_applicable" = "measured",
) {
  return {
    count,
    denominator,
    percentage: denominator === 0 ? null : Number(((count / denominator) * 100).toFixed(2)),
    status: denominator === 0 && status === "measured" ? "not_applicable" as const : status,
  };
}

function percentile(values: readonly number[], percentileValue: number): number | null {
  if (values.length === 0) return null;
  const ordered = values.toSorted((left, right) => left - right);
  const index = Math.max(0, Math.ceil(percentileValue * ordered.length) - 1);
  return ordered[index] ?? null;
}

function requireUnique(label: string, values: readonly string[]): void {
  if (new Set(values).size !== values.length) throw new Error(`DUPLICATE_${label.toUpperCase()}`);
}

export interface Task06MetricInputs {
  readonly materials: readonly EvaluationMaterial[];
  readonly extraction: readonly ExtractionRecord[];
  readonly questions: readonly GeneratedQuestionRecord[];
  readonly written: readonly WrittenGradingRecord[];
  readonly adaptive: readonly AdaptiveLoopRecord[];
  readonly provider: readonly ProviderOperation[];
  readonly baseline: readonly BaselineRecord[];
  readonly questionAnnotations: readonly HumanQuestionAnnotation[];
  readonly writtenAnnotations: readonly HumanWrittenAnnotation[];
  readonly generatedAt: string;
}

export function computeTask06Metrics(input: Task06MetricInputs): AggregateMetrics {
  requireUnique("material_id", input.materials.map((item) => item.materialId));
  requireUnique("extraction_record_id", input.extraction.map((item) => item.recordId));
  requireUnique("question_record_id", input.questions.map((item) => item.recordId));
  requireUnique("written_record_id", input.written.map((item) => item.recordId));
  requireUnique("adaptive_record_id", input.adaptive.map((item) => item.recordId));
  requireUnique("provider_operation_id", input.provider.map((item) => item.operationId));
  requireUnique("baseline_record_id", input.baseline.map((item) => item.recordId));

  const measuredExtraction = input.extraction.filter((item) => item.status !== "pending");
  const successfulExtraction = measuredExtraction.filter((item) => item.status === "success");
  const measuredCer = successfulExtraction
    .map((item) => item.characterErrorRate)
    .filter((value): value is number => value !== null);
  const correctionKnown = successfulExtraction.filter((item) => item.materialCorrectionRequired !== null);

  const adjudicatedQuestions = input.questions.filter((item) => item.reviewerStatus === "complete");
  const adjudicationByQuestion = new Map(
    input.questionAnnotations
      .filter((item) => item.reviewerId === "ADJ" && item.completedAt !== null)
      .map((item) => [item.questionRecordId, item]),
  );
  const completedQuestionAnnotations = adjudicatedQuestions
    .map((item) => adjudicationByQuestion.get(item.recordId))
    .filter((item): item is HumanQuestionAnnotation => item !== undefined);

  const adjudicationByWritten = new Map(
    input.writtenAnnotations
      .filter((item) => item.reviewerId === "ADJ" && item.completedAt !== null)
      .map((item) => [item.writtenRecordId, item]),
  );
  const reviewedWritten = input.written
    .map((item) => ({ record: item, annotation: adjudicationByWritten.get(item.recordId) }))
    .filter((item): item is { record: WrittenGradingRecord; annotation: HumanWrittenAnnotation } =>
      item.annotation !== undefined && item.annotation.mark !== null && item.record.awardedMarks !== null,
    );
  const markDifferences = reviewedWritten.map((item) =>
    Math.abs((item.record.awardedMarks ?? 0) - (item.annotation.mark ?? 0)),
  );

  const completedProvider = input.provider.filter((item) => item.finalStatus !== "pending");
  const repaired = completedProvider.filter((item) => item.repairAttempted);
  const latencies = completedProvider.map((item) => item.latencyMs);
  const validAdaptive = input.adaptive.filter((item) => item.status === "valid");
  const scoreChanges = validAdaptive
    .map((item) => item.scoreChange)
    .filter((value): value is number => value !== null);
  const measuredBaseline = input.baseline.filter((item) => item.operationId !== null);
  const baselineRequested = measuredBaseline.reduce((sum, item) => sum + item.requestedQuestionCount, 0);
  const baselineTransparent = measuredBaseline.reduce((sum, item) => sum + item.evidenceTransparencyCount, 0);
  const humanStatus = completedQuestionAnnotations.length === input.questions.length &&
    reviewedWritten.length === input.written.length && input.questions.length > 0 && input.written.length > 0
    ? "complete" as const
    : "pending" as const;

  return {
    schemaVersion: "aggregate-metrics.v1",
    generatedAt: input.generatedAt,
    corpus: {
      materials: input.materials.length,
      domains: new Set(input.materials.map((item) => item.domain)).size,
      languages: new Set(input.materials.map((item) => item.language)).size,
      inputTypes: new Set(input.materials.map((item) => item.inputType)).size,
    },
    extraction: {
      pageSuccess: ratio(successfulExtraction.length, measuredExtraction.length),
      routingAccuracy: ratio(
        measuredExtraction.filter((item) => item.actualRoute === item.expectedRoute).length,
        measuredExtraction.length,
      ),
      meanCharacterErrorRate: measuredCer.length === 0
        ? null
        : Number((measuredCer.reduce((sum, value) => sum + value, 0) / measuredCer.length).toFixed(6)),
      materialCorrectionPages: ratio(
        correctionKnown.filter((item) => item.materialCorrectionRequired).length,
        correctionKnown.length,
      ),
    },
    questions: {
      total: input.questions.length,
      deterministicGrounding: ratio(input.questions.filter((item) => item.deterministicGroundingValid).length, input.questions.length),
      deterministicKeyValidity: ratio(input.questions.filter((item) => item.deterministicKeyValid).length, input.questions.length),
      duplicates: ratio(input.questions.filter((item) => item.duplicateOfRecordId !== null).length, input.questions.length),
      humanAccepted: ratio(
        completedQuestionAnnotations.filter((item) => item.accept === true).length,
        completedQuestionAnnotations.length,
        completedQuestionAnnotations.length === 0 ? "pending_human_review" : "measured",
      ),
      humanGroundedAccepted: ratio(
        completedQuestionAnnotations.filter((item) => item.sourceGrounded === true && item.accept === true).length,
        completedQuestionAnnotations.length,
        completedQuestionAnnotations.length === 0 ? "pending_human_review" : "measured",
      ),
      humanCorrectKeys: ratio(
        completedQuestionAnnotations.filter((item) => item.correctAnswerKey === true).length,
        completedQuestionAnnotations.length,
        completedQuestionAnnotations.length === 0 ? "pending_human_review" : "measured",
      ),
      humanAmbiguous: ratio(
        completedQuestionAnnotations.filter((item) => item.ambiguous === true).length,
        completedQuestionAnnotations.length,
        completedQuestionAnnotations.length === 0 ? "pending_human_review" : "measured",
      ),
    },
    written: {
      total: input.written.length,
      providerOperations: input.written.filter((item) => item.providerCalled).length,
      humanReviewed: reviewedWritten.length,
      meanAbsoluteError: markDifferences.length === 0
        ? null
        : Number((markDifferences.reduce((sum, value) => sum + value, 0) / markDifferences.length).toFixed(4)),
      exactAgreement: ratio(
        markDifferences.filter((value) => value === 0).length,
        markDifferences.length,
        markDifferences.length === 0 ? "pending_human_review" : "measured",
      ),
      withinOneMark: ratio(
        markDifferences.filter((value) => value <= 1).length,
        markDifferences.length,
        markDifferences.length === 0 ? "pending_human_review" : "measured",
      ),
      statusAgreement: ratio(
        reviewedWritten.filter((item) => item.record.status === item.annotation.status).length,
        reviewedWritten.length,
        reviewedWritten.length === 0 ? "pending_human_review" : "measured",
      ),
    },
    reliability: {
      totalOperations: completedProvider.length,
      firstPassValid: ratio(completedProvider.filter((item) => item.firstPassValid).length, completedProvider.length),
      finalValid: ratio(completedProvider.filter((item) => item.finalStatus === "valid").length, completedProvider.length),
      repairRate: ratio(repaired.length, completedProvider.length),
      repairSuccess: ratio(repaired.filter((item) => item.repairSuccess).length, repaired.length),
      groundingFailures: completedProvider.reduce((sum, item) => sum + item.evidenceFailureCount, 0),
      quoteFailures: completedProvider.reduce((sum, item) => sum + item.quoteFailureCount, 0),
      conceptFailures: completedProvider.reduce((sum, item) => sum + item.conceptFailureCount, 0),
      reconciliationFailures: completedProvider.reduce((sum, item) => sum + item.reconciliationFailureCount, 0),
      medianLatencyMs: percentile(latencies, 0.5),
      p95LatencyMs: percentile(latencies, 0.95),
      maximumLatencyMs: latencies.length === 0 ? null : Math.max(...latencies),
    },
    adaptive: {
      total: input.adaptive.length,
      valid: ratio(validAdaptive.length, input.adaptive.filter((item) => item.status !== "pending").length),
      fabricatedWeaknesses: input.adaptive.reduce((sum, item) => sum + item.fabricatedWeaknessCount, 0),
      meanObservedScoreChange: scoreChanges.length === 0
        ? null
        : Number((scoreChanges.reduce((sum, value) => sum + value, 0) / scoreChanges.length).toFixed(4)),
    },
    baseline: {
      materials: input.baseline.length,
      parseSuccess: ratio(measuredBaseline.filter((item) => item.parseSuccess).length, measuredBaseline.length),
      evidenceTransparency: ratio(baselineTransparent, baselineRequested),
    },
    humanReviewStatus: humanStatus,
  };
}
