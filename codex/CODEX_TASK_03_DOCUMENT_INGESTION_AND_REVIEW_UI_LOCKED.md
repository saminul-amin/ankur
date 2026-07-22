# Codex Task 03 — P0 Document Ingestion and Extraction Review (UI-Locked)

> Run only after the UI Gate passes.

## Context

Ankur already supports pasted text and one-page digital-text PDF input through a grounded MCQ vertical slice. The premium Ankur visual system is now an implementation contract.

This task expands only the P0 source-ingestion boundary. All new screens and states must use the approved Ankur design system and existing signature components. It does not add written grading, diagnosis, revision, or retry.

## Objective

Deliver the complete P0 material-ingestion journey:

```text
pasted text, up to three page images, or one PDF up to three pages
→ page-level classification
→ direct extraction or Gemma 4 transcription per page
→ premium side-by-side extraction review
→ edit/include/exclude pages
→ explicit learner-priority instruction
→ confirm source
→ deterministic immutable source segments
→ continue through the existing grounded preparation-map and one-MCQ slice
```

## Authority order

Read before editing:

1. `ANKUR_SSOT.md`
2. `AGENTS.md`
3. all accepted ADRs under `docs/adr/`
4. `docs/UI_UX_DESIGN_SYSTEM.md`
5. `docs/PRODUCT_SPEC.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DOMAIN_MODEL.md`
8. `docs/API_CONTRACTS.md`
9. `docs/AI_CONTRACTS.md`
10. `docs/SECURITY.md`
11. `docs/TEST_STRATEGY.md`
12. `docs/EVALUATION.md`
13. `docs/DELIVERY_PLAN.md`
14. provider, vertical-slice, and UI-gate result reports

## Required scope

### Source types

- Pasted Bengali, English, or mixed text.
- One digitally generated, scanned, or mixed PDF with at most three pages.
- Up to three standalone JPG, PNG, or WebP page images.
- One source collection per P0 session.

### Browser-side PDF processing

- Use PDF.js in the browser.
- Inspect each page independently.
- Extract embedded text where usable.
- Classify suspicious or insufficient embedded text using centralized configurable heuristics.
- Render scanned or suspicious pages in the browser.
- Resize while preserving legibility, with an approximate maximum long edge of 1,800 pixels.
- Compress each transmitted image below the configured safe decoded-byte limit.
- Send only one preprocessed page image per transcription request.
- Never send the original PDF through an application API route.
- Revoke object URLs and release PDF.js resources.

### Page transcription

Implement and integrate `POST /api/transcriptions` according to `docs/API_CONTRACTS.md`.

- Use the existing server-only Gemma adapter.
- Use `gemma-4-26b-a4b-it` with minimal thinking.
- Use native schema mode, Zod validation, and one bounded repair attempt.
- Preserve visible structure; do not summarize or answer page questions.
- Return uncertain segments and warnings.
- Validate MIME type and decoded image size server-side.
- Preserve typed safe errors.

### Premium extraction-review experience

Use the approved `SourceCanvas`, `PageReviewCard`, `ProcessNarrative`, `GrowthRail`, status, alert, and action primitives.

For every page show:

- original page preview;
- page number;
- processing method (`embedded_text`, `gemma_ocr`, or `manual_text`);
- editable extracted text;
- uncertain-segment warnings;
- include/exclude control;
- retry transcription where safe;
- processing and error state per page.

Desktop:

- use a balanced preview/editor split;
- keep page controls visible but not visually dominant;
- preserve comfortable Bengali reading width.

Mobile:

- use a clear stacked composition;
- keep primary confirmation reachable;
- never cover text with sticky actions;
- preserve preview legibility.

Requirements:

- OCR output is always an editable draft.
- No analysis or assessment generation can run until the user explicitly confirms the source.
- Provider failure must preserve all successfully extracted and edited text.
- The user can return from review without losing current work.
- At least one included, non-empty page is required to confirm.
- Loading must explain the current page-level processing stage.
- Errors must state what remains preserved and the safe recovery action.

### Priority instruction

Add the explicit application-controlled field:

`What should Ankur prioritize?`

- Maximum 1,000 characters.
- Clearly separated visually and semantically from uploaded source content.
- Persisted with the source session.
- Passed to `/api/analyses` only after source confirmation.
- Never infer that text inside a document is a trusted priority instruction.
- Use helper text explaining that it guides emphasis but cannot override the source.

### Source confirmation and segmentation

- Generate a content-derived source version after confirmation.
- Preserve trusted material and page metadata.
- Create deterministic immutable segment IDs.
- Recreate segments whenever confirmed text changes.
- Invalidate downstream preparation maps and assessments when the source version changes.
- Revalidate persisted source and extraction artifacts before rendering.
- Display the confirmed-source state and version without overwhelming normal users.

