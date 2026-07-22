import { z } from "zod";

export const uncertainSegmentSchema = z.object({
  text: z.string().min(1).max(500),
  reason: z.string().min(1).max(240),
}).strict();

export const pageTranscriptionProviderSchema = z.object({
  pageNumber: z.number().int().min(1).max(3),
  detectedLanguage: z.enum(["bn", "en", "mixed"]),
  text: z.string().min(1).max(25_000),
  uncertainSegments: z.array(uncertainSegmentSchema).max(20),
  warnings: z.array(z.string().min(1).max(240)).max(10),
}).strict();

export const pageTranscriptionProviderJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    pageNumber: { type: "integer", minimum: 1, maximum: 3 },
    detectedLanguage: { type: "string", enum: ["bn", "en", "mixed"] },
    text: { type: "string" },
    uncertainSegments: {
      type: "array",
      maxItems: 20,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          text: { type: "string" },
          reason: { type: "string" },
        },
        required: ["text", "reason"],
      },
    },
    warnings: { type: "array", maxItems: 10, items: { type: "string" } },
  },
  required: ["pageNumber", "detectedLanguage", "text", "uncertainSegments", "warnings"],
} as const;

export type PageTranscriptionProviderOutput = z.infer<typeof pageTranscriptionProviderSchema>;
