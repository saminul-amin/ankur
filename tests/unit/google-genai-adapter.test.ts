import { z } from "zod";
import { describe, expect, it, vi } from "vitest";
import type { GenerateContentResponse, GoogleGenAI } from "@google/genai";

import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";

describe("Google GenAI structured repair", () => {
  it("uses a bounded repair payload without duplicating the original grounded prompt", async () => {
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
    expect(JSON.stringify(repairRequest)).not.toContain("ALLOWED SEGMENT: M01-P001-S001");
    expect(JSON.stringify(repairRequest)).toContain("not-a-segment");
    expect(JSON.stringify(repairRequest)).toContain("VALIDATION ERRORS");
  });

  it("emits only sanitized schema diagnostics for first-pass and failed repair output", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({ text: JSON.stringify({ segmentId: "not-a-segment" }) } as GenerateContentResponse)
      .mockResolvedValueOnce({ text: "not json" } as GenerateContentResponse);
    const diagnostics: unknown[] = [];
    const adapter = new GoogleGenAiAdapter(
      "unit-test-key",
      "gemma-4-26b-a4b-it",
      { generateContent },
      (diagnostic) => diagnostics.push(diagnostic),
    );
    const schema = z.object({ segmentId: z.string().regex(/^M\d{2}-P\d{3}-S\d{3}$/) }).strict();

    await expect(adapter.generateStructured({
      task: "structured_generation", modelId: "gemma-4-26b-a4b-it", promptVersion: "diagnostic.v1",
      schemaVersion: "diagnostic.v1", thinkingLevel: "minimal", temperature: 0, maxOutputTokens: 200,
      timeoutMs: 10_000, contents: [{ kind: "text", text: "PRIVATE SOURCE CONTENT" }], outputMode: "native",
      jsonSchema: { type: "object", properties: { segmentId: { type: "string" } }, required: ["segmentId"] },
      schema, maxSchemaRepairs: 1,
    })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });

    expect(diagnostics).toEqual([
      expect.objectContaining({ phase: "first_pass", category: "invalid_enum_or_identifier", fieldPath: "$.segmentId" }),
      expect.objectContaining({ phase: "repair", category: "repair_response_invalid", fieldPath: "$" }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("PRIVATE SOURCE CONTENT");
    expect(JSON.stringify(diagnostics)).not.toContain("not-a-segment");
    expect(JSON.stringify(diagnostics)).not.toContain("not json");
  });

  it("retries one transient provider failure and records the bounded retry", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockRejectedValueOnce({ status: 429 })
      .mockResolvedValueOnce({ text: "ready" } as GenerateContentResponse);
    const adapter = new GoogleGenAiAdapter("unit-test-key", "gemma-4-26b-a4b-it", { generateContent });
    const result = await adapter.generateText({
      task: "text_generation",
      modelId: "gemma-4-26b-a4b-it",
      promptVersion: "network-retry.v1",
      thinkingLevel: "minimal",
      temperature: 0,
      maxOutputTokens: 20,
      timeoutMs: 10_000,
      contents: [{ kind: "text", text: "Return ready." }],
    });

    expect(result.text).toBe("ready");
    expect(result.metadata.networkRetryCount).toBe(1);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
});
