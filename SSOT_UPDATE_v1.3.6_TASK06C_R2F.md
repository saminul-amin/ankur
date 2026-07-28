# SSOT Update v1.3.6 — Task 06C-R2F outcome

## Status

Task 06C-R2F completed the final authorized narrow assessment-reliability
correction and exactly one fixed-denominator evaluation. The result materially
improved over Task 06C-R2E without regressing deterministic correctness, but the
unchanged technical gate failed. Task 07 remains unauthorized.

## Authorized correction

The correction is limited to deterministic misconception-candidate salvage:

- normalize Unicode, case, punctuation, and whitespace;
- reject language-invalid candidates;
- reject candidates equivalent to the canonical answer or supported evidence;
- reject exact and semantic near-duplicates;
- retain valid candidates;
- fill missing candidates with existing deterministic evidence-derived
  misconception transformations.

The indexed-evidence analysis pipeline, prompts, provider schemas, canonical
answer, correct-option identity, deterministic option ordering, rubric
construction, mark allocation, source grounding, and acceptance thresholds are
unchanged.

Sanitized semantic diagnostics now distinguish first-pass and repair-stage
failure codes without retaining source, prompt, response, learner, provider, or
credential content.

## Authoritative measured result

- Logical operations: 45.
- First-pass valid: 22/45 (48.89%).
- Final valid: 33/45 (73.33%).
- Repair attempts: 14/45.
- Repair successes: 11/14 (78.57%).
- Persisted structured questions: 42.
- Valid written cases: 18.
- Deterministic grounding: 42/42 (100%).
- Deterministic MCQ-key validity: 42/42 (100%).
- Invalid rubrics entering grading metrics: 0.
- Cross-material evidence defects: 0.
- Duplicate diagnostics: 7/42 (16.67%).

Two assessment operations remained `INVALID_OUTPUT` after bounded repair. One
analysis operation was rate-limited and one timed out; their dependent
operations remain explicit failures in the 45-operation denominator.

## Gate and disposition

The 43/45 final-validity requirement failed. The correction is classified
`KEEP` because final validity improved by nine operations, persisted questions
increased by 18, written cases increased by seven, and deterministic correctness
remained 100%.

No second R2F run, selective retry, reviewer packet, or human metric is
authorized. No further broad reliability iteration is authorized. Deployment
and submission preparation may proceed with the failed reliability gate and
remaining provider-output limitation disclosed transparently.

## Authorization

Task 07 remains blocked. Historical Task 06, Task 06C, R1, R2, and R2E evidence
remains immutable.
