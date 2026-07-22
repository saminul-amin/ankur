# Ankur P0 Traceability Matrix

> **Version:** 1.0.0

| Requirement | Architecture component | API/use case | Primary tests | Evidence before done |
|---|---|---|---|---|
| PR-P0-001 No login | Next.js presentation | none | Playwright public smoke | Incognito run |
| PR-P0-002 One source | Browser document adapter | none | file-limit unit/component | accepted PDF/image/text |
| PR-P0-003 Page routing | browser PDF adapter | transcription only when needed | classifier unit/integration | mixed fixture result |
| PR-P0-004 Review extraction | review feature | `/api/transcriptions` | component/e2e | edited text persists |
| PR-P0-005 Confirm snapshot | grounding domain | none | segment/hash unit tests | deterministic IDs |
| PR-P0-006 Explicit priority | session/application | `/api/analyses` | injection integration | document command ignored |
| PR-P0-007 Preparation map | analysis use case | `/api/analyses` | schema/evidence integration | valid concepts/evidence |
| PR-P0-008 Assessment | assessment use case | `/api/assessments` | invariant/integration | valid MCQ + written |
| PR-P0-009 Objective grading | assessment domain | none | pure unit tests | exact expected score |
| PR-P0-010 Written grading | grading use case | `/api/written-evaluations` | rubric/integration | bounded criterion marks |
| PR-P0-011 Diagnosis | attempt domain | none | aggregation unit tests | weak concept visible |
| PR-P0-012 Revision | revision use case | `/api/revisions` | evidence integration | weak-only note |
| PR-P0-013 Retry | revision domain | `/api/revisions` | duplicate tests | new wording, same concept |
| PR-P0-014 Comparison | results presentation | none | unit/component/e2e | first vs retry shown |
| PR-P0-015 Recoverable state | client persistence | all | corruption/error e2e | no loss after failure |
| PR-P0-016 Sample fallback | sample adapter | runtime status | Playwright | labelled sample path |
| NFR-002 Server-only key | Gemma infrastructure | all AI routes | bundle/secret test | no client key |
| NFR-003 Schema/evidence | domain + Gemma adapter | all AI routes | contract/integration | invalid artifact rejected |
| NFR-004 No large PDF route | browser document processing | transcription page only | payload tests | route rejects oversized |
| NFR-010 Three smoke runs | deployment operations | all | production manual | signed checklist |

## Completion rule

A requirement is `VERIFIED` only when its implementation exists, its required automated checks pass, and the listed acceptance evidence has been recorded. Generated code or a passing build alone is insufficient.
