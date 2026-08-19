export const REPETITION_COLLAPSE_VERSION = "deterministic-repetition-collapse.v1";

// Whitespace plus the hyphen family (U+2010 to U+2015 and ASCII hyphen-minus),
// because a degenerate provider loop can use either as its joiner.
const SEPARATOR_SPLIT = /([\s‐-―-]+)/u;
const SEPARATOR_ONLY = /^[\s‐-―-]+$/u;
const MAXIMUM_PHRASE_SEGMENTS = 8;

interface Piece {
  readonly text: string;
  readonly key: string;
  readonly separator: boolean;
}

function comparableSegment(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase().replace(/[\p{P}\p{S}]+/gu, "").trim();
}

function toPieces(value: string): Piece[] {
  return value
    .split(SEPARATOR_SPLIT)
    .filter((part) => part.length > 0)
    .map((text) => SEPARATOR_ONLY.test(text)
      ? { text, key: "", separator: true }
      : { text, key: comparableSegment(text), separator: false });
}

function wordIndexes(pieces: readonly Piece[]): number[] {
  return pieces.flatMap((piece, index) => piece.separator ? [] : [index]);
}

function phraseKey(pieces: readonly Piece[], indexes: readonly number[]): string {
  return indexes.map((index) => pieces[index]?.key ?? "").join("");
}

/**
 * Removes immediately repeated words and phrases from provider text. Gemma
 * occasionally degenerates into a repetition loop on Bengali and mixed-language
 * material ("safety-related safety-related safety-related …"); collapsing the
 * literal repeats keeps the surviving meaning without rewriting any wording.
 */
export function collapseRepeatedSegments(value: string): string {
  let pieces = toPieces(value);
  let changed = true;
  while (changed) {
    changed = false;
    const words = wordIndexes(pieces);
    for (let start = 0; start < words.length && !changed; start += 1) {
      for (let length = 1; length <= MAXIMUM_PHRASE_SEGMENTS; length += 1) {
        if (start + 2 * length > words.length) break;
        const first = words.slice(start, start + length);
        const second = words.slice(start + length, start + 2 * length);
        const firstKey = phraseKey(pieces, first);
        // A single one-character word is never treated as a degenerate repeat.
        if (firstKey.length <= 1) continue;
        if (firstKey !== phraseKey(pieces, second)) continue;
        // Drop the duplicate block together with the separator that introduced it.
        const from = (first.at(-1) ?? 0) + 1;
        const to = second.at(-1) ?? from;
        pieces = [...pieces.slice(0, from), ...pieces.slice(to + 1)];
        changed = true;
        break;
      }
    }
  }
  return pieces.map((piece) => piece.text).join("");
}

/**
 * Applies {@link collapseRepeatedSegments} to every string in a parsed provider
 * object before schema validation, so a bounded degenerate loop does not fail an
 * otherwise usable artifact on its length contract.
 */
export function collapseRepeatedSegmentsDeep(value: unknown): unknown {
  if (typeof value === "string") return collapseRepeatedSegments(value);
  if (Array.isArray(value)) return value.map((item: unknown) => collapseRepeatedSegmentsDeep(item));
  if (typeof value === "object" && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([property, item]: [string, unknown]) => [property, collapseRepeatedSegmentsDeep(item)]),
    );
  }
  return value;
}
