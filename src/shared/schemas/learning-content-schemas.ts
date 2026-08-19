import { z } from "zod";

import { collapseRepeatedSegmentsDeep } from "../text/collapse-repetition";

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
  title: z.string().min(1).max(160),
  language: z.enum(["bn", "en", "mixed"]),
  domain: z.string().min(1).max(120),
  topicName: z.string().min(1).max(120),
  topicPriority: prioritySchema,
  conceptName: z.string().min(1).max(120),
  conceptDescription: z.string().min(1).max(500),
  conceptPriority: prioritySchema,
  objectiveDescription: z.string().min(1).max(300),
  evidenceIndex: z.number().int().min(1).max(24),
  warnings: z.array(z.string().max(240)).max(3),
}).strict();

export const mcqCandidateProviderSchema = z.object({
  prompt: z.string().min(1).max(500),
  explanation: z.string().min(1).max(600),
  optionA: z.string().min(1).max(240),
  optionB: z.string().min(1).max(240),
  optionC: z.string().min(1).max(240),
  optionD: z.string().min(1).max(240),
  correctOptionId: z.enum(["A", "B", "C", "D"]),
}).strict();

// These shallow transports accept only semantic wording; application code owns
// all identifiers, evidence, marks, and artifact metadata.
export const writtenQuestionCandidateProviderSchema = z.object({
  prompt: z.string().min(1).max(700),
  explanation: z.string().min(1).max(700),
  expectedLength: z.enum(["one_sentence", "short_paragraph"]),
}).strict();

export const writtenRubricCandidateProviderSchema = z.object({
  criterion1Description: z.string().min(1).max(400),
  criterion2Description: z.string().min(1).max(400),
  criterion3Description: z.string().min(1).max(400),
}).strict();

// The analysis transport applies deterministic repetition collapse before
// validation so a bounded degenerate loop cannot fail an otherwise usable
// artifact purely on its length contract. Nothing else is rewritten.
export const preparationMapProviderTransportSchema = z.preprocess(
  collapseRepeatedSegmentsDeep,
  preparationMapProviderSchema,
);

export type PreparationMapProviderOutput = z.infer<typeof preparationMapProviderSchema>;
export type McqCandidateProviderOutput = z.infer<typeof mcqCandidateProviderSchema>;
export type WrittenQuestionCandidateProviderOutput = z.infer<typeof writtenQuestionCandidateProviderSchema>;
export type WrittenRubricCandidateProviderOutput = z.infer<typeof writtenRubricCandidateProviderSchema>;

// Every bound below mirrors `preparationMapProviderSchema`. Without them the
// provider received no length contract and could run a scalar into a degenerate
// repetition loop until it exhausted the output budget.
export const preparationMapProviderJsonSchema = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string", minLength: 1, maxLength: 160 }, language: { type: "string", enum: ["bn", "en", "mixed"] }, domain: { type: "string", minLength: 1, maxLength: 120 },
    topicName: { type: "string", minLength: 1, maxLength: 120 }, topicPriority: { type: "string", enum: ["high", "medium", "low"] },
    conceptName: { type: "string", minLength: 1, maxLength: 120 }, conceptDescription: { type: "string", minLength: 1, maxLength: 500 }, conceptPriority: { type: "string", enum: ["high", "medium", "low"] },
    objectiveDescription: { type: "string", minLength: 1, maxLength: 300 }, evidenceIndex: { type: "integer", minimum: 1, maximum: 24 },
    warnings: { type: "array", maxItems: 3, items: { type: "string", minLength: 1, maxLength: 240 } },
  },
  required: ["title", "language", "domain", "topicName", "topicPriority", "conceptName", "conceptDescription", "conceptPriority", "objectiveDescription", "evidenceIndex", "warnings"],
} as const;

export function createMcqCandidateProviderJsonSchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 500 },
      explanation: { type: "string", minLength: 1, maxLength: 600 },
      optionA: { type: "string", minLength: 1, maxLength: 240 }, optionB: { type: "string", minLength: 1, maxLength: 240 },
      optionC: { type: "string", minLength: 1, maxLength: 240 }, optionD: { type: "string", minLength: 1, maxLength: 240 },
      correctOptionId: { type: "string", enum: ["A", "B", "C", "D"] },
    },
    required: ["prompt", "explanation", "optionA", "optionB", "optionC", "optionD", "correctOptionId"],
  } as const;
}

export function createWrittenQuestionCandidateProviderJsonSchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      prompt: { type: "string", minLength: 1, maxLength: 700 }, explanation: { type: "string", minLength: 1, maxLength: 700 },
      expectedLength: { type: "string", enum: ["one_sentence", "short_paragraph"] },
    },
    required: ["prompt", "explanation", "expectedLength"],
  } as const;
}

export function createWrittenRubricCandidateProviderJsonSchema() {
  return {
    type: "object", additionalProperties: false,
    properties: {
      criterion1Description: { type: "string", minLength: 1, maxLength: 400 },
      criterion2Description: { type: "string", minLength: 1, maxLength: 400 },
      criterion3Description: { type: "string", minLength: 1, maxLength: 400 },
    },
    required: ["criterion1Description", "criterion2Description", "criterion3Description"],
  } as const;
}
