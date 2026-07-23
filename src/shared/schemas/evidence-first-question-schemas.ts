import { z } from "zod";

export const EVIDENCE_FIRST_CONTRACT_VERSIONS = {
  canonicalAnswer: "canonical-answer.v2",
  singleMcq: "single-mcq-question.v2",
  shortWritten: "short-written-question.v2",
  writtenRubric: "written-rubric.v2",
  revisionQuestion: "revision-question.v2",
} as const;

export const artifactFailureCodeSchema = z.enum([
  "CANONICAL_ANSWER_EMPTY",
  "CANONICAL_ANSWER_NOT_ENTAILED",
  "CANONICAL_ANSWER_UNSUPPORTED_CLAIM",
  "CANONICAL_ANSWER_INCOMPLETE",
  "EVIDENCE_REFERENCE_INVALID",
  "EVIDENCE_CROSS_MATERIAL",
  "EVIDENCE_CROSS_SOURCE_VERSION",
  "LANG_REPEATED_TOKEN",
  "LANG_DUPLICATED_CLAUSE",
  "LANG_PLACEHOLDER_TEXT",
  "LANG_INCOMPLETE_SENTENCE",
  "LANG_MALFORMED_VERB",
  "LANG_MIXED_LANGUAGE_CORRUPTION",
  "LANG_UNSTABLE_INTERPRETATION",
  "LANG_NONSENSICAL_TOKEN",
  "LANG_TRUNCATED_SENTENCE",
  "MCQ_OPTION_COUNT_INVALID",
  "MCQ_DUPLICATE_OPTIONS",
  "MCQ_MULTIPLE_CORRECT_OPTIONS",
  "MCQ_NO_SUPPORTED_CORRECT_OPTION",
  "MCQ_KEY_CANONICAL_MISMATCH",
  "MCQ_AMBIGUOUS_STEM",
  "MCQ_CROSS_SOURCE_EVIDENCE",
  "MCQ_PLACEHOLDER_OPTION",
  "MCQ_DISTRACTOR_INVALID",
  "QUESTION_DUPLICATE",
  "QUESTION_REQUIRED_CLAIM_MISSING",
  "QUESTION_CANONICAL_ANSWER_MISMATCH",
  "QUESTION_EXPLANATION_UNGROUNDED",
  "RUBRIC_QUESTION_MISMATCH",
  "RUBRIC_MISSING_CENTRAL_CONCEPT",
  "RUBRIC_UNRELATED_CRITERION",
  "RUBRIC_EVIDENCE_SCOPE_INVALID",
  "RUBRIC_MARK_TOTAL_INVALID",
  "RUBRIC_DUPLICATE_CRITERIA",
  "RUBRIC_CANONICAL_ANSWER_MISMATCH",
  "REPAIR_LOCKED_FIELD_CHANGED",
  "REPAIR_FAILED",
]);

export type ArtifactFailureCode = z.infer<typeof artifactFailureCodeSchema>;

export const scopedEvidenceReferenceSchema = z.object({
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  segmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/u),
  quote: z.string().min(1).max(1_200).optional(),
}).strict();

export const requiredClaimSchema = z.object({
  id: z.string().regex(/^claim-[a-z0-9-]+$/u),
  text: z.string().min(1).max(1_200),
  conceptIds: z.array(z.string().min(1)).min(1).max(6),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(6),
}).strict();

export const canonicalAnswerV2Schema = z.object({
  schemaVersion: z.literal(EVIDENCE_FIRST_CONTRACT_VERSIONS.canonicalAnswer),
  id: z.string().regex(/^canonical-answer-[a-z0-9-]+$/u),
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  conceptIds: z.array(z.string().min(1)).min(1).max(6),
  canonicalAnswer: z.string().min(1).max(2_400),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(8),
  requiredClaims: z.array(requiredClaimSchema).min(1).max(6),
  language: z.enum(["bn", "en", "mixed"]),
  validationStatus: z.enum(["pending", "valid", "invalid"]),
  failureCodes: z.array(artifactFailureCodeSchema),
}).strict();

