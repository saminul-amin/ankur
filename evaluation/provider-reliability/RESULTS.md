# Task 04B.2 Provider Reliability Benchmark

- Gate: **PASSED**
- Started: 2026-07-22T11:44:14.278Z
- Completed: 2026-07-22T11:47:43.998Z
- Fixture: team-authored repository photosynthesis source
- Correct-answer fixture: team-authored complete paraphrase, not the generated reference text
- Model: `gemma-4-26b-a4b-it`
- Assessment thinking: `minimal` first pass; `high` only for bounded application repair
- Written-grading thinking: `high`
- Non-empty structural schema-repair thinking: `minimal`
- Assessment prompt/schema: `assessment.v4`; `assessment-mcq.v4` and `assessment-written.v4`
- Written prompt/schema: `written-evaluation.v4`; `written-evaluation-transport.v4`
- Provider operations completed: 9/9
- First-pass validated: 6/9 (66.7%) — optimization metric only
- Repaired-valid operations: 3
- Repair rate: 33.3%
- Final validated success: 9/9 (100.0%)
- Grounding failures: 0
- Quote failures: 0
- Criterion/mark reconciliation failures: 0
- Concept failures: 0
- Deterministic empty-answer checks: 3/3
- Provider calls caused by empty answers: 0
- Controlled state-preservation checks: 3/3
- Median operation latency: 4097 ms
- Maximum operation latency: 63820 ms
- Prompt tokens reported: 13904
- Output tokens reported: 9017
- Network retries: 0

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
| assessment-1 | yes | no | 62097 | 2 | 3568 | 2763 | 0 |
| correct-1 | yes | yes | 3833 | 1 | 550 | 133 | 0 |
| partial-1 | yes | yes | 3535 | 1 | 519 | 105 | 0 |
| assessment-2 | yes | no | 61005 | 2 | 3568 | 2763 | 0 |
| correct-2 | yes | yes | 4097 | 1 | 550 | 129 | 0 |
| partial-2 | yes | yes | 3600 | 1 | 519 | 105 | 0 |
| assessment-3 | yes | no | 63820 | 2 | 3569 | 2801 | 0 |
| correct-3 | yes | yes | 4478 | 1 | 546 | 113 | 0 |
| partial-3 | yes | yes | 3225 | 1 | 515 | 105 | 0 |

## Sanitized failure taxonomy

| Operation | Phase | Category | Code | Field path | Expected | Model | Prompt | Schema |
|---|---|---|---|---|---|---|---|---|
| assessment-1 | first_pass | invalid_json | INVALID_JSON_MAX_TOKENS | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |
| assessment-2 | first_pass | invalid_json | INVALID_JSON_MAX_TOKENS | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |
| assessment-3 | first_pass | invalid_json | INVALID_JSON_MAX_TOKENS | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |

The report stores no credential, raw source, prompt, model response, reference answer, or student answer.
