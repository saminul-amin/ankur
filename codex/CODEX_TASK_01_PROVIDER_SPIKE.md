# Codex Task 01 — Gemma 4 Provider Feasibility Spike

## Context

Ankur will use Gemma 4 through the hosted Gemini API. The application architecture is defined in the Pre-Codex Architecture Pack. This task verifies provider behavior before application implementation.

## Objective

Create a minimal, server-only, disposable-but-clean provider spike that proves authentication, model access, Bengali text, Bengali image input, structured-output handling, error mapping, and secret isolation.

## Allowed scope

- Repository foundation only where necessary to run the spike.
- Server-only environment validation.
- `GenerativeModelPort` and Google adapter skeleton.
- CLI or server-only scripts under `scripts/provider-spike/`.
- Versioned test schemas and redacted result report.
- Unit tests for configuration and error mapping.

Do not build product screens, PDF upload, assessment UI, persistence, or complete prompts.

## Required behavior

Test explicitly:

1. `gemma-4-26b-a4b-it` plain Bengali text generation.
2. One Bengali printed/scanned page image input.
3. One small Zod-backed structured response.
4. Native structured schema if supported; otherwise documented JSON/Zod fallback.
5. Thinking `minimal` and `high` configuration paths.
6. Invalid key error mapping without secret leakage.
7. Timeout handling.
8. Mocked 429 and 5xx mapping.
9. Optional 31B comparison only if access/quota permits.

## Technical constraints

- Use `@google/genai` only in a server-only infrastructure module.
- Read `GEMINI_API_KEY` only from server environment.
- Never print the key or raw authorization data.
- Use explicit approved Gemma model IDs.
- Keep prompts and schemas versioned.
- Do not add a second provider.
- Do not place live calls in normal CI tests.

## Acceptance criteria

- Spike commands are documented.
- Bengali text is readable.
- Image input returns a useful transcription result or a precise documented blocker.
- At least one structured response validates or is repaired successfully.
- Typed error categories exist.
- No secret appears in browser/client output, logs, fixtures, Git diff, or report.
- A redacted `evaluation/provider-spike/RESULTS.md` records model, date, config, latency, schema outcome, evidence notes, and limitations.
- Lint, typecheck, unit tests, and build pass.

## Required commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run spike:gemma
```

The live spike command must require an explicit environment flag so it cannot run accidentally in CI.

## Final report

Follow `AGENTS.md`. Do not proceed into application implementation. Recommend whether Gate 1 is passed or blocked.
