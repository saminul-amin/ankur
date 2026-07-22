import { z } from "zod";

import { activitySetModelSchema, preparationMapModelSchema } from "./learning-content-schemas";

export const apiErrorCodes = [
  "VALIDATION_FAILED",
  "SOURCE_NOT_CONFIRMED",
  "SOURCE_VERSION_MISMATCH",
  "PAYLOAD_TOO_LARGE",
  "RATE_LIMITED",
  "LIVE_AI_DISABLED",
  "PROVIDER_RATE_LIMITED",
  "PROVIDER_TIMEOUT",
  "PROVIDER_UNAVAILABLE",
  "MODEL_OUTPUT_INVALID",
  "EVIDENCE_INVALID",
  "UNSUPPORTED_MEDIA",
  "FEATURE_NOT_AVAILABLE",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof apiErrorCodes)[number];

const artifactSchema = z
  .object({
    provider: z.literal("gemini_api"),
    modelId: z.literal("gemma-4-26b-a4b-it"),
    task: z.enum(["material_analysis", "assessment_generation"]),
    promptVersion: z.string().min(1),
    schemaVersion: z.string().min(1),
    thinkingLevel: z.enum(["minimal", "high"]),
    requestId: z.string().min(1),
    createdAt: z.string().min(1),
    latencyMs: z.number().nonnegative(),
    repaired: z.boolean(),
  })
  .strict();

export const preparationMapApiSchema = preparationMapModelSchema.extend({
  id: z.string().min(1),
  artifact: artifactSchema,
});

export const activitySetApiSchema = z
  .object({
    schemaVersion: z.literal("activity-set.v1"),
    id: z.string().min(1),
    sourceVersionId: z.string().min(1),
    title: z.string().min(1),
    questions: z.tuple([activitySetModelSchema.shape.question]),
    warnings: z.array(z.string()),
    artifact: artifactSchema,
  })
  .strict();

export const segmentInputSchema = z
  .object({
    id: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/),
    pageNumber: z.number().int().min(1).max(1),
    text: z.string().min(1).max(25_000),
  })
  .strict();

export const analysisRequestSchema = z
  .object({
    sourceVersionId: z.string().min(1),
    language: z.enum(["bn", "en", "mixed"]),
    priorityInstruction: z.string().max(1_000).optional(),
    segments: z.array(segmentInputSchema).min(1).max(100),
  })
  .strict()
  .superRefine((value, context) => {
    const ids = new Set(value.segments.map((segment) => segment.id));
    if (ids.size !== value.segments.length) {
      context.addIssue({ code: "custom", path: ["segments"], message: "Segment IDs must be unique." });
    }
    const length = value.segments.reduce((total, segment) => total + segment.text.length, 0);
    if (length > 25_000) {
      context.addIssue({ code: "custom", path: ["segments"], message: "Confirmed text is too large." });
    }
  });

export const assessmentRequestSchema = z
  .object({
    sourceVersionId: z.string().min(1),
    preparationMap: preparationMapApiSchema,
    selectedConceptIds: z.array(z.string()).min(1).max(8),
    configuration: z
      .object({
        language: z.enum(["bn", "en", "mixed"]),
        mcqCount: z.literal(1),
        shortWrittenCount: z.literal(0),
        difficulty: z.enum(["easy", "medium", "hard", "mixed"]),
      })
      .strict(),
    segments: z.array(segmentInputSchema).min(1).max(100),
  })
  .strict();

export interface ApiSuccess<T> {
  readonly ok: true;
  readonly requestId: string;
  readonly data: T;
}

export interface ApiFailure {
  readonly ok: false;
  readonly requestId: string;
  readonly error: {
    readonly code: ApiErrorCode;
    readonly message: string;
    readonly retryable: boolean;
    readonly fieldErrors?: Readonly<Record<string, readonly string[]>>;
  };
}
