# Ankur Product Specification

> **Public-safe derivative of the internal SSOT**  
> **Version:** 1.0.0  
> **Status:** APPROVED FOR P0 IMPLEMENTATION

## 1. Product definition

Ankur is a Gemma 4-powered adaptive source-grounded learning platform. It converts learner-confirmed PDFs, scanned pages, images, or pasted text into a preparation map, assessment, transparent feedback, concept-level diagnosis, personalized revision, and weak-area retry.

## 2. Primary user outcome

A learner can transform material they already trust into a short, evidence-linked learning cycle without manually creating questions or reviewing the entire source again.

## 3. Golden path

```text
Select one source
→ extract or transcribe pages
→ review and edit extracted text
→ confirm immutable source snapshot
→ analyze topics and concepts
→ generate a mixed assessment
→ answer an MCQ and short written question
→ receive evidence-linked grading
→ review weak concept note
→ complete a focused retry
→ compare improvement
```

## 4. Users

### Primary

- Students using teacher notes, textbook excerpts, scanned handouts, and suggestions.
- Learners preparing from Bengali, English, or mixed-language material.

### Secondary

- Competitive-exam learners.
- Vocational and professional trainees.
- Users studying structured religious or language material, with appropriate disclaimers.

## 5. P0 functional requirements

| ID | Requirement | Acceptance condition |
|---|---|---|
| PR-P0-001 | Start without authentication | A judge can open the public URL and use sample or live mode without an account. |
| PR-P0-002 | Accept one source | One PDF up to 3 processed pages, up to 3 images, or pasted text is accepted within limits. |
| PR-P0-003 | Route PDF pages | Each PDF page is classified as usable embedded text or image transcription required. |
| PR-P0-004 | Review extraction | The learner can inspect, edit, include, or exclude each page before confirmation. |
| PR-P0-005 | Confirm source snapshot | Confirmation creates immutable deterministic source segments. |
| PR-P0-006 | Accept explicit priority | A learner-controlled instruction can prioritize topics; document-embedded instructions cannot. |
| PR-P0-007 | Build preparation map | Topics, concepts, priorities, objectives, and source evidence are shown. |
| PR-P0-008 | Generate assessment | The system creates at least one single-answer MCQ and one short written question. |
| PR-P0-009 | Grade objective answer | MCQ grading is deterministic and independent of the model. |
| PR-P0-010 | Grade written answer | Gemma returns criterion-level marks, evidence, covered and missing concepts, and concise feedback. |
| PR-P0-011 | Diagnose concepts | Results aggregate performance by concept and identify at least one weak concept when applicable. |
| PR-P0-012 | Generate revision | Revision focuses only on weak concepts and cites confirmed source evidence. |
| PR-P0-013 | Generate retry | Retry tests the same weak concept with substantially different wording. |
| PR-P0-014 | Compare attempts | First-attempt and retry performance are displayed. |
| PR-P0-015 | Preserve recoverable state | Network or provider failure does not erase confirmed source, assessment answers, or completed results. |
| PR-P0-016 | Provide sample fallback | A clearly labelled pre-generated Gemma 4 sample demonstrates the golden path if live generation is unavailable. |

## 6. P1 requirements

- True/false questions.
- Normalized factual-answer questions.
- Timer, configurable marks, and negative marking.
- Refresh recovery during an active assessment.
- Multiple files and increased page limits after production load testing.
- Richer misconception descriptions.
- Evaluation notebook and polished video assets.

No P1 requirement may delay a production-stable P0 flow.

## 7. Non-functional requirements

| ID | Requirement |
|---|---|
| NFR-001 | TypeScript strict mode; no unchecked external input. |
| NFR-002 | Server-only provider credential and model calls. |
| NFR-003 | Important AI responses are schema-validated and evidence-validated. |
| NFR-004 | The browser never sends a complete large PDF through a serverless function. |
| NFR-005 | P0 works on current desktop Chrome and a representative mobile viewport. |
| NFR-006 | Bengali text renders correctly with a documented font fallback. |
| NFR-007 | Every loading state names the current operation. |
| NFR-008 | Every failure is recoverable or has an honest fallback. |
| NFR-009 | No raw uploaded document or full student answer is written to production logs. |
| NFR-010 | Production deployment passes three consecutive golden-path smoke runs before submission. |

## 8. Explicit non-goals

- User authentication.
- Production learning database.
- Admin or teacher dashboard.
- Vector database or retrieval service.
- Multi-agent framework.
- Fine-tuning.
- Full handwritten Bengali support.
- Long-essay grading.
- Internet fact-checking.
- Mobile application.
- Separate backend deployment.
- Local/self-hosted Gemma runtime.

## 9. User-facing trust statements

The product must disclose:

- Generated content is based on the learner-confirmed source.
- Written grading is an AI estimate, not an official academic grade.
- Selected source content is sent to Google's hosted Gemini API for Gemma 4 processing.
- The prototype should not be used for confidential documents.
- Domain-sensitive content is not a substitute for qualified professional or religious authority.

## 10. Product success criteria

P0 is successful when a first-time judge can complete the golden path without team intervention, see valid source evidence for every generated learning artifact, and understand what improved after retry.
