# ADR-0007: Protect the Public Demo and Provide Sample Mode

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

The demo requires no login, but unrestricted model access could exhaust quota or be abused. Provider failure must not erase the demonstrable product story.

## Decision

Use narrow task-specific APIs, rate limits, payload limits, one active request per session, a live-AI kill switch, and a clearly labelled pre-generated Gemma 4 sample mode.

## Consequences

Positive:

- protects key and quota;
- maintains a useful public experience during outage;
- recorded demonstration remains reproducible.

Negative:

- durable rate limiting adds a small infrastructure concern;
- sample mode must be clearly disclosed to avoid misleading judges.
