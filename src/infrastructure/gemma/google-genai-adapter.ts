import { GoogleGenAI, ThinkingLevel as GoogleThinkingLevel } from "@google/genai";
import type { GenerateContentResponse, Part } from "@google/genai";

import type {
  GenerationContentPart,
  GenerationMetadata,
  GenerativeModelPort,
  ProviderHealth,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
  TextGenerationResult,
  ThinkingLevel,
} from "../../application/ports/generative-model-port";
import { ProviderError, mapProviderError } from "../../shared/errors/provider-error";
import type {
  ProviderDiagnosticObserver,
  ProviderFailureCategory,
  ProviderValidationDiagnostic,
} from "./provider-diagnostics";

interface GenAiModelsClient {
  generateContent(parameters: Parameters<GoogleGenAI["models"]["generateContent"]>[0]): Promise<GenerateContentResponse>;
}

function toGoogleThinkingLevel(level: ThinkingLevel): GoogleThinkingLevel {
  return level === "high" ? GoogleThinkingLevel.HIGH : GoogleThinkingLevel.MINIMAL;
}

function toParts(parts: readonly GenerationContentPart[]): Part[] {
  return parts.map((part): Part => {
    if (part.kind === "text") {
      return { text: part.text };
    }
    return {
      inlineData: {
        mimeType: part.mimeType,
        data: part.base64Data,
      },
    };
  });
}

function extractText(response: GenerateContentResponse): string {
  const text = response.text?.trim();
  if (!text) {
    throw new ProviderError("INVALID_OUTPUT");
  }
  return text;
}

function structuredText(response: GenerateContentResponse): string | undefined {
  const text = response.text?.trim();
  return text && text.length > 0 ? text : undefined;
}

function diagnosticCode(code: string, response: GenerateContentResponse): string {
  const finishReason = response.candidates?.[0]?.finishReason;
  return typeof finishReason === "string" && /^[A-Z_]{2,40}$/u.test(finishReason)
    ? `${code}_${finishReason}`
    : code;
}

function metadata(
  response: GenerateContentResponse,
  request: Pick<TextGenerationRequest, "modelId" | "thinkingLevel">,
  latencyMs: number,
  networkRetryCount = 0,
): GenerationMetadata {
  const promptTokenCount = response.usageMetadata?.promptTokenCount;
  const outputTokenCount = response.usageMetadata?.candidatesTokenCount;
  return {
    provider: "gemini_api",
    modelId: request.modelId,
    thinkingLevel: request.thinkingLevel,
    latencyMs,
    networkRetryCount,
    ...(promptTokenCount === undefined ? {} : { promptTokenCount }),
    ...(outputTokenCount === undefined ? {} : { outputTokenCount }),
  };
}

function repairedMetadata(
  first: { readonly response: GenerateContentResponse; readonly latencyMs: number; readonly networkRetryCount: number },
  repaired: { readonly response: GenerateContentResponse; readonly latencyMs: number; readonly networkRetryCount: number },
  request: Pick<TextGenerationRequest, "modelId" | "thinkingLevel">,
): GenerationMetadata {
  const firstPrompt = first.response.usageMetadata?.promptTokenCount;
  const repairedPrompt = repaired.response.usageMetadata?.promptTokenCount;
  const firstOutput = first.response.usageMetadata?.candidatesTokenCount;
  const repairedOutput = repaired.response.usageMetadata?.candidatesTokenCount;
  const promptTokenCount = firstPrompt === undefined && repairedPrompt === undefined
    ? undefined
    : (firstPrompt ?? 0) + (repairedPrompt ?? 0);
  const outputTokenCount = firstOutput === undefined && repairedOutput === undefined
    ? undefined
    : (firstOutput ?? 0) + (repairedOutput ?? 0);
  return {
    provider: "gemini_api",
    modelId: request.modelId,
    thinkingLevel: request.thinkingLevel,
    latencyMs: first.latencyMs + repaired.latencyMs,
    networkRetryCount: first.networkRetryCount + repaired.networkRetryCount,
    ...(promptTokenCount === undefined ? {} : { promptTokenCount }),
    ...(outputTokenCount === undefined ? {} : { outputTokenCount }),
  };
}

