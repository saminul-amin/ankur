# Task 06C-R1 Iteration 3

Status: frozen; `REVERT`.

Implementation commit: `7b62976`

This was the third and final controlled full evaluation. It used the fixed
45-logical-operation denominator and stored raw provider calls separately in
`provider-attempts.json`.

## Result

- Logical operations: 45
- First-pass valid: 2/45 (4.44%)
- Final valid: 6/45 (13.33%)
- Repair success: 4/18 (22.22%)
- Controlled failures: 39
- Persisted structured questions: 0
- Valid written cases: 0
- Baseline parse success: 9/9
- Grounding, quotation, concept-reference, and reconciliation failures: 0
- P95/maximum logical-operation latency: 147,500 / 161,818 ms

Failure categories were 13 `INVALID_OUTPUT`, two `TIMEOUT`, one
`RATE_LIMITED`, and 23 deterministic `DEPENDENCY_UNAVAILABLE` results. The
dependency failures are explicit fixed-plan artifacts, not additional provider
attempts.

## Decision

The targeted larger output budgets did not prevent invalid assessment output
and materially worsened completion and latency. The product portion of this
change is reverted. The fixed-denominator and provider-attempt separation is
retained because it corrects evaluation accounting without changing product
behavior.

No reviewer packets are generated because the technical gate failed.
Historical Task 06 and Task 06C evidence remains unchanged.
