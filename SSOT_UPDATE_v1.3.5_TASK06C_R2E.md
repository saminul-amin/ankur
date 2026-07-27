# SSOT Update v1.3.5 — Task 06C-R2E outcome

## Status

Task 06C-R2E completed an evaluation-only provider-stable rerun of frozen
implementation commit `f9bb5a40b41c3403a1f147f8c2fa30d0dd782c5c`.
The authoritative infrastructure-valid run failed the unchanged technical gate.
Task 07 remains unauthorized.

## Provider-stability decision

The preflight completed 3/3 bounded requests with `STOP` finish reasons and no
authentication, rate-limit, quota, timeout, availability, or malformed-output
failure.

Run 1 is `INFRASTRUCTURE_VALID`. It had one analysis rate limit and one analysis
timeout, both retained in the denominator, but no provider-wide unavailability,
explicit quota exhaustion, sustained rate limiting, or repeated timeout across
multiple unrelated materials. Seven assessment `INVALID_OUTPUT` failures are
semantic product-output failures and may not be reclassified as infrastructure.
Run 2 was therefore neither authorized nor executed.

## Authoritative measured result

- Logical operations: 45.
- First-pass valid: 18/45 (40%).
- Final valid: 24/45 (53.33%).
- Repair attempts: 14/45.
- Repair successes: 6/14 (42.86%).
- Persisted structured questions: 24.
- Valid written cases: 11.
- Deterministic grounding: 24/24 (100%).
- Deterministic MCQ-key validity: 24/24 (100%).
- Invalid rubrics entering grading metrics: 0.
- Cross-material evidence defects: 0.
- Duplicate diagnostics: 3/24.

## Gate decision

The minimum 43/45 final validity and 30 persisted-question gates failed.
Reviewer packets were not generated, no human review began, and no human metric
was invented. The frozen R2 implementation and all Task 06/06C/R1/R2 evidence
remain unchanged.

## Authorization

Task 07 remains blocked. The recommended next work is a narrow diagnosis of the
seven assessment `INVALID_OUTPUT` failures using sanitized validation codes,
without broad prompt experimentation or threshold changes.
