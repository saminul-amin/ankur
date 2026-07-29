# Ankur R2F preview release report

## Release identity

- Trusted source branch: `task06c-r2f/final-assessment-correction`
- Trusted source SHA: `3b458b736d487ba9c927868b3a29064ecb7e7cd0`
- Release branch: `release/ankur-r2f-preview`
- Release code SHA: `3575cf808cf1e5362ff6a626aca864bdef4a3128`
- Integration strategy: direct branch from the trusted R2F SHA; full history
  preserved; no squash, rebase, cherry-pick, or merge.
- Remote baseline: `origin/main` at
  `3728724ef4140666566bb9f72fd5dfb55bc523c3`
- Topology at branch creation: zero commits behind and 26 commits ahead of
  `origin/main`.

## Release changes

Two release-verification defects were corrected without changing prompts,
provider transport, grounding, scoring, persistence, or UI behavior:

- a one-concept preparation map now expands the written-question evidence scope
  with additional confirmed segments from the same source version when needed;
- the API contract now permits empty feedback only for the deterministic
  `not_answered` written status.

Release work also adds this report, the human approval checklist, and public-safe
screenshot copies. Frozen Task 06 through R2F evidence is unchanged.

## Changed files

Release documentation and evidence:

- `docs/releases/ANKUR_R2F_PREVIEW_RELEASE_REPORT.md`
- `docs/releases/ANKUR_R2F_HUMAN_APPROVAL_CHECKLIST.md`
- eight public-safe PNG files under `docs/releases/screenshots/`

One-concept assessment release fix:

- `src/application/services/evidence-first-assessment-builder.ts`
- `tests/unit/deterministic-assessment-construction.test.ts`

Deterministic unanswered-grading contract fix:

- `src/shared/schemas/api-contracts.ts`
- `tests/unit/written-grading-and-diagnosis.test.ts`

No provider prompt, model configuration, accepted ADR, historical evaluation
record, production variable, or production deployment was changed.

## Provider-free release gate

| Check | Result |
|---|---|
| `npm ci` | Passed; 290 packages installed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 33 files and 168 tests |
| `npm run build` | Passed; Next.js 16.2.11 production build |
| `npm run test:e2e` | Passed; 22 tests and 6 intentional skips |
| `npm audit --audit-level=moderate` | Passed; zero vulnerabilities |
| Architecture/security contracts | Passed; 2 files and 6 tests |
| Task 06 public/closure verification | Passed |
| Task 06C public verification | Passed |
| R1/R2/R2E/R2F provider-free verification | Passed |
| Task 06 through R2F notebooks | Restart-and-run-all passed |
| Secret scan | Passed; zero credential-pattern matches |
| Client bundle scan | Passed; zero credential/name matches |
| Public privacy scan | Passed; zero matches |
| `git diff --check` | Passed |

The first sandboxed production build could not download Google font assets.
The same command passed with network access; this was an execution-environment
network restriction, not a source defect.

The release fixes are recorded in commits `25b1dcf` and `3575cf8`. The final
post-fix full gate passed with 33 test files / 168 tests and 22 Playwright tests
/ 6 intentional project-specific skips.

## Local production verification

- Production server: `next start` on `127.0.0.1:3200`
- Home: HTTP 200
- Health: HTTP 200
- Sample mode: enabled
- Live AI: disabled locally
- Provider configured: yes
- Primary model: `gemma-4-26b-a4b-it`
- Playwright sample, ingestion, assessment, written grading, revision/retry,
  keyboard, accessibility, and responsive checks: passed
- Automated WCAG A/AA violations in tested screens: none
- Mobile horizontal overflow in tested screens: none

## Sanitized environment audit

No values from local secret files were inspected.

| Variable | Classification | Local | Preview | Production | Purpose |
|---|---|---|---|---|---|
| `GEMINI_API_KEY` | Required for live AI; server-only secret | Present | Present, encrypted | Present, encrypted | Hosted Gemma authentication |
| `ANKUR_LIVE_AI_ENABLED` | Non-secret flag | Disabled in local smoke | `true` | Unchanged | Live-generation kill switch |
| `ANKUR_SAMPLE_MODE_ENABLED` | Non-secret flag | Enabled | `true` | Unchanged | Provider-free demonstration |
| `GEMMA_PRIMARY_MODEL` | Non-secret locked model | Default locked | `gemma-4-26b-a4b-it` | Unchanged | Sole application model |
| `GEMMA_NATIVE_STRUCTURED_OUTPUT` | Non-secret | Native | `native` | Unchanged | Structured-output mode |
| `AI_REQUEST_TIMEOUT_MS` | Non-secret | 90,000 ms | 90,000 ms | Unchanged | Provider timeout |
| `ANKUR_BUILD_ID` | Optional release metadata | Local fallback | Vercel Git SHA | Unchanged | Health/build correlation |

No `NEXT_PUBLIC_*` provider secret or model override exists.

## Vercel project

