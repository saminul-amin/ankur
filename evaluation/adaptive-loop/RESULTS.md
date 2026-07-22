# Task 05 Live Adaptive-Loop Verification

- Gate check: **PASSED**
- Started: 2026-07-22T17:43:20.733Z
- Completed: 2026-07-22T17:44:22.178Z
- Model: gemma-4-26b-a4b-it
- Revision mode: weak_area
- Revision targets: 1
- Revision items: 1
- Retry composition: 1-mark MCQ + 5-mark written
- Original score: 0/6
- Retry score: 6/6
- Absolute change: +6
- Grounding failures: 0
- Quote failures: 0
- Concept-reference failures: 0
- Mark-reconciliation failures: 0
- Duplicate retry failures: 0
- Persistence recovery: passed
- Source or answer loss: 0
- Provider calls observed: 10
- Provider latency sum: 61392 ms
- Prompt tokens reported: 7210
- Output tokens reported: 2285
- Network retries: 0
- Provider schema repairs: 2
- Application-level revision repair used: no
- Final revision artifact repaired: no

## Safe revision operation metadata

- Build ID: local-working-tree
- Source version ID: source-01e2d55e
- Revision prompt version: revision.v2
- Revision schema version: revision-plan.v1
- Thinking level: high
- Output-token budgets: memory cue 650; retry MCQ 1800; retry written 1800; retry rubric 1600
- Target concept IDs: concept-01
- Permitted evidence segment IDs: M01-P002-S001
- Permitted evidence segments: 1
- Permitted evidence characters: 127
- Provider configured: yes
- Repair context: original prompts supplied as exclusion data; invalid repair component bounded to its shallow scalar transport
- Provider timeout: 90000 ms
- Revision route maximum duration: 180000 ms

## Sanitized revision validation diagnostics

| Stage | Code | Field | Expected | Targets | Evidence segments | Evidence characters | Response characters | Latency (ms) | Repair attempted |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| - | - | - | - | 0 | 0 | 0 | 0 | 0 | no |

## Sanitized provider-schema diagnostics

| Prompt | Schema | Stage | Code | Field | Expected | Response characters | Response tokens | Latency (ms) | Repair attempted |
|---|---|---|---|---|---|---:|---:|---:|---|
| analysis.v1 | preparation-map.v1 | first_pass | INVALID_ENUM_OR_IDENTIFIER_STOP | $.topicId | valid identifier format | 772 | 221 | 6343 | yes |
| assessment.v5 | assessment-mcq.v5 | first_pass | INVALID_JSON_MAX_TOKENS | $ | valid JSON object | 5098 | 900 | 20270 | yes |

No credential, raw source, prompt, provider body, generated question, reference answer, learner answer, or feedback is stored in this report.
