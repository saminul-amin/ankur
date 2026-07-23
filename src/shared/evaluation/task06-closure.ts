import { z } from "zod";

import { providerOperationSchema, type ProviderOperation } from "./task06-schemas";

const yesNoSchema = z.enum(["yes", "no"]);
const acceptRejectSchema = z.enum(["accept", "reject"]);
const oneToFiveSchema = z.enum(["1", "2", "3", "4", "5"]);

export const closureQuestionEvidenceSchema = z.object({
  record_id: z.string().min(1),
  material_id: z.string().min(1),
  pipeline: z.enum(["ankur_structured", "one_prompt_baseline"]),
  question_stage: z.enum(["original_assessment", "adaptive_retry", "baseline"]),
  adj_question_grounded_in_permitted_source: yesNoSchema,
  adj_answerable_from_source: yesNoSchema,
  adj_clear: yesNoSchema,
  adj_ambiguous: yesNoSchema,
  adj_fair_difficulty: yesNoSchema,
  adj_materially_duplicate: yesNoSchema,
  adj_language_quality: oneToFiveSchema,
  adj_question_text_accept_or_reject: acceptRejectSchema,
  adj_proposed_answer_or_key_correct: yesNoSchema,
  adj_proposed_answer_or_key_grounded: yesNoSchema,
  adj_explanation_or_evidence_usefulness: oneToFiveSchema,
  adj_final_accept_or_reject: acceptRejectSchema,
  overall_accept: acceptRejectSchema,
}).loose();

export const closureWrittenEvidenceSchema = z.object({
  record_id: z.string().min(1),
  material_id: z.string().min(1),
  eligibility: z.literal("exclude_invalid_rubric"),
}).loose();

const ratioSchema = z.object({
  count: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100),
}).strict();

export const task06ClosureMetricsSchema = z.object({
  schemaVersion: z.literal("task06-closure-metrics.v1"),
  generatedAt: z.string().min(1),
  productBaseline: z.string().min(1),
  evaluationCommit: z.string().min(1),
  model: z.literal("gemma-4-26b-a4b-it"),
  humanEvidenceStatus: z.literal("complete"),
  corpus: z.object({
    materials: z.literal(6),
    questions: z.literal(60),
    ankurQuestions: z.literal(30),
    baselineQuestions: z.literal(30),
    writtenCases: z.literal(14),
    sourcePages: z.literal(9),
  }).strict(),
  questionQuality: z.object({
    pipelines: z.record(z.string(), z.unknown()),
    ankurMinusBaselinePercentagePoints: z.record(z.string(), z.number()),
    duplicateMetricCaveat: z.string().min(1),
    ankurStageBreakdown: z.record(z.string(), z.unknown()),
  }).loose(),
  written: z.object({
    total_cases: z.literal(14),
    eligibility: z.object({
      eligible: z.literal(0),
      excluded_invalid_rubric: z.literal(14),
      exclusion_percentage: z.literal(100),
      human_confirmation: z.literal("complete"),
    }).strict(),
    grading_accuracy: z.object({
      status: z.literal("not_applicable_invalid_rubric"),
      mean_absolute_error: z.null(),
      exact_agreement: z.null(),
      within_one_mark: z.null(),
      status_agreement: z.null(),
    }).strict(),
  }).loose(),
  reliability: z.object({
    provider_availability: ratioSchema,
    logical_operations: z.object({ count: z.number().int().positive() }).strict(),
    first_pass_valid: ratioSchema,
    repair_attempted: ratioSchema,
    repair_success: ratioSchema,
    final_artifact_valid: ratioSchema,
    controlled_failure: ratioSchema,
  }).loose(),
  gate: z.object({
    task06EvidenceClosure: z.literal("passed"),
    productQualityGate: z.literal("failed"),
    task07Authorization: z.literal("blocked"),
    reasons: z.array(z.string().min(1)).min(1),
  }).strict(),
}).loose();

