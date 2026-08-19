# Task 06C-R2G evaluation

This directory contains the preflight record, the frozen public-safe run, and
the report for the multilingual generation-reliability correction.

- `preflight/`: the private-safe 3/3 provider stability result.
- `run-1/records/public/`: normalized public-safe records.
- `run-1/exports/`: reconciled metrics and tables.
- `run-1/RUN_DECISION.json`: immutable `KEEP` decision.
- `TASK_06C_R2G_EVALUATION_REPORT.md`: public-safe report.

R2G reuses the Task 06C-R2F evaluation design without modification — the same
nine-material frozen-plus-holdout corpus, the same fixed 45-operation
denominator, the same answer cases, metrics, export shape, and acceptance
thresholds. Only the output root differs, so every frozen R2F record is
untouched and the two runs are directly comparable.

The ignored `run-1/records/private/` and `run-1/annotations/private/` paths are
not public inputs. Reviewer packets were not generated because the technical gate
failed. Human metrics are pending, not zero and not passed.
