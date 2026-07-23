# Ankur Limitations and Release Boundaries

> Current public release: source ingestion through personalized revision, focused retry, and deterministic improvement comparison.

## Product boundaries

- One source session at a time.
- Up to three PDF pages or three standalone page images.
- Printed Bengali, English, and mixed-language content; handwriting is not a supported claim.
- Exactly one 1-mark MCQ and one 5-mark short-written question.
- No authentication, cloud history, production database, administration, timer, negative marking, or additional question types.
- The adaptive loop is intentionally bounded to one revision plan followed by one retry MCQ and one retry short-written question. It does not provide spaced repetition or evidence of durable retention.

## Model and grading limitations

- Gemma output is probabilistic even with strict prompts and native structured output.
- All important outputs are validated, repaired once when necessary, and rejected if still invalid; this improves safety but cannot prove educational correctness.
- Source-ID and quote validation proves that evidence exists, not that every generated interpretation is pedagogically ideal.
- Written grading is a criterion-level AI estimate and must not be treated as an official academic grade.
- Provider latency, rate limits, availability, and quota vary by project and time. The provider-free sample is therefore intentionally retained.
- The latest bounded Task 04B.2 run achieved 9/9 final-valid operations and 9/9 first-pass validity with zero grounding, quote, concept, or mark-reconciliation failures. First-pass validity is an optimization metric, not an independent release blocker, and a single bounded repair remains available for provider variability.

## Document limitations

- The original PDF is processed in the browser and is never sent through an Ankur API route.
- Scanned pages are rendered and compressed before one page image is sent for transcription.
- OCR/transcription output remains an editable draft and must be explicitly confirmed.
- Poor scans, unusual layouts, handwriting, tables, and mathematical notation may need substantial manual correction.

## Persistence and operational limitations

- Session state is stored in the browser. Clearing site data removes it, and it does not synchronize across devices.
- The public serverless rate limiter is process-memory based and is not a durable global quota system.
- The prototype does not intentionally retain source files or answers on an application server, but selected live-operation content is processed under the applicable Google API terms.
- The prototype is not intended for confidential, regulated, medical, legal, financial, religious-authority, or examination-restricted material.

## Evaluation scope

Published numbers describe the repository fixtures and recorded runs only. They are not universal accuracy, latency, or teacher-equivalence claims. Human review remains necessary for question quality, Bengali transcription quality, and consequential grading decisions.

The Task 06 corpus run produced 30 structured questions, 14 written-answer records, and six material-level adaptive records. Accepted artifacts had zero grounding, quotation, concept-reference, or mark-reconciliation failures, but only 40 of 51 recorded provider application operations or retained attempts were final-valid (78.43%), below the 95% internal target. Three of six adaptive material paths completed. Independent R1/R2 semantic review, adjudication, source-text verification, question acceptance, and written-score agreement are pending; deterministic validator success must not be read as those human results.


## Task 06 human-reviewed quality limitation

The completed internal review found that the current structured question and rubric-generation pipeline does not meet the product-quality gate. Only 1/30 Ankur structured questions passed both question-text and answer/reference acceptance, compared with 29/30 baseline questions. All 14 written cases were excluded from semantic grading-accuracy metrics because the generated rubrics were not validly aligned with their questions. The product must not claim reliable written grading, teacher equivalence, or baseline superiority until Task 06C remediation and a fresh blinded evaluation pass the SSOT gates.
