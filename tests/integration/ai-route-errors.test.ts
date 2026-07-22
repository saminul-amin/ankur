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

  it.each([
    [new ProviderError("RATE_LIMITED", { status: 429 }), 429, "PROVIDER_RATE_LIMITED"],
    [new ProviderError("UNAVAILABLE", { status: 503 }), 503, "PROVIDER_UNAVAILABLE"],
    [new ProviderError("INVALID_OUTPUT", { cause: new Error("malformed raw JSON") }), 502, "MODEL_OUTPUT_INVALID"],
  ] as const)("maps %s to a typed safe response", async (providerError, expectedStatus, expectedCode) => {
    const response = await handleAiRoute({
      request: new Request("http://localhost/api/written-evaluations", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ankur-session-id": `session-${expectedCode.toLowerCase()}` },
        body: JSON.stringify({ value: "valid" }),
      }),
      schema: z.object({ value: z.literal("valid") }),
      execute: vi.fn().mockRejectedValue(providerError),
    });
    const body = await response.text();
    expect(response.status).toBe(expectedStatus);
    expect(body).toContain(expectedCode);
    expect(body).not.toContain("malformed raw JSON");
  });

  it("enforces the configured per-session request limit", async () => {
    const execute = vi.fn().mockResolvedValue({ accepted: true });
    const responses: Response[] = [];
    for (let requestNumber = 0; requestNumber < 9; requestNumber += 1) {
      responses.push(await handleAiRoute({
        request: new Request("http://localhost/api/written-evaluations", {
          method: "POST",
          headers: { "content-type": "application/json", "x-ankur-session-id": "session-rate-limit" },
          body: JSON.stringify({ value: "valid" }),
        }),
        schema: z.object({ value: z.literal("valid") }),
        execute,
      }));
    }
    expect(responses.slice(0, 8).every((response) => response.status === 200)).toBe(true);
    expect(responses[8]?.status).toBe(429);
    expect(await responses[8]?.json()).toMatchObject({ error: { code: "RATE_LIMITED" } });
    expect(execute).toHaveBeenCalledTimes(8);
  });

  it("does not log or return raw student, source, provider, or key material", async () => {
    const rawAnswer = "private student answer";
    const rawSource = "private confirmed source";
    const rawProviderBody = "private provider response";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const response = await handleAiRoute({
      request: new Request("http://localhost/api/written-evaluations", {
        method: "POST",
        headers: { "content-type": "application/json", "x-ankur-session-id": "session-private-test" },
        body: JSON.stringify({ answer: rawAnswer, source: rawSource }),
      }),
      schema: z.object({ answer: z.string(), source: z.string() }),
      execute: vi.fn().mockRejectedValue(new ProviderError("UNAVAILABLE", { cause: new Error(rawProviderBody) })),
    });
    const body = await response.text();
    for (const secret of [rawAnswer, rawSource, rawProviderBody, "test-only-not-a-real-key"]) expect(body).not.toContain(secret);
    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    expect(warn).not.toHaveBeenCalled();
  });
});
