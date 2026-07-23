# Task 06C public exports

Files ending in `.pending.json` describe prepared denominators and gate state before live generation and fresh human review. A pending value is never a passing result.

Files ending in `.live-run.json` freeze the single Task 06C live run completed on
23 July 2026. The run produced 33 final-valid logical operations out of 45 and
only seven written cases. Those measured results fail the logical-validity and
written-case gates. Human-dependent metrics remain pending because incomplete
generation was not sent for review.

Final exports may be created only from:

1. one frozen-material and holdout generation run;
2. the equivalent-count one-prompt baseline;
3. fresh independently completed R1 and R2 packets;
4. disagreement-only adjudication;
5. validated public/private separation.

Public exports may contain normalized public-safe source references, hashes, neutral record IDs, validator codes, and aggregate metrics. They must not contain reviewer identities, private notes, coordinator mappings, attestations, learner answers beyond the public-safe evaluation fixtures, raw provider bodies, prompts, hidden reasoning, or credentials.