export const distractorClassificationSchema = z.enum([
  "contradicted_by_evidence",
  "unsupported_by_evidence",
  "plausible_misconception",
]);

export const mcqOptionV2Schema = z.object({
  id: z.enum(["A", "B", "C", "D"]),
  text: z.string().min(1).max(1_200),
  role: z.enum(["correct", "distractor"]),
  validationClassification: z.enum([
    "supported_by_evidence",
    "contradicted_by_evidence",
    "unsupported_by_evidence",
    "plausible_misconception",
  ]),
}).strict();

export const singleMcqQuestionV2Schema = z.object({
  schemaVersion: z.literal(EVIDENCE_FIRST_CONTRACT_VERSIONS.singleMcq),
  id: z.string().min(1).max(160),
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  prompt: z.string().min(1).max(700),
  explanation: z.string().min(1).max(900),
  canonicalAnswerId: z.string().regex(/^canonical-answer-[a-z0-9-]+$/u),
  requiredClaimIds: z.array(z.string().regex(/^claim-[a-z0-9-]+$/u)).min(1).max(6),
  conceptIds: z.array(z.string().min(1)).min(1).max(6),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(8),
  options: z.array(mcqOptionV2Schema).length(4),
  correctOptionId: z.enum(["A", "B", "C", "D"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.literal(1),
}).strict();

export const shortWrittenQuestionV2Schema = z.object({
  schemaVersion: z.literal(EVIDENCE_FIRST_CONTRACT_VERSIONS.shortWritten),
  id: z.string().min(1).max(160),
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  prompt: z.string().min(1).max(900),
  explanation: z.string().min(1).max(900),
  canonicalAnswerId: z.string().regex(/^canonical-answer-[a-z0-9-]+$/u),
  requiredClaimIds: z.array(z.string().regex(/^claim-[a-z0-9-]+$/u)).min(1).max(6),
  conceptIds: z.array(z.string().min(1)).min(1).max(6),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(8),
  expectedLength: z.enum(["one_sentence", "short_paragraph"]),
  difficulty: z.enum(["easy", "medium", "hard"]),
  marks: z.literal(5),
}).strict();

export const rubricCriterionV2Schema = z.object({
  id: z.string().min(1).max(160),
  description: z.string().min(1).max(600),
  maximumMarks: z.number().int().nonnegative().max(5),
  requiredClaimIds: z.array(z.string().regex(/^claim-[a-z0-9-]+$/u)).min(1).max(6),
  requiredConceptIds: z.array(z.string().min(1)).min(1).max(6),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(8),
}).strict();

export const writtenRubricV2Schema = z.object({
  schemaVersion: z.literal(EVIDENCE_FIRST_CONTRACT_VERSIONS.writtenRubric),
  id: z.string().min(1).max(160),
  questionId: z.string().min(1).max(160),
  canonicalAnswerId: z.string().regex(/^canonical-answer-[a-z0-9-]+$/u),
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  language: z.enum(["bn", "en", "mixed"]),
  criteria: z.array(rubricCriterionV2Schema).min(1).max(5),
  maximumMarks: z.literal(5),
}).strict();

export const revisionQuestionV2Schema = z.object({
  schemaVersion: z.literal(EVIDENCE_FIRST_CONTRACT_VERSIONS.revisionQuestion),
  id: z.string().min(1).max(160),
  originalQuestionId: z.string().min(1).max(160),
  retryMode: z.enum(["weak_area", "reinforcement", "challenge"]),
  materialId: z.string().min(1).max(120),
  sourceVersionId: z.string().min(1).max(160),
  prompt: z.string().min(1).max(900),
  canonicalAnswerId: z.string().regex(/^canonical-answer-[a-z0-9-]+$/u),
  requiredClaimIds: z.array(z.string().regex(/^claim-[a-z0-9-]+$/u)).min(1).max(6),
  requiredConceptIds: z.array(z.string().min(1)).min(1).max(6),
  evidenceReferences: z.array(scopedEvidenceReferenceSchema).min(1).max(8),
  questionType: z.enum(["single_mcq", "short_written"]),
}).strict();

export const evidenceFirstMcqProviderSchema = z.object({
  prompt: z.string().min(1).max(700),
  explanation: z.string().min(1).max(900),
  distractor1: z.string().min(1).max(1_200),
  distractor1Classification: distractorClassificationSchema,
  distractor2: z.string().min(1).max(1_200),
  distractor2Classification: distractorClassificationSchema,
  distractor3: z.string().min(1).max(1_200),
  distractor3Classification: distractorClassificationSchema,
}).strict();

export const evidenceFirstWrittenQuestionProviderSchema = z.object({
  prompt: z.string().min(1).max(900),
  explanation: z.string().min(1).max(900),
  expectedLength: z.enum(["one_sentence", "short_paragraph"]),
}).strict();

export const evidenceFirstRubricProviderSchema = z.object({
  criterion1Description: z.string().min(1).max(600),
  criterion2Description: z.string().min(1).max(600),
  criterion3Description: z.string().min(1).max(600),
}).strict();

export type ScopedEvidenceReference = z.infer<typeof scopedEvidenceReferenceSchema>;
export type RequiredClaim = z.infer<typeof requiredClaimSchema>;
export type CanonicalAnswerV2 = z.infer<typeof canonicalAnswerV2Schema>;
export type SingleMcqQuestionV2 = z.infer<typeof singleMcqQuestionV2Schema>;
export type ShortWrittenQuestionV2 = z.infer<typeof shortWrittenQuestionV2Schema>;
export type WrittenRubricV2 = z.infer<typeof writtenRubricV2Schema>;
export type RevisionQuestionV2 = z.infer<typeof revisionQuestionV2Schema>;
export type EvidenceFirstMcqProviderOutput = z.infer<typeof evidenceFirstMcqProviderSchema>;
export type EvidenceFirstWrittenQuestionProviderOutput = z.infer<typeof evidenceFirstWrittenQuestionProviderSchema>;
export type EvidenceFirstRubricProviderOutput = z.infer<typeof evidenceFirstRubricProviderSchema>;

export const evidenceFirstMcqProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: { type: "string", minLength: 1, maxLength: 700 },
    explanation: { type: "string", minLength: 1, maxLength: 900 },
    distractor1: { type: "string", minLength: 1, maxLength: 1200 },
    distractor1Classification: { type: "string", enum: distractorClassificationSchema.options },
    distractor2: { type: "string", minLength: 1, maxLength: 1200 },
    distractor2Classification: { type: "string", enum: distractorClassificationSchema.options },
    distractor3: { type: "string", minLength: 1, maxLength: 1200 },
    distractor3Classification: { type: "string", enum: distractorClassificationSchema.options },
  },
  required: [
    "prompt",
    "explanation",
    "distractor1",
    "distractor1Classification",
    "distractor2",
    "distractor2Classification",
    "distractor3",
    "distractor3Classification",
  ],
} as const;

export const evidenceFirstWrittenQuestionProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    prompt: { type: "string", minLength: 1, maxLength: 900 },
    explanation: { type: "string", minLength: 1, maxLength: 900 },
    expectedLength: { type: "string", enum: ["one_sentence", "short_paragraph"] },
  },
  required: ["prompt", "explanation", "expectedLength"],
} as const;

export const evidenceFirstRubricProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    criterion1Description: { type: "string", minLength: 1, maxLength: 600 },
    criterion2Description: { type: "string", minLength: 1, maxLength: 600 },
    criterion3Description: { type: "string", minLength: 1, maxLength: 600 },
  },
  required: ["criterion1Description", "criterion2Description", "criterion3Description"],
} as const;
