import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import type { GenerateContentResponse, GoogleGenAI } from "@google/genai";

import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";

describe("Google GenAI structured repair", () => {
  it("retains the original grounded context in the single schema-repair call", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({ text: JSON.stringify({ segmentId: "not-a-segment" }) } as GenerateContentResponse)
      .mockResolvedValueOnce({ text: JSON.stringify({ segmentId: "M01-P001-S001" }) } as GenerateContentResponse);
    const adapter = new GoogleGenAiAdapter("unit-test-key", "gemma-4-26b-a4b-it", { generateContent });
    const schema = z.object({ segmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/) }).strict();
    const result = await adapter.generateStructured({
      task: "structured_generation",
      modelId: "gemma-4-26b-a4b-it",
      promptVersion: "repair-context.v1",
      schemaVersion: "repair-context.v1",
      thinkingLevel: "minimal",
      temperature: 0,
      maxOutputTokens: 200,
      timeoutMs: 10_000,
      contents: [{ kind: "text", text: "ALLOWED SEGMENT: M01-P001-S001" }],
      outputMode: "native",
      jsonSchema: {
        type: "object",
        additionalProperties: false,
        properties: { segmentId: { type: "string" } },
        required: ["segmentId"],
      },
      schema,
      maxSchemaRepairs: 1,
    });

    expect(result).toMatchObject({ value: { segmentId: "M01-P001-S001" }, repaired: true, structuredOutputMode: "native" });
    expect(generateContent).toHaveBeenCalledTimes(2);
    const repairRequest = generateContent.mock.calls[1]?.[0];
    expect(JSON.stringify(repairRequest)).toContain("ALLOWED SEGMENT: M01-P001-S001");
    expect(JSON.stringify(repairRequest)).toContain("VALIDATION ERRORS");
  });
});
