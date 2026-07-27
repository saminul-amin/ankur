# Task 06C-R2 deterministic assessment construction — evaluation report

## Outcome

`TASK 06C-R2 TECHNICAL GATE FAILED — TASK 07 REMAINS BLOCKED`

One complete, fixed-denominator iteration was frozen. No failed record was
selectively rerun, no second implementation version was opened, and no reviewer
packet or human judgment was created.

## Engineering result

The R2 assessment path now uses two small strict semantic transports:

1. `mcq-semantic.v3`: one stem and three misconception candidates.
2. `written-question-semantic.v3`: one stem and expected-length category.

Application code locks the canonical answer, filters unsupported/duplicate
distractors, deterministically orders four options from the operation seed,
assigns the correct-option identity, constructs rubric criteria from required
claims and source-scoped evidence, and allocates exactly five integer marks.
Provider output cannot set internal IDs, evidence identities, correct-option
identity, rubric IDs, criterion IDs, claims, or marks.

When semantic validation fails, one whole small artifact may be regenerated.
The repair receives only failure codes, invalid semantic fields, bounded
evidence, language, required claims, and the canonical answer. Every
deterministic validator runs again before persistence.

## Iteration classification

| Run | Classification | Final valid | Questions | Written cases |
|---|---|---:|---:|---:|
| Task 06C baseline | historical | 33/45 | 18 | 7 |
| Task 06C-R1 best observed | historical | no valid fixed-denominator pass | 18 | 9 |
| Task 06C-R2 iteration 1 | KEEP (correctness), gate failed | 12/45 | 12 | 5 |

`KEEP` applies to the isolated deterministic-construction correctness change:
all five assessment-generation operations with a valid upstream analysis
completed and persisted valid artifacts. It does not classify the release gate
as passed.

## Fixed-denominator reliability

| Metric | Result |
|---|---:|
| Logical operations | 45 |
| First-pass valid | 8/45 (17.78%) |
| Final valid | 12/45 (26.67%) |
| Repairs attempted | 5/45 |
| Repair success | 4/5 (80%) |
| Grounding failures | 0 |
| Quotation failures | 0 |
| Concept-reference failures | 0 |
| Mark-reconciliation failures | 0 |
| P95 latency | 87,958 ms |
| Maximum latency | 90,012 ms |

The fixed operation denominator was preserved. Downstream work blocked by a
failed analysis is represented as `DEPENDENCY_UNAVAILABLE`; it is not omitted
or counted as successful.

## Sanitized failure classification

- Analysis: 2 valid, 2 `TIMEOUT`, 1 `RATE_LIMITED`, 4 `UNAVAILABLE`.
- Assessment generation: 5 valid, 16 dependency failures.
- Written grading: 4 valid, 8 dependency failures.
- Revision/retry generation: 1 valid, 1 provider `UNAVAILABLE`, 2 dependency
  failures.

These records contain no source text, learner answer, prompt body, provider
body, credential, or hidden reasoning.

## Persisted artifact quality

- Questions: 12.
- Written cases: 5.
- Deterministic grounding: 12/12 (100%).
- Deterministic MCQ-key validity: 12/12 (100%).
- Cross-material evidence defects: 0.
- Invalid rubrics entering grading metrics: 0.
- Duplicate findings: 2/12, retained honestly for later human-quality work.

The small semantic construction eliminated the targeted assessment failures in
the operations that could run: no persisted artifact recorded canonical-answer
mismatch, invalid JSON truncation, duplicate MCQ options, multiple supported
options, invalid distractors, or duplicated-clause validation failures.

## Technical gate

| Gate | Required | Measured | Result |
|---|---:|---:|---|
| Final logical validity | at least 43/45 | 12/45 | FAIL |
| Persisted structured questions | at least 30 | 12 | FAIL |
| Valid written cases | at least 10 | 5 | FAIL |
| Deterministic grounding | 100% | 12/12 | PASS |
| Deterministic MCQ-key validity | 100% | 12/12 | PASS |
| Invalid rubrics in grading metrics | 0 | 0 | PASS |
| Cross-material evidence defects | 0 | 0 | PASS |
| Non-skipped Playwright tests | all | 22/22 | PASS |
| Provider-free notebook | restart-and-run-all | passed | PASS |
| Public privacy scan | passed | passed | PASS |

## Verification

- `npm ci`: passed.
- lint: passed after two deterministic-construction lint corrections.
- typecheck: passed.
- Vitest: 32 files, 158 tests passed.
- production build: passed.
- Playwright: 22 passed, 6 intentional project-specific skips.
- audit: zero vulnerabilities.
- Task 06 public closure verification: passed.
- Task 06C public verification: passed.
- Task 06C-R1 provider-free dry run and notebook: passed.
- Task 06C-R2 provider-free dry run: passed with nine materials, 42 planned
  questions, and 45 fixed logical operations.
- historical frozen-hash verification: passed.
- repository secret scan: passed without reading `.env.local`.
- client-bundle credential scan: passed.
- `git diff --check`: passed.

## Reviewer packets

Not generated. The technical gate is a prerequisite, so fresh Pass A/Pass B
packets, coordinator mapping, and reviewer attestations do not exist.

## Decision

The deterministic assessment construction is retained as a correctness
improvement. The R2 release/evaluation gate remains failed because provider
availability prevented a representative fixed-denominator sample. Task 07 is
not authorized.
