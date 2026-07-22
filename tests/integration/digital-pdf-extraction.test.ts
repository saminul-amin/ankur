import { PDFDocument, StandardFonts } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { ExtractOnePageDigitalPdf } from "../../src/application/use-cases/extract-one-page-digital-pdf.js";
import type { PdfExtractionError } from "../../src/application/use-cases/extract-one-page-digital-pdf.js";
import { PdfJsOnePageTextExtractor } from "../../src/infrastructure/documents/pdfjs-one-page-text-extractor.js";

async function makePdf(pageCount = 1): Promise<File> {
  const document = await PDFDocument.create();
  const font = await document.embedFont(StandardFonts.Helvetica);
  for (let index = 0; index < pageCount; index += 1) {
    const page = document.addPage([400, 300]);
    page.drawText(`Confirmed digital PDF source text for page ${String(index + 1)}.`, {
      x: 30,
      y: 240,
      size: 14,
      font,
    });
  }
  const bytes = await document.save();
  return new File([Uint8Array.from(bytes).buffer], "fixture.pdf", { type: "application/pdf" });
}

describe("one-page digital PDF extraction", () => {
  const useCase = new ExtractOnePageDigitalPdf(new PdfJsOnePageTextExtractor());

  it("extracts embedded text from a team-authored in-memory PDF", async () => {
    const result = await useCase.execute(await makePdf());
    expect(result.pageCount).toBe(1);
    expect(result.pageNumber).toBe(1);
    expect(result.text).toContain("Confirmed digital PDF source text");
  });

  it("rejects more than one page", async () => {
    await expect(useCase.execute(await makePdf(2))).rejects.toMatchObject({
      code: "PAGE_LIMIT_EXCEEDED",
    } satisfies Partial<PdfExtractionError>);
  });
});
