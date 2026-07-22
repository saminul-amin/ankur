import type { ExtractedDigitalPdf, PdfTextExtractorPort } from "../../application/ports/pdf-text-extractor-port";
import { PdfExtractionError } from "../../application/use-cases/extract-one-page-digital-pdf";

export class PdfJsOnePageTextExtractor implements PdfTextExtractorPort {
  async extractOnePage(file: File): Promise<ExtractedDigitalPdf> {
    try {
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      if (typeof window !== "undefined") {
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      const loadingTask = pdfjs.getDocument({ data: bytes });
      const document = await loadingTask.promise;
      try {
        const page = await document.getPage(1);
        const content = await page.getTextContent();
        const text = content.items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        return { pageNumber: 1, pageCount: document.numPages, text };
      } finally {
        await loadingTask.destroy();
      }
    } catch (error) {
      if (error instanceof PdfExtractionError) {
        throw error;
      }
      throw new PdfExtractionError("MALFORMED_PDF");
    }
  }
}
