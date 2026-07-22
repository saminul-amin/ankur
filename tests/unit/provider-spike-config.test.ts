import { describe, expect, it } from "vitest";

import { readProviderSpikeConfig } from "../../src/infrastructure/gemma/server-config.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";

describe("provider spike configuration", () => {
  it("requires explicit opt-in", () => {
    const secret = "test-secret-that-must-not-leak";
    let captured: unknown;
    try {
      readProviderSpikeConfig({ GEMINI_API_KEY: secret });
    } catch (error) {
      captured = error;
    }

    expect(captured).toBeInstanceOf(ProviderError);
    expect(JSON.stringify(captured)).not.toContain(secret);
    expect((captured as ProviderError).code).toBe("CONFIGURATION_ERROR");
  });

  it("returns only approved model configuration", () => {
    const config = readProviderSpikeConfig({
      GEMINI_API_KEY: "server-only-test-key",
      ANKUR_PROVIDER_SPIKE_OPT_IN: "true",
      GEMMA_PRIMARY_MODEL: "gemma-4-26b-a4b-it",
      GEMMA_ESCALATION_MODEL: "gemma-4-31b-it",
      GEMMA_NATIVE_STRUCTURED_OUTPUT: "auto",
      AI_REQUEST_TIMEOUT_MS: "5000",
    });

    expect(config.primaryModel).toBe("gemma-4-26b-a4b-it");
    expect(config.structuredOutputMode).toBe("auto");
    expect(config.requestTimeoutMs).toBe(5000);
    expect(config.compare31B).toBe(false);
  });
});
