import { z } from "zod";

const ratioSchema = z.object({
  count: z.number().int().nonnegative(),
  denominator: z.number().int().nonnegative(),
  percentage: z.number().min(0).max(100).nullable(),
  status: z.enum(["measured", "pending_human_review", "not_applicable"]),
}).strict();

export const evaluationMaterialSchema = z.object({
  schemaVersion: z.literal("evaluation-material.v1"),
  materialId: z.string().regex(/^(?:SCI|CIV|VOC|GOLDEN)-[A-Z]+-(?:PASTE|PDF|IMG)-\d{2}$|^GOLDEN-DEMO-01$/u),
  title: z.string().min(1).max(200),
  domain: z.enum(["academic_science", "bangladesh_civics", "vocational_safety"]),
  language: z.enum(["bn", "en", "mixed"]),
  inputType: z.enum(["pasted_text", "digital_pdf", "page_image", "mixed_pdf"]),
  pageCount: z.number().int().min(1).max(3),
  fixturePath: z.string().nullable(),
  licence: z.literal("CC-BY-4.0"),
  provenance: z.literal("team-authored"),
  sourceUrl: z.null(),
  redistributionAllowed: z.literal(true),
  publicSafe: z.literal(true),
  contentHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  learnerPriorityHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  manualVerificationStatus: z.enum(["pending", "complete"]),
  reviewerNotes: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  pages: z.array(z.object({
    pageNumber: z.number().int().min(1).max(3),
    route: z.enum(["pasted_text", "embedded_text", "page_transcription"]),
    expectedText: z.string().min(1),
    confirmedText: z.string().min(1),
    expectedTextHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
    confirmedTextHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  }).strict()).min(1).max(3),
}).strict();

export const extractionRecordSchema = z.object({
  schemaVersion: z.literal("extraction-record.v1"),
  recordId: z.string().min(1),
  materialId: z.string().min(1),
  pageNumber: z.number().int().min(1).max(3),
  expectedRoute: z.enum(["pasted_text", "embedded_text", "page_transcription"]),
  actualRoute: z.enum(["pasted_text", "embedded_text", "page_transcription", "failed", "pending"]),
  status: z.enum(["success", "failed", "pending"]),
  referenceCharacterCount: z.number().int().nonnegative(),
  candidateCharacterCount: z.number().int().nonnegative(),
  changedCharacterCount: z.number().int().nonnegative().nullable(),
  characterErrorRate: z.number().min(0).nullable(),
  uncertainSegmentCount: z.number().int().nonnegative(),
  materialCorrectionRequired: z.boolean().nullable(),
  candidateTextHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).nullable(),
  providerOperationId: z.string().nullable(),
}).strict();

export const providerOperationSchema = z.object({
  schemaVersion: z.literal("provider-operation.v1"),
  operationId: z.string().min(1),
  materialId: z.string().min(1),
  modelId: z.literal("gemma-4-26b-a4b-it"),
  operationType: z.enum(["page_transcription", "analysis", "assessment_generation", "written_grading", "revision_retry_generation", "one_prompt_baseline"]),
  promptVersion: z.string().min(1),
  providerSchemaVersion: z.string().min(1),
  thinkingLevel: z.enum(["minimal", "high"]),
  temperature: z.number().min(0).max(2),
  maxOutputTokens: z.number().int().positive(),
  timestamp: z.iso.datetime(),
  latencyMs: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative().nullable(),
  outputTokens: z.number().int().nonnegative().nullable(),
  firstPassValid: z.boolean(),
  repairAttempted: z.boolean(),
  repairSuccess: z.boolean(),
  finalStatus: z.enum(["valid", "controlled_failure", "pending"]),
  failureCategory: z.string().nullable(),
  evidenceFailureCount: z.number().int().nonnegative(),
  quoteFailureCount: z.number().int().nonnegative(),
  conceptFailureCount: z.number().int().nonnegative(),
  reconciliationFailureCount: z.number().int().nonnegative(),
  artifactHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).nullable(),
}).strict();

