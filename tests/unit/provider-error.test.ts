import { describe, expect, it } from "vitest";

import { mapProviderError } from "../../src/shared/errors/provider-error.js";

describe("provider error mapping", () => {
  it.each([
    [{ status: 401 }, "AUTHENTICATION_FAILED", false],
    [{ status: 400, message: "API key not valid" }, "AUTHENTICATION_FAILED", false],
    [{ status: 429 }, "RATE_LIMITED", true],
    [{ status: 500 }, "UNAVAILABLE", true],
    [{ status: 503 }, "UNAVAILABLE", true],
    [{ status: 400 }, "REQUEST_REJECTED", false],
  ] as const)("maps a provider failure without exposing its body", (input, code, retryable) => {
    const secret = "sensitive-provider-body";
    const mapped = mapProviderError({ ...input, body: secret });

    expect(mapped.code).toBe(code);
    expect(mapped.retryable).toBe(retryable);
    expect(JSON.stringify(mapped.toSafeObject())).not.toContain(secret);
  });

  it("maps aborts to timeout", () => {
    const mapped = mapProviderError(new DOMException("aborted", "AbortError"));
    expect(mapped.code).toBe("TIMEOUT");
    expect(mapped.retryable).toBe(true);
  });
});
