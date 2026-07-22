import type {
  BrowserDocumentProcessingResult,
  BrowserDocumentProcessorPort,
} from "../../application/ports/browser-document-processor-port";
import {
  classifyExtractedPage,
  INGESTION_LIMITS,
  type ReviewPage,
} from "../../domain/source/page-extraction";

export type DocumentIngestionErrorCode =
  | "INVALID_FILE_TYPE"
  | "FILE_TOO_LARGE"
  | "PAGE_LIMIT_EXCEEDED"
  | "MALFORMED_PDF"
  | "ENCRYPTED_PDF"
  | "IMAGE_DECODE_FAILED"
  | "IMAGE_COMPRESSION_FAILED";

export class DocumentIngestionError extends Error {
  constructor(readonly code: DocumentIngestionErrorCode) {
    super(code);
    this.name = "DocumentIngestionError";
  }
}

interface PdfTextItemLike {
  readonly str?: string;
  readonly hasEOL?: boolean;
}

export interface BrowserPdfPageLike {
  getTextContent(): Promise<{ readonly items: readonly PdfTextItemLike[] }>;
  getViewport(input: { scale: number }): { readonly width: number; readonly height: number };
  render(input: {
    canvas: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: unknown;
  }): { readonly promise: Promise<unknown> };
  cleanup(): void;
}

interface BrowserPdfDocumentLike {
  readonly numPages: number;
  getPage(pageNumber: number): Promise<BrowserPdfPageLike>;
}

interface BrowserPdfLoadingTaskLike {
  readonly promise: Promise<BrowserPdfDocumentLike>;
  destroy(): Promise<void>;
}

export interface RenderedPageImage {
  readonly previewUrl: string;
  readonly mimeType: "image/jpeg";
  readonly base64Data: string;
}

export interface BrowserPageRenderer {
  renderPdfPage(page: BrowserPdfPageLike): Promise<RenderedPageImage>;
  renderImage(file: File): Promise<RenderedPageImage>;
}

type PdfLoader = (bytes: Uint8Array) => Promise<BrowserPdfLoadingTaskLike>;

function textFromItems(items: readonly PdfTextItemLike[]): string {
  return items.map((item) => `${item.str ?? ""}${item.hasEOL ? "\n" : " "}`)
    .join("")
    .replace(/[ \t]+\n/gu, "\n")
    .replace(/[ \t]{2,}/gu, " ")
    .replace(/\n{3,}/gu, "\n\n")
    .trim();
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) reject(new DocumentIngestionError("IMAGE_COMPRESSION_FAILED"));
      else resolve(blob);
    }, "image/jpeg", quality);
  });
}

async function encodedCanvas(canvas: HTMLCanvasElement): Promise<RenderedPageImage> {
  for (const quality of [0.86, 0.72, 0.58, 0.45]) {
    const blob = await canvasBlob(canvas, quality);
    if (blob.size <= INGESTION_LIMITS.maxTranscriptionImageBytes) {
      const base64Data = toBase64(new Uint8Array(await blob.arrayBuffer()));
      return { previewUrl: `data:image/jpeg;base64,${base64Data}`, mimeType: "image/jpeg", base64Data };
    }
  }
  throw new DocumentIngestionError("IMAGE_COMPRESSION_FAILED");
}

function canvasForDimensions(width: number, height: number): {
  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D;
} {
  const longEdge = Math.max(width, height);
  const scale = Math.min(1, INGESTION_LIMITS.targetImageLongEdge / longEdge);
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const context = canvas.getContext("2d", { alpha: false });
  if (context === null) throw new DocumentIngestionError("IMAGE_COMPRESSION_FAILED");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  return { canvas, context };
}

async function loadImage(file: File): Promise<HTMLImageElement> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new DocumentIngestionError("IMAGE_DECODE_FAILED"));
      image.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export class CanvasPageRenderer implements BrowserPageRenderer {
  async renderPdfPage(page: BrowserPdfPageLike): Promise<RenderedPageImage> {
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(2.25, INGESTION_LIMITS.targetImageLongEdge / Math.max(base.width, base.height));
    const viewport = page.getViewport({ scale });
    const { canvas, context } = canvasForDimensions(viewport.width, viewport.height);
    await page.render({ canvas, canvasContext: context, viewport }).promise;
    return encodedCanvas(canvas);
  }

  async renderImage(file: File): Promise<RenderedPageImage> {
    const image = await loadImage(file);
    const { canvas, context } = canvasForDimensions(image.naturalWidth, image.naturalHeight);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return encodedCanvas(canvas);
  }
}

