# Task 05 Revision-Provider Reliability Repair

## Defect classification

- Release candidate: `03fccd9926cbda9698d72b671ae67aa315fdd598`
- Build ID: `03fccd9926cb`
- Model: `gemma-4-26b-a4b-it`
- Source version ID: `source-01e2d55e`
- Target concepts: 1
- Permitted evidence: 1 segment, 127 characters
- Provider configured: yes
- Provider timeout: 90000 ms
- Revision route maximum duration: 180000 ms

The production-equivalent local reproduction failed only revision-plan validation. The first pass produced `DUPLICATE_PROMPT` at `retryActivity.questions[0].prompt` and `retryActivity.questions[1].prompt`. The bounded repair removed the MCQ duplication but retained `DUPLICATE_PROMPT` at `retryActivity.questions[1].prompt`, so the operation was atomically rejected as `MODEL_OUTPUT_INVALID`.

| Stage | Prompt | Schema | Code | Safe field path | Response characters | Output tokens | Latency (ms) | Repair attempted |
|---|---|---|---|---|---:|---|---:|---|
| First pass | `revision.v1` | `revision-plan.v1` | `DUPLICATE_PROMPT` | `retryActivity.questions[0].prompt` | 5302 | unavailable | 10043 | yes |
| First pass | `revision.v1` | `revision-plan.v1` | `DUPLICATE_PROMPT` | `retryActivity.questions[1].prompt` | 5302 | unavailable | 10043 | yes |
| Repair | `revision-repair.v1` | `revision-plan.v1` | `DUPLICATE_PROMPT` | `retryActivity.questions[1].prompt` | 5397 | unavailable | 9676 | yes |

No source text, learner answer, generated revision content, invalid response object, prompt body, provider body, credential, or hidden reasoning was recorded.

## Local-versus-production metadata

The local reproduction and production failure used the same commit/build, model, team-authored source fixture, source version, one target concept, permitted evidence count/size, provider configuration, 90000 ms provider timeout, and 180000 ms route duration. Both used high thinking for the memory cue, then the generic assessment transport (`assessment.v5`) with minimal thinking on first pass and high thinking on application repair. Output budgets were 650 tokens for the cue and 900/1800/1200 for MCQ/written/rubric. The repair received the invalid retry activity and validation paths but not the original questions, so it could not reliably satisfy cross-attempt distinctness. Production returned controlled HTTP 422 responses in approximately 14–16 seconds; the matching local reproduction returned the same safe `MODEL_OUTPUT_INVALID` category.

## Correction

- Revision prompt versions: `revision.v2` and `revision-repair.v2`
- Provider transports: `revision-item.v1`, `revision-retry-mcq.v1`, `revision-retry-written-question.v1`, and `revision-retry-rubric.v1`
- Thinking: high for the measured adaptive-revision operation
- Output budgets: 650 for each memory cue; 900 each for retry MCQ, written prompt, and rubric
- Repair context: original questions supplied as exclusion data; previous invalid content bounded to the affected shallow component

Gemma supplies only memory-aid text, retry wording/options/explanations, and rubric wording. Application code owns source version, target ordering and IDs, evidence IDs, plan/item/question/rubric IDs, marks and rubric allocations, timestamps, artifact metadata, and deterministic grounding assignments. Native structured output, Zod validation, one provider-schema repair, one application repair, grounding/quote validation, and atomic rejection remain intact.

## Required local reliability sequence

| Run | Final valid | Wall duration (ms) | Provider latency sum (ms) | Grounding | Quotes | Concepts | Reconciliation | Duplicates | State loss | Persistence |
|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | yes | 36659 | 36615 | 0 | 0 | 0 | 0 | 0 | 0 | passed |
| 2 | yes | 76086 | 76048 | 0 | 0 | 0 | 0 | 0 | 0 | passed |
| 3 | yes | 59463 | 59419 | 0 | 0 | 0 | 0 | 0 | 0 | passed |

Result: 3/3 revision operations were final-valid. A fourth post-clean-install verification also passed in 55794 ms wall time with zero validation, persistence, or state-loss failures. The final safe result is recorded in `evaluation/adaptive-loop/RESULTS.md`.
