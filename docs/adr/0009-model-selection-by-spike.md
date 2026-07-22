# ADR-0009: Select Gemma Model Policy Through Measurement

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

The Gemini API supports `gemma-4-26b-a4b-it` and `gemma-4-31b-it`. Larger does not automatically mean a better product decision once latency, quota, Bengali quality, and reliability are considered.

## Decision

Start with 26B A4B. Permit 31B only for a task where a controlled spike or evaluation shows meaningful quality improvement. Record model policy centrally by task.

## Consequences

Positive:

- avoids unsupported quality claims;
- optimizes end-to-end user experience;
- allows targeted escalation.

Negative:

- requires a small benchmark;
- task-specific model policy increases configuration complexity.
