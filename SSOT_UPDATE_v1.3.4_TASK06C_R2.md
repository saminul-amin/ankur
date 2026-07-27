# SSOT Update v1.3.4 — Task 06C-R2 outcome

## Status

Task 06C-R2 completed one frozen, fixed-denominator evaluation iteration.
The technical gate did not pass. Task 07 remains unauthorized.

## Locked implementation decisions

- Preserve `analysis-indexed-evidence.v3` and `analysis-semantic.v2`.
- Assessment semantic transport is split into `mcq-semantic.v3` and
  `written-question-semantic.v3`.
- Gemma supplies only one concise MCQ stem, three bounded misconception
  candidates, and one concise written-question stem.
- Application code owns internal IDs, evidence scope, canonical answers,
  required claims, option ordering, correct-option identity, rubric criteria,
  criterion IDs, and the deterministic five-mark allocation.
- A failed semantic artifact receives at most one whole-small-artifact
  regeneration, followed by the full deterministic validator sequence.
- Provider attempts and the fixed 45 logical operations remain separate
  denominators.

## Frozen R2 result

Iteration 1 persisted 12 structured questions and five written cases. It
recorded 12/45 final-valid logical operations, zero grounding failures, zero
quotation failures, zero concept-reference failures, zero mark-reconciliation
failures, 100% deterministic grounding for persisted questions, and 100%
deterministic MCQ-key validity for persisted questions.

All five assessment-generation operations that had a valid upstream analysis
completed successfully. The full gate was blocked by upstream provider
availability: seven of nine analysis operations failed in controlled form
(two timeouts, one rate limit, and four unavailable responses), which produced
explicit dependency failures rather than omissions. One revision operation
also returned unavailable.

No selective rerun was performed. No second implementation iteration was
created because the frozen run did not identify a reproducible defect in the
new deterministic assessment construction.

## Gate decision

- Final logical validity: 12/45 — failed.
- Persisted structured questions: 12 — failed.
- Valid written cases: 5 — failed.
- Deterministic grounding for persisted questions: 12/12 — passed.
- Deterministic MCQ-key validity for persisted questions: 12/12 — passed.
- Invalid rubrics entering grading metrics: 0 — passed.
- Cross-material evidence defects: 0 — passed.
- Provider-free notebook restart-and-run-all: passed.
- Public privacy scan: passed.
- Non-skipped Playwright tests: 22/22 passed.

Reviewer packets were not generated because the technical gate did not pass.
No human judgments or metrics were fabricated.

## Authorization

Task 07 remains blocked. A new evaluation may be authorized only after provider
availability and quota permit one fresh complete fixed-denominator run. The
unchanged Task 06C-R2 technical thresholds remain authoritative.
