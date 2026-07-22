# Ankur Limitations and Release Boundaries

> Current public release: source ingestion through mixed-assessment diagnosis.

## Product boundaries

- One source session at a time.
- Up to three PDF pages or three standalone page images.
- Printed Bengali, English, and mixed-language content; handwriting is not a supported claim.
- Exactly one 1-mark MCQ and one 5-mark short-written question.
- No authentication, cloud history, production database, administration, timer, negative marking, or additional question types.
- Revision-note generation, weak-area retry, and improvement comparison are not implemented in this release.

## Model and grading limitations

- Gemma output is probabilistic even with strict prompts and native structured output.
- All important outputs are validated, repaired once when necessary, and rejected if still invalid; this improves safety but cannot prove educational correctness.
- Source-ID and quote validation proves that evidence exists, not that every generated interpretation is pedagogically ideal.
- Written grading is a criterion-level AI estimate and must not be treated as an official academic grade.
- Provider latency, rate limits, availability, and quota vary by project and time. The provider-free sample is therefore intentionally retained.
- The latest bounded Task 04B.2 run achieved 9/9 final-valid operations with zero grounding, quote, concept, or mark-reconciliation failures. First-pass validity was 6/9; all three assessment generations required the one bounded JSON repair. First-pass validity is an optimization metric, not an independent release blocker.

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
