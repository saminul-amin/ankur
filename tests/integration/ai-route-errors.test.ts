import { z } from "zod";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { resetInMemoryRateLimitForTests } from "../../src/infrastructure/rate-limit/in-memory-ai-rate-limit";
import { handleAiRoute } from "../../src/presentation/api/ai-route";
import { ProviderError } from "../../src/shared/errors/provider-error";

describe("AI route safe error mapping", () => {
  beforeEach(() => {
    resetInMemoryRateLimitForTests();
    vi.stubEnv("ANKUR_LIVE_AI_ENABLED", "true");
    vi.stubEnv("GEMINI_API_KEY", "test-only-not-a-real-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("maps a provider timeout without returning its cause or provider body", async () => {
    const execute = vi.fn().mockRejectedValue(
      new ProviderError("TIMEOUT", { cause: new Error("sensitive raw provider body") }),
    );
    const response = await handleAiRoute({
      request: new Request("http://localhost/api/analyses", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ankur-session-id": "session-error-test" },
        body: JSON.stringify({ value: "valid" }),
      }),
      schema: z.object({ value: z.literal("valid") }),
      execute,
    });
    const body = await response.text();

    expect(response.status).toBe(504);
    expect(body).toContain("PROVIDER_TIMEOUT");
    expect(body).not.toContain("sensitive raw provider body");
    expect(body).not.toContain("test-only-not-a-real-key");
  });

  it("refuses execution when live AI is disabled", async () => {
    vi.stubEnv("ANKUR_LIVE_AI_ENABLED", "false");
    const execute = vi.fn();
    const response = await handleAiRoute({
      request: new Request("http://localhost/api/analyses", { method: "POST" }),
      schema: z.object({}),
      execute,
    });

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      ok: false,
      error: { code: "LIVE_AI_DISABLED" },
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
