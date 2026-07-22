# Ankur System Architecture

> **Version:** 1.0.0  
> **Status:** LOCKED FOR P0

## 1. Architecture style

Ankur is a **single-deployable modular monolith** built with Next.js App Router. It also acts as a **backend for frontend (BFF)**: browser-facing API contracts are tailored to Ankur's workflow, while the external Gemini API remains inaccessible to the browser.

This choice is professional for P0 because the application has no server database, no background queue, no mobile client, no multi-tenant identity system, and no independent backend-scaling requirement.

## 2. System context

```text
Learner or judge
      │ HTTPS
      ▼
Ankur on Vercel
  ├─ Next.js UI
  ├─ Next.js Route Handlers
  ├─ application and domain modules
  └─ server-only Gemma adapter
      │ HTTPS + server credential
      ▼
Google Gemini API
      │ explicit model ID
      ▼
Gemma 4
```

## 3. Container view

### Browser container

Responsibilities:

- Render the user experience.
- Read PDFs with `pdfjs-dist`.
- Extract embedded text.
- Render scanned pages to Canvas.
- Resize and compress page images before transmission.
- Allow extraction review and editing.
- Create the confirmed source snapshot and deterministic segment candidates.
- Store recoverable session state in LocalStorage or IndexedDB.
- Execute deterministic objective grading and display logic.

The browser never receives the provider key and never calls the Gemini API directly.

### Next.js application container

Responsibilities:

- Serve UI and static assets.
- Expose typed Route Handlers.
- Validate every request with Zod.
- Enforce operational limits, rate limits, and feature flags.
- Execute application use cases.
- Construct versioned prompts.
- Call Gemma through a server-only adapter.
- Validate schemas and source evidence.
- Return typed result or typed error envelopes.
- Emit content-free structured telemetry.

### Gemini API / Gemma 4 external system

Responsibilities:

- Image transcription and uncertainty detection.
- Material analysis.
- Candidate question and rubric generation.
- Written-answer rubric evaluation.
- Weak-concept revision and retry generation.

Gemma does not perform deterministic scoring, file validation, state persistence, or evidence acceptance.

## 4. Layering and dependency rule

```text
presentation
    ↓
application
    ↓
domain
    ↑
infrastructure adapters implement domain/application ports
```

Allowed dependencies:

- `presentation` may import `application`, `domain`, and `shared` public contracts.
- `application` may import `domain`, declared ports, and `shared`.
- `domain` may import only `shared` primitives with no framework or provider dependency.
- `infrastructure` may import ports and domain types, never the reverse.
- Route Handlers are presentation/API adapters and must remain thin.

Forbidden dependencies:

- Domain importing Next.js, React, Google SDK, PDF.js, browser storage, or telemetry libraries.
- React components importing provider clients or prompt templates.
- Route Handlers implementing grading or grounding algorithms directly.
- Browser modules importing server-only configuration.

## 5. Proposed repository structure

```text
ankur/
├── app/
│   ├── (marketing)/page.tsx
│   ├── workspace/page.tsx
│   ├── assessment/page.tsx
│   ├── results/page.tsx
│   ├── revision/page.tsx
│   └── api/
│       ├── health/route.ts
│       ├── runtime-status/route.ts
│       ├── transcriptions/route.ts
│       ├── analyses/route.ts
│       ├── assessments/route.ts
│       ├── written-evaluations/route.ts
│       └── revisions/route.ts
├── src/
│   ├── domain/
│   │   ├── materials/
│   │   ├── grounding/
│   │   ├── preparation/
│   │   ├── assessments/
│   │   ├── attempts/
│   │   └── revision/
│   ├── application/
│   │   ├── ports/
│   │   └── use-cases/
│   ├── infrastructure/
│   │   ├── gemma/
│   │   ├── documents/
│   │   ├── persistence/
│   │   ├── rate-limit/
│   │   └── telemetry/
│   ├── presentation/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   └── view-models/
│   └── shared/
│       ├── config/
│       ├── errors/
│       ├── ids/
│       ├── schemas/
│       └── utilities/
├── docs/
├── evaluation/
├── tests/
│   ├── contract/
│   ├── integration/
│   └── e2e/
├── public/samples/
├── AGENTS.md
├── .env.example
└── package.json
```

## 6. Golden-path data flow