function validationMessage(error: unknown): string {
  if (typeof error !== "object" || error === null) {
    return "Output did not satisfy the schema.";
  }
  const issues = Reflect.get(error, "issues") as unknown;
  if (!Array.isArray(issues)) {
    return "Output did not satisfy the schema.";
  }
  return issues
    .slice(0, 8)
    .map((issue) => {
      if (typeof issue !== "object" || issue === null) {
        return "invalid value";
      }
      const path = Reflect.get(issue, "path") as unknown;
      const message = Reflect.get(issue, "message") as unknown;
      return `${Array.isArray(path) ? path.join(".") : "value"}: ${String(message)}`;
    })
    .join("; ");
}

interface ValidationFailure {
  readonly category: ProviderFailureCategory;
  readonly code: string;
  readonly fieldPath: string;
  readonly expected: string;
  readonly repairMessage: string;
}

type ValidationResult<T> = { success: true; value: T } | ({ success: false } & ValidationFailure);

function safeFieldPath(issue: unknown): string {
  if (typeof issue !== "object" || issue === null) return "$";
  const path = Reflect.get(issue, "path") as unknown;
  if (!Array.isArray(path) || path.length === 0) return "$";
  return `$.${(path as unknown[]).map((part) => typeof part === "number"
    ? String(part)
    : typeof part === "string"
      ? part.replace(/[^a-zA-Z0-9_-]/gu, "_")
      : "field").join(".")}`;
}

function expectedCategory(issue: unknown): string {
  if (typeof issue !== "object" || issue === null) return "schema-valid value";
  const expected = Reflect.get(issue, "expected") as unknown;
  if (typeof expected === "string" && /^(?:string|number|boolean|object|array|record|map|set|date|bigint|int|unknown)$/u.test(expected)) {
    return expected;
  }
  const code = Reflect.get(issue, "code") as unknown;
  if (code === "invalid_value") return "allowed enum value";
  if (code === "invalid_format") return "valid identifier format";
  if (code === "too_small" || code === "too_big") return "value within configured bounds";
  return "schema-valid value";
}

function classifySchemaFailure(error: unknown): Omit<ValidationFailure, "repairMessage"> {
  if (typeof error !== "object" || error === null) {
    return { category: "transport_schema_mismatch", code: "SCHEMA_MISMATCH", fieldPath: "$", expected: "schema-valid object" };
  }
  const issues = Reflect.get(error, "issues") as unknown;
  const issue: unknown = Array.isArray(issues) ? (issues as unknown[])[0] : undefined;
  if (typeof issue !== "object" || issue === null) {
    return { category: "transport_schema_mismatch", code: "SCHEMA_MISMATCH", fieldPath: "$", expected: "schema-valid object" };
  }
  const code = Reflect.get(issue, "code") as unknown;
  const message = Reflect.get(issue, "message") as unknown;
  if (code === "invalid_type" && typeof message === "string" && /received undefined/iu.test(message)) {
    return { category: "missing_scalar", code: "MISSING_SCALAR", fieldPath: safeFieldPath(issue), expected: expectedCategory(issue) };
  }
  if (code === "invalid_value" || code === "invalid_format") {
    return { category: "invalid_enum_or_identifier", code: "INVALID_ENUM_OR_IDENTIFIER", fieldPath: safeFieldPath(issue), expected: expectedCategory(issue) };
  }
  return { category: "transport_schema_mismatch", code: "SCHEMA_MISMATCH", fieldPath: safeFieldPath(issue), expected: expectedCategory(issue) };
}

export class GoogleGenAiAdapter implements GenerativeModelPort {
  readonly #models: GenAiModelsClient;
  readonly #configuredModel: TextGenerationRequest["modelId"];

