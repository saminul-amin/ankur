# Task 06C-R2F evaluation

This directory contains the final narrow assessment-correction diagnosis,
preflight record, frozen public-safe run, provider-free notebook, and report.

- `diagnostics/`: pre-change diagnosis based on sanitized R2E evidence.
- `preflight/`: the private-safe 3/3 provider stability result.
- `run-1/records/public/`: normalized public-safe records.
- `run-1/exports/`: reconciled metrics and tables.
- `run-1/RUN_DECISION.json`: immutable `KEEP` decision.
- `notebook/`: provider-free metric reconciliation.

The ignored `run-1/records/private/` and `run-1/annotations/private/` paths are
not public inputs. Reviewer packets were not generated because the technical
gate failed. Human metrics are pending, not zero and not passed.
