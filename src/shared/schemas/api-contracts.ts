import { z } from "zod";

import { evidenceSchema, preparationMapModelSchema } from "./learning-content-schemas";
import { pageTranscriptionProviderSchema } from "./transcription-schemas";

export const apiErrorCodes = [
  "VALIDATION_FAILED", "SOURCE_NOT_CONFIRMED", "SOURCE_VERSION_MISMATCH", "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED", "LIVE_AI_DISABLED", "PROVIDER_RATE_LIMITED", "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE", "MODEL_OUTPUT_INVALID", "EVIDENCE_INVALID", "UNSUPPORTED_MEDIA",
  "FEATURE_NOT_AVAILABLE", "INTERNAL_ERROR",
] as const;
export type ApiErrorCode = (typeof apiErrorCodes)[number];

export const artifactSchema = z.object({
  provider: z.literal("gemini_api"), modelId: z.literal("gemma-4-26b-a4b-it"),
  task: z.enum(["page_transcription", "material_analysis", "assessment_generation", "written_evaluation"]),
  promptVersion: z.string().min(1), schemaVersion: z.string().min(1), thinkingLevel: z.enum(["minimal", "high"]),
  requestId: z.string().min(1), createdAt: z.string().min(1), latencyMs: z.number().nonnegative(), repaired: z.boolean(),
}).strict();

export const preparationMapApiSchema = preparationMapModelSchema.extend({ id: z.string().min(1), artifact: artifactSchema });
const conceptIdSchema = z.string().regex(/^concept-[a-z0-9-]+$/);
const difficultySchema = z.enum(["easy", "medium", "hard"]);
const questionBase = {
  id: z.string().min(1), prompt: z.string().min(1).max(700), conceptIds: z.array(conceptIdSchema).min(1).max(6),
  sourceVersionId: z.string().min(1), difficulty: difficultySchema, explanation: z.string().min(1).max(700),
  evidence: z.array(evidenceSchema).min(1).max(6), artifact: artifactSchema,
};
const optionSchema = z.object({ id: z.enum(["A", "B", "C", "D"]), text: z.string().min(1).max(240) }).strict();

export const singleMcqQuestionApiSchema = z.object({
  ...questionBase, type: z.literal("single_mcq"), marks: z.literal(1),
  options: z.tuple([optionSchema, optionSchema, optionSchema, optionSchema]), correctOptionId: z.enum(["A", "B", "C", "D"]),
}).strict().superRefine((value, context) => {
  const ids = value.options.map((option) => option.id);
  const normalized = value.options.map((option) => option.text.trim().toLocaleLowerCase());
  if (new Set(ids).size !== 4 || !ids.includes(value.correctOptionId)) context.addIssue({ code: "custom", path: ["options"], message: "Options must use A through D exactly once." });
  if (new Set(normalized).size !== 4) context.addIssue({ code: "custom", path: ["options"], message: "Option text must be unique." });
});

export const rubricCriterionApiSchema = z.object({
  id: z.string().regex(/^criterion-[a-z0-9-]+$/), description: z.string().min(1).max(400),
  maximumMarks: z.number().int().min(1).max(4), requiredConceptIds: z.array(conceptIdSchema).min(1).max(4),
  evidence: z.array(evidenceSchema).min(1).max(6),
}).strict();

export const shortWrittenQuestionApiSchema = z.object({
  ...questionBase, type: z.literal("short_written"), marks: z.literal(5),
  expectedLength: z.enum(["one_sentence", "short_paragraph"]), referenceAnswer: z.string().min(1).max(1_200),
  requiredConceptIds: z.array(conceptIdSchema).min(1).max(6), rubric: z.array(rubricCriterionApiSchema).min(2).max(4),
}).strict().superRefine((value, context) => {
  const required = new Set(value.requiredConceptIds);
  if (required.size !== value.requiredConceptIds.length || value.requiredConceptIds.some((id) => !value.conceptIds.includes(id))) {
    context.addIssue({ code: "custom", path: ["requiredConceptIds"], message: "Required concepts must be unique question concepts." });
  }
  if (new Set(value.rubric.map((criterion) => criterion.id)).size !== value.rubric.length || value.rubric.reduce((sum, criterion) => sum + criterion.maximumMarks, 0) !== 5) {
    context.addIssue({ code: "custom", path: ["rubric"], message: "Rubric IDs must be unique and marks must total five." });
  }
  value.rubric.forEach((criterion, index) => {
    if (new Set(criterion.requiredConceptIds).size !== criterion.requiredConceptIds.length || criterion.requiredConceptIds.some((id) => !required.has(id))) {
      context.addIssue({ code: "custom", path: ["rubric", index, "requiredConceptIds"], message: "Criterion concepts must be unique required concepts." });
    }
  });
});

