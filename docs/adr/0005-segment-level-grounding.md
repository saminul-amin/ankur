# ADR-0005: Enforce Segment-Level Grounding

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

Prompt-only requests for citations do not prove that questions, answers, grading, or revision are supported by the learner-confirmed source.

## Decision

Create deterministic immutable segment IDs after source confirmation. Require model artifacts to cite IDs and optional quotes. Validate ID existence and quote inclusion in application code. Repair once or reject.

## Consequences

Positive:

- grounding becomes testable;
- UI page labels come from trusted metadata;
- unsupported artifacts can be rejected;
- evaluation can measure semantic support.

Negative:

- source segmentation and versioning add complexity;
- long segments can produce weak semantic evidence;
- valid substrings do not alone prove semantic support, so human evaluation remains necessary.
