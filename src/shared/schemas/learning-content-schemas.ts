import { z } from "zod";

export const evidenceSchema = z.object({
  segmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
  quote: z.string().min(1).max(600).optional(),
}).strict();

const prioritySchema = z.enum(["high", "medium", "low"]);
const conceptIdSchema = z.string().regex(/^concept-[a-z0-9-]+$/);

export const preparationMapModelSchema = z.object({
  schemaVersion: z.literal("preparation-map.v1"),
  sourceVersionId: z.string().min(1),
  title: z.string().min(1).max(160),
  language: z.enum(["bn", "en", "mixed"]),
  domain: z.string().min(1).max(120),
  topics: z.array(z.object({
    id: z.string().regex(/^topic-[a-z0-9-]+$/),
    name: z.string().min(1).max(120),
    priority: prioritySchema,
    evidence: z.array(evidenceSchema).min(1).max(3),
  }).strict()).min(1).max(4),
  concepts: z.array(z.object({
    id: conceptIdSchema,
    topicId: z.string().regex(/^topic-[a-z0-9-]+$/),
    name: z.string().min(1).max(120),
    description: z.string().min(1).max(500),
    priority: prioritySchema,
    evidence: z.array(evidenceSchema).min(1).max(3),
  }).strict()).min(1).max(8),
  objectives: z.array(z.object({
    id: z.string().regex(/^objective-[a-z0-9-]+$/),
    description: z.string().min(1).max(300),
    conceptIds: z.array(conceptIdSchema).min(1).max(4),
    evidence: z.array(evidenceSchema).min(1).max(3),
  }).strict()).min(1).max(6),
  warnings: z.array(z.string().max(240)).max(5),
}).strict();

export const preparationMapProviderSchema = z.object({
  schemaVersion: z.literal("preparation-map.v1"),
  sourceVersionId: z.string().min(1),
  title: z.string().min(1).max(160),
  language: z.enum(["bn", "en", "mixed"]),
  domain: z.string().min(1).max(120),
  topicId: z.string().regex(/^topic-[a-z0-9-]+$/),
  topicName: z.string().min(1).max(120),
  topicPriority: prioritySchema,
  conceptId: conceptIdSchema,
  conceptName: z.string().min(1).max(120),
  conceptDescription: z.string().min(1).max(500),
  conceptPriority: prioritySchema,
  objectiveId: z.string().regex(/^objective-[a-z0-9-]+$/),
  objectiveDescription: z.string().min(1).max(300),
  evidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
  evidenceQuote: z.string().min(1).max(600),
  warnings: z.array(z.string().max(240)).max(3),
}).strict();

export const mcqCandidateProviderSchema = z.object({
  prompt: z.string().min(1).max(500),
  conceptId: conceptIdSchema,
  explanation: z.string().min(1).max(600),
  optionA: z.string().min(1).max(240),
  optionB: z.string().min(1).max(240),
  optionC: z.string().min(1).max(240),
  optionD: z.string().min(1).max(240),
  correctOptionId: z.enum(["A", "B", "C", "D"]),
  evidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
}).strict();

// Gemma can append harmless derived fields despite an additionalProperties:false
// native schema. Zod strips them while still validating every consumed field.
export const writtenCandidateProviderSchema = z.object({
  prompt: z.string().min(1).max(700),
  explanation: z.string().min(1).max(700),
  expectedLength: z.enum(["one_sentence", "short_paragraph"]),
  referenceAnswer: z.string().min(1).max(1_200),
  criterion1Description: z.string().min(1).max(400), criterion1RequiredConceptId: conceptIdSchema, criterion1EvidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
  criterion2Description: z.string().min(1).max(400), criterion2RequiredConceptId: conceptIdSchema, criterion2EvidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
  criterion3Description: z.string().min(1).max(400), criterion3RequiredConceptId: conceptIdSchema, criterion3EvidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
});

