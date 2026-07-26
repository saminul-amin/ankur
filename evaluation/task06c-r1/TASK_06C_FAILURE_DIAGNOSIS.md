# Task 06C frozen-failure diagnosis

> Source commit: `e175b040fdeb33c07d13686b83d13ddbdcb2dfd3`

## Evidence boundary

The 12 frozen failures were diagnosed from the public provider-operation
records, sanitized aggregate exports, the ignored frozen checkpoint structure,
and the exact runtime call graph. No raw provider body, private source payload,
reviewer evidence, credential, prompt response, or hidden reasoning was copied.

The old recorder did not persist exact validator codes, finish reasons, or
parse-versus-semantic results for failed calls. Those fields remain explicitly
`null` or `not_recorded` in the machine-readable diagnosis rather than being
invented.

## Findings

| Operations | Final category | Code-level cause |
|---|---|---|
| Three analysis operations | `EVIDENCE_INVALID` | The provider schema required Gemma to emit `sourceVersionId`, internal topic/concept/objective IDs, `evidenceSegmentId`, and an exact quote. Application repair resent the full invalid map. This violated application ownership and left evidence identity/quotation fragile. |
| Six grouped assessment failures | `INVALID_OUTPUT` | Semantic repair labelled canonical answers, source identity, marks, and complete v2 artifacts as locked output fields even though these fields were absent from the strict shallow provider schema. The prompt could induce additional properties rejected by strict validation. |
| One MCQ-only assessment failure | `INVALID_OUTPUT` | The failing provider result and component-level diagnostic were not persisted, preventing exact classification. The same nested schema/semantic repair architecture applied. |
| Bengali revision/retry | `INVALID_OUTPUT` | Retry generation repeated the assessment repair-context defect and nested three generated components inside revision generation. Whole-plan outer repair then repeated the operation. |
| English revision/retry | `INVALID_OUTPUT` | Only 22 output tokens were retained and no finish reason was persisted. The repair path could not distinguish truncation from another invalid response and reused the contaminated retry context. |

## Required correction

1. Analysis uses indexed evidence choices. Gemma selects an integer; application
   code maps it to the composite material/source-version/segment identity and
   owns every internal ID.
2. Repair separates mutable schema fields, schema-present locked output fields,
   and reference-only canonical/evidence context.
3. Each small provider component gets at most one repair. An already
   schema-repaired component is not repaired again semantically.
4. `MAX_TOKENS` alone receives a bounded larger repair budget.
5. Evaluation persists sanitized component attempts and validator failures
   before a controlled error propagates.
6. Same-material accepted question banks are supplied to later generation runs
   and remain distinct from cross-pipeline comparison.

The detailed per-operation record is
`diagnostics/task06c-failure-diagnosis.json`.
