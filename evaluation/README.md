# Ankur Task 06 Evaluation Evidence

This package evaluates the frozen Task 05 product. It adds no product feature, provider transport, prompt, grading rule, threshold, or UI behavior.

## Reproduce without an API key

```bash
npm ci
npm run evaluation:fixtures
npm run evaluation:dry-run
npm run evaluation:export
npm run evaluation:verify
npm run notebook:run
```

The committed notebook reads only sanitized public exports. Live provider calls are never made by tests, CI, the notebook, or the default evaluation command.

## Live runner safety

Live evaluation requires all of:

```text
ANKUR_EVALUATION_MODE=selected-material or resume
ANKUR_EVALUATION_LIVE_OPT_IN=true
ANKUR_LIVE_AI_ENABLED=true
GEMINI_API_KEY present in the server process
```

The runner is sequential, checkpointed, uses stable operation IDs, and writes semantic raw artifacts only under ignored `evaluation/records/private/`. A public export contains safe fields, content hashes, and sanitized failure categories. It never contains a credential, provider body, hidden reasoning, or private learner data.

## Current evidence status

- Corpus: 6 team-authored CC BY 4.0 materials, 3 domains, Bengali/English/mixed, and 4 input types.
- Golden demo: 1 separate team-authored source.
- Generated questions: 30.
- Written-answer records: 14, including 2 deterministic empty cases; one provider result is unavailable after a controlled timeout.
- Adaptive records: 6 planned/material paths; 3 completed and 3 controlled failures.
- Baseline: 6 materials with the same Gemma model and five requested questions each.
- Human review: templates prepared; R1, R2, and adjudication are pending.
- Source-text manual verification: pending.

See `reports/TASK_06_EVALUATION_REPORT.md` for measured values and target interpretation. Human-dependent quality metrics are deliberately reported as pending.
