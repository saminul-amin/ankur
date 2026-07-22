import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { PageTranscriptionPort } from "../../application/ports/page-transcription-port";
import {
  pageTranscriptionProviderJsonSchema,
  pageTranscriptionProviderSchema,
} from "../../shared/schemas/transcription-schemas";
import { buildPageTranscriptionPrompt, PAGE_TRANSCRIPTION_PROMPT_VERSION } from "./page-transcription-prompts";

const PRIMARY_MODEL = "gemma-4-26b-a4b-it" as const;

export class GemmaPageTranscriptionAdapter implements PageTranscriptionPort {
  constructor(
    private readonly model: GenerativeModelPort,
    private readonly timeoutMs = 90_000,
  ) {}

  async transcribePage(input: Parameters<PageTranscriptionPort["transcribePage"]>[0]) {
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion: PAGE_TRANSCRIPTION_PROMPT_VERSION,
      schemaVersion: "page-transcription.v1",
      thinkingLevel: "minimal",
      temperature: 0,
      maxOutputTokens: 4_000,
      timeoutMs: this.timeoutMs,
      contents: [
        { kind: "text", text: buildPageTranscriptionPrompt(input) },
        { kind: "inline_image", mimeType: input.mimeType, base64Data: input.imageBase64 },
      ],
      outputMode: "native",
      jsonSchema: pageTranscriptionProviderJsonSchema,
      schema: pageTranscriptionProviderSchema,
      maxSchemaRepairs: 1,
    });
    return {
      ...result.value,
      artifact: {
        provider: "gemini_api" as const,
        modelId: PRIMARY_MODEL,
        task: "page_transcription" as const,
        promptVersion: PAGE_TRANSCRIPTION_PROMPT_VERSION,
        schemaVersion: "page-transcription.v1",
        thinkingLevel: "minimal" as const,
        requestId: input.requestId,
        createdAt: new Date().toISOString(),
        latencyMs: result.metadata.latencyMs,
        repaired: result.repaired,
      },
    };
  }
}
