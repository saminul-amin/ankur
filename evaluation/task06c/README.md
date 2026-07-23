# Task 06C — Evidence-first remediation evaluation

This directory is separate from the immutable Task 06 evidence under `evaluation/records/public/`, `evaluation/exports/`, and `evaluation/reports/`.

## Provider-free preparation

```bash
npm run evaluation:task06c:prepare
npm run evaluation:task06c:dry-run
npm run evaluation:task06c:verify
npm run notebook:task06c
```

These commands require no API key. They prepare and verify six unchanged frozen materials plus three public-safe holdouts, pending gate exports, reviewer instructions, and the notebook. They do not generate questions or human judgments.

## Live generation

Live generation is explicit, sequential, checkpointed, and writes semantic state only beneath the Git-ignored `evaluation/task06c/records/private/` path:

```powershell
$env:ANKUR_EVALUATION_MODE="resume"
$env:ANKUR_EVALUATION_LIVE_OPT_IN="true"
$env:ANKUR_LIVE_AI_ENABLED="true"
npm run evaluation:task06c:run
Remove-Item Env:ANKUR_EVALUATION_MODE
Remove-Item Env:ANKUR_EVALUATION_LIVE_OPT_IN
Remove-Item Env:ANKUR_LIVE_AI_ENABLED
```

The command uses only `gemma-4-26b-a4b-it`. It must not be repeatedly rerun to select favorable outputs.

## Human review status

Fresh independent review is required. Historical Task 06 labels cannot be copied into Task 06C. Until the R1/R2 packets, disagreement-only adjudication, and attestations are complete, every human-dependent metric remains pending and Task 07 remains blocked.

## Frozen live-run outcome

The one permitted Task 06C live run is preserved under `records/public/` and
`exports/run/`. It produced 18 Ankur questions, 42 baseline questions, seven
written cases, and 33 final-valid logical operations from 45 operations.
Because this is below both the 30-question/10-written-case evaluation minimum
and the 95% logical-validity gate, no human-review packet was issued. The
measured gate status is recorded in `exports/task06c-gate-status.live-run.json`.
The run was not tuned or selectively regenerated after observing these results.
