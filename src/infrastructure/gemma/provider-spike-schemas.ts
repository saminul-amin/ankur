import { z } from "zod";

export const PROVIDER_SPIKE_SCHEMA_VERSION = "provider-spike.v1" as const;

export const providerSpikeStructuredSchema = z
  .object({
    schemaVersion: z.literal(PROVIDER_SPIKE_SCHEMA_VERSION),
    language: z.literal("bn"),
    summary: z.string().min(10).max(400),
    keywords: z.array(z.string().min(1).max(80)).min(2).max(5),
  })
  .strict();

export type ProviderSpikeStructuredValue = z.infer<typeof providerSpikeStructuredSchema>;

export const providerSpikeStructuredJsonSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    schemaVersion: {
      type: "string",
      enum: [PROVIDER_SPIKE_SCHEMA_VERSION],
      description: "The exact schema version.",
    },
    language: {
      type: "string",
      enum: ["bn"],
      description: "The response language.",
    },
    summary: {
      type: "string",
      description: "A concise Bengali summary of the supplied source paragraph.",
    },
    keywords: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
      description: "Two to five Bengali keywords grounded in the paragraph.",
    },
  },
  required: ["schemaVersion", "language", "summary", "keywords"],
} as const;
