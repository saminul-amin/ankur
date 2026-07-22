import type { ExtractedDigitalPdf, PdfTextExtractorPort } from "../ports/pdf-text-extractor-port";

export class PdfExtractionError extends Error {
  constructor(
    readonly code:
      | "INVALID_FILE_TYPE"
      | "FILE_TOO_LARGE"
      | "PAGE_LIMIT_EXCEEDED"
      | "NO_EMBEDDED_TEXT"
      | "MALFORMED_PDF",
  ) {
    super(code);
    this.name = "PdfExtractionError";
  }
}

export class ExtractOnePageDigitalPdf {
  constructor(private readonly extractor: PdfTextExtractorPort) {}

  async execute(file: File): Promise<ExtractedDigitalPdf> {
    if (file.type !== "application/pdf" && !file.name.toLocaleLowerCase().endsWith(".pdf")) {
      throw new PdfExtractionError("INVALID_FILE_TYPE");
    }
    if (file.size > 8 * 1024 * 1024) {
      throw new PdfExtractionError("FILE_TOO_LARGE");
    }
    const result = await this.extractor.extractOnePage(file);
    if (result.pageCount !== 1) {
      throw new PdfExtractionError("PAGE_LIMIT_EXCEEDED");
    }
    if (result.text.replace(/\s/g, "").length < 20) {
      throw new PdfExtractionError("NO_EMBEDDED_TEXT");
    }
    return result;
  }
}
