# ADR-0006: Use Versioned Structured AI Output

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Ankur needs machine-verifiable analyses, assessments, grading, and revision. Free-form model text is too fragile.

## Decision

Define versioned Zod schemas and prompt versions. Prefer native provider JSON schema when verified by the spike; otherwise use strict JSON-only prompting. Validate, repair once, then fail safely.

## Consequences

Positive:

- typed application contracts;
- measurable reliability;
- controlled failures;
- easier regression testing.

Negative:

- provider-specific schema support must be tested;
- schema evolution requires migrations and fixture updates;
- repair calls add latency and quota use.
