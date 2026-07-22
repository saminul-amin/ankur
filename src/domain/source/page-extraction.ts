export const INGESTION_LIMITS = Object.freeze({
  maxPages: 3,
  maxSourceBytes: 8 * 1024 * 1024,
  maxTranscriptionImageBytes: 3 * 1024 * 1024,
  targetImageLongEdge: 1_800,
  maxConfirmedCharacters: 25_000,
});

export type PageProcessingMethod = "embedded_text" | "gemma_ocr" | "manual_text";
export type PageSourceKind = "pdf" | "page_image" | "pasted_text" | "sample";
export type PageProcessingStatus = "processing" | "ready" | "error";

export interface UncertainSegment {
  readonly text: string;
  readonly reason: string;
}

export interface ReviewPage {
  readonly id: string;
  readonly pageNumber: number;
  readonly sourceKind: PageSourceKind;
  readonly method: PageProcessingMethod;
  readonly text: string;
  readonly rawExtraction?: string;
  readonly uncertainSegments: readonly UncertainSegment[];
  readonly warnings: readonly string[];
  readonly included: boolean;
  readonly status: PageProcessingStatus;
  readonly previewUrl?: string;
  readonly previewAvailable: boolean;
  readonly transcriptionImage?: {
    readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
    readonly base64Data: string;
  };
  readonly error?: string | undefined;
}

export interface PageClassification {
  readonly route: "embedded_text" | "gemma_ocr";
  readonly reasons: readonly string[];
  readonly nonWhitespaceCharacters: number;
  readonly printableRatio: number;
  readonly replacementRatio: number;
}

function countCodePoints(value: string): number {
  return Array.from(value).length;
}

export function classifyExtractedPage(text: string): PageClassification {
  const characters = Array.from(text);
  const total = Math.max(characters.length, 1);
  const nonWhitespaceCharacters = countCodePoints(text.replace(/\s/gu, ""));
  const printableCharacters = characters.filter((character) =>
    character === "\n" || character === "\r" || character === "\t" || !/\p{Cc}/u.test(character),
  ).length;
  const replacements = characters.filter((character) => character === "\uFFFD").length;
  const printableRatio = printableCharacters / total;
  const replacementRatio = replacements / total;
  const fragmentedBengali = /(?:^|\s)[\u09BC\u09BE-\u09CC\u09D7](?:\s|$)/u.test(text)
    || /[\u0980-\u09FF](?:\s+[\u09BE-\u09CC]){2,}/u.test(text);
  const reasons: string[] = [];
  if (nonWhitespaceCharacters < 80) reasons.push("INSUFFICIENT_TEXT");
  if (printableRatio < 0.85) reasons.push("LOW_PRINTABLE_RATIO");
  if (replacementRatio >= 0.02) reasons.push("HIGH_REPLACEMENT_RATIO");
  if (fragmentedBengali) reasons.push("BENGALI_FRAGMENTATION");
  return {
    route: reasons.length === 0 ? "embedded_text" : "gemma_ocr",
    reasons,
    nonWhitespaceCharacters,
    printableRatio,
    replacementRatio,
  };
}

export function decodedBase64ByteLength(value: string): number {
  const normalized = value.replace(/\s/gu, "");
  if (normalized.length === 0 || normalized.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/u.test(normalized)) {
    return -1;
  }
  const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
  return Math.floor((normalized.length * 3) / 4) - padding;
}

export function validateTranscriptionImage(input: {
  readonly mimeType: string;
  readonly imageBase64: string;
}): readonly string[] {
  const failures: string[] = [];
  if (!["image/jpeg", "image/png", "image/webp"].includes(input.mimeType)) {
    failures.push("UNSUPPORTED_MEDIA");
  }
  const byteLength = decodedBase64ByteLength(input.imageBase64);
  if (byteLength < 1) failures.push("INVALID_IMAGE_DATA");
  if (byteLength > INGESTION_LIMITS.maxTranscriptionImageBytes) failures.push("IMAGE_TOO_LARGE");
  return failures;
}
