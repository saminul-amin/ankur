# Ankur R2F preview release report

## Release identity

- Trusted source branch: `task06c-r2f/final-assessment-correction`
- Trusted source SHA: `3b458b736d487ba9c927868b3a29064ecb7e7cd0`
- Release branch: `release/ankur-r2f-preview`
- Release SHA: pending final evidence commit
- Integration strategy: direct branch from the trusted R2F SHA; full history
  preserved; no squash, rebase, cherry-pick, or merge.
- Remote baseline: `origin/main` at
  `3728724ef4140666566bb9f72fd5dfb55bc523c3`
- Topology at branch creation: zero commits behind and 26 commits ahead of
  `origin/main`.

## Release changes

No product, prompt, schema, provider, domain, persistence, or UI behavior was
changed. Release work adds only this report, the human approval checklist, and
public-safe screenshot copies. Frozen Task 06 through R2F evidence is unchanged.

## Provider-free release gate

| Check | Result |
|---|---|
| `npm ci` | Passed; 290 packages installed |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 33 files and 166 tests |
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

- Deployment ID: pending
- Preview URL: pending
- Deployment status: pending
- Build duration: pending
- Exact deployed SHA: pending

## Preview smoke matrix

| Flow | Result |
|---|---|
| HTTPS/home/general rendering | Pending |
| Sample flow | Pending |
| Live English pasted text | Pending |
| Live Bengali pasted text | Pending |
| Mixed-language pasted text | Pending |
| Digital/scanned PDF | Pending |
| Standalone image | Pending |
| Assessment interaction | Pending |
| Written grading | Pending |
| Revision/retry | Pending |
| Controlled failure | Pending |
| Mobile | Pending |
| Console/server errors | Pending |

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

## Rollback

The preview must not be promoted directly. If human review rejects it, leave the
current production deployment and variables unchanged, correct only a reproduced
release blocker on the release branch, rerun affected gates, and create a new
preview. Production rollback remains the last known-good Vercel production
deployment.
