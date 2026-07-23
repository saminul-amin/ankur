# Task 06 Final Evaluation Closure Report

> **Product baseline:** `3728724ef4140666566bb9f72fd5dfb55bc523c3`
> **Evaluation implementation commit:** `7487ea020c609a1973378a0216a57e2258fc9713`
> **Model:** `gemma-4-26b-a4b-it`
> **Human evidence:** complete and adjudicated
> **Task 06 evidence closure:** **PASSED**
> **Product quality gate:** **FAILED**
> **Task 07:** **BLOCKED pending remediation and re-evaluation**

## Executive verdict

Task 06 is complete as an evaluation and evidence-closure exercise. Two independent reviewers completed blinded Pass A and Pass B review, confirmed duplicate-scope corrections, and jointly adjudicated every disagreement. The source-verification evidence is complete.

The measured product result is not acceptable for progression. On the six-material corpus, only **1 of 30 Ankur structured questions (3.33%)** passed both question-text acceptance and answer/reference acceptance, versus **29 of 30 baseline questions (96.67%)**. All 14 written-answer cases were excluded from semantic grading-accuracy metrics because the generated rubrics did not validly align with the questions.

This result must be treated as a finding, not hidden or diluted. The next engineering work is remediation of question generation, rubric construction, and validation gates—not Task 07 feature expansion.

## Corpus and review evidence

| Evidence | Count | Status |
|---|---:|---|
| Licensed source materials | 6 | Complete |
| Source pages reviewed | 9 | 9/9 reviewer agreement |
| Ankur structured questions | 30 | Adjudicated |
| One-prompt baseline questions | 30 | Adjudicated |
| Written cases | 14 | Adjudicated, then excluded for invalid rubrics |
| Independent reviewers | 2 | R1 and R2 |
| Field-level adjudication disagreements | 155 | 155/155 resolved |

All nine source pages were independently confirmed with no material omission or material transcription error.

## Extraction

| Metric | Result |
|---|---:|
| Page success | 9/9 (100.00%) |
| Routing accuracy | 9/9 (100.00%) |
| Mean character error rate | 0.686% |
| Pages over correction heuristic | 2/9 (22.22%) |

Extraction and source confirmation are the strongest part of the prototype.

## Reviewer agreement

Agreement is reported before adjudication and after the reviewer-confirmed cross-pipeline duplicate-scope correction.

| Field | Exact agreement | Kappa |
|---|---:|---:|
| Source grounding | 96.67% | 0.4872 |
| Answerability | 96.67% | 0.4872 |
| Clarity | 90.00% | 0.6897 |
| Ambiguity | 90.00% | 0.6897 |
| Fair difficulty | 91.67% | 0.7500 |
| Within-pipeline duplication | 86.67% | 0.6364 |
| Pass A acceptance | 91.67% | 0.8201 |
| Language quality | 71.67% | 0.6517 weighted |
| Answer/key correctness | 88.33% | 0.7009 |
| Answer/key grounding | 88.33% | 0.6008 |
| Pass B acceptance | 91.67% | 0.8000 |
| Explanation usefulness | 66.67% | 0.8187 weighted |
| Derived overall acceptance | 95.00% | 0.9000 |

The reviewers agreed on the final accept/reject interpretation for 57/60 questions (95.00%) before adjudication. Exact agreement on all 12 reviewed fields occurred for 28/60 questions (46.67%), which justifies the disagreement-only adjudication stage.

## Question-quality comparison

### Headline comparison

| Metric | Ankur structured | One-prompt baseline | Difference |
|---|---:|---:|---:|
| Source grounded | 27/30 (90.00%) | 30/30 (100.00%) | -10.00 pp |
| Clear | 17/30 (56.67%) | 29/30 (96.67%) | -40.00 pp |
| Ambiguous | 13/30 (43.33%) | 1/30 (3.33%) | +40.00 pp |
| Fair difficulty | 16/30 (53.33%) | 30/30 (100.00%) | -46.67 pp |
| Pooled within-pipeline duplicates | 18/30 (60.00%) | 0/30 (0.00%) | +60.00 pp |
| Pass A accepted | 7/30 (23.33%) | 29/30 (96.67%) | -73.34 pp |
| Answer/key correct | 11/30 (36.67%) | 30/30 (100.00%) | -63.33 pp |
| Answer/key grounded | 16/30 (53.33%) | 30/30 (100.00%) | -46.67 pp |
| Pass B accepted | 10/30 (33.33%) | 30/30 (100.00%) | -66.67 pp |
| **Overall accepted** | **1/30 (3.33%)** | **29/30 (96.67%)** | **-93.34 pp** |
| Language quality mean | 3.300/5 | 4.967/5 | -1.667 |
| Explanation usefulness mean | 3.367/5 | 4.900/5 | -1.533 |

