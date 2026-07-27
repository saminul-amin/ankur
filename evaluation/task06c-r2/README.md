# Task 06C-R2

This directory contains the immutable historical-hash inventory, the frozen
public-safe iteration-1 exports, the provider-free notebook, and the final
Task 06C-R2 report.

Private runner state and blank annotation templates are Git-ignored under each
iteration. No human review packets were generated because the technical gate
did not pass.

Run provider-free checks with:

```bash
npm run evaluation:task06c-r2:dry-run
npm run notebook:task06c-r2
```

The live runner requires `ANKUR_TASK06C_R2_LIVE_OPT_IN=true` and an explicit
iteration number. The frozen iteration must not be resumed or selectively
regenerated.
