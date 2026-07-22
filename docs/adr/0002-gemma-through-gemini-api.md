# ADR-0002: Access Gemma 4 Through the Gemini API

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Gemma 4 must be the primary and sole runtime generative model. The public application must remain available without a team laptop or self-managed GPU server.

## Decision

Use the hosted Gemini API through `@google/genai`, authenticated with a server-only `GEMINI_API_KEY`. Explicitly request approved Gemma 4 model IDs.

## Alternatives considered

- Ollama on a team laptop and public tunnel.
- Self-hosted GPU server.
- Another hosted LLM provider.

## Consequences

Positive:

- deployable Vercel application;
- no model-serving infrastructure;
- supported text and image input;
- official hosted access to Gemma 4.

Negative:

- dependency on provider quota, pricing, rate limits, and availability;
- source content leaves the browser for model operations;
- key and abuse controls are required.

## Constraints

- No Gemini-branded model.
- No provider calls from browser code.
- No user-controlled model ID.
- Provider spike required before implementation proceeds.
