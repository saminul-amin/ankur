# SSOT Update — Hosted Gemma Architecture and Pre-Codex Contract

> **Target SSOT version:** 1.2.0  
> **Decision date:** 22 July 2026  
> **Status:** APPROVED

## 1. Final decisions

### D-029 — Hosted Gemma runtime

**Status:** LOCKED

Ankur uses Gemma 4 as its sole user-facing runtime generative model through Google's hosted Gemini API. The application accesses the API through the official Google GenAI JavaScript SDK using a server-only `GEMINI_API_KEY`.

The fact that the service endpoint is named Gemini API does not mean Ankur uses a Gemini-branded model. Every production inference request must explicitly name an approved Gemma 4 model.

### D-030 — Next.js backend

**Status:** LOCKED FOR HACKATHON MVP

Ankur uses Next.js App Router Route Handlers on the Node.js runtime as its application backend. The backend is part of the same deployable modular monolith as the frontend. A separate FastAPI, Express, or NestJS deployment is rejected for P0.

### D-031 — Pre-Codex architecture contract

**Status:** LOCKED

Codex implementation must begin from the approved Pre-Codex Architecture Pack. Codex may not silently choose alternative architectural patterns, persistence layers, AI providers, route contracts, or source-grounding mechanisms.

### D-032 — Local Gemma rejected for MVP

**Status:** REJECTED FOR HACKATHON MVP

Local or self-hosted Gemma through Ollama, LM Studio, Hugging Face, or a custom inference server is not used for the hackathon runtime because a public deployment must not depend on a team laptop, tunnel, or self-managed GPU server.

### D-033 — Provider spike before product implementation

**Status:** LOCKED

A bounded provider feasibility spike must verify model access, Bengali text quality, Bengali image understanding, structured-output behavior, latency, error handling, and provider quota before application implementation is considered unblocked.

## 2. Exact access-method replacement

Replace the runtime access section with:

> Ankur accesses Gemma 4 through Google's hosted Gemini API using the official `@google/genai` SDK. All provider calls occur in server-only infrastructure adapters invoked by Next.js Node.js Route Handlers. The provider credential is stored in the server environment as `GEMINI_API_KEY`; it is never sent to browser code, written to logs, committed to Git, or returned in an error response. Runtime requests must explicitly use an approved Gemma 4 model ID. No Gemini-branded model or other LLM is part of the product inference pipeline.

## 3. Exact architecture replacement

Replace ambiguous references to “no backend” or “frontend-only” with:

> Ankur is a full-stack Next.js modular monolith. React Server and Client Components provide the presentation layer. Next.js Route Handlers provide a backend-for-frontend API and execute application use cases in the Node.js runtime. Domain rules remain framework-independent. Infrastructure adapters integrate with the Gemini API, browser document processing, browser persistence, telemetry, and rate limiting.

## 4. Environment contract

Required production variable:

```env
GEMINI_API_KEY=
```

Required non-secret configuration:

```env
ANKUR_LIVE_AI_ENABLED=true
ANKUR_SAMPLE_MODE_ENABLED=true
GEMMA_PRIMARY_MODEL=gemma-4-26b-a4b-it
GEMMA_ESCALATION_MODEL=gemma-4-31b-it
GEMMA_NATIVE_STRUCTURED_OUTPUT=auto
AI_REQUEST_TIMEOUT_MS=90000
AI_MAX_NETWORK_RETRIES=1
AI_MAX_SCHEMA_REPAIRS=1
```

Exact timeout and function-duration settings must be confirmed against the deployed Vercel plan and measured provider latency.

## 5. New document-control rule

The internal SSOT remains authoritative for product and delivery decisions. The Pre-Codex Architecture Pack is authoritative for implementation boundaries, domain vocabulary, endpoint contracts, AI schemas, security controls, and test obligations.

Any change to a locked item requires:

1. an explicit user decision;
2. an ADR update or replacement;
3. an SSOT decision-register entry;
4. corresponding API/schema/test changes;
5. a migration note when stored client state is affected.