### Persistence and recovery

Persist the current ingestion/review state in browser storage using a versioned envelope.

At minimum preserve:

- selected source metadata without relying on server persistence;
- page processing results;
- user edits;
- include/exclude choices;
- learner-priority instruction;
- confirmed source version and segments;
- safe workflow stage.

Do not persist raw original files longer than necessary. Clearly define what cannot survive a browser restart and provide an honest recovery message.

### Sample and evaluation fixtures

- Add a team-authored three-page mixed PDF fixture containing at least one embedded-text page and one scanned page.
- Add standalone Bengali image fixture coverage.
- Add a clearly labelled provider-free sample ingestion flow.
- Add an explicit-opt-in live ingestion verifier and redacted result report.
- Capture desktop and mobile screenshots of source selection, page processing, review, warning, and confirmed states under `evaluation/ui/`.

## Constraints

- Keep Next.js Route Handlers as the only application backend.
- Preserve `docs/UI_UX_DESIGN_SYSTEM.md`; do not create a competing visual system.
- Do not add server database, object storage, queue, authentication, admin interface, or separate backend.
- Do not add short written questions, written evaluation, concept diagnosis, revision, retry, timer, negative marking, or new question types.
- Do not import the Google SDK outside server infrastructure.
- Do not send provider prompts, raw outputs, keys, or source content to production logs.
- Do not bypass evidence validation in the existing preparation-map and MCQ flow.
- Do not use traditional OCR unless explicitly approved as a later experiment.
- Do not visually regress the existing landing, map, MCQ, result, or evidence screens.
- Do not introduce default-library-looking components.

## Required tests

### Unit

- Page-classifier heuristics.
- Image byte and type validation.
- Text normalization.
- Source-version invalidation.
- Deterministic segmentation across multiple pages.
- Persistence-envelope validation and corrupted-state rejection.
- Page-review visual-state variants where valuable.

### Integration

- Mixed PDF routes embedded-text and scanned pages differently.
- Transcription endpoint request/response validation.
- Provider failure preserves editable review state.
- Source modification invalidates downstream artifacts.
- Priority instruction is treated as application input, not source content.
- Oversized, malformed, encrypted, unsupported, and over-page-limit inputs fail safely where detectable.

### End-to-end

Provider-free Playwright flow at desktop and mobile viewports:

1. Select the mixed sample.
2. Review multiple pages.
3. Edit one OCR segment.
4. Exclude and re-include a page.
5. Enter a priority instruction.
6. Confirm the source.
7. Generate the preparation map.
8. Generate and answer the existing MCQ.
9. Expand evidence and verify the correct page/segment.
10. Refresh at a stable stage and verify safe recovery.
11. Complete the critical review flow using keyboard navigation.
12. Verify no horizontal overflow at the required mobile viewport.

Live provider verification must remain explicit opt-in and outside normal CI.

## Required commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Add and run a separate explicit-opt-in live ingestion verification command. Never execute it in normal CI.

## Acceptance criteria

- Pasted text still works.
- A three-page digital PDF works.
- A three-page scanned PDF works on the selected fixture.
- A mixed PDF routes pages independently.
- Up to three page images work.
- Every page has premium preview, method, editable text, warnings, and include/exclude state.
- Raw OCR cannot bypass user confirmation.
- Confirmed pages create deterministic source segments with valid page metadata.
- Editing confirmed text creates a new source version and invalidates stale downstream artifacts.
- Priority instruction reaches analysis as a separate trusted field.
- Provider failure and refresh do not destroy completed review work.
- All payload and page limits are enforced.
- Existing preparation-map, MCQ, grading, evidence, and UI-gate tests remain passing.
- New screens follow the approved design system at desktop and mobile.
- Loading, warning, error, empty, and confirmed states are intentionally designed.
- Production deployment remains healthy after the change.

## Final report

Report:

1. Implementation summary
2. Changed files
3. Architecture, visual-system, and contract compliance
4. Browser PDF and image-processing decisions
5. Page-classification behavior
6. Transcription endpoint behavior
7. Extraction-review UX behavior
8. Persistence and invalidation behavior
9. Commands run and exact outcomes
10. Tests added or changed
11. Mixed/scanned/digital fixture results
12. Source-grounding regression result
13. Responsive and accessibility verification
14. Screenshot inventory
15. Secret and privacy verification
16. Production deployment verification
17. Known limitations
18. Manual desktop and mobile QA steps/results
19. Recommendation: `Task 03 PASSED` or `Task 03 BLOCKED`
20. Recommended next task
21. `SSOT Update: none` or exact proposed changes

Do not begin written grading or adaptive-learning work automatically.
