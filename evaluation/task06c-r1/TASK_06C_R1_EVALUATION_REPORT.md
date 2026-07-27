# Task 06C-R1 Reliability Correction — Final Evaluation Report

## Outcome

`TASK 06C-R1 TECHNICAL GATE FAILED — TASK 07 REMAINS BLOCKED`

Three controlled full iterations were run. None met the unchanged gate. No
reviewer packet was generated and no human judgment was invented.

## Engineering correction

- Analysis now returns semantic wording plus one bounded evidence index.
- Application code owns all internal IDs, evidence identities, quotes, and marks.
- Repair context separates mutable output, schema-present locked output, and
  non-output canonical/evidence reference context.
- A component receives at most one bounded repair.
- Provider metadata records finish reason and provider-attempt count.
- Evaluation accounting separates 45 structured logical operations from raw
  provider attempts, transcription, and baseline calls.

## Iterations

| Iteration | Classification | Final validity | Questions | Written | Decision |
|---|---|---:|---:|---:|---|
| Frozen Task 06C baseline | baseline | 33/45 (73.33%) | 18 | 7 | failed |
| R1 iteration 1 | REWORK | 23/43 (53.49%) | 2 | 2 | rejected |
| R1 iteration 2 | REWORK | 34/48 (70.83% mixed records) | 18 | 9 | best observed, below gate |
| R1 iteration 3 | REVERT | 6/45 (13.33%) | 0 | 0 | budget change reverted |

Iteration 2’s inherited runner mixed logical artifacts, baseline calls, and
transcription calls. Iteration 3 is the authoritative fixed-denominator
demonstration: nine analyses, 21 assessments, 12 written evaluations, and three
adaptive artifacts.

## Sanitized diagnoses

Iteration 1 reproduced `QUESTION_CANONICAL_ANSWER_MISMATCH`, exposing a repair
dispatch gap. Iteration 2 exposed `INVALID_JSON_MAX_TOKENS`, followed by:

- `MCQ_DUPLICATE_OPTIONS`
- `MCQ_MULTIPLE_CORRECT_OPTIONS`
- `MCQ_DISTRACTOR_INVALID`
- `LANG_DUPLICATED_CLAUSE`

Iteration 3 tested targeted larger budgets. It regressed to 13
`INVALID_OUTPUT`, two `TIMEOUT`, one `RATE_LIMITED`, and 23 explicit dependency
failures, so that product change was reverted.

## Technical gate

| Gate | Required | Evidence | Result |
|---|---:|---:|---|
| Final logical artifact validity | ≥95% and ≥43/45 | 6/45 fixed-plan | FAIL |
| Persisted structured questions | ≥30 | 18 best observed | FAIL |
| Valid written question–rubric cases | ≥10 | 9 best observed | FAIL |
| Deterministic grounding | 100% | 18/18 best observed | PASS for persisted sample |
| Deterministic MCQ key validity | 100% | 18/18 best observed | PASS for persisted sample |
| Invalid rubrics entering metrics | 0 | 0 | PASS |
| Cross-material evidence defects | 0 | 0 | PASS |
| Notebook restart-and-run-all | passed | passed | PASS |
| Public privacy scan | passed | passed | PASS |
| Non-skipped Playwright | passed | 22 passed, 6 intentional skips | PASS |

Public exports contain sanitized records, not credentials, raw provider bodies,
reviewer identities, or private annotation paths. Private state remains
Git-ignored. Human metrics remain pending and reviewer packets do not exist.

The iteration-3 product budgets were reverted. The retained product
configuration is the best non-regressive iteration-2 configuration; safe
evidence-index ownership, repair separation, attempt metadata, and corrected
evaluation accounting remain.
