import type { ApprovedGemmaModel } from "../ports/generative-model-port";
import type { EvidenceValidationFailure } from "../../domain/grounding/evidence";

export interface RevisionValidationDiagnostic {
  readonly modelId: ApprovedGemmaModel;
  readonly promptVersion: string;
  readonly schemaVersion: "revision-plan.v1";
  readonly sourceVersionId: string;
  readonly targetConceptCount: number;
  readonly permittedEvidenceSegmentCount: number;
  readonly permittedEvidenceCharacterCount: number;
  readonly phase: "first_pass" | "repair";
  readonly validationCode: EvidenceValidationFailure["reason"];
  readonly fieldPath: string;
  readonly expected: string;
  readonly responseCharacterCount: number;
  readonly latencyMs: number;
  readonly repairAttempted: boolean;
}

export type RevisionDiagnosticObserver = (diagnostic: RevisionValidationDiagnostic) => void;

const expectedByCode: Record<EvidenceValidationFailure["reason"], string> = {
  DUPLICATE_PROMPT: "materially distinct retry wording and option ordering",
  EVIDENCE_REQUIRED: "at least one permitted evidence reference",
  INVARIANT_VIOLATION: "application-owned revision invariant",
  QUOTE_NOT_FOUND: "exact substring of permitted evidence",
  SOURCE_VERSION_MISMATCH: "confirmed source version identifier",
  UNKNOWN_CONCEPT: "deterministically selected target concept identifier",
  UNKNOWN_SEGMENT: "permitted evidence segment identifier",
};

export function sanitizeRevisionFieldPath(path: string): string {
  const safe = path.replace(/[^a-zA-Z0-9_.[\]-]/gu, "_").slice(0, 180);
  return safe.length === 0 ? "$" : safe;
}

export function revisionExpectedCategory(reason: EvidenceValidationFailure["reason"]): string {
  return expectedByCode[reason];
}
