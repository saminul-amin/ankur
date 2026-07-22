# Task 04B.2 Provider Reliability Benchmark

- Gate: **PASSED**
- Started: 2026-07-22T12:54:22.977Z
- Completed: 2026-07-22T12:55:07.137Z
- Fixture: team-authored repository photosynthesis source
- Correct-answer fixture: team-authored complete paraphrase, not the generated reference text
- Partial-answer fixture: team-authored incomplete paraphrase, not source or generated-reference text
- Model: `gemma-4-26b-a4b-it`
- Assessment thinking: `minimal` first pass; `high` only for bounded application repair
- Written-grading thinking: `high`
- Non-empty structural schema-repair thinking: `minimal`
- Assessment prompt/schema: `assessment.v5`; `assessment-mcq.v5`, `assessment-written-question.v5`, and `assessment-written-rubric.v5`
- Written prompt/schema: `written-evaluation.v5`; `written-evaluation-transport.v5`
- Provider operations completed: 9/9
- First-pass validated: 9/9 (100.0%) — optimization metric only
- Repaired-valid operations: 0
- Repair rate: 0.0%
- Final validated success: 9/9 (100.0%)
- Grounding failures: 0
- Quote failures: 0
- Criterion/mark reconciliation failures: 0
- Concept failures: 0
- Deterministic empty-answer checks: 3/3
- Provider calls caused by empty answers: 0
- Controlled state-preservation checks: 3/3
- Median operation latency: 3079 ms
- Maximum operation latency: 8867 ms
- Prompt tokens reported: 9496
- Output tokens reported: 1263
- Network retries: 0

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
| assessment-1 | yes | yes | 8867 | 3 | 1715 | 248 | 0 |
| correct-1 | yes | yes | 2724 | 1 | 737 | 83 | 0 |
| partial-1 | yes | yes | 3162 | 1 | 714 | 90 | 0 |
| assessment-2 | yes | yes | 8595 | 3 | 1715 | 247 | 0 |
| correct-2 | yes | yes | 2914 | 1 | 736 | 86 | 0 |
| partial-2 | yes | yes | 2952 | 1 | 713 | 88 | 0 |
| assessment-3 | yes | yes | 8806 | 3 | 1715 | 248 | 0 |
| correct-3 | yes | yes | 3047 | 1 | 737 | 83 | 0 |
| partial-3 | yes | yes | 3079 | 1 | 714 | 90 | 0 |

## Sanitized failure taxonomy

No schema or controlled-operation failures were observed.

The report stores no credential, raw source, prompt, model response, reference answer, or student answer.