export const activitySetApiSchema = z.object({
  schemaVersion: z.literal("activity-set.v2"), id: z.string().min(1), sourceVersionId: z.string().min(1), title: z.string().min(1).max(160),
  questions: z.tuple([singleMcqQuestionApiSchema, shortWrittenQuestionApiSchema]), warnings: z.array(z.string().max(240)).max(5), artifact: artifactSchema,
}).strict();

export const criterionResultApiSchema = z.object({
  criterionId: z.string().min(1), awardedMarks: z.number().min(0).max(5), maximumMarks: z.number().int().min(1).max(4),
  state: z.enum(["met", "partial", "not_met"]), reason: z.string().min(1).max(400),
}).strict();

export const writtenEvaluationApiSchema = z.object({
  schemaVersion: z.literal("written-evaluation.v1"), questionId: z.string().min(1), sourceVersionId: z.string().min(1),
  awardedMarks: z.number().min(0).max(5), maximumMarks: z.literal(5),
  status: z.enum(["correct", "partially_correct", "incorrect", "not_answered", "needs_review"]),
  criterionResults: z.array(criterionResultApiSchema).min(2).max(4), coveredConceptIds: z.array(conceptIdSchema).max(8),
  missingConceptIds: z.array(conceptIdSchema).max(8), incorrectClaims: z.array(z.string().min(1).max(500)).max(8),
  unsupportedClaims: z.array(z.string().min(1).max(500)).max(8), feedback: z.string().min(1).max(800),
  evidence: z.array(evidenceSchema).min(1).max(6), recommendedRevisionConceptIds: z.array(conceptIdSchema).max(8), artifact: artifactSchema,
}).strict();

export const segmentInputSchema = z.object({
  id: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/), pageNumber: z.number().int().min(1).max(3), text: z.string().min(1).max(25_000),
}).strict();

export const analysisRequestSchema = z.object({
  sourceVersionId: z.string().min(1), language: z.enum(["bn", "en", "mixed"]), priorityInstruction: z.string().max(1_000).optional(),
  segments: z.array(segmentInputSchema).min(1).max(100),
}).strict().superRefine((value, context) => {
  if (new Set(value.segments.map((segment) => segment.id)).size !== value.segments.length) context.addIssue({ code: "custom", path: ["segments"], message: "Segment IDs must be unique." });
  if (value.segments.reduce((total, segment) => total + segment.text.length, 0) > 25_000) context.addIssue({ code: "custom", path: ["segments"], message: "Confirmed text is too large." });
});

export const assessmentRequestSchema = z.object({
  sourceVersionId: z.string().min(1), preparationMap: preparationMapApiSchema,
  selectedConceptIds: z.array(conceptIdSchema).min(1).max(8),
  configuration: z.object({
    title: z.string().min(1).max(160), language: z.enum(["bn", "en", "mixed"]), mcqCount: z.literal(1), shortWrittenCount: z.literal(1), difficulty: difficultySchema,
  }).strict(),
  segments: z.array(segmentInputSchema).min(1).max(100),
}).strict();

export const writtenEvaluationRequestSchema = z.object({
  operationId: z.string().regex(/^[a-zA-Z0-9_-]{8,100}$/), sourceVersionId: z.string().min(1),
  question: shortWrittenQuestionApiSchema, studentAnswer: z.string().max(3_000),
  evidenceSegments: z.array(segmentInputSchema).min(1).max(20),
}).strict().superRefine((value, context) => {
  if (value.question.sourceVersionId !== value.sourceVersionId) context.addIssue({ code: "custom", path: ["sourceVersionId"], message: "Source versions must match." });
  const allowed = new Set([
    ...value.question.evidence.map((reference) => reference.segmentId),
    ...value.question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
  ]);
  const supplied = new Set(value.evidenceSegments.map((segment) => segment.id));
  if (supplied.size !== value.evidenceSegments.length || allowed.size !== supplied.size || [...allowed].some((id) => !supplied.has(id))) {
    context.addIssue({ code: "custom", path: ["evidenceSegments"], message: "Supply exactly the question evidence window." });
  }
});

export const transcriptionRequestSchema = z.object({
  sourceVersionDraftId: z.string().min(1).max(120), materialOrdinal: z.literal(1), pageNumber: z.number().int().min(1).max(3),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]), imageBase64: z.string().min(4).max(4_194_304),
  optionalRawExtraction: z.string().max(25_000).optional(), targetLanguage: z.enum(["bn", "en", "mixed"]),
}).strict();

export const transcriptionResultApiSchema = pageTranscriptionProviderSchema.extend({ artifact: artifactSchema });

export interface ApiSuccess<T> { readonly ok: true; readonly requestId: string; readonly data: T }
export interface ApiFailure {
  readonly ok: false; readonly requestId: string;
  readonly error: { readonly code: ApiErrorCode; readonly message: string; readonly retryable: boolean; readonly fieldErrors?: Readonly<Record<string, readonly string[]>> };
}
