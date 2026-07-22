import { NextResponse } from "next/server";
import type { ZodType } from "zod";

import { acquireAiRequest } from "../../infrastructure/rate-limit/in-memory-ai-rate-limit";
import { readRuntimeConfig } from "../../shared/config/runtime-config";
import { ApplicationError } from "../../shared/errors/application-error";
import { ProviderError } from "../../shared/errors/provider-error";
import type { ApiErrorCode, ApiFailure, ApiSuccess } from "../../shared/schemas/api-contracts";

const SAFE_MESSAGES: Readonly<Record<ApiErrorCode, string>> = {
  VALIDATION_FAILED: "Check the submitted fields and try again.",
  SOURCE_NOT_CONFIRMED: "Confirm the source before continuing.",
  SOURCE_VERSION_MISMATCH: "The source changed. Confirm it again before continuing.",
  PAYLOAD_TOO_LARGE: "The submitted content is too large.",
  RATE_LIMITED: "Too many generation requests. Please try again later.",
  LIVE_AI_DISABLED: "Live generation is currently unavailable. Try the labelled sample flow.",
  PROVIDER_RATE_LIMITED: "The learning service is busy. Please try again later.",
  PROVIDER_TIMEOUT: "Generation took too long. Your confirmed source is still saved.",
  PROVIDER_UNAVAILABLE: "The learning service is temporarily unavailable.",
  MODEL_OUTPUT_INVALID: "Generated content did not pass validation.",
  EVIDENCE_INVALID: "Generated content could not be grounded in the confirmed source.",
  UNSUPPORTED_MEDIA: "This file type is not supported.",
  FEATURE_NOT_AVAILABLE: "This feature is not available in the current slice.",
  INTERNAL_ERROR: "An unexpected error occurred.",
};

function failure(requestId: string, code: ApiErrorCode, retryable = false, status = 400): NextResponse<ApiFailure> {
  return NextResponse.json(
    { ok: false, requestId, error: { code, message: SAFE_MESSAGES[code], retryable } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function mapError(requestId: string, error: unknown): NextResponse<ApiFailure> {
  if (error instanceof ApplicationError) {
    const code = error.code;
    const status = code === "SOURCE_VERSION_MISMATCH" ? 409
      : code === "PAYLOAD_TOO_LARGE" ? 413
        : code === "UNSUPPORTED_MEDIA" ? 415
          : 422;
    return failure(requestId, code, false, status);
  }
  if (error instanceof ProviderError) {
    if (error.code === "RATE_LIMITED") return failure(requestId, "PROVIDER_RATE_LIMITED", true, 429);
    if (error.code === "TIMEOUT") return failure(requestId, "PROVIDER_TIMEOUT", true, 504);
    if (error.code === "INVALID_OUTPUT") return failure(requestId, "MODEL_OUTPUT_INVALID", false, 502);
    if (error.code === "CONFIGURATION_ERROR") return failure(requestId, "LIVE_AI_DISABLED", false, 503);
    return failure(requestId, "PROVIDER_UNAVAILABLE", error.retryable, 503);
  }
  return failure(requestId, "INTERNAL_ERROR", false, 500);
}

export async function handleAiRoute<TInput, TOutput>(input: {
  readonly request: Request;
  readonly schema: ZodType<TInput>;
  readonly execute: (data: TInput, requestId: string) => Promise<TOutput>;
  readonly maxBodyBytes?: number;
}): Promise<NextResponse<ApiSuccess<TOutput> | ApiFailure>> {
  const requestId = crypto.randomUUID();
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    return failure(requestId, "LIVE_AI_DISABLED", false, 503);
  }
  const sessionId = input.request.headers.get("x-ankur-session-id");
  if (sessionId === null || !/^[a-zA-Z0-9_-]{8,100}$/.test(sessionId)) {
    return failure(requestId, "VALIDATION_FAILED", false, 400);
  }
  const maxBodyBytes = input.maxBodyBytes ?? 300_000;
  const contentLength = Number(input.request.headers.get("content-length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    return failure(requestId, "PAYLOAD_TOO_LARGE", false, 413);
  }
  const rate = acquireAiRequest({
    sessionId,
    ip: input.request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local",
  });
  if (!rate.ok) {
    return failure(requestId, "RATE_LIMITED", true, 429);
  }

  try {
    const rawBody = await input.request.text();
    if (new TextEncoder().encode(rawBody).byteLength > maxBodyBytes) {
      return failure(requestId, "PAYLOAD_TOO_LARGE", false, 413);
    }
    let body: unknown;
    try {
      body = JSON.parse(rawBody) as unknown;
    } catch {
      return failure(requestId, "VALIDATION_FAILED", false, 400);
    }
    const parsed = input.schema.safeParse(body);
    if (!parsed.success) {
      return failure(requestId, "VALIDATION_FAILED", false, 400);
    }
    const data = await input.execute(parsed.data, requestId);
    return NextResponse.json(
      { ok: true, requestId, data },
      { status: 200, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return mapError(requestId, error);
  } finally {
    rate.release();
  }
}