export const generatedQuestionRecordSchema = z.object({
  schemaVersion: z.literal("generated-question-record.v1"),
  recordId: z.string().min(1),
  operationId: z.string().min(1),
  materialId: z.string().min(1),
  language: z.enum(["bn", "en", "mixed"]),
  domain: z.enum(["academic_science", "bangladesh_civics", "vocational_safety"]),
  questionStage: z.enum(["original_assessment", "adaptive_retry"]),
  questionType: z.enum(["single_mcq", "short_written"]),
  questionOrdinal: z.number().int().positive(),
  questionHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  questionText: z.string().min(1),
  correctOptionId: z.enum(["A", "B", "C", "D"]).nullable(),
  conceptIds: z.array(z.string().min(1)).min(1),
  evidenceSegmentIds: z.array(z.string().min(1)).min(1),
  deterministicGroundingValid: z.boolean(),
  deterministicKeyValid: z.boolean(),
  duplicateOfRecordId: z.string().nullable(),
  reviewerStatus: z.enum(["pending", "complete"]),
  acceptedByAdjudication: z.boolean().nullable(),
}).strict();

export const writtenGradingRecordSchema = z.object({
  schemaVersion: z.literal("written-grading-record.v1"),
  recordId: z.string().min(1),
  operationId: z.string().nullable(),
  materialId: z.string().min(1),
  questionRecordId: z.string().min(1),
  answerCase: z.enum(["correct", "partially_correct", "incorrect", "empty", "unsupported_claim", "missing_key_concept"]),
  answerText: z.string().max(3_000),
  answerHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u),
  providerCalled: z.boolean(),
  awardedMarks: z.number().min(0).max(5).nullable(),
  status: z.enum(["correct", "partially_correct", "incorrect", "not_answered", "pending"]),
  groundingValid: z.boolean().nullable(),
  reconciliationValid: z.boolean().nullable(),
  reviewerStatus: z.enum(["pending", "complete"]),
  adjudicatedMark: z.number().min(0).max(5).nullable(),
  adjudicatedStatus: z.enum(["correct", "partially_correct", "incorrect", "not_answered"]).nullable(),
}).strict();

export const adaptiveLoopRecordSchema = z.object({
  schemaVersion: z.literal("adaptive-loop-record.v1"),
  recordId: z.string().min(1),
  materialId: z.string().min(1),
  operationId: z.string().nullable(),
  status: z.enum(["valid", "controlled_failure", "pending"]),
  failureCategory: z.string().nullable(),
  revisionMode: z.enum(["weak_area", "reinforcement", "challenge"]).nullable(),
  targetConceptIds: z.array(z.string().min(1)),
  fabricatedWeaknessCount: z.number().int().nonnegative(),
  revisionGroundingFailures: z.number().int().nonnegative(),
  retryGroundingFailures: z.number().int().nonnegative(),
  duplicateFailures: z.number().int().nonnegative(),
  originalScore: z.number().min(0).max(6).nullable(),
  retryScore: z.number().min(0).max(6).nullable(),
  scoreChange: z.number().min(-6).max(6).nullable(),
  persistenceRecoveryPassed: z.boolean().nullable(),
  statePreservationPassed: z.boolean().nullable(),
}).strict();

export const baselineRecordSchema = z.object({
  schemaVersion: z.literal("baseline-record.v1"),
  recordId: z.string().min(1),
  operationId: z.string().nullable(),
  materialId: z.string().min(1),
  requestedQuestionCount: z.number().int().positive(),
  parsedQuestionCount: z.number().int().nonnegative(),
  parseSuccess: z.boolean(),
  evidenceTransparencyCount: z.number().int().nonnegative(),
  outputHash: z.string().regex(/^sha256:[a-f0-9]{64}$/u).nullable(),
  reviewerStatus: z.enum(["pending", "complete"]),
}).strict();