```text
1. Browser selects source
2. Browser validates type and size
3. Browser processes each PDF page
   ├─ embedded text → local extraction
   └─ scanned/corrupt → compressed image
4. Browser calls POST /api/transcriptions for required pages
5. Learner edits and confirms pages
6. Browser creates immutable confirmed-source snapshot and segment IDs
7. Browser calls POST /api/analyses
8. Server calls Gemma, validates schema and evidence
9. Learner selects topics/configuration
10. Browser calls POST /api/assessments
11. Server generates and validates assessment
12. Browser grades objective answer locally
13. Browser calls POST /api/written-evaluations for written answer
14. Domain aggregates concept performance
15. Browser calls POST /api/revisions for weak concepts
16. Learner completes retry and sees comparison
```

## 7. Document-processing boundary

Vercel Functions have a 4.5 MB request and response body ceiling. Therefore:

- The selected source may be larger in the browser, but the original PDF is never forwarded to a Route Handler.
- Each page image is rendered, resized, and compressed in the browser.
- P0 preprocessed page payload must remain at or below 3 MB.
- At most one page image is sent in a transcription request.
- Confirmed text is capped at 25,000 characters in P0.
- Server enforcement mirrors browser enforcement.

The initial browser-side classifier should use conservative deterministic heuristics:

- minimum non-whitespace character count;
- ratio of replacement characters or control characters;
- Bengali/Latin letter presence;
- excessive isolated glyphs;
- user override.

## 8. State ownership

| State | Owner | Persistence |
|---|---|---|
| Raw selected file | Browser memory only | Not persisted by default |
| Page previews | Browser object URL / IndexedDB if needed | Session-scoped |
| Extracted draft text | Browser | IndexedDB |
| Confirmed source snapshot | Browser | IndexedDB |
| Preparation map | Browser | IndexedDB |
| Assessment and answers | Browser | IndexedDB |
| Results and revision | Browser | IndexedDB |
| Provider credentials | Server environment | Platform secret store |
| Model-generated response during request | Server memory | Not retained |
| Telemetry metadata | Server log sink | No source content |

No production server database is introduced for P0.

## 9. Session state machine

```text
EMPTY
→ SOURCE_SELECTED
→ SOURCE_PROCESSING
→ EXTRACTION_REVIEW
→ SOURCE_CONFIRMED
→ ANALYSIS_PENDING
→ PREPARATION_READY
→ ASSESSMENT_PENDING
→ ASSESSMENT_READY
→ ATTEMPT_IN_PROGRESS
→ WRITTEN_EVALUATION_PENDING
→ RESULTS_READY
→ REVISION_PENDING
→ REVISION_READY
→ RETRY_IN_PROGRESS
→ COMPLETE
```

Every pending state must have an error transition back to the last stable state. A provider error must never return the session to `EMPTY`.

## 10. Runtime and deployment

- Route Handlers that call Gemma use the Node.js runtime.
- Production is deployed to Vercel from a pinned lockfile.
- Provider key is configured in Vercel environment secrets.
- `ANKUR_LIVE_AI_ENABLED` is a kill switch.
- `ANKUR_SAMPLE_MODE_ENABLED` controls the transparent pre-generated fallback.
- Function maximum duration is configured only after confirming the deployed plan and measured P95 latency.
- No server-side response may approach the 4.5 MB platform limit.

## 11. Performance strategy

- Keep P0 source size bounded.
- Send only relevant segments to written grading and revision calls.
- Use one model call per scanned page.
- Batch written criteria for one answer into one call.
- Run a second quality-review model call only for flagged assessment items or when submission quality requires it.
- Disable duplicate submission in the UI.
- Preserve generated artifacts so a refresh does not repeat model calls unnecessarily.

## 12. Failure and degradation strategy

| Failure | Behavior |
|---|---|
| Invalid file | Reject before processing with actionable message. |
| Page transcription failure | Preserve other pages; allow retry or manual text entry. |
| Provider 429 | One bounded retry, then preserve state and offer manual retry/sample mode. |
| Provider timeout/5xx | One bounded retry, then typed recoverable error. |
| Invalid schema | One repair call; reject unresolved artifact. |
| Invalid evidence | One evidence repair; reject unresolved item. |
| Live AI disabled | Explain and offer labelled sample mode. |
| Browser state corrupt | Quarantine corrupt record and offer a clean session; never loop on startup. |

## 13. Evolution path

A dedicated backend, database, object storage, worker queue, or retrieval layer may be introduced after the hackathon only when persistent accounts, long-document pipelines, multiple clients, or independent scaling justify the cost. P0 code must preserve ports and boundaries that allow this evolution without pretending those systems already exist.
