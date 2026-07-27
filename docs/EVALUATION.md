# Ankur Evaluation Plan

> **Version:** 1.0.0  
> **Status:** APPROVED

## Task 06 measured package

The frozen-product Task 06 run is published under `evaluation/`. It contains six licensed materials, 30 generated question records, 14 written-answer records, six material-level adaptive records, 51 sanitized provider-operation/attempt records, a six-material one-prompt baseline, pending two-reviewer templates, and a provider-free notebook. The measured final-valid rate was 40/51 (78.43%), below the 95% internal target. Human-dependent quality and grading-agreement metrics remain pending and are not substituted with deterministic validator results.

## 1. Evaluation question

Does Ankur reliably turn learner-confirmed Bengali, English, and mixed source material into evidence-grounded assessments, fair short-answer feedback, and useful weak-area revision?

## 2. Evaluation dimensions

1. Document extraction and transcription.
2. Source grounding.
3. Question and answer-key quality.
4. Written-answer grading.
5. Structured-output reliability.
6. Latency and operational reliability.
7. Bengali usability.
8. End-to-end learning-loop completion.

## 3. Dataset

P0 minimum:

- 6 source materials;
- at least 3 domains;
- Bengali, English, and mixed-language coverage;
- at least 30 generated questions;
- at least 10 written-answer evaluations;
- at least 3 scanned pages with manual reference transcription.

Preferred submission target if time permits:

- 10–15 source materials;
- 50+ questions;
- 15+ written answers.

Use team-authored, public-domain, or openly licensed material only.

## 4. Extraction metrics

### Character Error Rate

```text
CER = (substitutions + deletions + insertions) / reference characters
```

Report separately for Bengali and English sample pages where possible.

### Page success rate

A page succeeds when the complete important educational content is recoverable after user review and no critical line is missing.

```text
page success rate = successful pages / evaluated pages
```

### Uncertainty precision

Human reviewer checks whether model-marked uncertain spans are genuinely uncertain.

## 5. Grounding metrics

### Evidence-ID validity

```text
valid evidence ID rate = references to existing segments / all returned references
```

This should be 100% after application validation because unresolved artifacts are rejected.

### Quote validity

```text
quote validity rate = normalized quotes found in cited segments / returned quotes
```

### Human-supported artifact rate

A human reviewer judges whether the cited segments actually support the generated claim.

```text
human-supported rate = supported artifacts / reviewed artifacts
```

Report question, answer key, explanation, grading feedback, and revision notes separately if sample size permits.

## 6. Question-quality review

Both team members independently score a subset.

Binary checks:

- answerable from source;
- correct answer key;
- exactly one correct MCQ option;
- clear language;
- no material ambiguity;
- plausible distractors;
- appropriate difficulty;
- useful explanation;
- non-duplicate.

Metrics:

- human acceptance rate;
- answer-key correctness rate;
- ambiguity rate;
- duplicate rate;
- reviewer agreement rate.

Disagreements are adjudicated and recorded.

## 7. Written-grading evaluation

Prepare human reference marks using the same fixed rubric before viewing model grades.

Metrics:

```text
MAE = mean(abs(model marks - adjudicated human marks))
exact agreement = identical marks / answers
within-one-mark agreement = abs difference ≤ 1 / answers
missing-concept recall = correctly identified missing concepts / human-identified missing concepts
```

Also rate feedback usefulness from 1 to 5 using:

- correctness;
- actionability;
- tone;
- evidence relevance.

Do not claim official teacher equivalence from a small internal sample.

## 8. Structured-output reliability

Record per task:

- first-pass schema-valid rate;
- repair-attempt rate;
- repair success rate;
- final controlled-failure rate;
- evidence-repair rate;
- final accepted-artifact rate.

## 9. Latency and reliability

For each task, record:

- median latency;
- P95 latency where sample size supports it;
- timeout rate;
- provider error rate;
- complete-flow success rate;
- number of model calls per completed session.

Rate limits depend on the active Gemini API project tier, so report observed conditions and the test date rather than presenting a universal quota.

## 10. Baseline comparison

Baseline prompt:

> Read this source and create a quiz.

Use the same model and source where possible. Compare the baseline with Ankur's structured pipeline on:

- schema validity;
- evidence availability;
- answer-key correctness;
- ambiguity;
- feedback transparency;
- weak-concept revision usefulness.

This isolates the value of Ankur's pipeline from the underlying model.

## 11. Reproducibility record

Every evaluation row includes:

- source fixture ID and hash;
- source language/domain;
- model ID;
- prompt version;
- schema version;
- thinking level;
- generation configuration;
- request timestamp;
- measured latency;
- raw human labels;
- adjudication result.

Do not publish API keys, private source content, or unlicensed pages.

## 12. Claims policy

Only report measured values. Use phrases such as:

- “On our internal six-document evaluation set…”
- “In 30 reviewed generated questions…”
- “The prototype achieved…”

Avoid:

- “always accurate”;
- “teacher-level”;
- “perfect OCR”;
- “works with any document”;
- unsupported comparison to unrelated products.

## 13. Evaluation acceptance gate

The application may be submitted with honest limitations, but these defects block source-grounded claims:

- accepted question with nonexistent evidence;
- wrong answer key not caught in human review;
- grading marks outside rubric bounds;
- revision introducing unsupported facts;
- fabricated or irreproducible metric.

## 14. Final Task 06 human-reviewed result — 23 July 2026

