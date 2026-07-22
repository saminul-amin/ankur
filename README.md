# Ankur Pre-Codex Architecture Pack

> **Status:** APPROVED IMPLEMENTATION CONTRACT  
> **Version:** 1.0.0  
> **Date:** 22 July 2026  
> **Project:** Ankur — Adaptive Learning from Any Source  
> **Team:** Hotasha

This pack converts the internal Ankur SSOT into an implementation-ready engineering contract. It is intentionally more precise than a product brief and intentionally smaller than an enterprise architecture manual.

Codex must not design the application independently. It must implement against this pack, raise contradictions, and request an explicit ADR change before crossing a locked boundary.

## 1. Final runtime decisions

| Area | Decision |
|---|---|
| Application shape | Single deployable Next.js modular monolith |
| Frontend | Next.js App Router, React, TypeScript, Tailwind CSS |
| Backend | Next.js Route Handlers using the Node.js runtime |
| Runtime model | Gemma 4 only |
| Hosted model access | Gemini API through the official `@google/genai` SDK |
| Authentication to provider | Server-only `GEMINI_API_KEY` |
| Initial model candidate | `gemma-4-26b-a4b-it` |
| Escalation candidate | `gemma-4-31b-it`, only after measured benefit |
| PDF processing | Browser-side `pdfjs-dist` page routing and rendering |
| Server persistence | None for the hackathon MVP |
| Client persistence | LocalStorage for small metadata; IndexedDB for larger structured session state |
| Deployment | Vercel |
| Grounding | Deterministic immutable segment IDs plus evidence validation |
| AI output safety | Versioned schemas, Zod validation, one bounded repair attempt |
| Public demo | No login, quota-protected live mode, clearly labelled sample fallback |

## 2. Reading order

1. `SSOT_UPDATE_v1.2.0.md`
2. `docs/PRODUCT_SPEC.md`
3. `docs/ARCHITECTURE.md`
4. `docs/DOMAIN_MODEL.md`
5. `docs/API_CONTRACTS.md`
6. `docs/AI_CONTRACTS.md`
7. `docs/SECURITY.md`
8. `docs/TEST_STRATEGY.md`
9. `docs/EVALUATION.md`
10. `docs/DELIVERY_PLAN.md`
11. `docs/OPERATIONS_RUNBOOK.md`
12. `docs/TRACEABILITY_MATRIX.md`
13. `docs/adr/*`
14. `AGENTS.md`
15. `codex/CODEX_TASK_01_PROVIDER_SPIKE.md`
16. `codex/CODEX_TASK_02_FOUNDATION_AND_VERTICAL_SLICE.md`

## 3. Authority order

When documents conflict:

1. Latest explicit user decision
2. Latest internal `ANKUR_SSOT.md`
3. Accepted ADRs in this pack
4. `docs/API_CONTRACTS.md` and `docs/AI_CONTRACTS.md`
5. `docs/ARCHITECTURE.md`
6. `docs/PRODUCT_SPEC.md`
7. Other documents
8. Existing code

Existing code is never authoritative when it conflicts with a locked product or architecture decision.

## 4. Pre-implementation gates

Implementation may begin only after:

- the Gemini API key is available in a local server environment;
- the two Gemma 4 model IDs can be queried or a documented provider limitation is recorded;
- one Bengali text request succeeds;
- one Bengali page-image request succeeds;
- the structured-output strategy is verified;
- the golden fixture is prepared;
- no contradiction remains between the SSOT and this pack.

## 5. Non-negotiable rules

- Never call the Gemini API from browser code.
- Never expose or log `GEMINI_API_KEY`.
- Never use a Gemini-branded generative model or any other runtime LLM.
- Never send a complete large PDF through a Vercel Function.
- Never treat model-provided citations as valid without deterministic checks.
- Never add authentication, an admin panel, a vector database, a separate backend, or a multi-agent framework during P0.
- Never call a task complete without lint, typecheck, tests, and production build evidence.
- Never fabricate evaluation metrics.

## 6. Official-source basis

This architecture reflects current official documentation available on 22 July 2026:

- Gemma 4 hosted through the Gemini API with `gemma-4-26b-a4b-it` and `gemma-4-31b-it`.
- Google GenAI JavaScript SDK and Zod-capable structured schemas.
- Next.js App Router Route Handlers as full-stack backend-for-frontend endpoints.
- Vercel Function request and response payload ceiling of 4.5 MB.

Provider and platform capabilities must still be verified through the spike because quotas and endpoint-specific behavior can vary by project and model.

## 7. Task 01 provider spike

This repository currently implements only the bounded, server-only Gemma 4 provider feasibility spike. It does not contain product screens or Task 02 application work.

Install and verify the non-live code:

```bash
npm install
npm run lint
npm run typecheck
npm test
npm run build
```

Configure `GEMINI_API_KEY` in `.env.local`, then explicitly opt in to the live, quota-consuming spike. PowerShell example:

```powershell
$env:ANKUR_PROVIDER_SPIKE_OPT_IN = "true"
npm run spike:gemma
```

The command refuses to run without that flag. It uses `gemma-4-26b-a4b-it`, the Bengali fixture under `evaluation/provider-spike/fixtures/`, and writes a credential-free report to `evaluation/provider-spike/RESULTS.md`. The optional 31B comparison also requires `ANKUR_SPIKE_COMPARE_31B=true`.
