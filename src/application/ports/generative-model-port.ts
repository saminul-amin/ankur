import type { ZodType } from "zod";

export const APPROVED_GEMMA_MODELS = [
  "gemma-4-26b-a4b-it",
  "gemma-4-31b-it",
] as const;

export type ApprovedGemmaModel = (typeof APPROVED_GEMMA_MODELS)[number];
export type ThinkingLevel = "minimal" | "high";
export type StructuredOutputMode = "auto" | "native" | "json_prompt";

export type GenerationContentPart =
  | { readonly kind: "text"; readonly text: string }
  | {
      readonly kind: "inline_image";
      readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
      readonly base64Data: string;
    };

export interface GenerationSettings {
  readonly modelId: ApprovedGemmaModel;
  readonly thinkingLevel: ThinkingLevel;
  readonly temperature: number;
  readonly maxOutputTokens: number;
  readonly timeoutMs: number;
}

export interface TextGenerationRequest extends GenerationSettings {
  readonly task: "text_generation" | "page_transcription";
  readonly promptVersion: string;
  readonly contents: readonly GenerationContentPart[];
}

export interface StructuredGenerationRequest<T> extends GenerationSettings {
  readonly task: "structured_generation";
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly contents: readonly GenerationContentPart[];
  readonly outputMode: StructuredOutputMode;
  readonly jsonSchema: Readonly<Record<string, unknown>>;
  readonly schema: ZodType<T>;
  readonly maxSchemaRepairs: 0 | 1;
}

export interface GenerationMetadata {
  readonly provider: "gemini_api";
  readonly modelId: ApprovedGemmaModel;
  readonly thinkingLevel: ThinkingLevel;
  readonly latencyMs: number;
  readonly promptTokenCount?: number;
  readonly outputTokenCount?: number;
}

export interface TextGenerationResult {
  readonly text: string;
  readonly metadata: GenerationMetadata;
}

export interface StructuredGenerationResult<T> {
  readonly value: T;
  readonly metadata: GenerationMetadata;
  readonly structuredOutputMode: "native" | "json_prompt";
  readonly repaired: boolean;
}

export interface ProviderHealth {
  readonly configured: boolean;
  readonly provider: "gemini_api";
  readonly modelId: ApprovedGemmaModel;
}

export interface GenerativeModelPort {
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult>;
  generateStructured<T>(
    request: StructuredGenerationRequest<T>,
  ): Promise<StructuredGenerationResult<T>>;
  healthCheck(): Promise<ProviderHealth>;
}
