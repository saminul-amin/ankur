# Task 06C-R2F assessment failure diagnosis

## Scope

This diagnosis covers the seven authoritative R2E assessment operations that
ended `INVALID_OUTPUT` after one bounded regeneration. Historical evidence was
not modified and no provider response was replayed.

## Diagnostic limitation

R2E retained operation ID, material, language, prompt/schema versions, token
totals, latency, repair attempted/succeeded, final status, and aggregate
grounding/concept/quote/reconciliation counts. It did not retain:

- the semantic component that failed;
- first-pass or regeneration finish reasons;
- parse outcomes;
- deterministic validator failure codes;
- invalid semantic fields.

Those values cannot be reconstructed from operation metadata, because semantic
provider outputs were intentionally not persisted. They are recorded as
`not_recorded`, not guessed. R2F adds sanitized stage/code propagation so its
final run is diagnosable without storing content.

## Seven-operation summary

| Operation | Language | Input | Repair | Final |
|---|---|---|---|---|
| `assessment:CIV-BN-PASTE-02:r1` | Bengali | pasted text | attempted, failed | `INVALID_OUTPUT` |
| `assessment:CIV-BN-PASTE-02:r2` | Bengali | pasted text | attempted, failed | `INVALID_OUTPUT` |
| `assessment:CIV-MIX-PDF-01:r1` | mixed | mixed PDF | attempted, failed | `INVALID_OUTPUT` |
| `assessment:CIV-MIX-PDF-01:r2` | mixed | mixed PDF | attempted, failed | `INVALID_OUTPUT` |
| `assessment:SCI-BN-PASTE-01:r3` | Bengali | pasted text | attempted, failed | `INVALID_OUTPUT` |
| `assessment:VOC-MIX-IMG-01:r1` | mixed | page image | attempted, failed | `INVALID_OUTPUT` |
| `assessment:VOC-MIX-IMG-01:r2` | mixed | page image | attempted, failed | `INVALID_OUTPUT` |

All seven were non-English operations. All seven returned non-empty token
metadata, attempted regeneration, and still failed. None recorded a grounding,
quote, concept-reference, or reconciliation defect.

## Grouped findings

Because the historical codes were not persisted, confirmed counts are:

- Distractor-related: 0 confirmed, 7 unclassified.
- Canonical-answer/stem mismatch: 0 confirmed, 7 unclassified.
- Duplicated-clause/language: 0 confirmed, 7 unclassified.
- Malformed or truncated: 0 confirmed; there is no retained finish reason
  proving truncation.
- Repeated after regeneration: 7.

Provider-free regression construction reproduces one concrete gap: the frozen
distractor selector normalizes exact punctuation and whitespace and rejects
canonical/evidence-supported candidates, but it does not reject every
language-invalid or semantically near-equivalent candidate before final MCQ
validation. A bad candidate can therefore force whole-artifact regeneration
even when the other semantic fields are usable.

## Selected narrow correction

Implement language-aware, Unicode-normalized, semantic-duplicate-aware
distractor salvage:

1. validate every candidate's language before accepting it;
2. reject exact, punctuation, Unicode, and semantic near-duplicates;
3. preserve valid candidates;
4. fill only missing slots from bounded deterministic misconception
   transformations;
5. rerun the unchanged full validator;
6. retain one whole-small-artifact regeneration only when the assembled
   artifact still fails.

Also propagate sanitized semantic component, phase, failure code, and field path
to the evaluation runner. No raw semantic content is recorded.

This correction preserves the canonical answer, evidence, correct-option
identity, option seed, rubric construction, mark allocation, schemas, and
acceptance thresholds.
