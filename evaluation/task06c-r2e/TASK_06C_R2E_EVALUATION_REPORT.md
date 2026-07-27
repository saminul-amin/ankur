# Task 06C-R2E provider-stable evaluation report

## Outcome

`TASK 06C-R2E PRODUCT GATE FAILED ON INFRASTRUCTURE-VALID RUN — TASK 07 REMAINS BLOCKED`

The frozen deterministic-assessment implementation was evaluated without any
product prompt, schema, validator, repair, or generation-logic change.

## Initial and frozen state

- Starting branch: `task06c-r2/deterministic-assessment-construction`.
- Frozen implementation SHA: `f9bb5a40b41c3403a1f147f8c2fa30d0dd782c5c`.
- R2E branch: `task06c-r2e/provider-stable-evaluation`.
- Historical evidence hash verification: passed.
- Historical private state: ignored and untracked.

## Provider-free gate

- `npm ci`: passed, 290 packages installed.
- Lint: passed.
- Typecheck: passed.
- Vitest: 32 files and 158 tests passed.
- Architecture/security targeted suite: 11 files and 51 tests passed.
- Production build: passed.
- Playwright: 22 passed; 6 intentional project-specific skips.
- Audit: zero vulnerabilities.
- Task 06 closure verification: passed.
- Task 06C verification: passed.
- Task 06C-R1 dry run and notebook: passed.
- Task 06C-R2 dry run and notebook: passed.
- Frozen historical hashes: passed.
- Repository secret and client-bundle credential scans: passed.
- `git diff --check`: passed.

## Provider preflight

All three bounded calls used `gemma-4-26b-a4b-it`, minimal thinking,
temperature zero, 16 output tokens, and a 30-second timeout.

| Request | Result | Latency | Finish |
|---|---|---:|---|
| 1 | passed | 1,566 ms | `STOP` |
| 2 | passed | 1,036 ms | `STOP` |
| 3 | passed | 1,001 ms | `STOP` |

No authentication, quota, rate-limit, timeout, availability, or malformed
response occurred. The provider exposes no remaining-quota endpoint; the
100-attempt fixed-plan budget was accepted on the evidence of the 3/3 preflight.

## Infrastructure classification

Run 1 is `INFRASTRUCTURE_VALID` and authoritative.

- Baselines: 9/9 valid.
- Analyses: 7/9 valid.
- Authentication failures: 0.
- Provider-wide unavailable failures: 0.
- Explicit quota exhaustion: 0.
- Rate limits: 1.
- Timeouts: 1.
- Semantic assessment `INVALID_OUTPUT`: 7.

One rate limit and one timeout remain in the fixed denominator but do not meet
the registered definitions of sustained rate limiting or repeated timeout
across multiple unrelated materials. Semantic failures are not infrastructure
failures. Run 2 was not authorized or executed.

## Authoritative technical metrics

| Metric | Result |
|---|---:|
| Logical operations | 45 |
| First-pass valid | 18/45 (40%) |
| Final valid | 24/45 (53.33%) |
| Repair attempts | 14/45 (31.11%) |
| Repair success | 6/14 (42.86%) |
| Public provider-operation records | 50 |
| Minimum implied transport attempts | 65 |
| Controlled logical failures | 21 |
| Dependency failures | 12 |
| Median latency | 4,605 ms |
| P95 latency | 89,872 ms |
| Maximum latency | 90,915 ms |

The runner aggregates multi-component assessment calls into sanitized
provider-operation records. Therefore 65 is the conservative transport-attempt
count implied by 50 public records plus 15 repair flags, not a claim that every
internal component call was individually persisted.

## Failure summary by operation type

- Analysis: 7 valid, 1 `RATE_LIMITED`, 1 `TIMEOUT`.
- Assessment generation: 9 valid, 7 `INVALID_OUTPUT`, 5 dependency failures.
- Written grading: 6 valid, 6 dependency failures.
- Revision/retry generation: 2 valid, 1 dependency failure.

The seven assessment failures occurred after the one bounded repair and are the
residual product-output defect. No invalid assessment was persisted.

## Artifact quality

- Persisted structured questions: 24.
- Valid written cases: 11.
- Deterministic grounding: 24/24 (100%).
- Deterministic MCQ-key validity: 24/24 (100%).
- Grounding failures: 0.
- Quote failures: 0.
- Concept-reference failures: 0.
- Mark-reconciliation failures: 0.
- Invalid rubrics entering grading metrics: 0.
- Cross-material evidence defects: 0.
- Duplicate diagnostics: 3/24 (12.5%).

Duplicate diagnostics remain visible and are not counted as infrastructure
failures or silently removed.

## Technical gate

| Gate | Required | Result |
|---|---:|---|
| Final logical validity | at least 43/45 | FAIL — 24/45 |
| Persisted structured questions | at least 30 | FAIL — 24 |
| Valid written cases | at least 10 | PASS — 11 |
| Deterministic grounding | 100% | PASS — 24/24 |
| Deterministic MCQ-key validity | 100% | PASS — 24/24 |
| Invalid rubrics in grading metrics | 0 | PASS |
| Cross-material evidence defects | 0 | PASS |
| Non-skipped Playwright tests | all | PASS — 22/22 |
| Provider-free notebook | passed | PASS |
| Public privacy scan | passed | PASS |

## Reviewer and human status

Reviewer packets were not generated because the technical gate failed. Human
acceptance, answer-key review, written-grading agreement, reviewer agreement,
and adjudication remain unmeasured. No human result was fabricated.

## Recommendation

Do not begin Task 07. Define one narrow follow-up that safely captures sanitized
validator failure codes for the seven post-repair assessment failures and
determines whether a single contract-level correction is justified. Do not
weaken thresholds or broadly experiment with prompts.
