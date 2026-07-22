# ADR-0003: Process PDFs in the Browser

- **Status:** Accepted
- **Date:** 2026-07-22

## Context

P0 supports digital, scanned, and mixed PDFs. Vercel Functions limit request and response bodies to 4.5 MB.

## Decision

Use `pdfjs-dist` in the browser to extract embedded text or render pages. Send only compressed individual page images requiring transcription to the backend.

## Consequences

Positive:

- avoids large serverless uploads;
- improves privacy by not forwarding the full PDF;
- enables page-level routing and immediate preview.

Negative:

- browser performance varies;
- PDF worker configuration and mobile memory require testing;
- file processing logic exists client-side.

## Limits

P0: one source, three processed pages, 8 MB selected source, 3 MB maximum preprocessed page payload, 25,000 confirmed characters.