export type PreparationMapProviderOutput = z.infer<typeof preparationMapProviderSchema>;
export type McqCandidateProviderOutput = z.infer<typeof mcqCandidateProviderSchema>;
export type WrittenCandidateProviderOutput = z.infer<typeof writtenCandidateProviderSchema>;

export const preparationMapProviderJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["preparation-map.v1"] }, sourceVersionId: { type: "string" },
    title: { type: "string" }, language: { type: "string", enum: ["bn", "en", "mixed"] }, domain: { type: "string" },
    topicId: { type: "string" }, topicName: { type: "string" }, topicPriority: { type: "string", enum: ["high", "medium", "low"] },
    conceptId: { type: "string" }, conceptName: { type: "string" }, conceptDescription: { type: "string" }, conceptPriority: { type: "string", enum: ["high", "medium", "low"] },
    objectiveId: { type: "string" }, objectiveDescription: { type: "string" }, evidenceSegmentId: { type: "string" }, evidenceQuote: { type: "string" },
    warnings: { type: "array", maxItems: 3, items: { type: "string" } },
  },
  required: ["schemaVersion", "sourceVersionId", "title", "language", "domain", "topicId", "topicName", "topicPriority", "conceptId", "conceptName", "conceptDescription", "conceptPriority", "objectiveId", "objectiveDescription", "evidenceSegmentId", "evidenceQuote", "warnings"],
} as const;

export function createMcqCandidateProviderJsonSchema(input: {
  readonly conceptIds: readonly string[];
  readonly segmentIds: readonly string[];
}) {
  return {
    type: "object", additionalProperties: false,
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 500 }, conceptId: { type: "string", enum: input.conceptIds },
      explanation: { type: "string", minLength: 1, maxLength: 600 },
      optionA: { type: "string", minLength: 1, maxLength: 240 }, optionB: { type: "string", minLength: 1, maxLength: 240 },
      optionC: { type: "string", minLength: 1, maxLength: 240 }, optionD: { type: "string", minLength: 1, maxLength: 240 },
      correctOptionId: { type: "string", enum: ["A", "B", "C", "D"] }, evidenceSegmentId: { type: "string", enum: input.segmentIds },
    },
    required: ["prompt", "conceptId", "explanation", "optionA", "optionB", "optionC", "optionD", "correctOptionId", "evidenceSegmentId"],
  } as const;
}

export function createWrittenCandidateProviderJsonSchema(input: {
  readonly conceptIds: readonly string[];
  readonly segmentIds: readonly string[];
}) {
  const conceptId = { type: "string", enum: input.conceptIds } as const;
  const segmentId = { type: "string", enum: input.segmentIds } as const;
  return {
    type: "object", additionalProperties: false,
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 700 }, explanation: { type: "string", minLength: 1, maxLength: 700 },
      expectedLength: { type: "string", enum: ["one_sentence", "short_paragraph"] }, referenceAnswer: { type: "string", minLength: 1, maxLength: 1_200 },
      criterion1Description: { type: "string", minLength: 1, maxLength: 400 }, criterion1RequiredConceptId: conceptId, criterion1EvidenceSegmentId: segmentId,
      criterion2Description: { type: "string", minLength: 1, maxLength: 400 }, criterion2RequiredConceptId: conceptId, criterion2EvidenceSegmentId: segmentId,
      criterion3Description: { type: "string", minLength: 1, maxLength: 400 }, criterion3RequiredConceptId: conceptId, criterion3EvidenceSegmentId: segmentId,
    },
    required: ["prompt", "explanation", "expectedLength", "referenceAnswer", "criterion1Description", "criterion1RequiredConceptId", "criterion1EvidenceSegmentId", "criterion2Description", "criterion2RequiredConceptId", "criterion2EvidenceSegmentId", "criterion3Description", "criterion3RequiredConceptId", "criterion3EvidenceSegmentId"],
  } as const;
}