export type ClosureQuestionEvidence = z.infer<typeof closureQuestionEvidenceSchema>;
export type ClosureWrittenEvidence = z.infer<typeof closureWrittenEvidenceSchema>;

export const closureQuestionAdjudicationFields = [
  "question_grounded_in_permitted_source",
  "answerable_from_source",
  "clear",
  "ambiguous",
  "fair_difficulty",
  "materially_duplicate",
  "language_quality",
  "question_text_accept_or_reject",
  "proposed_answer_or_key_correct",
  "proposed_answer_or_key_grounded",
  "explanation_or_evidence_usefulness",
  "final_accept_or_reject",
] as const;

export const closureWrittenAdjudicationFields = [
  "human_mark_out_of_5",
  "status",
  "covered_concepts",
  "missing_concepts",
  "incorrect_claims",
  "unsupported_claims",
  "model_feedback_grounded",
  "feedback_usefulness",
] as const;

function requiredPrivateText(
  record: Record<string, unknown>,
  key: string,
  recordId: string,
): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`CLOSURE_PRIVATE_FIELD_MISSING:${recordId}:${key}`);
  }
  return value;
}

function countAdjudicatedFields(
  records: readonly Record<string, unknown>[],
  fields: readonly string[],
): { disagreements: number; adjudicatedDisagreements: number } {
  let disagreements = 0;
  let adjudicatedDisagreements = 0;
  for (const record of records) {
    const recordId = requiredPrivateText(record, "record_id", "unknown");
    for (const field of fields) {
      const left = requiredPrivateText(record, `r1_${field}`, recordId);
      const right = requiredPrivateText(record, `r2_${field}`, recordId);
      const adjudicated = requiredPrivateText(record, `adj_${field}`, recordId);
      if (left !== right) {
        disagreements += 1;
        if (adjudicated.length > 0) adjudicatedDisagreements += 1;
      }
    }
  }
  return { disagreements, adjudicatedDisagreements };
}

export function computeAdjudicationSummary(
  questions: readonly ClosureQuestionEvidence[],
  written: readonly ClosureWrittenEvidence[],
) {
  const question = countAdjudicatedFields(
    questions,
    closureQuestionAdjudicationFields,
  );
  const writtenSummary = countAdjudicatedFields(
    written,
    closureWrittenAdjudicationFields,
  );
  return {
    questionDisagreements: question.disagreements,
    writtenDisagreements: writtenSummary.disagreements,
    totalDisagreements: question.disagreements + writtenSummary.disagreements,
    adjudicatedDisagreements:
      question.adjudicatedDisagreements +
      writtenSummary.adjudicatedDisagreements,
  };
}

function percentage(count: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((count / denominator) * 100).toFixed(2));
}

function ratio(count: number, denominator: number) {
  return { count, denominator, percentage: percentage(count, denominator) };
}