  constructor(
    apiKey: string,
    configuredModel: TextGenerationRequest["modelId"],
    models?: GenAiModelsClient,
    private readonly diagnosticObserver?: ProviderDiagnosticObserver,
  ) {
    if (apiKey.length === 0) {
      throw new ProviderError("CONFIGURATION_ERROR");
    }
    this.#configuredModel = configuredModel;
    this.#models = models ?? new GoogleGenAI({ apiKey }).models;
  }

  healthCheck(): Promise<ProviderHealth> {
    return Promise.resolve({
      configured: true,
      provider: "gemini_api",
      modelId: this.#configuredModel,
    });
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const { response, latencyMs, networkRetryCount } = await this.#call(request, false);
    return {
      text: extractText(response),
      metadata: metadata(response, request, latencyMs, networkRetryCount),
    };
  }

  async generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>> {
    const requestedModes: Array<"native" | "json_prompt"> =
      request.outputMode === "auto"
        ? ["native", "json_prompt"]
        : [request.outputMode];

    let nativeRejection: ProviderError | undefined;
    for (const mode of requestedModes) {
      try {
        return await this.#generateStructuredWithMode(request, mode);
      } catch (error) {
        const mapped = mapProviderError(error);
        if (
          mode === "native" &&
          request.outputMode === "auto" &&
          mapped.code === "REQUEST_REJECTED"
        ) {
          nativeRejection = mapped;
          continue;
        }
        throw mapped;
      }
    }

    throw nativeRejection ?? new ProviderError("INVALID_OUTPUT");
  }

