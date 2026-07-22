import { describe, expect, it } from "vitest";

import {
  classifyExtractedPage,
  decodedBase64ByteLength,
  INGESTION_LIMITS,
  validateTranscriptionImage,
} from "../../src/domain/source/page-extraction.js";

describe("page extraction rules", () => {
  it("keeps sufficiently long clean embedded text on the direct route", () => {
    const result = classifyExtractedPage("Clean embedded learning text with ordinary printable characters and enough detail for a useful lesson page. ".repeat(2));
    expect(result.route).toBe("embedded_text");
    expect(result.reasons).toEqual([]);
  });

  it("routes short, corrupted, and fragmented Bengali extraction to Gemma", () => {
    expect(classifyExtractedPage("too short").reasons).toContain("INSUFFICIENT_TEXT");
    expect(classifyExtractedPage(`Readable content ${"�".repeat(8)} ${"a".repeat(100)}`).reasons).toContain("HIGH_REPLACEMENT_RATIO");
    expect(classifyExtractedPage(`${"পাঠ ".repeat(30)}া ি ী`).reasons).toContain("BENGALI_FRAGMENTATION");
  });

  it("validates base64 bytes and accepted image media", () => {
    expect(decodedBase64ByteLength("aGVsbG8=")).toBe(5);
    expect(validateTranscriptionImage({ mimeType: "image/png", imageBase64: "aGVsbG8=" })).toEqual([]);
    expect(validateTranscriptionImage({ mimeType: "application/pdf", imageBase64: "aGVsbG8=" })).toContain("UNSUPPORTED_MEDIA");
    const oversized = Buffer.alloc(INGESTION_LIMITS.maxTranscriptionImageBytes + 1).toString("base64");
    expect(validateTranscriptionImage({ mimeType: "image/jpeg", imageBase64: oversized })).toContain("IMAGE_TOO_LARGE");
    expect(validateTranscriptionImage({ mimeType: "image/jpeg", imageBase64: "%%%" })).toContain("INVALID_IMAGE_DATA");
  });
});
