import {
  task06cGateResultSchema,
  type Task06cGateResult,
  type Task06cMetrics,
} from "./task06c-schemas";

function ratioGate(
  gate: string,
  threshold: string,
  ratio: {
    readonly numerator: number;
    readonly denominator: number;
    readonly percentage: number | null;
    readonly status: "measured" | "pending_human_review" | "not_applicable";
  },
  predicate: (percentage: number) => boolean,
) {
  return {
    gate,
    threshold,
    observed: ratio.percentage === null
      ? `${String(ratio.numerator)}/${String(ratio.denominator)} (pending)`
      : `${String(ratio.numerator)}/${String(ratio.denominator)} (${ratio.percentage.toFixed(2)}%)`,
    status: ratio.status !== "measured" || ratio.percentage === null
      ? "pending" as const
      : predicate(ratio.percentage)
        ? "passed" as const
        : "failed" as const,
  };
}

export function evaluateTask06cGates(
  metrics: Task06cMetrics,
): Task06cGateResult {
  const acceptanceComparisonStatus =
    metrics.ankurHumanAcceptance.status !== "measured" ||
    metrics.baselineHumanAcceptance.status !== "measured" ||
    metrics.ankurHumanAcceptance.percentage === null ||
    metrics.baselineHumanAcceptance.percentage === null
      ? "pending" as const
      : metrics.ankurHumanAcceptance.percentage >= metrics.baselineHumanAcceptance.percentage
        ? "passed" as const
        : "failed" as const;
  const gates = [
    ratioGate("answer_key_correctness", ">= 90%", metrics.answerKeyCorrectness, (value) => value >= 90),
    ratioGate("answer_key_grounding", ">= 90%", metrics.answerKeyGrounding, (value) => value >= 90),
    ratioGate("overall_human_question_acceptance", ">= 80%", metrics.overallHumanAcceptance, (value) => value >= 80),
    {
      gate: "ankur_not_below_baseline",
      threshold: "Ankur acceptance >= baseline acceptance",
      observed: `${String(metrics.ankurHumanAcceptance.percentage ?? "pending")} vs ${String(metrics.baselineHumanAcceptance.percentage ?? "pending")}`,
      status: acceptanceComparisonStatus,
    },
    ratioGate("question_rubric_alignment", ">= 90%", metrics.questionRubricAlignment, (value) => value >= 90),
    {
      gate: "eligible_written_cases",
      threshold: ">= 10",
      observed: String(metrics.eligibleWrittenCases),
      status: metrics.humanReviewStatus === "pending"
        ? "pending" as const
        : metrics.eligibleWrittenCases >= 10
          ? "passed" as const
          : "failed" as const,
    },
    ratioGate("written_within_one_mark", ">= 80%", metrics.writtenWithinOneMark, (value) => value >= 80),
    ratioGate("final_logical_artifact_validity", ">= 95%", metrics.finalLogicalArtifactValidity, (value) => value >= 95),
    {
      gate: "accepted_cross_material_evidence_defects",
      threshold: "= 0",
      observed: String(metrics.acceptedCrossMaterialEvidenceDefects),
      status: metrics.humanReviewStatus === "pending"
        ? "pending" as const
        : metrics.acceptedCrossMaterialEvidenceDefects === 0
          ? "passed" as const
          : "failed" as const,
    },
    {
      gate: "invalid_rubrics_in_grading_metrics",
      threshold: "= 0",
      observed: String(metrics.invalidRubricCasesIncludedInGradingMetrics),
      status: metrics.invalidRubricCasesIncludedInGradingMetrics === 0 ? "passed" as const : "failed" as const,
    },
    {
      gate: "notebook_restart_and_run_all",
      threshold: "passed",
      observed: metrics.notebookRestartRunAll,
      status: metrics.notebookRestartRunAll,
    },
    {
      gate: "public_privacy_scan",
      threshold: "passed",
      observed: metrics.publicPrivacyScan,
      status: metrics.publicPrivacyScan,
    },
  ];
  const overallStatus = gates.some((gate) => gate.status === "failed")
    ? "failed" as const
    : gates.some((gate) => gate.status === "pending")
      ? "pending" as const
      : "passed" as const;
  return task06cGateResultSchema.parse({
    schemaVersion: "task06c-gate-result.v1",
    generatedAt: metrics.generatedAt,
    gates,
    overallStatus,
    task07Authorized: overallStatus === "passed",
  });
}