The pending-human-review status is closed. The authoritative artifacts are:

- `evaluation/exports/task06-closure-metrics.json`
- `evaluation/exports/question-pipeline-comparison.csv`
- `evaluation/exports/reviewer-agreement.csv`
- `evaluation/exports/reliability-reclassification.json`
- `evaluation/exports/written-evaluation-validity.csv`
- `evaluation/reports/TASK_06_FINAL_CLOSURE_REPORT.md`

Two independent reviewers completed blinded Pass A and Pass B review, confirmed duplicate-scope corrections, and jointly adjudicated all 155 disagreement fields.

The evaluation process passed, but the product-quality gate failed:

- Ankur overall question acceptance: 1/30 (3.33%).
- One-prompt baseline overall acceptance: 29/30 (96.67%).
- Ankur answer/key correctness: 11/30 (36.67%).
- Written cases eligible for grading-accuracy metrics: 0/14 because every generated rubric was materially misaligned with its question.
- Final logical artifact validity: 40/44 (90.91%), below the 95% target.

The former 40/51 final-valid percentage is retired because it mixed seven attempt rows with 44 logical operations. Reliability is now reported separately for request attempts, provider availability, logical first-pass validity, repair success, and final logical artifact validity.

Task 07 is blocked. The authorized next work is Task 06C question and rubric remediation followed by a fresh evaluation.

## 15. Task 06C re-evaluation protocol

Task 06C is isolated under `evaluation/task06c/`; it never replaces the frozen Task 06 exports.

- Corpus: the same six frozen public-safe materials plus three new team-authored CC BY 4.0 holdouts.
- Coverage: three domains; Bengali, English, and mixed language; the frozen digital-PDF, image, mixed-PDF, and pasted-text routes remain represented.
- Generation plan: 42 Ankur questions and 42 one-prompt baseline questions under equivalent requested counts and the same `gemma-4-26b-a4b-it` provider conditions.
- Review: fresh neutral IDs, independently shuffled R1/R2 order, Pass A before Pass B, no reused Task 06 labels, a private coordinator mapping, authorship-conflict declarations, attestations, and disagreement-only adjudication.
- Written evaluation: an invalid question–rubric pair is excluded before grading; empty answers are deterministic `0/5`, `not_answered`, provider-free, and have feedback usefulness `not_applicable`.
- Reproducibility: the Task 06C notebook reads committed public-safe normalized exports only and reports Task 06 historical metrics separately.

Reliability denominators are explicit:

```text
provider attempt = one network request, including a schema or semantic repair request
logical operation = one requested canonical answer, question, rubric, written evaluation, or adaptive artifact
```

Provider availability and first-pass schema validity use provider-attempt observations where specified. First-pass semantic validity, repair rate, final logical validity, alignment validity, and controlled failure use logical-operation denominators. A repair never creates a second logical artifact.

Until fresh generation, independent human review, and adjudication finish, the Task 06C human metrics and gate result remain `pending`; pending is not passing and Task 07 remains blocked.

### Task 06C frozen run result

The single live run completed with 33/45 final-valid logical operations
(73.33%), 18 persisted Ankur questions, 42 parsed baseline questions, and seven
written cases. It therefore failed the 95% logical-validity and minimum-ten
written-case gates before human review. The public-safe report is
`evaluation/task06c/TASK_06C_EVALUATION_REPORT.md`; Task 06 historical metrics
remain unchanged.

## 16. Task 06C-R1 reliability correction

Task 06C-R1 is isolated under `evaluation/task06c-r1/`. Three controlled
iterations are frozen: iteration 1 is `REWORK` (23/43, two questions), iteration
2 is `REWORK` (34/48 mixed runner records, 18 questions, nine written records),
and iteration 3 is `REVERT` (6/45, zero questions).

Iteration 3 introduced the corrected denominator: exactly 45 structured logical
artifacts (nine analyses, 21 assessments, 12 written evaluations, and three
adaptive artifacts). Baseline and transcription calls remain provider attempts
but are excluded from that logical denominator. Missing dependent artifacts are
explicit `DEPENDENCY_UNAVAILABLE` controlled failures.

The provider-free notebook reads only public-safe exports. The technical gate
failed, so reviewer packets were not generated and Task 07 remains blocked.

## 17. Task 06C-R2E provider-stable evaluation

Task 06C-R2E is isolated under `evaluation/task06c-r2e/` and changes no product
prompt, schema, validator, or generation behavior. Three small bounded requests
must pass before a fixed run begins. A complete run always retains the
45-logical-operation denominator; provider attempts, baseline calls, and
transcription calls remain separately reported.

Run 1 passed the 3/3 preflight and was classified `INFRASTRUCTURE_VALID`: all
nine baselines completed, seven of nine analyses completed, there was no
authentication failure, provider-wide unavailability, or explicit quota
exhaustion, and the single rate limit plus single timeout did not constitute
sustained or repeated cross-material infrastructure failure. Semantic
`INVALID_OUTPUT` failures cannot be reclassified as infrastructure failures.

The authoritative result was 24/45 final-valid logical operations, 24 persisted
questions, and 11 written cases. Persisted deterministic grounding and MCQ-key
validity were 100%, with zero invalid rubrics entering grading metrics and zero
cross-material evidence defects. Seven assessment operations failed after their
bounded repair, so the technical gate failed before human review. Task 07
remains blocked.
