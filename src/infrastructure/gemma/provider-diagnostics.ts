import type { ApprovedGemmaModel } from "../../application/ports/generative-model-port";

export const PROVIDER_FAILURE_CATEGORIES = [
  "provider_request_rejected",
  "timeout",
  "rate_limited",
  "unavailable_or_network",
  "empty_response",
  "invalid_json",
  "transport_schema_mismatch",
  "missing_scalar",
  "invalid_enum_or_identifier",
  "invalid_evidence",
  "quote_mismatch",
  "rubric_mismatch",
  "mark_reconciliation_mismatch",
  "concept_mismatch",
  "repair_response_invalid",
  "unknown_controlled_failure",
] as const;

export type ProviderFailureCategory = (typeof PROVIDER_FAILURE_CATEGORIES)[number];

export interface ProviderValidationDiagnostic {
  readonly modelId: ApprovedGemmaModel;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly phase: "first_pass" | "repair";
  readonly category: ProviderFailureCategory;
  readonly code: string;
  readonly fieldPath: string;
  readonly expected: string;
}

export type ProviderDiagnosticObserver = (diagnostic: ProviderValidationDiagnostic) => void;
