# Task 04B.2 Provider Reliability Benchmark

- Gate: **PASSED**
- Started: 2026-07-22T10:40:44.359Z
- Completed: 2026-07-22T10:44:10.347Z
- Fixture: team-authored repository photosynthesis source
- Model: `gemma-4-26b-a4b-it`
- Assessment thinking: `minimal` first pass; `high` only for bounded application repair
- Written-grading thinking: `high`
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
- Median operation latency: 3521 ms
- Maximum operation latency: 62779 ms
- Prompt tokens reported: 13794
- Output tokens reported: 8976
- Network retries: 0

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
| assessment-1 | yes | no | 62394 | 2 | 3567 | 2771 | 0 |
| correct-1 | yes | yes | 3521 | 1 | 516 | 110 | 0 |
| partial-1 | yes | yes | 3121 | 1 | 511 | 99 | 0 |
| assessment-2 | yes | no | 62779 | 2 | 3568 | 2819 | 0 |
| correct-2 | yes | yes | 3016 | 1 | 531 | 95 | 0 |
| partial-2 | yes | yes | 3560 | 1 | 526 | 121 | 0 |
| assessment-3 | yes | no | 60829 | 2 | 3568 | 2757 | 0 |
| correct-3 | yes | yes | 3320 | 1 | 506 | 90 | 0 |
| partial-3 | yes | yes | 3434 | 1 | 501 | 114 | 0 |

## Sanitized failure taxonomy

| Operation | Phase | Category | Code | Field path | Expected | Model | Prompt | Schema |
|---|---|---|---|---|---|---|---|---|
| assessment-1 | first_pass | invalid_json | INVALID_JSON | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |
| assessment-2 | first_pass | invalid_json | INVALID_JSON | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |
| assessment-3 | first_pass | invalid_json | INVALID_JSON | `$` | valid JSON object | `gemma-4-26b-a4b-it` | `assessment.v4` | `assessment-written.v4` |

The report stores no credential, raw source, prompt, model response, reference answer, or student answer.
