# Ankur Task 06 Human Review Protocol

> Schema version: `human-question-annotation.v1` and `human-written-annotation.v1`
> Status: prepared; R1/R2 review and adjudication are pending.

## Roles and blinding

- `R1` and `R2` review independently.
- Neither reviewer may see the other reviewer’s rows before both first passes are locked.
- `ADJ` is completed only after R1 and R2 are locked. The adjudicator records a final value and a short disagreement reason where the reviewers differ.
- Reviewer identities remain in a private team log. Public exports use only `R1`, `R2`, and `ADJ`.

Do not fill a row if you authored that exact answer or question. Assign it to the other reviewer and disclose the conflict in the private review log.

## Materials

Use:

- `evaluation/records/public/question-records.json`;
- `evaluation/records/public/written-grading-records.json`;
- `evaluation/corpus/public/manifest.json`;
- `evaluation/annotations/templates/question-annotations.csv`;
- `evaluation/annotations/templates/written-annotations.csv`.

Reviewers may read only the confirmed source pages and evidence IDs for the row being reviewed. They must not inspect provider diagnostics, the other reviewer’s labels, or aggregate metrics during independent review.

## Question review

For each question:

1. Resolve every evidence segment ID against the material’s confirmed source.
2. Mark `sourceGrounded` only when the cited text supports the question and expected answer.
3. For MCQs, independently solve the item before checking `correctOptionId`.
4. Mark `answerableFromEvidence` only when no outside knowledge is required.
5. Mark `ambiguous` when more than one answer is defensible or essential wording is unclear.
6. Mark `duplicate` for materially equivalent meaning, not merely a shared topic.
7. Judge language quality in the language used by the source.
8. Mark `accept` only when the item is grounded, answerable, clear, fair, and has a correct key where applicable.

`ADJ` rows contain final values, not averages.

## Written-answer review

For each written case, independently record:

- mark from 0 to 5 using the generated fixed rubric;
- `correct`, `partially_correct`, `incorrect`, or `not_answered`;
- covered concept IDs;
- missing concept IDs;
- incorrect or unsupported claims;
- feedback usefulness from 1 (not useful) to 5 (very useful).

Review the learner answer before looking at Gemma’s mark. Empty answers must be `0/5` and `not_answered`.

## Completion and adjudication

1. R1 completes and locks all assigned rows.
2. R2 completes and locks all assigned rows independently.
3. A coordinator checks only for missing cells and invalid identifiers.
4. ADJ resolves disagreements against the confirmed source and rubric.
5. Place completed files under `evaluation/annotations/completed-private/`.
6. Run the sanitization/export tool before publishing any reviewed aggregate.

Never copy reviewer names, emails, private notes, raw provider responses, or credentials into public files.

## Agreement metrics

After completion, calculate:

- raw categorical agreement;
- Cohen’s kappa for categorical labels when both reviewers used all required fields;
- absolute mark-difference distribution;
- exact and within-one-mark agreement;
- Gemma-versus-adjudicated MAE;
- status agreement.

When a denominator is zero or review is incomplete, report `pending`; never substitute validator success for a human label.