async function defaultPdfLoader(bytes: Uint8Array): Promise<BrowserPdfLoadingTaskLike> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (typeof window !== "undefined") {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
      import.meta.url,
    ).toString();
  }
  return pdfjs.getDocument({ data: bytes }) as unknown as BrowserPdfLoadingTaskLike;
}

function isPasswordError(error: unknown): boolean {
  return typeof error === "object" && error !== null && Reflect.get(error, "name") === "PasswordException";
}

const ACCEPTED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

export class BrowserDocumentProcessor implements BrowserDocumentProcessorPort {
  constructor(
    private readonly renderer: BrowserPageRenderer = new CanvasPageRenderer(),
    private readonly loadPdf: PdfLoader = defaultPdfLoader,
  ) {}

  async processPdf(file: File): Promise<BrowserDocumentProcessingResult> {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      throw new DocumentIngestionError("INVALID_FILE_TYPE");
    }
    if (file.size > INGESTION_LIMITS.maxSourceBytes) throw new DocumentIngestionError("FILE_TOO_LARGE");
    let loadingTask: BrowserPdfLoadingTaskLike | undefined;
    try {
      loadingTask = await this.loadPdf(new Uint8Array(await file.arrayBuffer()));
      const pdf = await loadingTask.promise;
      if (pdf.numPages < 1 || pdf.numPages > INGESTION_LIMITS.maxPages) {
        throw new DocumentIngestionError("PAGE_LIMIT_EXCEEDED");
      }
      const pages: ReviewPage[] = [];
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        const page = await pdf.getPage(pageNumber);
        try {
          const rawExtraction = textFromItems((await page.getTextContent()).items);
          const classification = classifyExtractedPage(rawExtraction);
          const rendered = await this.renderer.renderPdfPage(page);
          pages.push({
            id: `page-${String(pageNumber).padStart(3, "0")}`,
            pageNumber,
            sourceKind: "pdf",
            method: classification.route,
            text: classification.route === "embedded_text" ? rawExtraction : "",
            ...(rawExtraction === "" ? {} : { rawExtraction }),
            uncertainSegments: [],
            warnings: classification.route === "gemma_ocr"
              ? classification.reasons.map((reason) => `Page routed to Gemma transcription: ${reason}.`)
              : [],
            included: true,
            status: classification.route === "embedded_text" ? "ready" : "processing",
            previewUrl: rendered.previewUrl,
            previewAvailable: true,
            ...(classification.route === "gemma_ocr"
              ? { transcriptionImage: { mimeType: rendered.mimeType, base64Data: rendered.base64Data } }
              : {}),
          });
        } finally {
          page.cleanup();
        }
      }
      return { sourceName: file.name, sourceKind: "pdf", pages };
    } catch (error) {
      if (error instanceof DocumentIngestionError) throw error;
      if (isPasswordError(error)) throw new DocumentIngestionError("ENCRYPTED_PDF");
      throw new DocumentIngestionError("MALFORMED_PDF");
    } finally {
      if (loadingTask !== undefined) await loadingTask.destroy().catch(() => undefined);
    }
  }

  async processPageImages(files: readonly File[]): Promise<BrowserDocumentProcessingResult> {
    if (files.length < 1 || files.length > INGESTION_LIMITS.maxPages) {
      throw new DocumentIngestionError("PAGE_LIMIT_EXCEEDED");
    }
    if (files.some((file) => !ACCEPTED_IMAGE_TYPES.has(file.type))) {
      throw new DocumentIngestionError("INVALID_FILE_TYPE");
    }
    if (files.reduce((total, file) => total + file.size, 0) > INGESTION_LIMITS.maxSourceBytes) {
      throw new DocumentIngestionError("FILE_TOO_LARGE");
    }
    const pages: ReviewPage[] = [];
    for (const [index, file] of files.entries()) {
      const rendered = await this.renderer.renderImage(file);
      const pageNumber = index + 1;
      pages.push({
        id: `page-${String(pageNumber).padStart(3, "0")}`,
        pageNumber,
        sourceKind: "page_image",
        method: "gemma_ocr",
        text: "",
        uncertainSegments: [],
        warnings: [],
        included: true,
        status: "processing",
        previewUrl: rendered.previewUrl,
        previewAvailable: true,
        transcriptionImage: { mimeType: rendered.mimeType, base64Data: rendered.base64Data },
      });
    }
    return {
      sourceName: files.length === 1 ? files[0]?.name ?? "page image" : `${String(files.length)} page images`,
      sourceKind: "page_images",
      pages,
    };
  }
}
