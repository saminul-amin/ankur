import { z } from "zod";

import { artifactFailureCodeSchema } from "../schemas/evidence-first-question-schemas";

const sha256Schema = z.string().regex(/^sha256:[a-f0-9]{64}$/u);

export const task06cMaterialSchema = z.object({
  schemaVersion: z.literal("task06c-material.v1"),
  materialId: z.string().min(1),
  cohort: z.enum(["frozen_task06", "holdout_task06c"]),
  title: z.string().min(1).max(200),
  domain: z.enum(["academic_science", "bangladesh_civics", "vocational_safety"]),
  language: z.enum(["bn", "en", "mixed"]),
  inputType: z.enum(["pasted_text", "digital_pdf", "page_image", "mixed_pdf"]),
  licence: z.literal("CC-BY-4.0"),
  provenance: z.literal("team-authored"),
  publicSafe: z.literal(true),
  sourceHash: sha256Schema,
  sourceReference: z.string().min(1),
}).strict();

export const task06cQuestionRecordSchema = z.object({
  schemaVersion: z.literal("task06c-question-record.v1"),
  recordId: z.string().min(1),
  neutralReviewId: z.string().min(1),
  operationId: z.string().min(1),
  materialId: z.string().min(1),
  pipeline: z.enum(["ankur_structured", "one_prompt_baseline"]),
  questionType: z.enum(["single_mcq", "short_written"]),
  questionHash: sha256Schema,
  canonicalAnswerHash: sha256Schema.nullable(),
  materialSourceVersionId: z.string().min(1),
  evidenceCompositeIds: z.array(z.string().min(1)),
  firstPassSchemaValid: z.boolean(),
  firstPassSemanticValid: z.boolean(),
  repairAttempted: z.boolean(),
  repairSuccess: z.boolean(),
  finalLogicalArtifactValid: z.boolean(),
  questionRubricAlignmentValid: z.boolean().nullable(),
  duplicateDecision: z.enum(["accepted", "rejected", "not_evaluated"]),
  comparedRecordId: z.string().nullable(),
  comparisonScope: z.enum([
    "within_pipeline",
    "cross_pipeline",
    "same_material",
    "same_operation",
    "revision_source",
    "retry_source",
  ]).nullable(),
  similarityScore: z.number().min(0).max(1).nullable(),
  failureCodes: z.array(artifactFailureCodeSchema),
  reviewerStatus: z.enum(["pending", "complete"]),
  acceptedByAdjudication: z.boolean().nullable(),
  answerKeyCorrectByAdjudication: z.boolean().nullable(),
  answerKeyGroundedByAdjudication: z.boolean().nullable(),
}).strict();

export const task06cWrittenRecordSchema = z.object({
  schemaVersion: z.literal("task06c-written-record.v1"),
  recordId: z.string().min(1),
  neutralReviewId: z.string().min(1),
  questionRecordId: z.string().min(1),
  materialId: z.string().min(1),
  answerCase: z.enum([
    "correct",
    "partially_correct",
    "incorrect",
    "empty",
    "unsupported_claim",
    "missing_key_concept",
  ]),
  answerHash: sha256Schema,
  providerCalled: z.boolean(),
  rubricAlignmentValid: z.boolean(),
  gradingMetricEligibility: z.enum(["eligible", "excluded_invalid_rubric"]),
  awardedMarks: z.number().min(0).max(5),
  status: z.enum(["correct", "partially_correct", "incorrect", "not_answered", "needs_review"]),
  feedbackUsefulness: z.union([z.number().int().min(1).max(5), z.literal("not_applicable")]).nullable(),
  adjudicatedMark: z.number().min(0).max(5).nullable(),
  reviewerStatus: z.enum(["pending", "complete"]),
}).strict().superRefine((record, context) => {
  if (record.answerCase === "empty") {
    if (record.providerCalled || record.awardedMarks !== 0 || record.status !== "not_answered") {
      context.addIssue({
        code: "custom",
        path: ["answerCase"],
        message: "Empty answers must use deterministic 0/5 not_answered handling.",
      });
    }
    if (record.feedbackUsefulness !== "not_applicable") {
      context.addIssue({
        code: "custom",
        path: ["feedbackUsefulness"],
        message: "Empty-answer feedback usefulness is not applicable.",
      });
    }
  }
  if (
    !record.rubricAlignmentValid &&
    record.gradingMetricEligibility !== "excluded_invalid_rubric"
  ) {
    context.addIssue({
      code: "custom",
      path: ["gradingMetricEligibility"],
      message: "Invalid rubrics cannot enter grading-accuracy metrics.",
    });
  }
});

const measuredRatioSchema = z.object({
  numerator: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100).nullable(),
  status: z.enum(["measured", "pending_human_review", "not_applicable"]),
}).strict();

export const task06cMetricsSchema = z.object({
  schemaVersion: z.literal("task06c-metrics.v1"),
  generatedAt: z.iso.datetime(),
  historicalTask06MetricsPath: z.literal("evaluation/exports/task06-closure-metrics.json"),
  materials: z.object({
    frozen: z.literal(6),
    holdout: z.number().int().min(3),
    total: z.number().int().min(9),
  }).strict(),
  logicalOperations: z.number().int().nonnegative(),
  providerAttempts: z.number().int().nonnegative(),
  answerKeyCorrectness: measuredRatioSchema,
  answerKeyGrounding: measuredRatioSchema,
  overallHumanAcceptance: measuredRatioSchema,
  ankurHumanAcceptance: measuredRatioSchema,
  baselineHumanAcceptance: measuredRatioSchema,
  questionRubricAlignment: measuredRatioSchema,
  eligibleWrittenCases: z.number().int().nonnegative(),
  writtenWithinOneMark: measuredRatioSchema,
  finalLogicalArtifactValidity: measuredRatioSchema,
  acceptedCrossMaterialEvidenceDefects: z.number().int().nonnegative(),
  invalidRubricCasesIncludedInGradingMetrics: z.number().int().nonnegative(),
  notebookRestartRunAll: z.enum(["passed", "failed", "pending"]),
  publicPrivacyScan: z.enum(["passed", "failed", "pending"]),
  humanReviewStatus: z.enum(["pending", "complete"]),
}).strict();

export const task06cGateResultSchema = z.object({
  schemaVersion: z.literal("task06c-gate-result.v1"),
  generatedAt: z.iso.datetime(),
  gates: z.array(z.object({
    gate: z.string().min(1),
    threshold: z.string().min(1),
    observed: z.string().min(1),
    status: z.enum(["passed", "failed", "pending"]),
  }).strict()).length(12),
  overallStatus: z.enum(["passed", "failed", "pending"]),
  task07Authorized: z.boolean(),
}).strict();

export type Task06cMaterial = z.infer<typeof task06cMaterialSchema>;
export type Task06cQuestionRecord = z.infer<typeof task06cQuestionRecordSchema>;
export type Task06cWrittenRecord = z.infer<typeof task06cWrittenRecordSchema>;
export type Task06cMetrics = z.infer<typeof task06cMetricsSchema>;
export type Task06cGateResult = z.infer<typeof task06cGateResultSchema>;
