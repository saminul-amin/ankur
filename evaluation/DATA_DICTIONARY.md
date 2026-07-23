# Task 06 Public Data Dictionary

All JSON record types are strict, versioned Zod contracts in `src/shared/evaluation/task06-schemas.ts`. Null means not measured, not available after a controlled failure, or pending human work; it never means a negative label.

## Task 06C versioning note

The Task 06 files documented below are historical and immutable. Task 06C uses separate strict contracts and locations under `evaluation/task06c/`:

- `task06c-material.v1` distinguishes `frozen_task06` and `holdout_task06c`;
- `task06c-question-record.v1` records pipeline, composite evidence IDs, schema and semantic validity, repair, duplicate scope, alignment, and fresh-review status;
- `task06c-written-record.v1` records alignment eligibility and deterministic empty-answer behavior;
- `task06c-metrics.v1` separates provider-attempt and logical-operation denominators;
- `task06c-gate-result.v1` represents every fixed acceptance gate as passed, failed, or pending.

Task 06C public records contain public-safe source text, hashes, and neutral identifiers. Private packet order, coordinator mappings, reviewer notes, attestations, and provider semantic artifacts remain Git-ignored.

| File | Grain | Primary ID | Purpose |
|---|---|---|---|
| `corpus/public/manifest.json` | material and page | `materialId` | Provenance, licence, language/domain/input coverage, source hashes, expected and confirmed reference text |
| `records/public/extraction-records.json` | page | `recordId` | Routing, CER, uncertainty, and correction-burden metadata |
| `records/public/question-records.json` | question | `recordId` | Sanitized structured question, stage, hashes, concept/evidence IDs, deterministic validation, pending adjudication |
| `records/public/written-grading-records.json` | answer case | `recordId` | Team-authored answer, provider-call status, reconciled mark/status, and pending adjudication |
| `records/public/adaptive-loop-records.json` | material path | `recordId` | Completed, controlled-failure, or pending adaptive path with targets, scores, grounding, and persistence checks |
| `records/public/provider-operations.json` | application operation or retained attempt | `operationId` | Safe provider metadata, repair/final status, latency/tokens, and controlled failure category |
| `records/public/baseline-records.json` | material | `recordId` | One-prompt baseline parse and evidence-transparency counts; raw output remains private |
| `exports/aggregate-metrics.json` | evaluation run | `schemaVersion` | Reconciled aggregate metrics with count/denominator/status |
| `exports/aggregate-tables.csv` | metric | `metric` | Tabular count/denominator export |
| `exports/error-analysis.csv` | controlled failure | `operationId` | Sanitized failure inventory |
| `exports/baseline-comparison.csv` | system | `system` | Structured-versus-baseline automated comparison; human acceptance remains pending |

## Important fields

- `questionStage`: `original_assessment` or `adaptive_retry`.
- `deterministicGroundingValid`: application validators accepted all cited immutable source segment IDs and quotes.
- `deterministicKeyValid`: the objective key refers to one of the four fixed MCQ options. It is not a human correctness judgment.
- `duplicateOfRecordId`: deterministic cross-run wording similarity at the product threshold; human duplicate review is pending.
- `repairAttempted`: either transport schema repair or bounded application evidence repair was attempted.
- `finalStatus`: `valid`, `controlled_failure`, or `pending`.
- `failureCategory`: sanitized application/provider category; no provider body is exported.
- `reviewerStatus`: remains `pending` until independent R1/R2 review and adjudication are complete.

## Normalization

Text hashes use SHA-256 over NFC-normalized UTF-8. CER uses NFC, normalized CR/LF, collapsed horizontal whitespace, trimmed line whitespace, and preserves Bengali characters and diacritics. Aggregate percentages are rounded to two decimal places and always retain counts and denominators.
