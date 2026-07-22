import { ExtractOnePageDigitalPdf } from "../../application/use-cases/extract-one-page-digital-pdf";
import { PdfJsOnePageTextExtractor } from "../../infrastructure/documents/pdfjs-one-page-text-extractor";

const pdfExtraction = new ExtractOnePageDigitalPdf(new PdfJsOnePageTextExtractor());

export function extractDigitalPdfForReview(file: File) {
  return pdfExtraction.execute(file);
}