export function computeQuestionPipelineMetrics(records: readonly ClosureQuestionEvidence[]) {
  const metrics: Record<string, unknown> = {};
  for (const pipeline of ["ankur_structured", "one_prompt_baseline"] as const) {
    const rows = records.filter((item) => item.pipeline === pipeline);
    const count = (predicate: (item: ClosureQuestionEvidence) => boolean) => rows.filter(predicate).length;
    metrics[pipeline] = {
      questions: rows.length,
      source_grounded: ratio(count((item) => item.adj_question_grounded_in_permitted_source === "yes"), rows.length),
      answerable: ratio(count((item) => item.adj_answerable_from_source === "yes"), rows.length),
      clear: ratio(count((item) => item.adj_clear === "yes"), rows.length),
      ambiguous: ratio(count((item) => item.adj_ambiguous === "yes"), rows.length),
      fair_difficulty: ratio(count((item) => item.adj_fair_difficulty === "yes"), rows.length),
      within_pipeline_duplicates: ratio(count((item) => item.adj_materially_duplicate === "yes"), rows.length),
      pass_a_accepted: ratio(count((item) => item.adj_question_text_accept_or_reject === "accept"), rows.length),
      answer_or_key_correct: ratio(count((item) => item.adj_proposed_answer_or_key_correct === "yes"), rows.length),
      answer_or_key_grounded: ratio(count((item) => item.adj_proposed_answer_or_key_grounded === "yes"), rows.length),
      pass_b_accepted: ratio(count((item) => item.adj_final_accept_or_reject === "accept"), rows.length),
      overall_accepted: ratio(count((item) => item.overall_accept === "accept"), rows.length),
      grounded_overall_accepted: ratio(count((item) =>
        item.overall_accept === "accept" &&
        item.adj_question_grounded_in_permitted_source === "yes" &&
        item.adj_proposed_answer_or_key_grounded === "yes"
      ), rows.length),
      language_quality_at_least_4: ratio(
        count((item) => Number(item.adj_language_quality) >= 4),
        rows.length,
      ),
      explanation_usefulness_at_least_4: ratio(
        count((item) => Number(item.adj_explanation_or_evidence_usefulness) >= 4),
        rows.length,
      ),
      language_quality_mean: rows.length === 0 ? null : Number((rows.reduce((sum, item) => sum + Number(item.adj_language_quality), 0) / rows.length).toFixed(3)),
      explanation_usefulness_mean: rows.length === 0 ? null : Number((rows.reduce((sum, item) => sum + Number(item.adj_explanation_or_evidence_usefulness), 0) / rows.length).toFixed(3)),
    };
  }
  return metrics;
}

function isAttemptRow(operationId: string): boolean {
  return /:attempt\d+$/u.test(operationId);
}

export function computeReliabilityReclassification(input: readonly ProviderOperation[]) {
  const attempts = input.map((item) => providerOperationSchema.parse(item));
  const logical = attempts.filter((item) => !isAttemptRow(item.operationId));
  const infrastructureFailure = new Set(["RATE_LIMITED", "TIMEOUT", "UNAVAILABLE"]);
  const repairRows = logical.filter((item) => item.repairAttempted);
  return {
    provider_attempts: { count: attempts.length },
    provider_availability: ratio(
      attempts.filter((item) => item.failureCategory === null || !infrastructureFailure.has(item.failureCategory)).length,
      attempts.length,
    ),
    logical_operations: { count: logical.length },
    first_pass_valid: ratio(logical.filter((item) => item.firstPassValid).length, logical.length),
    repair_attempted: ratio(repairRows.length, logical.length),
    repair_success: ratio(repairRows.filter((item) => item.repairSuccess).length, repairRows.length),
    final_artifact_valid: ratio(logical.filter((item) => item.finalStatus === "valid").length, logical.length),
    controlled_failure: ratio(logical.filter((item) => item.finalStatus === "controlled_failure").length, logical.length),
  };
}

export function assertClosureEvidence(
  questions: readonly ClosureQuestionEvidence[],
  written: readonly ClosureWrittenEvidence[],
): void {
  if (questions.length !== 60) throw new Error("CLOSURE_QUESTION_COUNT_INVALID");
  if (questions.filter((item) => item.pipeline === "ankur_structured").length !== 30) {
    throw new Error("CLOSURE_ANKUR_QUESTION_COUNT_INVALID");
  }
  if (questions.filter((item) => item.pipeline === "one_prompt_baseline").length !== 30) {
    throw new Error("CLOSURE_BASELINE_QUESTION_COUNT_INVALID");
  }
  if (new Set(questions.map((item) => item.record_id)).size !== questions.length) {
    throw new Error("CLOSURE_DUPLICATE_QUESTION_ID");
  }
  if (written.length !== 14) {
    throw new Error("CLOSURE_WRITTEN_ELIGIBILITY_INVALID");
  }
}
