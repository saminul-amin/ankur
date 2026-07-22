export const APPLICATION_ERROR_CODES = [
  "SOURCE_NOT_CONFIRMED",
  "SOURCE_VERSION_MISMATCH",
  "EVIDENCE_INVALID",
  "MODEL_OUTPUT_INVALID",
  "UNSUPPORTED_MEDIA",
  "PAYLOAD_TOO_LARGE",
] as const;

export type ApplicationErrorCode = (typeof APPLICATION_ERROR_CODES)[number];

const SAFE_MESSAGES: Readonly<Record<ApplicationErrorCode, string>> = {
  SOURCE_NOT_CONFIRMED: "Confirm the source before continuing.",
  SOURCE_VERSION_MISMATCH: "The source changed. Confirm it again before continuing.",
  EVIDENCE_INVALID: "Generated content could not be grounded in the confirmed source.",
  MODEL_OUTPUT_INVALID: "Generated content did not satisfy the required contract.",
  UNSUPPORTED_MEDIA: "This file type is not supported.",
  PAYLOAD_TOO_LARGE: "The submitted content is too large.",
};

export class ApplicationError extends Error {
  constructor(readonly code: ApplicationErrorCode, options?: { cause?: unknown }) {
    super(SAFE_MESSAGES[code], { cause: options?.cause });
    this.name = "ApplicationError";
  }
}
