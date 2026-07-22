# Ankur Test Strategy

> **Version:** 1.0.0  
> **Status:** REQUIRED FOR P0

## 1. Testing principles

- Most tests do not call the live provider.
- Domain rules are tested as pure functions.
- Provider behavior is isolated behind a port and mocked in CI.
- A small explicit live-provider spike is run manually and recorded.
- The golden path is tested in sample mode deterministically and in live mode manually.
- Tests verify negative paths, not only successful screens.

## 2. Test layers

### Unit tests — Vitest

Required targets:

- Unicode and whitespace normalization.
- Segment-ID generation and source-version invalidation.
- Evidence ID existence and quote-substring validation.
- MCQ option uniqueness and correct-option invariant.
- Rubric mark sum and bounded scores.
- Objective grading.
- Concept mark allocation and strength classification.
- Retry duplicate detection.
- File, page, image, and text limits.
- State-machine transitions.
- Error-code mapping.

### Contract tests

Validate:

- all public Zod schemas;
- API success and error envelopes;
- versioned model schemas against representative fixtures;
- persisted-session migration and corruption behavior;
- exact endpoint payload ceilings.

### Integration tests

Use mocked `GenerativeModelPort` responses to cover:

- transcription success and uncertainty;
- analysis with valid/invalid evidence;
- assessment generation and one repair;
- written grading totals and invalid output;
- revision generation and duplicate retry rejection;
- provider 429, timeout, 5xx, and authentication error mapping;
- live-AI kill switch;
- rate-limit behavior;
- state preservation after failure.

### Component tests — React Testing Library

Required flows:

- upload validation messages;
- extraction editing and confirmation;
- preparation-map selection;
- assessment answering;
- written evaluation loading/error state;
- results evidence expansion;
- clear-session confirmation;
- Bengali text rendering and accessible labels.

### End-to-end tests — Playwright

Deterministic sample-mode test:

1. Open public application.
2. Select sample mode.
3. Review sample source.
4. Confirm source.
5. view preparation map;
6. generate fixed sample assessment;
7. answer MCQ and written question;
8. submit;
9. view result and source evidence;
10. open revision;
11. complete retry;
12. see improvement comparison.

Production smoke test additionally verifies:

- `/api/health`;
- no authentication barrier;
- no console error;
- responsive mobile viewport;
- correct static and Bengali fonts;
- sample fallback.

## 3. Live-provider spike

This is not normal CI. Store redacted results in `evaluation/provider-spike/`.

Cases:

- Bengali text analysis.
- Bengali page image transcription.
- Mixed Bengali-English source.
- Native structured schema attempt.
- Deliberately malformed-output repair fixture where controllable.
- Invalid API key mapping.
- provider timeout simulation through adapter timeout;
- 429 mapping through a mocked provider response;
- 26B vs 31B comparison on a small common fixture if quota permits.

Record:

- model ID;
- timestamp;
- task;
- config;
- latency;
- schema-valid result;
- evidence-valid result;
- human acceptance note;
- quota or provider limitation.

## 4. Golden fixtures

Minimum fixture set:

1. A team-authored Bengali three-page learning source.
2. A short English technical source.
3. A mixed Bengali-English source.
4. A prompt-injection source containing hostile instructions.
5. Corrupted extraction text.
6. A written answer that is correct with different wording.
7. A partially correct written answer.
8. A confident answer containing unsupported external facts.

Do not place copyrighted full textbook pages in the public repository.

## 5. Quality gates

Every Codex implementation task must run:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

Before P0 production declaration:

- all commands pass;
- Playwright sample smoke passes;
- manual live golden path passes;
- three consecutive production sample runs pass;
- at least one production live run passes;
- no critical or high security defect remains open;
- no known data-loss bug remains open.

## 6. Coverage policy

Coverage is used as a warning and regression tool, not a substitute for meaningful tests.

Suggested P0 thresholds for domain and application modules:

- statements: 80%;
- branches: 75%;
- functions: 80%;
- lines: 80%.

UI styling and generated schema files may be excluded with documented reason. Do not write meaningless tests solely to satisfy percentages.

## 7. Manual test matrix

- Desktop Chrome on Windows.
- Mobile Chrome-sized viewport.
- Bengali digital PDF.
- Bengali scanned page.
- English pasted text.
- Mixed-language text.
- Invalid MIME and oversized source.
- Provider disabled.
- Provider timeout.
- 429 response.
- Invalid model output.
- Invalid evidence.
- Browser refresh at each stable stage.
- Incognito production URL.
- Clear Session.

## 8. Defect severity

| Severity | Meaning | Release rule |
|---|---|---|
| Critical | Secret exposure, unusable golden path, submission inaccessible, data-loss loop | Must fix |
| High | Incorrect grading totals, unsupported evidence accepted, scanned input broken | Must fix or disable affected feature |
| Medium | Recoverable UX issue, non-critical layout or warning problem | Fix if before freeze |
| Low | Cosmetic polish | May defer |
