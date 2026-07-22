# Task 04B Provider Reliability Benchmark

- Gate: **BLOCKED**
- Started: 2026-07-22T08:42:16.941Z
- Completed: 2026-07-22T08:48:47.337Z
- Fixture: team-authored repository photosynthesis source
- Model: `gemma-4-26b-a4b-it`
- Assessment thinking: `minimal` first pass; `high` only for bounded application repair
- Written-grading thinking: `high`
- Assessment prompt/schema: `assessment.v3`; `assessment-mcq.v3` and `assessment-written.v3`
- Written prompt/schema: `written-evaluation.v3`; `written-evaluation-transport.v3`
- Provider operations completed: 9/9
- First-pass validated: 3/9 (33.3%)
- Repair rate: 66.7%
- Final validated success: 8/9 (88.9%)
- Grounding failures: 0
- Criterion-reconciliation failures: 0
- Deterministic empty-answer checks: 3/3
- Provider calls caused by empty answers: 0
- Median operation latency: 42805 ms
- Maximum operation latency: 80509 ms
- Prompt tokens reported: 19616
- Output tokens reported: 1876
- Network retries: 0

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
| assessment-1 | yes | no | 80509 | 2 | 4335 | 460 | 0 |
| correct-1 | yes | yes | 3525 | 1 | 572 | 119 | 0 |
| partial-1 | yes | yes | 4050 | 1 | 567 | 144 | 0 |
| assessment-2 | yes | no | 79340 | 2 | 4335 | 396 | 0 |
| correct-2 | no | no | 55290 | 0 | 0 | 0 | 0 |
| partial-2 | yes | no | 42276 | 1 | 2435 | 99 | 0 |
| assessment-3 | yes | no | 79358 | 2 | 4335 | 423 | 0 |
| correct-3 | yes | no | 42805 | 1 | 2440 | 126 | 0 |
| partial-3 | yes | yes | 3240 | 1 | 597 | 109 | 0 |

The report stores no credential, raw source, prompt, model response, reference answer, or student answer.