  async #generateStructuredWithMode<T>(
    request: StructuredGenerationRequest<T>,
    mode: "native" | "json_prompt",
  ): Promise<StructuredGenerationResult<T>> {
    const first = await this.#call(request, mode === "native");
    const firstText = structuredText(first.response);
    const firstValidation: ValidationResult<T> = firstText === undefined
      ? {
          success: false,
          category: "empty_response",
          code: "EMPTY_RESPONSE",
          fieldPath: "$",
          expected: "non-empty JSON object",
          repairMessage: "Response was empty.",
        }
      : this.#parseAndValidate(firstText, request);
    if (firstValidation.success) {
      return {
        value: firstValidation.value,
        metadata: metadata(first.response, request, first.latencyMs, first.networkRetryCount),
        structuredOutputMode: mode,
        repaired: false,
      };
    }

    this.#recordDiagnostic(request, "first_pass", {
      ...firstValidation,
      code: diagnosticCode(firstValidation.code, first.response),
    });

    if (request.maxSchemaRepairs === 0) {
      throw new ProviderError("INVALID_OUTPUT", { cause: new Error(firstValidation.repairMessage) });
    }

    const repairFromEmptyResponse = firstText === undefined;
    const repairInstruction: GenerationContentPart = {
      kind: "text",
      text: repairFromEmptyResponse
        ? "The previous response was empty. Complete the original task now and return only one object satisfying the supplied native output schema. Do not include hidden reasoning."
        : `Repair this invalid JSON object so it satisfies the supplied native output schema. Preserve its supported semantic content, fill only required fields, and return JSON only. Do not include hidden reasoning.\n\nVALIDATION ERRORS\n${firstValidation.repairMessage}\n\nINVALID OBJECT\n${firstText}`,
    };
    const repairContents: readonly GenerationContentPart[] = repairFromEmptyResponse
      ? [...request.contents, repairInstruction]
      : [repairInstruction];
    const repaired = await this.#call({
      ...request,
      thinkingLevel: repairFromEmptyResponse ? request.thinkingLevel : "minimal",
      temperature: repairFromEmptyResponse ? request.temperature : 0,
      maxOutputTokens: repairFromEmptyResponse ? request.maxOutputTokens : Math.min(request.maxOutputTokens, 1_600),
      contents: repairContents,
    }, mode === "native");
    const repairedText = structuredText(repaired.response);
    if (repairedText === undefined) {
      const failure: ValidationFailure = {
        category: "repair_response_invalid", code: "REPAIR_RESPONSE_INVALID", fieldPath: "$", expected: "non-empty schema-valid repair response",
        repairMessage: "Repair response was empty.",
      };
      this.#recordDiagnostic(request, "repair", failure);
      throw new ProviderError("INVALID_OUTPUT");
    }
    const repairedValidation = this.#parseAndValidate(repairedText, request);
    if (!repairedValidation.success) {
      this.#recordDiagnostic(request, "repair", {
        ...repairedValidation,
        category: "repair_response_invalid",
        code: diagnosticCode("REPAIR_RESPONSE_INVALID", repaired.response),
      });
      throw new ProviderError("INVALID_OUTPUT", { cause: new Error(repairedValidation.repairMessage) });
    }

    return {
      value: repairedValidation.value,
      metadata: repairedMetadata(first, repaired, request),
      structuredOutputMode: mode,
      repaired: true,
    };
  }

  #parseAndValidate<T>(
    text: string,
    request: StructuredGenerationRequest<T>,
  ): ValidationResult<T> {
    try {
      const value: unknown = JSON.parse(text);
      const result = request.schema.safeParse(value);
      if (result.success) {
        return { success: true, value: result.data };
      }
      return {
        success: false,
        ...classifySchemaFailure(result.error),
        repairMessage: validationMessage(result.error),
      };
    } catch {
      return {
        success: false,
        category: "invalid_json",
        code: "INVALID_JSON",
        fieldPath: "$",
        expected: "valid JSON object",
        repairMessage: "Response was not valid JSON.",
      };
    }
  }

  #recordDiagnostic<T>(
    request: StructuredGenerationRequest<T>,
    phase: ProviderValidationDiagnostic["phase"],
    failure: ValidationFailure,
  ): void {
    this.diagnosticObserver?.({
      modelId: request.modelId,
      promptVersion: request.promptVersion,
      schemaVersion: request.schemaVersion,
      phase,
      category: failure.category,
      code: failure.code,
      fieldPath: failure.fieldPath,
      expected: failure.expected,
    });
  }

  async #call(
    request: TextGenerationRequest | StructuredGenerationRequest<unknown>,
    nativeStructuredOutput: boolean,
  ): Promise<{ response: GenerateContentResponse; latencyMs: number; networkRetryCount: number }> {
    const startedAt = performance.now();
    try {
      const response = await this.#callOnce(request, nativeStructuredOutput);
      return { response, latencyMs: Math.round(performance.now() - startedAt), networkRetryCount: 0 };
    } catch (error) {
      const mapped = mapProviderError(error);
      if (mapped.code !== "RATE_LIMITED" && mapped.code !== "UNAVAILABLE") throw mapped;
      await new Promise((resolve) => setTimeout(resolve, 350 + Math.floor(Math.random() * 300)));
      const response = await this.#callOnce(request, nativeStructuredOutput);
      return { response, latencyMs: Math.round(performance.now() - startedAt), networkRetryCount: 1 };
    }
  }

  async #callOnce(
    request: TextGenerationRequest | StructuredGenerationRequest<unknown>,
    nativeStructuredOutput: boolean,
  ): Promise<GenerateContentResponse> {
    const abortController = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      abortController.abort();
    }, request.timeoutMs);

    try {
      return await this.#models.generateContent({
        model: request.modelId,
        contents: [{ role: "user", parts: toParts(request.contents) }],
        config: {
          abortSignal: abortController.signal,
          temperature: request.temperature,
          maxOutputTokens: request.maxOutputTokens,
          thinkingConfig: {
            thinkingLevel: toGoogleThinkingLevel(request.thinkingLevel),
            includeThoughts: false,
          },
          ...(nativeStructuredOutput && "jsonSchema" in request
            ? {
                responseMimeType: "application/json",
                responseJsonSchema: request.jsonSchema,
              }
            : {}),
        },
      });
    } catch (error) {
      throw mapProviderError(error, timedOut);
    } finally {
      clearTimeout(timeout);
    }
  }
}
