# Task 06C-R1 Iteration 2

Status: frozen; `REWORK`.

Implementation commits: `bca7bbd`, `3675a19`

The run was interrupted after eight materials. Its saved state was resumed with
an evaluator guard that preserved all existing controlled failures and selected
only the unfinished two-material tail. No failed semantic operation was rerun.

## Result

- Recorded operations: 48 (the inherited runner mixed structured logical
  operations with transcription and baseline provider calls)
- Final valid: 34/48 (70.83%)
- First-pass valid: 26/48 (54.17%)
- Repair success: 8/18 (44.44%)
- Persisted structured questions: 18
- Valid written cases: 9
- Deterministic grounding and key validity: 18/18 (100%)
- Duplicate diagnostic: 1/18
- Grounding, quotation, concept-reference, and reconciliation failures: 0
- Median/P95/maximum latency: 6,866 / 90,072 / 123,206 ms

The first 45 saved records before the interrupted tail contained 34 valid and
11 controlled failures. The three resumed tail calls failed as `UNAVAILABLE`
inside the restricted execution network; a separately authorized diagnostic
confirmed API access and classified the actual assessment defect.

## Sanitized diagnosis

The assessment diagnostic recorded a first-pass
`INVALID_JSON_MAX_TOKENS`. Its sole repair produced an object that remained
semantically invalid:

- `MCQ_DUPLICATE_OPTIONS`
- `MCQ_MULTIPLE_CORRECT_OPTIONS`
- `MCQ_DISTRACTOR_INVALID`
- `LANG_DUPLICATED_CLAUSE`

Iteration 3 therefore increases only the proven shallow artifact budgets,
strengthens distractor constraints, and preserves every deterministic
validator. It also separates the fixed 45 structured logical-operation
denominator from provider attempts, transcription calls, and the fair baseline.

Historical Task 06 and Task 06C evidence remains unchanged.
