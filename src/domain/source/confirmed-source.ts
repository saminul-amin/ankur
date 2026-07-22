export type SourceLanguage = "bn" | "en" | "mixed";
export type SourceMethod = "pasted_text" | "digital_pdf" | "pdf" | "page_images";

export interface SourcePageInput {
  readonly pageNumber: number;
  readonly text: string;
}

export interface ConfirmedSegment {
  readonly id: string;
  readonly materialId: "material-01";
  readonly pageNumber: number;
  readonly ordinal: number;
  readonly text: string;
  readonly normalizedText: string;
  readonly textHash: string;
}

export interface ConfirmedSource {
  readonly sourceVersionId: string;
  readonly confirmedAt: string;
  readonly language: SourceLanguage;
  readonly method: SourceMethod;
  readonly segments: readonly ConfirmedSegment[];
  readonly normalizedTextHash: string;
  readonly priorityInstruction?: string;
}

export class SourceDomainError extends Error {
  constructor(readonly code: "EMPTY_SOURCE" | "SOURCE_TOO_LARGE" | "INVALID_SEGMENTS") {
    super(code === "EMPTY_SOURCE" ? "Source text is empty." : "Source text is invalid.");
    this.name = "SourceDomainError";
  }
}

export function normalizeSourceText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stableHash(value: string): string {
  let hash = 0x811c9dc5;
  for (const character of value) {
    hash ^= character.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function segmentText(value: string): string[] {
  return normalizeSourceText(value)
    .split(/\n\s*\n/g)
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0);
}

function segmentId(pageNumber: number, ordinal: number): string {
  return `M01-P${String(pageNumber).padStart(3, "0")}-S${String(ordinal).padStart(3, "0")}`;
}

export function createConfirmedSource(input: {
  readonly pages: readonly SourcePageInput[];
  readonly language: SourceLanguage;
  readonly method: SourceMethod;
  readonly priorityInstruction?: string;
  readonly confirmedAt?: string;
}): ConfirmedSource {
  const normalizedPages = input.pages.map((page) => ({
    pageNumber: page.pageNumber,
    text: normalizeSourceText(page.text),
  }));
  const combinedLength = normalizedPages.reduce((total, page) => total + page.text.length, 0);
  if (combinedLength === 0) {
    throw new SourceDomainError("EMPTY_SOURCE");
  }
  if (combinedLength > 25_000) {
    throw new SourceDomainError("SOURCE_TOO_LARGE");
  }
  if (
    normalizedPages.length === 0 ||
    normalizedPages.length > 3 ||
    normalizedPages.some((page, index) =>
      !Number.isInteger(page.pageNumber) ||
      page.pageNumber < 1 ||
      page.pageNumber > 3 ||
      (index > 0 && page.pageNumber <= (normalizedPages[index - 1]?.pageNumber ?? 0)),
    )
  ) {
    throw new SourceDomainError("INVALID_SEGMENTS");
  }

  const segments = normalizedPages.flatMap((page) =>
    segmentText(page.text).map((text, index): ConfirmedSegment => {
      const normalizedText = normalizeSourceText(text);
      return Object.freeze({
        id: segmentId(page.pageNumber, index + 1),
        materialId: "material-01",
        pageNumber: page.pageNumber,
        ordinal: index + 1,
        text,
        normalizedText,
        textHash: stableHash(normalizedText),
      });
    }),
  );
  if (segments.length === 0) {
    throw new SourceDomainError("EMPTY_SOURCE");
  }

  const normalizedPriority = input.priorityInstruction?.trim()
    ? normalizeSourceText(input.priorityInstruction)
    : undefined;
  const normalizedTextHash = stableHash(
    segments.map((segment) => `${segment.id}:${segment.normalizedText}`).join("\n"),
  );
  return Object.freeze({
    sourceVersionId: `source-${normalizedTextHash}`,
    confirmedAt: input.confirmedAt ?? new Date().toISOString(),
    language: input.language,
    method: input.method,
    segments: Object.freeze(segments),
    normalizedTextHash,
    ...(normalizedPriority === undefined ? {} : { priorityInstruction: normalizedPriority }),
  });
}

export function rehydrateConfirmedSource(input: {
  readonly sourceVersionId: string;
  readonly language: SourceLanguage;
  readonly method?: SourceMethod;
  readonly priorityInstruction?: string;
  readonly segments: ReadonlyArray<{ id: string; pageNumber: number; text: string }>;
}): ConfirmedSource {
  const pages = new Map<number, string[]>();
  for (const segment of input.segments) {
    const pageSegments = pages.get(segment.pageNumber) ?? [];
    pageSegments.push(segment.text);
    pages.set(segment.pageNumber, pageSegments);
  }
  const source = createConfirmedSource({
    pages: [...pages.entries()]
      .sort(([left], [right]) => left - right)
      .map(([pageNumber, values]) => ({ pageNumber, text: values.join("\n\n") })),
    language: input.language,
    method: input.method ?? "pasted_text",
    ...(input.priorityInstruction === undefined
      ? {}
      : { priorityInstruction: input.priorityInstruction }),
    confirmedAt: "1970-01-01T00:00:00.000Z",
  });
  const idsMatch =
    source.segments.length === input.segments.length &&
    source.segments.every((segment, index) => segment.id === input.segments[index]?.id);
  if (!idsMatch || source.sourceVersionId !== input.sourceVersionId) {
    throw new SourceDomainError("INVALID_SEGMENTS");
  }
  return source;
}
