export interface ExtractedDigitalPdf {
  readonly pageNumber: 1;
  readonly text: string;
  readonly pageCount: number;
}

export interface PdfTextExtractorPort {
  extractOnePage(file: File): Promise<ExtractedDigitalPdf>;
}
