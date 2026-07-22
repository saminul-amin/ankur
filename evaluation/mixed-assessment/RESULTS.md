# Task 04 Live Mixed-Assessment Verification

- Gate check: **PASSED**
- Started: 2026-07-22T07:16:00.911Z
- Completed: 2026-07-22T07:20:02.704Z
- Model: `gemma-4-26b-a4b-it`
- Candidate-generation thinking: `minimal`
- Written-grading thinking: `high`
- Structured-output mode: `native`
- Preparation map: deterministic, validated repository fixture
- Composition: 2 questions; MCQ 1 mark; written 5 marks
- Rubric criteria: 3
- Rubric maximum total: 5
- Activity grounding/invariant failures: 0
- Correct-answer validation failures: 0
- Partial-answer validation failures: 0
- Empty-answer validation failures: 0
- Correct-answer result: 5/5, `correct`
- Partial-answer result: 2/5, `partially_correct`
- Empty-answer result: 0/5, `not_answered`
- Empty answer provider bypass: passed
- Written provider calls: 2
- Assessment latency: 82147 ms
- Correct grading latency: 79643 ms
- Partial grading latency: 79986 ms
- Assessment repair used: yes
- Correct grading repair used: yes
- Partial grading repair used: yes
- Criterion and total reconciliation: passed

No credential, raw prompt, provider response body, source text, reference answer, or student answer is stored in this report.

## Offline verification

- `npm run lint`: passed
- `npm run typecheck`: passed
- `npm test`: passed (20 files, 73 tests)
- `npm run build`: passed
- `npm run test:e2e`: passed (20 passed, 6 intentionally skipped mobile-only duplicates)
- `npm audit --audit-level=moderate`: passed (0 vulnerabilities)
- Desktop and mobile screenshot set: captured and visually reviewed
- Automated WCAG A/AA, keyboard, reduced-motion, and horizontal-overflow checks: passed

## Production verification

- Deployment: `dpl_J6FKNFt92jG5fNwcEk1VQN1t87BV` (`Ready`, production)
- Canonical alias: `https://ankur-gamma.vercel.app`
- Home: HTTP 200
- Health: HTTP 200
- Runtime: sample mode enabled; provider configured; live AI disabled; primary model `gemma-4-26b-a4b-it`
- Provider-free mixed-assessment sample: completed at 3/6 with weak-concept results visible and no page error observed
- Disabled written-grading endpoint: HTTP 503 with safe `LIVE_AI_DISABLED` response and `Cache-Control: no-store`
- Public assets scanned: 8 JavaScript assets; no `GEMINI_API_KEY`, `@google/genai`, Google API-key-shaped value, or provider-related `NEXT_PUBLIC_*` identifier found
- Production live grading: not run because the human-controlled live-AI flag remains disabled
