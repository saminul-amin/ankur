import { z } from "zod";

// Provider-independent, versioned runtime contracts shared by API and infrastructure adapters.

const evidenceSchema = z
  .object({
    segmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
    quote: z.string().min(1).max(600).optional(),
  })
  .strict();

const prioritySchema = z.enum(["high", "medium", "low"]);

export const preparationMapModelSchema = z
  .object({
    schemaVersion: z.literal("preparation-map.v1"),
    sourceVersionId: z.string().min(1),
    title: z.string().min(1).max(160),
    language: z.enum(["bn", "en", "mixed"]),
    domain: z.string().min(1).max(120),
    topics: z
      .array(
        z
          .object({
            id: z.string().regex(/^topic-[a-z0-9-]+$/),
            name: z.string().min(1).max(120),
            priority: prioritySchema,
            evidence: z.array(evidenceSchema).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(4),
    concepts: z
      .array(
        z
          .object({
            id: z.string().regex(/^concept-[a-z0-9-]+$/),
            topicId: z.string().regex(/^topic-[a-z0-9-]+$/),
            name: z.string().min(1).max(120),
            description: z.string().min(1).max(500),
            priority: prioritySchema,
            evidence: z.array(evidenceSchema).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(8),
    objectives: z
      .array(
        z
          .object({
            id: z.string().regex(/^objective-[a-z0-9-]+$/),
            description: z.string().min(1).max(300),
            conceptIds: z.array(z.string().regex(/^concept-[a-z0-9-]+$/)).min(1).max(4),
            evidence: z.array(evidenceSchema).min(1).max(3),
          })
          .strict(),
      )
      .min(1)
      .max(6),
    warnings: z.array(z.string().max(240)).max(5),
  })
  .strict();

const optionSchema = z
  .object({
    id: z.enum(["A", "B", "C", "D"]),
    text: z.string().min(1).max(240),
  })
  .strict();

export const activitySetModelSchema = z
  .object({
    schemaVersion: z.literal("activity-set.v1"),
    sourceVersionId: z.string().min(1),
    title: z.string().min(1).max(160),
    question: z
      .object({
        id: z.literal("question-001"),
        type: z.literal("single_mcq"),
        prompt: z.string().min(1).max(500),
        conceptIds: z.array(z.string().regex(/^concept-[a-z0-9-]+$/)).min(1).max(3),
        difficulty: z.enum(["easy", "medium", "hard"]),
        marks: z.literal(1),
        explanation: z.string().min(1).max(600),
        options: z.tuple([optionSchema, optionSchema, optionSchema, optionSchema]),
        correctOptionId: z.enum(["A", "B", "C", "D"]),
        evidence: z.array(evidenceSchema).min(1).max(3),
      })
      .strict(),
    warnings: z.array(z.string().max(240)).max(5),
  })
  .strict();

export type PreparationMapModelOutput = z.infer<typeof preparationMapModelSchema>;
export type ActivitySetModelOutput = z.infer<typeof activitySetModelSchema>;

export const preparationMapProviderSchema = z
  .object({
    schemaVersion: z.literal("preparation-map.v1"),
    sourceVersionId: z.string().min(1),
    title: z.string().min(1).max(160),
    language: z.enum(["bn", "en", "mixed"]),
    domain: z.string().min(1).max(120),
    topicId: z.string().regex(/^topic-[a-z0-9-]+$/),
    topicName: z.string().min(1).max(120),
    topicPriority: prioritySchema,
    conceptId: z.string().regex(/^concept-[a-z0-9-]+$/),
    conceptName: z.string().min(1).max(120),
    conceptDescription: z.string().min(1).max(500),
    conceptPriority: prioritySchema,
    objectiveId: z.string().regex(/^objective-[a-z0-9-]+$/),
    objectiveDescription: z.string().min(1).max(300),
    evidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
    evidenceQuote: z.string().min(1).max(600),
    warnings: z.array(z.string().max(240)).max(3),
  })
  .strict();

export const activitySetProviderSchema = z
  .object({
    schemaVersion: z.literal("activity-set.v1"),
    sourceVersionId: z.string().min(1),
    title: z.string().min(1).max(160),
    prompt: z.string().min(1).max(500),
    conceptId: z.string().regex(/^concept-[a-z0-9-]+$/),
    difficulty: z.enum(["easy", "medium", "hard"]),
    explanation: z.string().min(1).max(600),
    optionA: z.string().min(1).max(240),
    optionB: z.string().min(1).max(240),
    optionC: z.string().min(1).max(240),
    optionD: z.string().min(1).max(240),
    correctOptionId: z.enum(["A", "B", "C", "D"]),
    evidenceSegmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
    evidenceQuote: z.string().min(1).max(600),
    warnings: z.array(z.string().max(240)).max(3),
  })
  .strict();

export type PreparationMapProviderOutput = z.infer<typeof preparationMapProviderSchema>;
export type ActivitySetProviderOutput = z.infer<typeof activitySetProviderSchema>;

export const preparationMapProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["preparation-map.v1"] },
    sourceVersionId: { type: "string" },
    title: { type: "string" },
    language: { type: "string", enum: ["bn", "en", "mixed"] },
    domain: { type: "string" },
    topicId: { type: "string" },
    topicName: { type: "string" },
    topicPriority: { type: "string", enum: ["high", "medium", "low"] },
    conceptId: { type: "string" },
    conceptName: { type: "string" },
    conceptDescription: { type: "string" },
    conceptPriority: { type: "string", enum: ["high", "medium", "low"] },
    objectiveId: { type: "string" },
    objectiveDescription: { type: "string" },
    evidenceSegmentId: { type: "string" },
    evidenceQuote: { type: "string" },
    warnings: { type: "array", maxItems: 3, items: { type: "string" } },
  },
  required: [
    "schemaVersion", "sourceVersionId", "title", "language", "domain", "topicId",
    "topicName", "topicPriority", "conceptId", "conceptName", "conceptDescription",
    "conceptPriority", "objectiveId", "objectiveDescription", "evidenceSegmentId",
    "evidenceQuote", "warnings",
  ],
} as const;

export const activitySetProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["activity-set.v1"] },
    sourceVersionId: { type: "string" },
    title: { type: "string" },
    prompt: { type: "string" },
    conceptId: { type: "string" },
    difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
    explanation: { type: "string" },
    optionA: { type: "string" },
    optionB: { type: "string" },
    optionC: { type: "string" },
    optionD: { type: "string" },
    correctOptionId: { type: "string", enum: ["A", "B", "C", "D"] },
    evidenceSegmentId: { type: "string" },
    evidenceQuote: { type: "string" },
    warnings: { type: "array", maxItems: 3, items: { type: "string" } },
  },
  required: [
    "schemaVersion", "sourceVersionId", "title", "prompt", "conceptId", "difficulty",
    "explanation", "optionA", "optionB", "optionC", "optionD", "correctOptionId",
    "evidenceSegmentId", "evidenceQuote", "warnings",
  ],
} as const;

const evidenceJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    segmentId: { type: "string" },
    quote: { type: "string" },
  },
  required: ["segmentId"],
} as const;

export const preparationMapJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["preparation-map.v1"] },
    sourceVersionId: { type: "string" },
    title: { type: "string" },
    language: { type: "string", enum: ["bn", "en", "mixed"] },
    domain: { type: "string" },
    topics: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          evidence: { type: "array", minItems: 1, maxItems: 3, items: evidenceJsonSchema },
        },
        required: ["id", "name", "priority", "evidence"],
      },
    },
    concepts: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          topicId: { type: "string" },
          name: { type: "string" },
          description: { type: "string" },
          priority: { type: "string", enum: ["high", "medium", "low"] },
          evidence: { type: "array", minItems: 1, maxItems: 3, items: evidenceJsonSchema },
        },
        required: ["id", "topicId", "name", "description", "priority", "evidence"],
      },
    },
    objectives: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          conceptIds: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } },
          evidence: { type: "array", minItems: 1, maxItems: 3, items: evidenceJsonSchema },
        },
        required: ["id", "description", "conceptIds", "evidence"],
      },
    },
    warnings: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: [
    "schemaVersion",
    "sourceVersionId",
    "title",
    "language",
    "domain",
    "topics",
    "concepts",
    "objectives",
    "warnings",
  ],
} as const;

export const activitySetJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: { type: "string", enum: ["activity-set.v1"] },
    sourceVersionId: { type: "string" },
    title: { type: "string" },
    question: {
      type: "object",
      additionalProperties: false,
      properties: {
        id: { type: "string", enum: ["question-001"] },
        type: { type: "string", enum: ["single_mcq"] },
        prompt: { type: "string" },
        conceptIds: { type: "array", minItems: 1, maxItems: 3, items: { type: "string" } },
        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
        marks: { type: "integer", enum: [1] },
        explanation: { type: "string" },
        options: {
          type: "array",
          minItems: 4,
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", enum: ["A", "B", "C", "D"] },
              text: { type: "string" },
            },
            required: ["id", "text"],
          },
        },
        correctOptionId: { type: "string", enum: ["A", "B", "C", "D"] },
        evidence: { type: "array", minItems: 1, maxItems: 3, items: evidenceJsonSchema },
      },
      required: [
        "id",
        "type",
        "prompt",
        "conceptIds",
        "difficulty",
        "marks",
        "explanation",
        "options",
        "correctOptionId",
        "evidence",
      ],
    },
    warnings: { type: "array", maxItems: 5, items: { type: "string" } },
  },
  required: ["schemaVersion", "sourceVersionId", "title", "question", "warnings"],
} as const;
