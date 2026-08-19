import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config";
import { ProviderError } from "../../src/shared/errors/provider-error";

const MODEL = "gemma-4-26b-a4b-it" as const;
const REQUEST_COUNT = 3;
const DELAY_MS = 2_000;
const EXPECTED_FIXED_PLAN_PROVIDER_ATTEMPTS = 100;

type SafeFailure =
  | "authentication_failure"
  | "rate_limit_or_quota"
  | "timeout"
  | "provider_unavailable"
  | "request_rejected"
  | "malformed_response"
  | "configuration_error"
  | "unknown_controlled_failure";

interface SafeAttempt {
  readonly ordinal: number;
  readonly succeeded: boolean;
  readonly latencyMs: number;
  readonly finishReason: string | null;
  readonly promptTokens: number | null;
  readonly outputTokens: number | null;
  readonly failure: SafeFailure | null;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

function safeFailure(error: unknown): SafeFailure {
  if (!(error instanceof ProviderError)) return "unknown_controlled_failure";
  if (error.code === "AUTHENTICATION_FAILED") return "authentication_failure";
  if (error.code === "RATE_LIMITED") return "rate_limit_or_quota";
  if (error.code === "TIMEOUT") return "timeout";
  if (error.code === "UNAVAILABLE") return "provider_unavailable";
  if (error.code === "REQUEST_REJECTED") return "request_rejected";
  if (error.code === "INVALID_OUTPUT") return "malformed_response";
  return "configuration_error";
}

async function main(): Promise<void> {
  if (process.env["ANKUR_TASK06C_R2G_PREFLIGHT_OPT_IN"] !== "true") {
    throw new Error("TASK06C_R2G_PREFLIGHT_OPT_IN_REQUIRED");
  }
  const config = readRuntimeConfig();
  if (config.apiKey === undefined) throw new Error("GEMINI_API_KEY_MISSING");
  const provider = new GoogleGenAiAdapter(config.apiKey, MODEL);
  const attempts: SafeAttempt[] = [];
  for (let ordinal = 1; ordinal <= REQUEST_COUNT; ordinal += 1) {
    const startedAt = performance.now();
    try {
      const result = await provider.generateText({
        task: "text_generation",
        modelId: MODEL,
        promptVersion: "task06c-r2g-provider-preflight.v1",
        thinkingLevel: "minimal",
        temperature: 0,
        maxOutputTokens: 16,
        timeoutMs: 30_000,
        contents: [{
          kind: "text",
          text: "Provider availability check. Reply with exactly OK and no other text.",
        }],
      });
      if (result.text.trim() !== "OK") {
        attempts.push({
          ordinal,
          succeeded: false,
          latencyMs: Math.round(performance.now() - startedAt),
          finishReason: result.metadata.finishReason ?? null,
          promptTokens: result.metadata.promptTokenCount ?? null,
          outputTokens: result.metadata.outputTokenCount ?? null,
          failure: "malformed_response",
        });
      } else {
        attempts.push({
          ordinal,
          succeeded: true,
          latencyMs: result.metadata.latencyMs,
          finishReason: result.metadata.finishReason ?? null,
          promptTokens: result.metadata.promptTokenCount ?? null,
          outputTokens: result.metadata.outputTokenCount ?? null,
          failure: null,
        });
      }
    } catch (error) {
      attempts.push({
        ordinal,
        succeeded: false,
        latencyMs: Math.round(performance.now() - startedAt),
        finishReason: null,
        promptTokens: null,
        outputTokens: null,
        failure: safeFailure(error),
      });
    }
    if (ordinal < REQUEST_COUNT) await delay(DELAY_MS);
  }

  const stable = attempts.every((attempt) => attempt.succeeded);
  const generatedAt = new Date().toISOString();
  const record = {
    schemaVersion: "task06c-r2g-provider-preflight.v1",
    generatedAt,
    modelId: MODEL,
    promptVersion: "task06c-r2g-provider-preflight.v1",
    requestCount: REQUEST_COUNT,
    boundedDelayMs: DELAY_MS,
    expectedFixedPlanProviderAttemptBudget: EXPECTED_FIXED_PLAN_PROVIDER_ATTEMPTS,
    budgetConfirmation: stable
      ? "3/3 bounded calls succeeded without quota, rate-limit, timeout, or availability errors; provider exposes no remaining-quota endpoint"
      : "not_confirmed",
    attempts,
    stable,
  };
  const directory = resolve("evaluation/task06c-r2g/preflight");
  const filename = `preflight-${generatedAt.replaceAll(":", "-")}.json`;
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, filename), `${JSON.stringify(record, null, 2)}\n`, "utf8");
  process.stdout.write(
    `Task 06C-R2G provider preflight ${stable ? "PASSED" : "FAILED"}: ${String(attempts.filter((attempt) => attempt.succeeded).length)}/3; record=${filename}\n`,
  );
  if (!stable) process.exitCode = 2;
}

void main().catch((error: unknown) => {
  const message = error instanceof Error && /^[A-Z0-9_:.-]+$/u.test(error.message)
    ? error.message
    : "TASK06C_R2G_PREFLIGHT_FAILED";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
