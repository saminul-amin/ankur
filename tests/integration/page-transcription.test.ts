import { describe, expect, it, vi } from "vitest";

import type { GenerativeModelPort, StructuredGenerationResult } from "../../src/application/ports/generative-model-port.js";
import type { PageTranscriptionPort } from "../../src/application/ports/page-transcription-port.js";
import { TranscribePage } from "../../src/application/use-cases/transcribe-page.js";
import { GemmaPageTranscriptionAdapter } from "../../src/infrastructure/gemma/gemma-page-transcription-adapter.js";
import { transcriptionRequestSchema } from "../../src/shared/schemas/api-contracts.js";

const request = {
  sourceVersionDraftId: "draft-fixture", materialOrdinal: 1 as const, pageNumber: 2,
  mimeType: "image/png" as const, imageBase64: "aGVsbG8=", targetLanguage: "bn" as const, requestId: "request-1",
};

describe("page transcription boundary", () => {
  it("uses the locked model, minimal thinking, native schema, one image, and one repair", async () => {
    const generateStructured = vi.fn().mockResolvedValue({
      value: { pageNumber: 2, detectedLanguage: "bn", text: "বিশ্বস্ত বাংলা পাঠ", uncertainSegments: [], warnings: [] },
      metadata: { provider: "gemini_api", modelId: "gemma-4-26b-a4b-it", thinkingLevel: "minimal", latencyMs: 12 },
      structuredOutputMode: "native", repaired: false,
    });
    const model: GenerativeModelPort = {
      generateStructured: async <T>(input: Parameters<GenerativeModelPort["generateStructured"]>[0]) => generateStructured(input) as Promise<StructuredGenerationResult<T>>,
      generateText: vi.fn(), healthCheck: vi.fn(),
    };
    const result = await new TranscribePage(new GemmaPageTranscriptionAdapter(model)).execute(request);
    expect(result.text).toBe("বিশ্বস্ত বাংলা পাঠ");
    expect(generateStructured).toHaveBeenCalledWith(expect.objectContaining({
      modelId: "gemma-4-26b-a4b-it", thinkingLevel: "minimal", outputMode: "native", maxSchemaRepairs: 1,
      contents: [expect.objectContaining({ kind: "text" }), expect.objectContaining({ kind: "inline_image", base64Data: "aGVsbG8=" })],
    }));
  });

  it("rejects bad request contracts and a provider page-number mismatch", async () => {
    expect(transcriptionRequestSchema.safeParse({ ...request, requestId: undefined, mimeType: "application/pdf" }).success).toBe(false);
    const port: PageTranscriptionPort = { transcribePage: vi.fn().mockResolvedValue({
      pageNumber: 1, detectedLanguage: "bn", text: "text", uncertainSegments: [], warnings: [],
      artifact: { provider: "gemini_api", modelId: "gemma-4-26b-a4b-it", task: "page_transcription", promptVersion: "v1", schemaVersion: "v1", thinkingLevel: "minimal", requestId: "r", createdAt: "now", latencyMs: 1, repaired: false },
    }) };
    await expect(new TranscribePage(port).execute(request)).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
  });
});
