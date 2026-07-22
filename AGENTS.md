# AGENTS.md — Ankur Engineering Instructions

## 1. Mission

Implement Ankur as a reliable, source-grounded adaptive learning product according to the internal SSOT and the Pre-Codex Architecture Pack.

## 2. Authority

Read before editing:

1. `ANKUR_SSOT.md` when present.
2. `SSOT_UPDATE_v1.2.0.md`.
3. All accepted ADRs.
4. `docs/API_CONTRACTS.md` and `docs/AI_CONTRACTS.md`.
5. `docs/ARCHITECTURE.md`.
6. `docs/DOMAIN_MODEL.md`.
7. `docs/PRODUCT_SPEC.md`.

When code conflicts with these documents, report the conflict. Do not silently preserve the code.

## 3. Locked technical boundaries

- One Next.js App Router modular monolith.
- TypeScript strict mode.
- Next.js Node.js Route Handlers are the backend.
- Gemma 4 through the Gemini API is the only runtime generative model.
- `GEMINI_API_KEY` is server-only.
- Browser-side PDF processing.
- No production server database for P0.
- Deterministic segment-level grounding.
- Versioned Zod schemas and bounded repair.
- No authentication, admin panel, vector database, separate backend, multi-agent framework, local model runtime, or fine-tuning in P0.

## 4. Engineering behavior

Before editing:

- inspect repository state;
- read relevant docs and tests;
- state assumptions;
- identify affected contracts;
- keep task scope narrow.

During editing:

- place business rules in domain/application modules, not Route Handlers or React components;
- keep external SDKs behind adapters;
- validate all external data;
- update tests with behavior;
- preserve user state on recoverable failures;
- do not suppress errors or weaken TypeScript to make checks pass;
- do not add a dependency without explaining its necessity and license.

After editing, run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Run targeted Playwright tests when the task changes the golden path.

## 5. Prohibited actions

- Do not use another model or provider.
- Do not put provider calls in client components.
- Do not expose provider error bodies.
- Do not accept user-controlled prompts, model IDs, or provider URLs.
- Do not send full PDFs to API routes.
- Do not trust model citations without validation.
- Do not create invented evaluation numbers.
- Do not rename product concepts without updating the domain model and contracts.
- Do not modify accepted ADRs inside an implementation task. Propose a superseding ADR instead.
- Do not claim deployment or tests passed unless commands actually ran.

## 6. Required task report

Every final report must contain:

1. Implementation summary.
2. Changed files.
3. Contract or ADR impact.
4. Important design decisions.
5. Commands run and exact outcomes.
6. Automated tests added or changed.
7. Known limitations and risks.
8. Manual verification steps.
9. Recommended next task.
10. `SSOT Update: none` or exact proposed change.

## 7. Stop conditions

Stop and report a blocker rather than improvising when:

- the required Gemma model cannot be accessed;
- provider behavior contradicts the AI contract;
- a requested change crosses a locked ADR;
- a secret appears to be exposed;
- repository state contains unrelated destructive changes;
- required source material or acceptance fixture is absent;
- satisfying the task would require P1/P2 scope before P0 is stable.
