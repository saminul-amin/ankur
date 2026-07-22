import { z } from "zod";

import {
  APPROVED_GEMMA_MODELS,
  type ApprovedGemmaModel,
  type StructuredOutputMode,
} from "../../application/ports/generative-model-port";
import { ProviderError } from "../../shared/errors/provider-error";

const environmentSchema = z
  .object({
    GEMINI_API_KEY: z.string().min(1),
    ANKUR_PROVIDER_SPIKE_OPT_IN: z.literal("true"),
    ANKUR_SPIKE_COMPARE_31B: z.enum(["true", "false"]).default("false"),
    GEMMA_PRIMARY_MODEL: z.enum(APPROVED_GEMMA_MODELS).default("gemma-4-26b-a4b-it"),
    GEMMA_ESCALATION_MODEL: z.enum(APPROVED_GEMMA_MODELS).default("gemma-4-31b-it"),
    GEMMA_NATIVE_STRUCTURED_OUTPUT: z
      .enum(["auto", "native", "json_prompt"])
      .default("auto"),
    AI_REQUEST_TIMEOUT_MS: z.coerce.number().int().min(1_000).max(180_000).default(90_000),
  })
  .loose();

export interface ProviderSpikeConfig {
  readonly apiKey: string;
  readonly primaryModel: ApprovedGemmaModel;
  readonly escalationModel: ApprovedGemmaModel;
  readonly structuredOutputMode: StructuredOutputMode;
  readonly requestTimeoutMs: number;
  readonly compare31B: boolean;
}

export function readProviderSpikeConfig(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): ProviderSpikeConfig {
  const result = environmentSchema.safeParse(environment);
  if (!result.success) {
    throw new ProviderError("CONFIGURATION_ERROR");
  }

  return {
    apiKey: result.data.GEMINI_API_KEY,
    primaryModel: result.data.GEMMA_PRIMARY_MODEL,
    escalationModel: result.data.GEMMA_ESCALATION_MODEL,
    structuredOutputMode: result.data.GEMMA_NATIVE_STRUCTURED_OUTPUT,
    requestTimeoutMs: result.data.AI_REQUEST_TIMEOUT_MS,
    compare31B: result.data.ANKUR_SPIKE_COMPARE_31B === "true",
  };
}
