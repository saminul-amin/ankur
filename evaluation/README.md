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

- Corpus: 6 team-authored CC BY 4.0 materials across 3 domains, Bengali/English/mixed language, and 4 input types.
- Golden demo: 1 separate team-authored source.
- Ankur structured questions: 30, independently reviewed and adjudicated.
- One-prompt baseline questions: 30, independently reviewed and adjudicated.
- Written-answer records: 14; all were excluded from semantic grading-accuracy metrics because their generated rubrics did not validly align with their questions.
- Source-page verification: complete for 9/9 pages.
- Human review and disagreement-only adjudication: complete.
- Task 06 evidence closure: passed.
- Product quality gate: failed.
- Task 07 authorization: blocked pending Task 06C remediation and re-evaluation.

## Final human-review closure

Task 06 human review is complete. Read `reports/TASK_06_FINAL_CLOSURE_REPORT.md` first.

Public-safe closure exports:

- `exports/task06-closure-metrics.json`
- `exports/question-pipeline-comparison.csv`
- `exports/reviewer-agreement.csv`
- `exports/reliability-reclassification.json`
- `exports/reliability-by-operation.csv`
- `exports/written-evaluation-validity.csv`
- `exports/question-error-analysis-v2.csv`

Private reviewer packets, attestations, mappings, and the adjudication workbook are intentionally excluded from this public-safe folder and must remain outside Git.
