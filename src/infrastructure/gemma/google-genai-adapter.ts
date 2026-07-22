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

export class GoogleGenAiAdapter implements GenerativeModelPort {
  readonly #models: GenAiModelsClient;
  readonly #configuredModel: TextGenerationRequest["modelId"];

  constructor(apiKey: string, configuredModel: TextGenerationRequest["modelId"], models?: GenAiModelsClient) {
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
    const firstText = extractText(first.response);
    const firstValidation = this.#parseAndValidate(firstText, request);
    if (firstValidation.success) {
      return {
        value: firstValidation.value,
        metadata: metadata(first.response, request, first.latencyMs, first.networkRetryCount),
        structuredOutputMode: mode,
        repaired: false,
      };
    }

    if (request.maxSchemaRepairs === 0) {
      throw new ProviderError("INVALID_OUTPUT", { cause: new Error(firstValidation.error) });
    }

    const repairContents: readonly GenerationContentPart[] = [
      ...request.contents,
      {
        kind: "text",
        text: `Repair this invalid JSON object so it satisfies the supplied output contract. Return JSON only.\n\nVALIDATION ERRORS\n${firstValidation.error}\n\nINVALID OBJECT\n${firstText}`,
      },
    ];
    const repaired = await this.#call({ ...request, contents: repairContents }, mode === "native");
    const repairedText = extractText(repaired.response);
    const repairedValidation = this.#parseAndValidate(repairedText, request);
    if (!repairedValidation.success) {
      throw new ProviderError("INVALID_OUTPUT", { cause: new Error(repairedValidation.error) });
    }

    return {
      value: repairedValidation.value,
      metadata: metadata(
        repaired.response,
        request,
        first.latencyMs + repaired.latencyMs,
        first.networkRetryCount + repaired.networkRetryCount,
      ),
      structuredOutputMode: mode,
      repaired: true,
    };
  }

  #parseAndValidate<T>(
    text: string,
    request: StructuredGenerationRequest<T>,
  ): { success: true; value: T } | { success: false; error: string } {
    try {
      const value: unknown = JSON.parse(text);
      const result = request.schema.safeParse(value);
      if (result.success) {
        return { success: true, value: result.data };
      }
      return { success: false, error: validationMessage(result.error) };
    } catch {
      return { success: false, error: "Response was not valid JSON." };
    }
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
