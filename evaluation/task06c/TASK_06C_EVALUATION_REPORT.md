# Task 06C evaluation report

> Date: 24 July 2026
> Result: FAILED
> Task 07: UNAUTHORIZED

## Historical boundary

The final Task 06 corpus, private review evidence, public exports, notebook, and
reported metrics are unchanged. Task 06C uses the separate
`evaluation/task06c/` corpus and record roots.

## Engineering remediation

Task 06C introduced evidence-first v2 artifact contracts and deterministic
validators. Construction now proceeds from composite-scoped evidence to a
locked canonical answer, then to question wording, distractors or rubric,
semantic validation, one bounded repair, and persistence or controlled failure.
The public `activity-set.v2` contract remains compatible.

The provider transports are deliberately shallow:

- application code owns source scope, evidence IDs, concepts, canonical answer,
  option IDs, correct key, rubric IDs and marks;
- Gemma 4 supplies bounded semantic wording;
- repaired output cannot change locked fields;
- invalid repaired artifacts are rejected atomically.

## Evaluation protocol

The live evaluation used the six unchanged Task 06 materials and three unseen
team-authored CC BY 4.0 holdouts. The same `gemma-4-26b-a4b-it` model and
equivalent requested question counts were used for the structured and
one-prompt baseline pipelines. Operations ran sequentially with checkpointing.
Completed material operations were not regenerated after results were observed.

The public provider-free records contain no provider body, prompt body, hidden
reasoning, credential, reviewer identity, or private reviewer note.

## Reliability denominators

- **Logical operation:** one requested analysis, transcription, structured
  assessment, revision/retry, written grading, or baseline generation operation.
- **Provider attempt:** one provider request. A bounded repair is a second
  provider attempt for the same logical operation.
- **First-pass validity:** operations valid after their first provider attempt,
  divided by logical operations.
- **Repair success:** successful repairs divided by repair attempts.
- **Final logical validity:** operations valid after zero or one repair, divided
  by logical operations.

The live run recorded 45 logical operations and 72 provider attempts. A repair
was attempted for 27 operations.

## Live results

| Measure | Result |
|---|---:|
| First-pass valid | 18/45 (40.00%) |
| Final logical operations valid | 33/45 (73.33%) |
| Repair successful | 15/27 (55.56%) |
| Controlled failures | 12 |
| Ankur questions persisted | 18 |
| One-prompt baseline questions parsed | 42 |
| Written cases persisted | 7 |
| Adaptive records | 9 |
| Deterministic grounding failures in persisted questions | 0 |
| Deterministic key failures in persisted questions | 0 |
| Invalid rubrics included in grading metrics | 0 |

Controlled failures were three `analysis/EVIDENCE_INVALID`, seven
`assessment_generation/INVALID_OUTPUT`, and two
`revision_retry_generation/INVALID_OUTPUT` operations. Failure records are
sanitized and contain no semantic payload.

The automated duplicate diagnostic marked 6/18 persisted Ankur questions as
duplicates under its recorded scopes. This diagnostic is not reclassified as a
human finding.

## Frozen-material and holdout outcome

The frozen and holdout cohorts were both attempted without changing their source
materials. Only three materials produced complete Ankur assessment pairs, while
all nine baseline operations parsed successfully. Aggregate human-quality
comparisons are not reported because the structured pipeline produced only 18
questions and seven written cases.

## Human review and adjudication

Fresh Task 06C R1/R2 review was not started. Issuing incomplete packets would
not meet the required 30-question and 10-written-case minimums, and reusing Task
06 labels is forbidden. No annotation, acceptance metric, grading agreement, or
adjudication result has been invented.

## Acceptance gates

| Gate | Threshold | Observed | Status |
|---|---:|---:|---|
| Answer/key correctness | >= 90% | no fresh human denominator | PENDING |
| Answer/key grounding | >= 90% | no fresh human denominator | PENDING |
| Overall human question acceptance | >= 80% | no fresh human denominator | PENDING |
| Ankur acceptance >= baseline | required | no fresh human denominator | PENDING |
| Question-rubric alignment | >= 90% | no fresh human denominator | PENDING |
| Eligible written cases | >= 10 | 7 | FAILED |
| Written within-one-mark agreement | >= 80% | no fresh human denominator | PENDING |
| Final logical artifact validity | >= 95% | 33/45 (73.33%) | FAILED |
| Accepted cross-material evidence defects | 0 | no human-accepted denominator | PENDING |
| Invalid rubrics included in grading metrics | 0 | 0 | PASSED |
| Provider-free notebook restart/run-all | passed | passed | PASSED |
| Public privacy scan | passed | passed | PASSED |

## Remaining limitations

- The first live evidence-first transport remains unreliable for assessment and
  revision/retry generation.
- The incomplete structured sample prevents a fair human Ankur-versus-baseline
  quality comparison.
- Deterministic acceptance of persisted artifacts is not a substitute for
  independent review.
- A future corrective task must increment affected prompt/schema versions,
  remain separately committed, and rerun all affected records without changing
  the acceptance thresholds.

Task 06C did not meet its acceptance gate. Task 07 remains blocked.
