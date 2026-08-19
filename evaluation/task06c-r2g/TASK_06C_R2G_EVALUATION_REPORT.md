# Task 06C-R2G evaluation report

## Scope

Task 06C-R2G measures the multilingual generation-reliability correction against
the unchanged Task 06C-R2F evaluation design: the same nine-material
frozen-plus-holdout corpus, the same fixed 45-operation logical denominator, the
same answer cases, the same metrics, and the same acceptance thresholds. Only the
output root differs, so every frozen R2F record is untouched and the two runs are
directly comparable.

The correction changed provider transport behaviour, provider-facing schema
bounds, and deterministic post-processing. It changed no prompt, validator,
threshold, grounding rule, canonical answer, correct-option identity, rubric
construction, mark allocation, or model identity.

## Provider stability preflight

3/3 bounded requests succeeded before the run started, so the run is
infrastructure-valid and authoritative.

## Measured result

| Metric | R2F | R2G | Change |
|---|---:|---:|---|
| Logical operations | 45 | 45 | fixed denominator |
| First-pass valid | 22/45 — 48.89% | **31/45 — 68.89%** | +9 operations |
| Final valid | 33/45 — 73.33% | **38/45 — 84.44%** | +5 operations |
| Repair attempts | 14 | 10 | −4 |
| Repair successes | 11/14 — 78.57% | 7/10 — 70.00% | fewer repairs needed |
| Persisted structured questions | 42 | **46** | +4 |
| Valid written cases | 18 | **22** | +4 |
| Deterministic grounding | 42/42 — 100% | **46/46 — 100%** | preserved |
| Deterministic MCQ-key validity | 42/42 — 100% | **46/46 — 100%** | preserved |
| Invalid rubrics entering grading metrics | 0 | 0 | preserved |
| Cross-material evidence defects | 0 | 0 | preserved |
| Fabricated weaknesses | 0 | 0 | preserved |
| Duplicate diagnostics | 7/42 — 16.67% | **6/46 — 13.04%** | −3.63 points |
| Mean transcription character error rate | 0.005145 | **0.004312** | −16% |
| Page extraction success and routing accuracy | 12/12 — 100% | 12/12 — 100% | preserved |
| Baseline parse success | 9/9 — 100% | 9/9 — 100% | unchanged |
| Adaptive artifacts valid | — | 6/9 — 66.67% | measured |
| Median operation latency | — | 5,113 ms | measured |
| 95th-percentile latency | — | 61,780 ms | measured |

## Remaining failures

Seven of 45 operations were invalid:

| Operation | Category |
|---|---|
| `analysis:VOC-MIX-IMG-01` | `INVALID_OUTPUT` |
| `assessment:CIV-MIX-PDF-01:r2` | `INVALID_OUTPUT` |
| `assessment:VOC-EN-PASTE-02:r1` | `INVALID_OUTPUT` |
| `assessment:VOC-MIX-IMG-01:r1` | `DEPENDENCY_UNAVAILABLE` |
| `assessment:VOC-MIX-IMG-01:r2` | `DEPENDENCY_UNAVAILABLE` |
| `written:VOC-MIX-IMG-01:unsupported_claim` | `DEPENDENCY_UNAVAILABLE` |
| `written:VOC-MIX-IMG-01:missing_key_concept` | `DEPENDENCY_UNAVAILABLE` |

Four of the seven are the deterministic downstream consequence of the single
failed analysis, recorded as explicit `DEPENDENCY_UNAVAILABLE` rather than
silently dropped from the denominator.

The 18 sanitized semantic diagnostics show what remains:

| Code | Phase | Count |
|---|---|---:|
| `INVALID_JSON_MAX_TOKENS` | first pass | 8 |
| `REPAIR_RESPONSE_INVALID_MAX_TOKENS` | repair | 4 |
| `EMPTY_RESPONSE_RECITATION` | first pass | 4 |
| `QUESTION_CANONICAL_ANSWER_MISMATCH` | first pass | 1 |
| `SCHEMA_MISMATCH_STOP` (`$.misconception3`) | first pass | 1 |

Every remaining failure is provider transport behaviour — a degenerate
repetition loop that exhausts the output budget, or a recitation stop — not a
defect in generated learning quality. **Zero `LANG_*` semantic failures remain,
against nine in the frozen R2F run**, so the specific defect class that produced
the R2F Bengali and mixed-language assessment failures is closed.

## Gate and disposition

The unchanged 43/45 (95.6%) final-validity gate **failed** at 38/45 (84.44%).

The run is classified `KEEP`: final validity improved by five operations,
first-pass validity by nine, persisted questions by four, and written cases by
four, while every deterministic correctness measure stayed at 100% and the
duplicate rate fell.

Reviewer packets were not generated. All human quality and grading-agreement
metrics remain `pending` — pending is not passing. Task 07 remains unauthorized.

## Honest framing

Ankur rejects invalid generated artifacts rather than persisting them. In this
run every persisted question was grounded in its source and had a
deterministically valid answer key, and no weakness was fabricated. Overall
structured-generation availability improved substantially but remains below the
project's strict internal reliability target, and the residual failures are
provider-side output pathologies that bounded deterministic recovery does not
always reach.
