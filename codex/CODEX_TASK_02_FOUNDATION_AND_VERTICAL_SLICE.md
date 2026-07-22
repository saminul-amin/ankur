# Codex Task 02 — Foundation and Thin P0 Vertical Slice

> Run only after Codex Task 01 passes and the provider results are reviewed.

## Context

The provider spike has validated the hosted Gemma path. Implement the smallest production-deployable vertical slice without widening scope.

## Objective

Deliver:

```text
pasted text or one digital PDF page
→ extraction review
→ confirmed source segments
→ preparation map
→ one MCQ
→ deterministic grading
→ source-evidence display
```

## Required modules

- Strict Next.js foundation and quality scripts.
- Environment validation.
- Domain primitives for source snapshot, segments, concepts, MCQ, and evidence.
- Browser-side one-page text PDF extraction.
- Pasted-text input.
- Extraction-review screen.
- `POST /api/analyses`.
- `POST /api/assessments` for one MCQ.
- Gemma adapter from Task 01.
- Evidence validation.
- Deterministic MCQ grading.
- Browser persistence for the stable states used in this slice.
- Health/runtime-status endpoints.
- Clearly labelled sample flow.
- Production-ready error and loading states.

## Constraints

- Follow all architecture documents and ADRs.
- No scanned-page transcription in this task.
- No written answer, revision, retry, timer, or negative marking.
- No server database.
- No full PDF sent to an API route.
- No unvalidated model artifact reaches the UI.

## Acceptance criteria

- A user can paste text and complete the slice.
- A one-page digital PDF can be extracted in the browser and reviewed.
- Source confirmation creates deterministic immutable segment IDs.
- Preparation-map concepts have valid evidence.
- The MCQ has four unique options and one valid answer.
- Objective grading is deterministic.
- Evidence opens the correct page/segment context.
- Provider failure preserves confirmed source.
- Sample flow runs without provider access and is labelled.
- Unit, integration, and Playwright sample smoke tests exist.
- Production build passes.

## Final report

Follow `AGENTS.md` and report the exact production deployment readiness. Do not begin the complete P0 flow in this task.
