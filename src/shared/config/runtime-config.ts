import { z } from "zod";

const runtimeEnvironmentSchema = z
  .object({
    GEMINI_API_KEY: z.string().min(1).optional(),
    ANKUR_LIVE_AI_ENABLED: z.enum(["true", "false"]).default("false"),
    ANKUR_SAMPLE_MODE_ENABLED: z.enum(["true", "false"]).default("true"),
    GEMMA_PRIMARY_MODEL: z.literal("gemma-4-26b-a4b-it").default("gemma-4-26b-a4b-it"),
    GEMMA_NATIVE_STRUCTURED_OUTPUT: z.enum(["native", "auto"]).default("native"),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(90_000),
  })
  .loose();

export interface RuntimeConfig {
  readonly apiKey?: string;
  readonly liveAiEnabled: boolean;
  readonly sampleModeEnabled: boolean;
  readonly primaryModel: "gemma-4-26b-a4b-it";
  readonly requestTimeoutMs: number;
}

export function readRuntimeConfig(environment: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const result = runtimeEnvironmentSchema.safeParse(environment);
  if (!result.success) {
    return {
      liveAiEnabled: false,
      sampleModeEnabled: true,
      primaryModel: "gemma-4-26b-a4b-it",
      requestTimeoutMs: 90_000,
    };
  }
  return {
    ...(result.data.GEMINI_API_KEY === undefined ? {} : { apiKey: result.data.GEMINI_API_KEY }),
    liveAiEnabled: result.data.ANKUR_LIVE_AI_ENABLED === "true",
    sampleModeEnabled: result.data.ANKUR_SAMPLE_MODE_ENABLED === "true",
    primaryModel: result.data.GEMMA_PRIMARY_MODEL,
    requestTimeoutMs: result.data.AI_REQUEST_TIMEOUT_MS,
  };
}
