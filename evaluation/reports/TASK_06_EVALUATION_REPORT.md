# Task 06 Evaluation Report

> Product baseline: `3728724ef4140666566bb9f72fd5dfb55bc523c3`
> Model: `gemma-4-26b-a4b-it`
> Human review status: **pending**
> Recommendation: **TASK 06 PARTIALLY PASSED**

## Scope and provenance

The corpus contains six original Team Hotasha materials released under CC BY 4.0, exactly two each in academic science, Bangladesh civics, and vocational safety. It covers Bengali, English, and mixed language; pasted text, digital PDF, standalone page image, and mixed digital/scanned PDF. `GOLDEN-DEMO-01` is separate and not counted among the six.

All source-text manual-verification fields remain pending. No human label or reviewer judgment was invented.

## Extraction

Nine pages completed the automated routing/extraction/transcription path: 9/9 non-empty technical page successes and 9/9 expected routes. The unweighted mean CER was 0.006860 (0.686%).

| Page class | Pages | Observed CER |
|---|---:|---:|
| Pasted/digital embedded text | 6 | 0 on every page |
| Bengali standalone image | 1 | 14/453 characters, 3.091% |
| Mixed-PDF scanned page | 1 | 2/200 characters, 1.000% |
| Mixed-language standalone image | 1 | 8/384 characters, 2.083% |

Using the declared `CER > 2%` material-correction heuristic, 2/9 pages were flagged. Human confirmation of whether important educational content is complete remains pending.

## Structured questions

Thirty generated questions were exported: 22 original-assessment items and 8 adaptive-retry items. Deterministic grounding validation accepted 30/30, and every MCQ key referenced a valid option (30/30 question records pass the applicable deterministic key invariant). Cross-run wording similarity flagged 2/30 (6.67%) as potential duplicates; these were preserved.

| Breakdown | Questions | Grounding-valid | Potential duplicates |
|---|---:|---:|---:|
| Bengali | 8 | 8 | 1 |
| English | 12 | 12 | 1 |
| Mixed | 10 | 10 | 0 |
| Academic science | 16 | 16 | 2 |
| Bangladesh civics | 4 | 4 | 0 |
| Vocational safety | 10 | 10 | 0 |

Human grounding support, key correctness, ambiguity, language quality, explanation usefulness, and acceptance are pending. Validator success is not reported as human acceptance.

## Written grading

Fourteen team-authored cases cover 6 correct, 2 partially correct, 2 incorrect, 2 empty, 1 unsupported-claim, and 1 missing-key-concept answer. Twelve cases were provider-eligible and two empty cases were deterministically graded without a provider call. Eleven provider-eligible records have final marks; one retry-correct record remains pending after a controlled timeout. Every available written artifact passed grounding and mark reconciliation.

Gemma-versus-human MAE, exact agreement, within-one-mark agreement, status agreement, missing-concept precision/recall/F1, and feedback usefulness are pending R1/R2 review and adjudication.

## Provider reliability

The public record retains 51 application operations or controlled retry attempts.

| Metric | Result |
|---|---:|
| First-pass valid | 24/51 (47.06%) |
| Final valid | 40/51 (78.43%) |
| Repair attempted | 23/51 (45.10%) |
| Repair success | 16/23 (69.57%) |
| Grounding failures in accepted artifacts | 0 |
| Quote failures in accepted artifacts | 0 |
| Concept-reference failures in accepted artifacts | 0 |
| Mark-reconciliation failures in accepted artifacts | 0 |
| Median latency | 26,252 ms |
| p95 latency | 93,741 ms |
| Maximum latency | 190,269 ms |
| Input tokens reported | 65,118 across 44/51 operations |
| Output tokens reported | 27,469 across 44/51 operations |

Controlled failures comprise timeouts/unavailability/rate limiting plus artifacts rejected after bounded validation or repair. No failed artifact was silently accepted, and no prompt/schema change was made after evaluation began.

## Adaptive loop

Six material-level records are present. Three completed end to end with persistence and state-preservation checks passing; their observed score changes were +3, +6, and +6 marks (mean +5). This is a short retry observation, not evidence of durable learning. No completed record fabricated a weakness. The remaining paths stopped safely during analysis, revision generation, or retry grading.

## One-prompt baseline

The fair baseline used the same `gemma-4-26b-a4b-it`, minimal thinking, temperature 0.1, five requested questions per material, and the prompt opening “Read this source and create a quiz.” It used no native schema, preparation map, immutable segment assignment, or application grounding validation.

All six outputs matched the requested five-block plain-text shape (30/30 parsed questions) and included 30/30 evidence-labelled lines. This is evidence transparency only; whether those quotations truly support each item and whether keys are correct remains pending the same human protocol. A written-grading baseline was not constructed because the documented one-prompt task creates a quiz rather than judging a fixed rubric, so a grading-transparency comparison would not be like-for-like. The result does not claim that every one-prompt design behaves this way.

## Targets

| Target | Result | Interpretation |
|---|---:|---|
| Final-valid after repair ≥95% | 40/51, 78.43% | **Miss** |
| Grounded human-accepted ≥90% | pending | Cannot assess |
| Correct objective keys ≥95% | human review pending; deterministic option invariant 30/30 | Cannot assess |
| Ambiguous questions ≤10% | pending | Cannot assess |
| Written-score MAE ≤1/5 | pending | Cannot assess |
| Three-flow production golden path | previously verified 3/3 at Task 04B.2 | Passed outside this run |

## Limitations and next actions

- Source-text verification and all semantic human labels are pending.
- The corpus is small, team-authored, and not representative of all textbooks, layouts, dialects, or disciplines.
- Reliability was measured during one bounded run with retained failures; it must not be generalized to provider-wide uptime.
- Automated evidence validity proves ID/quote consistency, not pedagogical quality.
- The adaptive comparison measures immediate retry only.
- Complete R1 and R2 independently, adjudicate, sanitize the completed labels, rerun aggregation/notebook, and decide whether the reliability miss justifies a separately versioned critical fix.
