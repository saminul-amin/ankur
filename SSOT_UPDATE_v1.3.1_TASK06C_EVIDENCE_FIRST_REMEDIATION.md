# Ankur SSOT Update v1.3.1 — Task 06C Evidence-First Remediation

> **Date:** 24 July 2026
> **Status:** IMPLEMENTATION COMPLETE; FRESH HUMAN RE-EVALUATION PENDING
> **Supersedes:** no historical Task 06 evidence or metric

## Decision

Task 06C replaces loosely coupled question construction with strict evidence-first v2 internal contracts. Task 06 historical results remain immutable. This update does not authorize Task 07.

```text
TASK_06_HISTORICAL_EVIDENCE = IMMUTABLE
TASK_06C_IMPLEMENTATION = EVIDENCE_FIRST_V2
TASK_06C_HUMAN_REVIEW = PENDING
TASK_07_AUTHORIZED = NO
```

## Added decisions

| ID | Decision | Status | Reason |
|---|---|---|---|
| D-047 | Questions are constructed from source-scoped evidence through a locked canonical answer before question wording, distractors, or rubrics are generated | APPROVED | Prevents question keys and rubrics from drifting away from permitted evidence. |
| D-048 | Evidence lookup for v2 artifacts uses the composite material ID, source-version ID, and segment ID; a segment ID alone is insufficient | LOCKED | Segment IDs are deterministic only within one confirmed source scope. |
| D-049 | Task 06C uses separate frozen-plus-holdout records, fresh blinded review, and the unchanged acceptance thresholds in v1.3.0 | LOCKED | Historical Task 06 labels and metrics must not be overwritten or reused. |
| D-050 | Task 07 remains blocked while any Task 06C human or measured acceptance gate is pending or failed | LOCKED | Deterministic validation and schema success do not substitute for independent human acceptance. |

## Internal v2 contracts

- `canonical-answer.v2`
- `single-mcq-question.v2`
- `short-written-question.v2`
- `written-rubric.v2`
- `revision-question.v2`

The public `activity-set.v2` API remains compatible. Historical Task 06 artifacts are read as historical v1/v2 records and are not migrated in place.

## Acceptance status

The implementation, deterministic tests, corpus preparation, privacy checks, and provider-free notebook may be verified before human review. The human-dependent correctness, acceptance, rubric-alignment, and grading-agreement gates remain pending until fresh independent review and disagreement-only adjudication complete. No pending gate may be reported as passed.
