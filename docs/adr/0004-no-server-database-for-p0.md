# ADR-0004: No Production Server Database for P0

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

P0 has no accounts, collaboration, cross-device history, or server-owned workflow that requires durable persistence.

## Decision

Store recoverable learning-session state in the browser using LocalStorage and IndexedDB. Keep AI Route Handlers stateless apart from optional rate-limit infrastructure.

## Consequences

Positive:

- less scope and privacy exposure;
- no migrations, authentication, or data-retention backend;
- faster delivery.

Negative:

- no cross-device sync;
- clearing browser data removes sessions;
- no true server-side idempotency;
- state schema migrations still need client handling.

## Revisit when

Accounts, shared classes, history, analytics, or cross-device use becomes required.
