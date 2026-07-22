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
      thinkingLevel: "high",
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
    expect(generateContent.mock.calls[0]?.[0].config?.thinkingConfig).toMatchObject({ thinkingLevel: "HIGH" });
    expect(repairRequest?.config).toMatchObject({ temperature: 0, maxOutputTokens: 200, thinkingConfig: { thinkingLevel: "MINIMAL" } });
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

  it("classifies a max-token truncated revision object and empty repair without retaining content", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({
        text: "{\"prompt\":\"PRIVATE TRUNCATED CONTENT",
        candidates: [{ finishReason: "MAX_TOKENS" }],
        usageMetadata: { candidatesTokenCount: 900 },
      } as GenerateContentResponse)
      .mockResolvedValueOnce({ text: "", usageMetadata: { candidatesTokenCount: 0 } } as GenerateContentResponse);
    const diagnostics: unknown[] = [];
    const adapter = new GoogleGenAiAdapter(
      "unit-test-key", "gemma-4-26b-a4b-it", { generateContent },
      (diagnostic) => diagnostics.push(diagnostic),
    );
    const schema = z.object({ prompt: z.string().min(1) }).strict();

    await expect(adapter.generateStructured({
      task: "structured_generation", modelId: "gemma-4-26b-a4b-it", promptVersion: "revision.v2",
      schemaVersion: "revision-retry-mcq.v1", thinkingLevel: "high", temperature: 0.1, maxOutputTokens: 1_800,
      timeoutMs: 10_000, contents: [{ kind: "text", text: "PRIVATE SOURCE CONTENT" }], outputMode: "native",
      jsonSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
      schema, maxSchemaRepairs: 1,
    })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });

    expect(diagnostics).toEqual([
      expect.objectContaining({
        phase: "first_pass", category: "invalid_json", code: "INVALID_JSON_MAX_TOKENS",
        fieldPath: "$", responseTokenCount: 900, repairAttempted: true,
      }),
      expect.objectContaining({
        phase: "repair", category: "repair_response_invalid", code: "REPAIR_RESPONSE_INVALID",
        fieldPath: "$", responseCharacterCount: 0, repairAttempted: true,
      }),
    ]);
    expect(JSON.stringify(diagnostics)).not.toContain("PRIVATE TRUNCATED CONTENT");
    expect(JSON.stringify(diagnostics)).not.toContain("PRIVATE SOURCE CONTENT");
  });

  it("retains task context only when an empty response must be regenerated", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({ text: "", candidates: [{ finishReason: "RECITATION" }] } as GenerateContentResponse)
      .mockResolvedValueOnce({ text: JSON.stringify({ judgment: "met" }) } as GenerateContentResponse);
    const adapter = new GoogleGenAiAdapter("unit-test-key", "gemma-4-26b-a4b-it", { generateContent });
    const schema = z.object({ judgment: z.literal("met") }).strict();
    const result = await adapter.generateStructured({
      task: "structured_generation", modelId: "gemma-4-26b-a4b-it", promptVersion: "empty-repair.v1",
      schemaVersion: "empty-repair.v1", thinkingLevel: "high", temperature: 0.1, maxOutputTokens: 800,
      timeoutMs: 10_000, contents: [{ kind: "text", text: "ORIGINAL GRADING CONTEXT" }], outputMode: "native",
      jsonSchema: { type: "object", properties: { judgment: { type: "string", enum: ["met"] } }, required: ["judgment"] },
      schema, maxSchemaRepairs: 1,
    });

    expect(result).toMatchObject({ value: { judgment: "met" }, repaired: true });
    const repairRequest = generateContent.mock.calls[1]?.[0];
    expect(JSON.stringify(repairRequest)).toContain("ORIGINAL GRADING CONTEXT");
    expect(repairRequest?.config?.thinkingConfig).toMatchObject({ thinkingLevel: "HIGH" });
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
