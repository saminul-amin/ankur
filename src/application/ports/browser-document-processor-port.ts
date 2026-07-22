import type { ReviewPage } from "../../domain/source/page-extraction";

export interface BrowserDocumentProcessingResult {
  readonly sourceName: string;
  readonly sourceKind: "pdf" | "page_images";
  readonly pages: readonly ReviewPage[];
}

export interface BrowserDocumentProcessorPort {
  processPdf(file: File): Promise<BrowserDocumentProcessingResult>;
  processPageImages(files: readonly File[]): Promise<BrowserDocumentProcessingResult>;
}
