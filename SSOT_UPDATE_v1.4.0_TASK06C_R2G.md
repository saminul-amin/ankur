# SSOT Update v1.4.0 — Task 06C-R2G multilingual reliability correction

## Status

Task 08A release QA failed because live Bengali and mixed-language assessment
generation returned controlled `MODEL_OUTPUT_INVALID`. That failure was
diagnosed from the frozen Task 06C-R2F semantic diagnostics and reproduced
against the live provider. Task 06C-R2G applies the resulting corrections and
records exactly one fixed-denominator evaluation using the unchanged R2F
evaluation design.

## Authorization change

`SSOT_UPDATE_v1.3.6_TASK06C_R2F.md` stated that no further broad reliability
iteration was authorized. That restriction was written on the understanding that
the remaining failures were semantic-quality failures requiring prompt research.
The R2F diagnostics show otherwise: the dominant failure mode is a provider
transport and configuration defect, not a question-quality defect.

**D-051 (APPROVED).** One further correction round, Task 06C-R2G, is authorized
for defects whose root cause is transport, configuration, or deterministic
post-processing. Prompt experimentation, validator relaxation, threshold change,
model change, and evaluation-design change remain unauthorized.

**D-052 (APPROVED).** Bounded UI polish is authorized inside the feature freeze,
limited to appearance tokens, defect repair, and reducing distance to the
learner's own work. New question types, new persistence, architecture change,
provider change, and screen redesign remain prohibited.

**D-053 (APPROVED).** A dependency advisory published after a freeze is a
release-blocking defect, not a feature change. Upgrading to the minimum
maintained version that clears it is authorized inside the freeze.

Historical Task 06, 06C, R1, R2, R2E, and R2F evidence remains immutable. Task
07 remains unauthorized.

## Root causes and corrections

All four corrections are deterministic. No validator, threshold, grounding rule,
canonical answer, correct-option identity, rubric construction, mark allocation,
prompt, or model identity changed.

### 1. Degenerate repetition loops in analysis

With extended thinking, analysis on Bengali and mixed material reproducibly ran
a scalar into a repetition loop until it exhausted the output budget. A live
replay of `CIV-BN-PASTE-02` produced a 13,723-character truncated response at a
4,000-token budget and a 29,723-character truncated response at 8,000 tokens;
the same prompt at minimal thinking returned a valid object in 5.4 seconds using
183 output tokens.

- Material analysis moves from `high` to `minimal` thinking. The task selects one
  numbered evidence choice and writes short labels; the application still
  validates grounding deterministically.
- The analysis output budget drops from 4,000 to 1,200 tokens, so a loop is
  detected in seconds instead of consuming the request timeout.

### 2. Missing length contract in native JSON schemas

The analysis and transcription native JSON schemas omitted the `minLength` and
`maxLength` bounds their Zod contracts already enforced, so the provider was
never told the limits it was expected to respect. Both now mirror their Zod
contract exactly.

### 3. Echo repair re-priming the failing sampling path

A candidate that stopped on `MAX_TOKENS` was sent back to the provider as the
object to repair, which re-primed the same loop. A cut-off or withheld candidate
now retries the original task once, and both original-task retries raise
temperature to at least 0.35 so the retry leaves the sampling path that produced
the loop or recitation stop.

### 4. Mechanical wording defects surviving regeneration

`LANG_TRUNCATED_SENTENCE` and `LANG_REPEATED_TOKEN` on question prompts survived
bounded regeneration in the frozen R2F run. Two deterministic recoveries are
added, alongside the accepted R2F distractor salvage:

- transport-level recovery of a complete brace-balanced JSON object from a fenced
  or prose-wrapped response, and collapse of immediately repeated words and
  phrases before schema validation;
- application-level question-prompt salvage for adjacent duplicate tokens,
  literally repeated clauses, doubled or dangling punctuation, and a missing
  terminal question mark.

Meaning is never rewritten, truncated output stays invalid, and the unchanged
semantic validators still decide acceptance.

## Authoritative measured result

One preflight-validated run is frozen under `evaluation/task06c-r2g/run-1/`. The
3/3 provider-stability preflight passed, so the run is infrastructure-valid.

- Logical operations: 45 (unchanged fixed denominator).
- First-pass valid: 31/45 (68.89%), from 22/45.
- Final valid: 38/45 (84.44%), from 33/45.
- Repair attempts: 10/45, from 14/45.
- Repair successes: 7/10 (70.00%).
- Persisted structured questions: 46, from 42.
- Valid written cases: 22, from 18.
- Deterministic grounding: 46/46 (100%).
- Deterministic MCQ-key validity: 46/46 (100%).
- Invalid rubrics entering grading metrics: 0.
- Cross-material evidence defects: 0.
- Fabricated weaknesses: 0.
- Duplicate diagnostics: 6/46 (13.04%), from 7/42 (16.67%).
- Mean transcription character error rate: 0.004312, from 0.005145.
- Adaptive artifacts valid: 6/9 (66.67%).
- Median operation latency: 5,113 ms; 95th percentile: 61,780 ms.

Seven operations remained invalid: one analysis and two assessment
`INVALID_OUTPUT` results, plus four explicit `DEPENDENCY_UNAVAILABLE` operations
downstream of the failed analysis. Every one traces to provider transport
behaviour — eight first-pass `MAX_TOKENS` repetition loops, four of which the
bounded retry did not recover, and four `RECITATION` stops. **Zero `LANG_*`
semantic failures remain, against nine in R2F**, so the defect class that caused
the Bengali and mixed-language assessment failures is closed.

## Gate and disposition

The unchanged 43/45 (95.6%) final-validity gate **failed** at 38/45 (84.44%).

The run is classified `KEEP`. Reviewer packets were not generated and every
human quality and grading-agreement metric remains `pending`; pending is not
passing. Task 07 remains unauthorized. Deployment and submission preparation may
proceed only with this limitation disclosed.

## Evaluation design

Task 06C-R2G reuses the Task 06C-R2F evaluation design without modification:
the same nine-material frozen-plus-holdout corpus, the same fixed 45-operation
denominator, the same answer cases, the same metrics, the same export shape, and
the same acceptance thresholds. Only the output root differs, so R2F evidence is
untouched and the two runs are directly comparable.

## Dependency and release hygiene

Advisories published after the R2F freeze made the locked manual release gate
fail with six findings, including arbitrary JavaScript execution in `pdfjs-dist`
when opening a malicious PDF — directly in Ankur's threat model, because learner
PDFs are parsed in the browser. `pdfjs-dist`, `next`, `nanoid`, `undici`, and
`brace-expansion` were upgraded to their minimum fixed versions.
`npm audit --audit-level=moderate` reports zero vulnerabilities.

## Interface change

The public interface gains a dark appearance that follows the system preference
and remembers an explicit choice, and the marketing introduction is hidden once
a learner is past source selection so every later stage starts at the top of the
page. Two layout defects were repaired: the concept-card priority badge was
painted over and clipped by the card's decorative circle in both themes, and the
progress rail now stays in view while a long result page scrolls. No screen,
copy, contract, or interaction flow was redesigned.
