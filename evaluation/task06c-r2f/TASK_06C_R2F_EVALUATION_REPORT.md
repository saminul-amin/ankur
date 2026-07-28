# Task 06C-R2F final assessment-correction report

## Outcome

`TASK 06C-R2F FINAL ENGINEERING RUN IMPROVED BUT GATE FAILED — FREEZE BEST VERSION — TASK 07 REMAINS BLOCKED`

The one authorized fixed-denominator run materially improved assessment
reliability while preserving deterministic correctness. The result remains
below the unchanged final-validity threshold.

## Diagnosis and correction

R2E retained seven controlled assessment `INVALID_OUTPUT` outcomes but did not
retain semantic component, field path, finish reason, or validator codes. The
pre-change diagnosis therefore marks these details unavailable instead of
inventing them. All seven were Bengali or mixed-language operations, all had
non-empty output, all attempted the bounded repair, and all failed again.

The largest provider-free reproducible gap was candidate selection accepting
language-invalid and semantically near-duplicate misconception candidates
before the final validator. The narrow correction:

- normalizes Unicode, case, punctuation, and whitespace;
- rejects language-invalid candidates;
- rejects candidates equivalent to the canonical answer or permitted evidence;
- rejects exact and semantic near-duplicates;
- preserves valid candidates;
- uses the existing deterministic evidence-derived misconception fallback.

Prompts and semantic schemas are unchanged. Application-owned identity,
canonical answers, evidence scope, option ordering, rubric construction, and
marks are unchanged.

## Provider-free verification

- Clean install: 290 packages.
- Lint: passed.
- Typecheck: passed.
- Vitest: 33 files and 166 tests passed.
- Targeted R2F and contract suite: 11 files and 50 tests passed.
- Production build: passed.
- Playwright: 22 passed and 6 intentional project-specific skips.
- Audit: zero vulnerabilities.
- Historical Task 06, 06C, R1, R2, and R2E verification: passed.
- Historical evidence hashes: passed for 146 files.
- R2F dry run: passed.
- Secret, client-bundle credential, and privacy scans: passed.
- `git diff --check`: passed.

## Provider preflight

The exact model was `gemma-4-26b-a4b-it`, with minimal thinking, temperature
zero, a 16-token bound, and a 30-second timeout.

| Request | Result | Latency | Finish |
|---|---|---:|---|
| 1 | passed | 1,103 ms | `STOP` |
| 2 | passed | 909 ms | `STOP` |
| 3 | passed | 831 ms | `STOP` |

No authentication, quota, rate-limit, timeout, availability, or malformed
response occurred during preflight.

## Frozen run metrics

| Metric | Result |
|---|---:|
| Logical operations | 45 |
| First-pass valid | 22/45 (48.89%) |
| Final valid | 33/45 (73.33%) |
| Repair attempts | 14/45 (31.11%) |
| Repair success | 11/14 (78.57%) |
| Sanitized provider-attempt rows | 60 |
| Controlled logical failures | 12 |
| Dependency failures | 8 |
| Median latency | 5,353 ms |
| P95 latency | 90,009 ms |
| Maximum latency | 90,409 ms |

Provider-attempt rows and logical operations use separate denominators. A repair
request is a provider attempt, not a new logical artifact.

## Operation outcomes

- Analysis: 7 valid, 1 `RATE_LIMITED`, 1 `TIMEOUT`.
- Assessment: 15 valid, 2 `INVALID_OUTPUT`, 4 dependency failures.
- Written grading: 8 valid, 4 dependency failures.
- Revision/retry: 3 valid.

The two residual assessment failures were `CIV-MIX-PDF-01:r1` and
`CIV-MIX-PDF-01:r2`. Sanitized diagnostics show repeated
`LANG_REPEATED_TOKEN`, `LANG_TRUNCATED_SENTENCE`, and `MCQ_AMBIGUOUS_STEM`
failures after repair; no raw content was retained.

## Artifact quality

- Persisted structured questions: 42.
- Valid written cases: 18.
- Deterministic grounding: 42/42 (100%).
- Deterministic MCQ-key validity: 42/42 (100%).
- Grounding, quote, concept-reference, and mark-reconciliation failures: 0.
- Invalid rubrics entering grading metrics: 0.
- Cross-material evidence defects: 0.
- Duplicate diagnostics: 7/42 (16.67%).
- Parsed baseline questions: 42/42 with source-transparency records.

Duplicate diagnostics remain visible; they were not deleted or reclassified.

## Comparison with R2E

| Metric | R2E | R2F | Change |
|---|---:|---:|---:|
| Final valid | 24/45 | 33/45 | +9 |
| First-pass valid | 18/45 | 22/45 | +4 |
| Repair success | 6/14 | 11/14 | +5 |
| Persisted questions | 24 | 42 | +18 |
| Written cases | 11 | 18 | +7 |
| Assessment invalid output | 7 | 2 | -5 |
| Grounding and key validity | 100% | 100% | unchanged |

## Technical gate

| Gate | Required | Result |
|---|---:|---|
| Final logical validity | at least 43/45 | FAIL — 33/45 |
| Persisted structured questions | at least 30 | PASS — 42 |
| Valid written cases | at least 10 | PASS — 18 |
| Deterministic grounding | 100% | PASS — 42/42 |
| Deterministic MCQ-key validity | 100% | PASS — 42/42 |
| Invalid rubrics in grading metrics | 0 | PASS |
| Cross-material evidence defects | 0 | PASS |
| Non-skipped Playwright tests | all | PASS — 22/22 |
| Provider-free notebook | passed | PASS |
| Public privacy scan | passed | PASS |

## Disposition

Classification: `KEEP`. This is a material, non-regressive improvement, but it
is not a technical-gate pass. Exactly one live R2F run was executed; there was
no selective rerun or second iteration.

Reviewer packets were not generated because the gate failed. Human acceptance,
answer-key review, written-grading agreement, reviewer agreement, and
adjudication remain pending. No human judgment or metric was fabricated.

Freeze this implementation and evidence. Do not begin Task 07. Proceed to
deployment and submission preparation only with the failed reliability gate,
two residual assessment failures, infrastructure sensitivity, and absent fresh
human review disclosed transparently.
