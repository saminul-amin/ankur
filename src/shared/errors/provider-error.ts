export const PROVIDER_ERROR_CODES = [
  "AUTHENTICATION_FAILED",
  "RATE_LIMITED",
  "TIMEOUT",
  "UNAVAILABLE",
  "REQUEST_REJECTED",
  "INVALID_OUTPUT",
  "CONFIGURATION_ERROR",
] as const;

export type ProviderErrorCode = (typeof PROVIDER_ERROR_CODES)[number];

const SAFE_MESSAGES: Readonly<Record<ProviderErrorCode, string>> = {
  AUTHENTICATION_FAILED: "Provider authentication failed.",
  RATE_LIMITED: "Provider rate limit reached.",
  TIMEOUT: "Provider request timed out.",
  UNAVAILABLE: "Provider is temporarily unavailable.",
  REQUEST_REJECTED: "Provider rejected the request.",
  INVALID_OUTPUT: "Provider returned output that failed validation.",
  CONFIGURATION_ERROR: "Provider configuration is invalid.",
};

export class ProviderError extends Error {
  readonly code: ProviderErrorCode;
  readonly retryable: boolean;
  readonly status?: number;

  constructor(code: ProviderErrorCode, options?: { status?: number; cause?: unknown }) {
    super(SAFE_MESSAGES[code], { cause: options?.cause });
    this.name = "ProviderError";
    this.code = code;
    this.retryable = code === "RATE_LIMITED" || code === "TIMEOUT" || code === "UNAVAILABLE";
    if (options?.status !== undefined) {
      this.status = options.status;
    }
  }

  toSafeObject(): {
    code: ProviderErrorCode;
    message: string;
    retryable: boolean;
    status?: number;
  } {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.status === undefined ? {} : { status: this.status }),
    };
  }
}

function numericStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }

  for (const property of ["status", "statusCode", "code"] as const) {
    const value = Reflect.get(error, property) as unknown;
    if (typeof value === "number" && Number.isInteger(value)) {
      return value;
    }
    if (typeof value === "string" && /^\d{3}$/.test(value)) {
      return Number(value);
    }
  }

  return undefined;
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    ((Reflect.get(error, "name") as unknown) === "AbortError" ||
      (Reflect.get(error, "code") as unknown) === "ABORT_ERR")
  );
}

function isAuthenticationError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }
  const reason = Reflect.get(error, "reason") as unknown;
  const status = Reflect.get(error, "status") as unknown;
  const message = Reflect.get(error, "message") as unknown;
  const combined = [reason, status, message]
    .filter((value): value is string => typeof value === "string")
    .join(" ");
  return /api[_ ]?key.*(?:invalid|not valid)|api_key_invalid|unauthenticated|permission_denied/i.test(
    combined,
  );
}

export function mapProviderError(error: unknown, timedOut = false): ProviderError {
  if (error instanceof ProviderError) {
    return error;
  }
  if (timedOut || isAbortError(error)) {
    return new ProviderError("TIMEOUT", { cause: error });
  }

  const status = numericStatus(error);
  if (status === 401 || status === 403 || isAuthenticationError(error)) {
    return new ProviderError("AUTHENTICATION_FAILED", {
      ...(status === undefined ? {} : { status }),
      cause: error,
    });
  }
  if (status === 429) {
    return new ProviderError("RATE_LIMITED", { status, cause: error });
  }
  if (status !== undefined && status >= 500 && status <= 599) {
    return new ProviderError("UNAVAILABLE", { status, cause: error });
  }
  if (status !== undefined && status >= 400 && status <= 499) {
    return new ProviderError("REQUEST_REJECTED", { status, cause: error });
  }
  return new ProviderError("UNAVAILABLE", { cause: error });
}
