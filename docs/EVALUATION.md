# Ankur Evaluation Plan

> **Version:** 1.0.0  
> **Status:** APPROVED

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
