import { describe, expect, it } from "vitest";

import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import type { ReviewPage } from "../../src/domain/source/page-extraction.js";
import {
  parsePersistedIngestionSession,
  toPersistedIngestionSession,
} from "../../src/presentation/persistence/ingestion-session.js";

const page: ReviewPage = {
  id: "page-002", pageNumber: 2, sourceKind: "pdf", method: "gemma_ocr", text: "Reviewed Bengali page text.",
  uncertainSegments: [{ text: "Bengali", reason: "check glyph" }], warnings: ["draft"], included: true,
  status: "ready", previewUrl: "data:image/jpeg;base64,preview", previewAvailable: true,
  transcriptionImage: { mimeType: "image/jpeg", base64Data: "secret-page-payload" },
};

describe("ingestion persistence envelope", () => {
  it("restores validated review text and choices without persisting raw page images", () => {
    const source = createConfirmedSource({ pages: [{ pageNumber: 2, text: page.text }], language: "en", method: "pdf" });
    const raw = toPersistedIngestionSession({
      stage: "confirmed", mode: "live", sourceKind: "pdf",
      sourceMetadata: { name: "lesson.pdf", kind: "pdf", pageCount: 1 },
      pages: [page], priorityInstruction: "Focus on terms", confirmedSource: source,
    });
    expect(raw).not.toContain("secret-page-payload");
    expect(raw).not.toContain("data:image");
    const restored = parsePersistedIngestionSession(raw);
    expect(restored?.pages[0]).toMatchObject({ pageNumber: 2, included: true, text: page.text, previewAvailable: false });
    expect(restored?.confirmedSource?.sourceVersionId).toBe(source.sourceVersionId);
    expect(restored?.recoveredWithoutPreviews).toBe(true);
  });

  it("rejects corrupted or unversioned state", () => {
    expect(parsePersistedIngestionSession("not-json")).toBeUndefined();
    expect(parsePersistedIngestionSession(JSON.stringify({ schemaVersion: 1, pages: [] }))).toBeUndefined();
  });
});
