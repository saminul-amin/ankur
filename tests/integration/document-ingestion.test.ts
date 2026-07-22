import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  BrowserDocumentProcessor,
  type BrowserPageRenderer,
} from "../../src/infrastructure/documents/browser-document-processor.js";
import type { DocumentIngestionError } from "../../src/infrastructure/documents/browser-document-processor.js";

const rendered = { previewUrl: "data:image/jpeg;base64,aGVsbG8=", mimeType: "image/jpeg" as const, base64Data: "aGVsbG8=" };
const renderer: BrowserPageRenderer = {
  renderPdfPage: vi.fn().mockResolvedValue(rendered),
  renderImage: vi.fn().mockResolvedValue(rendered),
};

async function fixture(name: string, type = "application/pdf") {
  const bytes = await readFile(resolve("evaluation/ingestion/fixtures", name));
  return new File([Uint8Array.from(bytes).buffer], name, { type });
}

describe("browser document ingestion", () => {
  it("routes a team-authored mixed PDF page by page", async () => {
    const result = await new BrowserDocumentProcessor(renderer).processPdf(await fixture("three-page-mixed.pdf"));
    expect(result.pages).toHaveLength(3);
    expect(result.pages.map((page) => page.method)).toEqual(["embedded_text", "gemma_ocr", "embedded_text"]);
    expect(result.pages[1]?.transcriptionImage?.base64Data).toBe("aGVsbG8=");
    expect(result.pages[0]?.transcriptionImage).toBeUndefined();
  });

  it("accepts digital and scanned three-page fixtures", async () => {
    const processor = new BrowserDocumentProcessor(renderer);
    const digital = await processor.processPdf(await fixture("three-page-digital.pdf"));
    const scanned = await processor.processPdf(await fixture("three-page-scanned.pdf"));
    expect(digital.pages.every((page) => page.method === "embedded_text")).toBe(true);
    expect(scanned.pages.every((page) => page.method === "gemma_ocr")).toBe(true);
  });

  it("accepts a standalone Bengali image and enforces collection constraints", async () => {
    const processor = new BrowserDocumentProcessor(renderer);
    const image = await fixture("../../provider-spike/fixtures/bengali-page.png", "image/png");
    const result = await processor.processPageImages([image]);
    expect(result.pages).toHaveLength(1);
    expect(result.pages[0]).toMatchObject({ method: "gemma_ocr", status: "processing", pageNumber: 1 });
    await expect(processor.processPageImages([])).rejects.toMatchObject({ code: "PAGE_LIMIT_EXCEEDED" } satisfies Partial<DocumentIngestionError>);
    await expect(processor.processPageImages([new File(["bad"], "bad.gif", { type: "image/gif" })])).rejects.toMatchObject({ code: "INVALID_FILE_TYPE" });
  });

  it("fails malformed, encrypted, oversized, and over-page-limit PDFs safely", async () => {
    const processor = new BrowserDocumentProcessor(renderer);
    await expect(processor.processPdf(new File(["bad"], "bad.pdf", { type: "application/pdf" }))).rejects.toMatchObject({ code: "MALFORMED_PDF" });
    const fourPage = await fixture("three-page-digital.pdf");
    const overLimitLoader = () => Promise.resolve({ promise: Promise.resolve({ numPages: 4, getPage: vi.fn() }), destroy: () => Promise.resolve() });
    await expect(new BrowserDocumentProcessor(renderer, overLimitLoader).processPdf(fourPage)).rejects.toMatchObject({ code: "PAGE_LIMIT_EXCEEDED" });
    const encryptedLoader = () => Promise.resolve({ promise: Promise.reject(Object.assign(new Error("password"), { name: "PasswordException" })), destroy: () => Promise.resolve() });
    await expect(new BrowserDocumentProcessor(renderer, encryptedLoader).processPdf(fourPage)).rejects.toMatchObject({ code: "ENCRYPTED_PDF" });
    const oversized = new File([new Uint8Array(8 * 1024 * 1024 + 1)], "large.pdf", { type: "application/pdf" });
    await expect(processor.processPdf(oversized)).rejects.toMatchObject({ code: "FILE_TOO_LARGE" });
  });
});