**Duplicate caveat:** the duplicate metric pools multiple Ankur assessment/retry runs but only one baseline run per material. It is a useful corpus-level diagnostic, not a clean per-call comparison. The other acceptance, correctness, clarity, and grounding results are not dependent on that duplicate denominator.

### Main Ankur failure dimensions

| Failure dimension | Questions |
|---|---:|
| Incorrect proposed answer/key | 19 |
| Pooled within-pipeline duplication | 18 |
| Language quality below 4/5 | 16 |
| Unclear | 14 |
| Ambiguous | 14 |
| Unfair difficulty | 14 |
| Ungrounded answer/key | 14 |
| Explanation usefulness below 4/5 | 12 |
| Not source-grounded | 3 |
| Not answerable from source | 3 |

The dominant problem is not source extraction. It is artifact construction: malformed wording, repeated questions, incorrect or weakly grounded keys, and unreliable explanations.

## Written-answer evaluation

All **14/14 written cases** were jointly classified as `exclude_invalid_rubric`. The generated rubrics did not validly align with the questions, including:

- evacuation-priority questions graded against broad household-planning checklists;
- radiation questions graded against malformed mode-listing rubrics;
- stored-energy questions graded against broad lockout sequences;
- spill-response questions graded against chemical-label rubrics.

Consequently, these metrics are **not applicable**:

- human-versus-model mark MAE;
- exact mark agreement;
- within-one-mark agreement;
- status agreement;
- missing-concept recall.

Reporting numerical grading accuracy from these cases would be methodologically invalid.

A separate deterministic behavior remains valid: both empty-answer cases were handled without a provider call and returned `0` with `not_answered` — **2/2 (100%)**.

Diagnostic-only feedback review found grounded feedback in 2/11 applicable cases (18.18%), with mean usefulness 1.455/5. This is failure analysis, not a grading benchmark.

## Reliability denominator reclassification

The old **40/51 (78.43%)** “final valid” rate mixed request attempts and logical operations. It is retired.

| Reliability concept | Correct denominator | Result |
|---|---|---:|
| Provider availability | 51 request attempts | 47/51 (92.16%) |
| First-pass logical artifact validity | 44 logical operations | 24/44 (54.55%) |
| Repair attempted | 44 logical operations | 19/44 (43.18%) |
| Repair success | 19 repaired logical operations | 16/19 (84.21%) |
| Final logical artifact validity | 44 logical operations | 40/44 (90.91%) |
| Controlled logical failure | 44 logical operations | 4/44 (9.09%) |

Final logical artifact validity remains below the internal 95% target.

## Adaptive loop

| Metric | Result |
|---|---:|
| Valid material-level loops | 3/6 (50.00%) |
| Controlled failures | 3/6 (50.00%) |
| Fabricated weaknesses | 0 |
| Mean score change on valid loops | +5.000 |

The positive score change is descriptive for three successful loops only and must not be generalized.

## Gate decision

### Passed

- Corpus coverage and licensing.
- Extraction routing and source verification.
- Independent review, attestation, and adjudication.
- Evidence integrity and reproducibility.
- Transparent reliability denominator correction.
- Honest exclusion of invalid written-grading cases.

### Failed

- Structured question-quality gate.
- Answer/key correctness gate.
- Rubric validity gate.
- Baseline superiority requirement.
- 95% final logical artifact-validity target.

## Required remediation before Task 07

1. Replace free-form mixed assessment generation with per-question-type schemas and deterministic validators.
2. Add a rubric-question semantic-alignment gate before any written grading call.
3. Reject malformed Bengali/English wording and duplicate options before persistence.
4. Generate correct answers from verified evidence first, then synthesize distractors around that locked answer.
5. Deduplicate within each generation call and against the material question bank.
6. Separate revision/retry prompts from original assessment prompts and prohibit copying earlier stems.
7. Re-run the same frozen six-material protocol plus a fresh holdout set.
8. Require Ankur to meet or exceed the baseline on overall acceptance and achieve at least 90% correct/grounded keys before Task 07.

## Final status

```text
Task 06 evidence closure: PASSED
Human review and adjudication: PASSED
Product quality gate: FAILED
Task 07 authorization: BLOCKED
Next authorized work: Task 06C remediation and re-evaluation
```
