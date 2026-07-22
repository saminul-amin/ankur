# Ankur API Contracts

> **Version:** 1.0.0  
> **Status:** LOCKED FOR P0

## 1. General rules

- Base path: `/api`.
- Content type: `application/json`, except no raw PDF upload endpoints exist in P0.
- Every request and response is validated with Zod.
- Every response includes `requestId`.
- The API is session-oriented but unauthenticated.
- `x-ankur-session-id` is required for AI-mutating routes and is an opaque random client-generated ID, not an authentication credential.
- Browser code may retry only when `error.retryable === true`.
- Route Handlers must set `Cache-Control: no-store` for learner-specific API responses.

## 2. Response envelopes

### Success

```ts
interface ApiSuccess<T> {
  ok: true;
  requestId: string;
  data: T;
}
```

### Error

```ts
interface ApiFailure {
  ok: false;
  requestId: string;
  error: {
    code: ApiErrorCode;
    message: string;
    retryable: boolean;
    fieldErrors?: Record<string, string[]>;
  };
}
```

Public error codes:

```text
VALIDATION_FAILED
SOURCE_NOT_CONFIRMED
SOURCE_VERSION_MISMATCH
PAYLOAD_TOO_LARGE
RATE_LIMITED
LIVE_AI_DISABLED
PROVIDER_RATE_LIMITED
PROVIDER_TIMEOUT
PROVIDER_UNAVAILABLE
MODEL_OUTPUT_INVALID
EVIDENCE_INVALID
UNSUPPORTED_MEDIA
FEATURE_NOT_AVAILABLE
INTERNAL_ERROR
```

Provider payloads, stack traces, keys, prompts, and raw source content must never appear in an error response.

## 3. `GET /api/health`

Purpose: deployment liveness only. It must not call the provider.

Response:

```json
{
  "ok": true,
  "requestId": "...",
  "data": {
      "status": "healthy",
      "version": "0.1.0",
      "buildId": "3c2e226055de",
    "timestamp": "2026-07-22T00:00:00.000Z"
  }
}
```

## 4. `GET /api/runtime-status`

Purpose: report whether live generation and sample mode are available. Provider checks must be cached briefly and must not expose quota details.

```ts
interface RuntimeStatus {
  liveAiEnabled: boolean;
  sampleModeEnabled: boolean;
  providerConfigured: boolean;
  primaryModel: string;
  buildId: string;
  status: "ready" | "degraded" | "disabled";
}
```

## 5. `POST /api/transcriptions`

Purpose: transcribe one preprocessed scanned page image.

Request:

```ts
interface TranscriptionRequest {
  sourceVersionDraftId: string;
  materialOrdinal: number;
  pageNumber: number;
  mimeType: "image/jpeg" | "image/png" | "image/webp";
  imageBase64: string;
  optionalRawExtraction?: string;
  targetLanguage: "bn" | "en" | "mixed";
}
```

Constraints:

- One image only.
- Decoded image size ≤ 3 MB.
- Base64 and request total must remain safely below the platform limit.
- Width and height are checked client-side and revalidated where possible.

Response:

```ts
interface TranscriptionResult {
  pageNumber: number;
  detectedLanguage: "bn" | "en" | "mixed";
  text: string;
  uncertainSegments: Array<{
    text: string;
    reason: string;
  }>;
  warnings: string[];
  artifact: ModelArtifactMetadata;
}
```

## 6. `POST /api/analyses`

Purpose: create a preparation map from confirmed source segments.

Request:

```ts
interface AnalysisRequest {
  sourceVersionId: string;
  language: "bn" | "en" | "mixed";
  priorityInstruction?: string;
  segments: Array<{
    id: string;
    pageNumber: number;
    text: string;
  }>;
}
```

Constraints:

- At least one segment.
- All segment IDs unique and structurally valid.
- Combined confirmed text ≤ 25,000 characters for P0.
- Priority instruction ≤ 1,000 characters.

Response: validated `PreparationMap` with verified evidence.

## 7. `POST /api/assessments`

Purpose: generate a P0 activity set.

Request:

```ts
interface AssessmentGenerationRequest {
  sourceVersionId: string;
  preparationMap: PreparationMap;
  selectedConceptIds: string[];
  configuration: {
    language: "bn" | "en" | "mixed";
    mcqCount: number; // P0: 1..5
    shortWrittenCount: number; // P0: 1..2
    difficulty: "easy" | "medium" | "hard" | "mixed";
  };
  segments: ConfirmedSegmentInput[];
}
```

Response:

```ts
interface AssessmentGenerationResult {
  activitySet: ActivitySet;
  rejectedCandidateCount: number;
  warnings: string[];
  artifact: ModelArtifactMetadata;
}
```

Server validation includes:

- source-version consistency;
- concept existence;
- evidence validity;
- exact question counts;
- MCQ option uniqueness and valid answer;
- rubric mark sum;
- duplicate-prompt detection.

## 8. `POST /api/written-evaluations`

Purpose: evaluate one non-empty short written answer against a fixed rubric and only the relevant source evidence.

Request:

```ts
interface WrittenEvaluationRequest {
  sourceVersionId: string;
  question: ShortWrittenQuestion;
  studentAnswer: string;
  evidenceSegments: ConfirmedSegmentInput[];
}
```

Constraints:

- Empty/whitespace-only answer must be handled locally and must not call this route.
- Student answer ≤ 3,000 characters for P0.
- Evidence segments must match question evidence.

Response: `WrittenAnswerEvaluation`.

Additional server checks:

- criterion marks sum to question maximum;
- awarded criterion marks are bounded;
- total equals criterion sum;
- returned concepts exist in the question/preparation map;
- evidence references are valid.

## 9. `POST /api/revisions`

Purpose: deterministically select a weak-area, reinforcement, or optional challenge target, then generate a focused revision plan and a two-question retry.

Request:

```ts
interface RevisionGenerationRequest {
  operationId: string;
  sourceVersionId: string;
  preparationMap: PreparationMap;
  originalActivity: ActivitySet;
  originalResultId: string;
  originalMcqGrade: McqGrade;
  originalWrittenEvaluation: WrittenAnswerEvaluation;
  conceptPerformance: ConceptPerformance[];
  language: "bn" | "en" | "mixed";
  segments: ConfirmedSegmentInput[];
}
```

Response:

```ts
interface RevisionGenerationResult {
  revisionPlan: RevisionPlan;
  warnings: string[];
  artifact: ModelArtifactMetadata;
}
```

The application use case recomputes and reconciles concept performance from the immutable activity and grades before selecting targets. Client-reported performance cannot create a weakness. Only selected concepts and their authorized evidence window reach the provider adapter. Validation requires exact target/item coverage, valid source quotes and concept IDs, fixed marks, and materially distinct retry prompts; one bounded repair is allowed before atomic rejection.

## 10. Rate-limit headers

When durable rate limiting is enabled, responses may include:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After
```

Exact quotas are environment-controlled because Gemini API limits depend on the active project tier and can change.

## 11. Idempotency and duplicate submission

P0 has no server database and therefore does not promise cross-instance idempotency. The client must:

- generate an operation ID;
- disable duplicate submit while pending;
- persist successful artifacts before navigating;
- ask the user before repeating a provider call after an uncertain network outcome.

A future server persistence layer may implement true idempotency keys.

## 12. Endpoint test obligations

Each endpoint requires:

- request-schema tests;
- success contract tests with a mocked model adapter;
- provider error mapping tests;
- invalid schema repair tests;
- invalid evidence tests where applicable;
- content-free logging tests;
- payload-limit tests.