export const humanQuestionAnnotationSchema = z.object({
  schemaVersion: z.literal("human-question-annotation.v1"),
  questionRecordId: z.string().min(1),
  reviewerId: z.enum(["R1", "R2", "ADJ"]),
  sourceGrounded: z.boolean().nullable(),
  correctAnswerKey: z.boolean().nullable(),
  answerableFromEvidence: z.boolean().nullable(),
  clear: z.boolean().nullable(),
  ambiguous: z.boolean().nullable(),
  fairDifficulty: z.boolean().nullable(),
  duplicate: z.boolean().nullable(),
  languageQuality: z.enum(["poor", "adequate", "good"]).nullable(),
  explanationUseful: z.boolean().nullable(),
  accept: z.boolean().nullable(),
  disagreementReason: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const humanWrittenAnnotationSchema = z.object({
  schemaVersion: z.literal("human-written-annotation.v1"),
  writtenRecordId: z.string().min(1),
  reviewerId: z.enum(["R1", "R2", "ADJ"]),
  mark: z.number().min(0).max(5).nullable(),
  status: z.enum(["correct", "partially_correct", "incorrect", "not_answered"]).nullable(),
  coveredConceptIds: z.array(z.string()),
  missingConceptIds: z.array(z.string()),
  incorrectOrUnsupportedClaims: z.array(z.string()),
  feedbackUsefulness: z.number().int().min(1).max(5).nullable(),
  disagreementReason: z.string(),
  completedAt: z.iso.datetime().nullable(),
}).strict();

export const aggregateMetricsSchema = z.object({
  schemaVersion: z.literal("aggregate-metrics.v1"),
  generatedAt: z.iso.datetime(),
  corpus: z.object({
    materials: z.number().int().nonnegative(),
    domains: z.number().int().nonnegative(),
    languages: z.number().int().nonnegative(),
    inputTypes: z.number().int().nonnegative(),
  }).strict(),
  extraction: z.object({
    pageSuccess: ratioSchema,
    routingAccuracy: ratioSchema,
    meanCharacterErrorRate: z.number().nonnegative().nullable(),
    materialCorrectionPages: ratioSchema,
  }).strict(),
  questions: z.object({
    total: z.number().int().nonnegative(),
    deterministicGrounding: ratioSchema,
    deterministicKeyValidity: ratioSchema,
    duplicates: ratioSchema,
    humanAccepted: ratioSchema,
    humanGroundedAccepted: ratioSchema,
    humanCorrectKeys: ratioSchema,
    humanAmbiguous: ratioSchema,
  }).strict(),
  written: z.object({
    total: z.number().int().nonnegative(),
    providerOperations: z.number().int().nonnegative(),
    humanReviewed: z.number().int().nonnegative(),
    meanAbsoluteError: z.number().nonnegative().nullable(),
    exactAgreement: ratioSchema,
    withinOneMark: ratioSchema,
    statusAgreement: ratioSchema,
  }).strict(),
  reliability: z.object({
    totalOperations: z.number().int().nonnegative(),
    firstPassValid: ratioSchema,
    finalValid: ratioSchema,
    repairRate: ratioSchema,
    repairSuccess: ratioSchema,
    groundingFailures: z.number().int().nonnegative(),
    quoteFailures: z.number().int().nonnegative(),
    conceptFailures: z.number().int().nonnegative(),
    reconciliationFailures: z.number().int().nonnegative(),
    medianLatencyMs: z.number().nonnegative().nullable(),
    p95LatencyMs: z.number().nonnegative().nullable(),
    maximumLatencyMs: z.number().nonnegative().nullable(),
  }).strict(),
  adaptive: z.object({
    total: z.number().int().nonnegative(),
    valid: ratioSchema,
    fabricatedWeaknesses: z.number().int().nonnegative(),
    meanObservedScoreChange: z.number().nullable(),
  }).strict(),
  baseline: z.object({
    materials: z.number().int().nonnegative(),
    parseSuccess: ratioSchema,
    evidenceTransparency: ratioSchema,
  }).strict(),
  humanReviewStatus: z.enum(["pending", "complete"]),
}).strict();

export type EvaluationMaterial = z.infer<typeof evaluationMaterialSchema>;
export type ExtractionRecord = z.infer<typeof extractionRecordSchema>;
export type ProviderOperation = z.infer<typeof providerOperationSchema>;
export type GeneratedQuestionRecord = z.infer<typeof generatedQuestionRecordSchema>;
export type WrittenGradingRecord = z.infer<typeof writtenGradingRecordSchema>;
export type AdaptiveLoopRecord = z.infer<typeof adaptiveLoopRecordSchema>;
export type BaselineRecord = z.infer<typeof baselineRecordSchema>;
export type HumanQuestionAnnotation = z.infer<typeof humanQuestionAnnotationSchema>;
export type HumanWrittenAnnotation = z.infer<typeof humanWrittenAnnotationSchema>;
export type AggregateMetrics = z.infer<typeof aggregateMetricsSchema>;