- Project: `ankur`
- Project ID: `prj_p9iokXO06qrp6LLremLvm5PxXMAZ`
- Framework: Next.js
- Root directory: `.`
- Node.js: 24.x
- Build command: Next.js default (`npm run build`)
- Output: Next.js default
- API routes: Node.js runtime
- AI route maximum duration: 180 seconds
- Preview environment: configured
- Production environment/deployment: unchanged

## Preview deployment

- Deployment ID: `dpl_7rtKUcsKLraUnwHniJhv3E5fncE6`
- Preview URL:
  `https://ankur-90h3wl2r5-saminulamin-gmailcoms-projects.vercel.app`
- Stable branch alias:
  `https://ankur-saminulamin-3445-saminulamin-gmailcoms-projects.vercel.app`
- Deployment status: Ready (preview target; production was not changed)
- Build duration: 45 seconds
- Exact deployed SHA/build ID:
  `3575cf808cf1e5362ff6a626aca864bdef4a3128` /
  `3575cf808cf1`
- Access protection: unauthenticated requests receive HTTP 302 to Vercel SSO.
  Authenticated Vercel deployment checks return HTTP 200.
- Runtime: live AI enabled, sample mode enabled, provider configured, primary
  model `gemma-4-26b-a4b-it`.

## Preview smoke matrix

| Flow | Result |
|---|---|
| HTTPS/home/general rendering | Authenticated health/home passed; unauthenticated clean-browser access blocked by Vercel SSO |
| Sample flow | Local production Playwright passed; preview flag is enabled; remote interactive check blocked by Vercel SSO |
| Live English pasted text | Passed full analysis, assessment, revision/retry, and retry written-grading chain |
| Live Bengali pasted text | Analysis passed; assessment returned controlled `MODEL_OUTPUT_INVALID` after bounded repair |
| Mixed-language pasted text | Analysis passed; assessment returned controlled `MODEL_OUTPUT_INVALID` after bounded repair |
| Digital/scanned PDF | Local production Playwright passed; remote interactive check blocked by Vercel SSO |
| Standalone image | Live Bengali image transcription returned a non-empty, schema-valid transcription |
| Assessment interaction | English passed; Bengali and mixed assessment availability failed as above |
| Written grading | English retry written grading passed with valid marks/status |
| Revision/retry | English live adaptive chain passed |
| Controlled failure | Empty-source request returned safe `VALIDATION_FAILED` without provider or credential leakage |
| Mobile | Local production Playwright passed with no horizontal overflow; remote interactive check blocked by Vercel SSO |
| Console/server errors | No unsafe provider body or credential exposure observed; controlled generation failures remained sanitized |

The live verifier intentionally did not rerun unchanged Bengali or mixed
assessment failures to select a favorable output. The preview therefore does
not satisfy the required multilingual release-availability gate.

## Evaluation disclosure

Final logical validity: 33/45 — 73.33%.

- Persisted structured questions: 42
- Valid written cases: 18
- Deterministic grounding: 42/42
- Deterministic MCQ-key validity: 42/42
- Invalid rubrics entering grading metrics: 0
- Cross-material evidence defects: 0
- Assessment invalid outputs after repair: 2
- Duplicate diagnostics: 7/42 — 16.67%
- One analysis rate limit and one analysis timeout occurred.
- No fresh formal R2F human review was performed.
- The self-imposed 43/45 reliability gate was not reached.

Ankur rejects invalid generated artifacts rather than persisting them. In the
final fixed evaluation, every persisted question was grounded in its source and
had a deterministically valid answer key, while overall structured-generation
availability remained below the project's strict reliability target.

## Screenshots

- `docs/releases/screenshots/homepage-desktop.png`
- `docs/releases/screenshots/homepage-mobile.png`
- `docs/releases/screenshots/source-input-desktop.png`
- `docs/releases/screenshots/learning-result-desktop.png`
- `docs/releases/screenshots/assessment-desktop.png`
- `docs/releases/screenshots/written-grading.png`
- `docs/releases/screenshots/revision-retry-desktop.png`
- `docs/releases/screenshots/controlled-failure.png`

## Known limitations

- Structured generation remains probabilistic and below the internal 43/45
  reliability target.
- Two R2F assessment artifacts remained invalid after bounded repair.
- Provider latency, rate limits, timeout, quota, and availability remain external
  dependencies.
- Sample mode is required as a safe fallback.
- Browser persistence is device-local and has no account synchronization.
- Fresh independent R2F human review has not been performed.
- Bengali and mixed-language preview assessments produced controlled invalid
  outputs after bounded repair.
- The preview remains protected by Vercel SSO and is not available to a clean
  unauthenticated reviewer session.

## Release decision

Release QA failed. Production is not authorized. Before another preview can be
submitted for human approval, assessment-generation reliability must pass the
required Bengali and mixed-language live flows, and the project owner must
create a Vercel shareable preview link (or otherwise authorize appropriate
preview access) without weakening production protection.

## Rollback

The preview must not be promoted directly. If human review rejects it, leave the
current production deployment and variables unchanged, correct only a reproduced
release blocker on the release branch, rerun affected gates, and create a new
preview. Production rollback remains the last known-good Vercel production
deployment.
