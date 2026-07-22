import type { ConfirmedSource } from "../source/confirmed-source";
import { normalizeSourceText } from "../source/confirmed-source";

export interface EvidenceReference {
  readonly segmentId: string;
  readonly quote?: string | undefined;
}

export interface EvidenceValidationFailure {
  readonly path: string;
  readonly reason: "UNKNOWN_SEGMENT" | "QUOTE_NOT_FOUND" | "EVIDENCE_REQUIRED";
}

export function validateEvidence(
  source: ConfirmedSource,
  references: readonly EvidenceReference[],
  path: string,
): EvidenceValidationFailure[] {
  if (references.length === 0) {
    return [{ path, reason: "EVIDENCE_REQUIRED" }];
  }
  const segmentMap = new Map(source.segments.map((segment) => [segment.id, segment]));
  return references.flatMap<EvidenceValidationFailure>((reference, index) => {
    const referencePath = `${path}[${String(index)}]`;
    const segment = segmentMap.get(reference.segmentId);
    if (segment === undefined) {
      return [{ path: referencePath, reason: "UNKNOWN_SEGMENT" as const }];
    }
    if (
      reference.quote !== undefined &&
      !segment.normalizedText.includes(normalizeSourceText(reference.quote))
    ) {
      return [{ path: referencePath, reason: "QUOTE_NOT_FOUND" as const }];
    }
    return [];
  });
}
