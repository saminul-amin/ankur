import { ExtractOnePageDigitalPdf } from "../../application/use-cases/extract-one-page-digital-pdf";
import { PdfJsOnePageTextExtractor } from "../../infrastructure/documents/pdfjs-one-page-text-extractor";
import { BrowserDocumentProcessor } from "../../infrastructure/documents/browser-document-processor";

const pdfExtraction = new ExtractOnePageDigitalPdf(new PdfJsOnePageTextExtractor());
const documentProcessor = new BrowserDocumentProcessor();

export function extractDigitalPdfForReview(file: File) {
  return pdfExtraction.execute(file);
}

export function processPdfForReview(file: File) {
  return documentProcessor.processPdf(file);
}

export function processPageImagesForReview(files: readonly File[]) {
  return documentProcessor.processPageImages(files);
}
