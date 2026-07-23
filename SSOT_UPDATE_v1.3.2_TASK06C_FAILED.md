# Ankur SSOT Update v1.3.2 — Task 06C Gate Failed

> **Date:** 24 July 2026
> **Status:** TASK 06C FAILED; TASK 07 BLOCKED
> **Supersedes:** no Task 06 historical evidence or metric

## Evaluation outcome

The single frozen Task 06C live run recorded 33 final-valid logical operations
from 45 (73.33%) and produced seven eligible written cases. These results fail
the unchanged 95% logical-validity and minimum-ten-written-case gates.

Fresh human review was not started because the structured pipeline produced only
18 of the required 30 questions. Human-dependent correctness, grounding,
acceptance, rubric-alignment, and grading-agreement metrics remain pending; they
must not be represented as passing or as zero-valued failures.

```text
TASK_06_HISTORICAL_EVIDENCE = IMMUTABLE
TASK_06C_LIVE_RUN = FROZEN_FAILED
TASK_06C_HUMAN_REVIEW = NOT_STARTED
TASK_07_AUTHORIZED = NO
```

The detailed record is
`evaluation/task06c/TASK_06C_EVALUATION_REPORT.md`. Any corrective work after
this evaluation must increment the affected prompt or schema version, use a
separate commit, and regenerate every affected record without weakening a gate.
