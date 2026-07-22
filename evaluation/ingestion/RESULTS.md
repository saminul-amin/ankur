# Task 03 Live Ingestion Verification

- Gate check: **PASSED**
- Started: 2026-07-22T05:13:47.684Z
- Completed: 2026-07-22T05:13:59.752Z
- Fixture: `evaluation/provider-spike/fixtures/bengali-page.png`
- Model: `gemma-4-26b-a4b-it`
- Thinking: `minimal`
- Native structured response validated: yes
- Schema repair used: no
- Detected language: `mixed`
- Transcribed characters: 1088
- Uncertain segments: 0
- Warnings: 0
- Deterministic confirmed segments: 2
- Source version created: yes

The verifier sent one repository-owned Bengali page image. It did not load the reference transcription. No credential, provider body, raw prompt, image bytes, or full source text is stored in this report.

## Offline and browser acceptance

- Unit/component/integration: **47 passed** across 16 files.
- Playwright: **20 passed**, 6 intentional mobile skips for desktop-only binary-fixture cases.
- Three-page digital fixture: pages routed `embedded_text`, `embedded_text`, `embedded_text`; no transcription request.
- Three-page scanned fixture: pages routed `gemma_ocr`, `gemma_ocr`, `gemma_ocr`; three one-image requests in browser verification.
- Three-page mixed fixture: pages routed `embedded_text`, `gemma_ocr`, `embedded_text`; only page 2 produced a one-image request.
- Standalone Bengali images: three ordered images produced three editable page drafts.
- Provider-failure recovery: successful page drafts and manual edits remained available when page 2 failed.
- Source grounding: the provider-free journey confirmed page 2 evidence and completed the existing one-MCQ grade/evidence flow.
- Persistence: confirmation survived refresh; raw previews and transmission image data were not persisted.
- Accessibility: automated WCAG A/AA scans passed for review and confirmed states at desktop and mobile projects.
- Mobile overflow: no horizontal document overflow at the required mobile viewport.
- Screenshot inventory: 10 Task 03 ingestion screenshots generated under `evaluation/ui/`.
- Dependency audit: 0 vulnerabilities at moderate level or above.

## Production verification

- Vercel deployment: `dpl_QXsvJsTZuNEpaPfxNu2eABW2s9of`
- Production alias: `https://ankur-gamma.vercel.app`
- Deployment state: `READY`
- Vercel production build: passed.
- Production home: HTTP 200.
- Production health route: healthy.
- Production runtime: provider configured; sample mode available; live generation remains disabled by the existing production feature flag.
