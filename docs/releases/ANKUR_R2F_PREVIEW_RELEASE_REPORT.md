# Ankur preview release report

## Release identity

- Trusted source branch: `task06c-r2f/final-assessment-correction`
- Trusted source SHA: `3b458b736d487ba9c927868b3a29064ecb7e7cd0`
- Release branch: `release/ankur-r2f-preview`
- Integration strategy: direct branch from the trusted R2F SHA; full history
  preserved; no squash, rebase, cherry-pick, or merge.
- Remote baseline: `origin/main` at `3728724ef4140666566bb9f72fd5dfb55bc523c3`

This supersedes the failed R2F preview QA recorded on 29 July 2026. That preview
was blocked by two findings: live Bengali and mixed-language assessments
returned controlled `MODEL_OUTPUT_INVALID`, and the preview URL was unreachable
without a Vercel team session. The first is fixed and re-verified below. The
second still needs one action from the project owner.

## What changed since the failed preview

### Multilingual generation reliability

The frozen Task 06C-R2F semantic diagnostics identified four deterministic-side
causes, each reproduced against the live provider before being corrected. None
of them was a question-quality defect.

| Cause | Correction |
|---|---|
| Extended thinking drove Bengali and mixed analysis into degenerate repetition loops that exhausted the output budget | Material analysis moved to minimal thinking and a 1,200-token budget. A replayed failing material went from a 13,723-character truncated response in 153 s to a valid object in 5.4 s using 183 tokens. Raising the budget to 8,000 tokens had made the loop longer, not shorter. |
| Native JSON schemas for analysis and transcription omitted the length bounds their Zod contracts enforced | Both now mirror their Zod contract exactly, so the provider is told the limits it must respect. |
| A cut-off candidate was echoed back for repair, re-priming the same loop | A `MAX_TOKENS` or empty candidate now retries the original task once, at a temperature of at least 0.35, so the retry leaves the failing sampling path. |
| `LANG_TRUNCATED_SENTENCE` and `LANG_REPEATED_TOKEN` survived regeneration | Transport-level recovery of a fenced or prose-wrapped JSON object and collapse of repeated words and phrases, plus application-level question-prompt salvage for mechanical wording defects. Meaning is never rewritten and the unchanged validators still decide acceptance. |

No validator, threshold, grounding rule, canonical answer, correct-option
identity, rubric construction, mark allocation, prompt, or model identity
changed.

### Dependency advisories

Advisories published after the R2F freeze made the locked release gate fail with
six findings, including arbitrary JavaScript execution in `pdfjs-dist` when
opening a malicious PDF — directly in Ankur's threat model, because learner PDFs
are parsed in the browser. `pdfjs-dist`, `next`, `nanoid`, `undici`, and
`brace-expansion` moved to their minimum fixed versions.

### Interface

A dark appearance that follows the system preference and remembers an explicit
choice; the marketing introduction now hides once a learner is past source
selection, so every later stage starts at the top of the page; the concept-card
priority badge is no longer painted over and clipped by the card's decorative
circle; the progress rail stays in view while a long result page scrolls.

## Provider-free release gate

| Check | Result |
|---|---|
| `npm ci` | Passed from the committed lockfile |
| `npm run lint` | Passed |
| `npm run typecheck` | Passed |
| `npm test` | Passed; 35 files and 186 tests |
| `npm run build` | Passed; Next.js 16.3.1 production build |
| `npm run test:e2e` | Passed; 22 tests and 6 intentional project-specific skips |
| `npm audit --audit-level=moderate` | Passed; zero vulnerabilities |
| `git diff --check` | Passed |
| Architecture/security contract tests | Passed |
| Task 06 public/closure verification | Passed |
| Task 06C public verification | Passed |
| R2E/R2F/R2G provider-free dry runs | Passed |
| Secret scan | Passed; zero credential-pattern matches |
| Client bundle scan | Passed; zero credential matches in built static output |
| Automated WCAG A/AA violations in tested screens | None |
| Mobile horizontal overflow in tested screens | None |

## Live flow verification

Run against the release build in production mode with live generation enabled.
`npm run verify:release-flows` records the matrix in
[`RELEASE_FLOW_VERIFICATION.md`](RELEASE_FLOW_VERIFICATION.md).

| Flow | Result | Written grading |
|---|---|---|
| English pasted text | **passed** | `correct`, 5/5 |
| Bengali pasted text | **passed** | `correct`, 5/5 |
| Mixed Bengali-English pasted text | **passed** | `partially_correct`, 2/5 |
| Controlled failure (empty source) | **passed** | Safe typed `VALIDATION_FAILED`, no provider or credential leakage |

Zero grounding failures, zero quote failures, and reconciling mark totals in
every flow. Flows blocked by provider availability after three attempts: 0.
Flows that produced an invalid generated artifact: 0.

The two multilingual flows that blocked the previous preview now pass. PDF,
page-image, sample-mode, keyboard, accessibility, and responsive paths are
covered by the Playwright suite against the same build.

Provider availability remained variable during verification. Two intermediate
attempts were rejected with `PROVIDER_UNAVAILABLE` or `RATE_LIMITED`, and the
application returned safe typed controlled failures each time. That is the
external dependency behaving badly, not a product defect, and it is why the
verifier now retries an unavailable flow up to three times and reports provider
unavailability separately from an invalid generated artifact.

## Evaluation disclosure

The authoritative reliability measurement is Task 06C-R2G, run against the
unchanged R2F evaluation design and fixed 45-operation denominator.

| Metric | R2F | R2G |
|---|---:|---:|
| First-pass valid | 22/45 — 48.89% | **31/45 — 68.89%** |
| Final valid | 33/45 — 73.33% | **38/45 — 84.44%** |
| Persisted structured questions | 42 | **46** |
| Valid written cases | 18 | **22** |
| Deterministic grounding | 100% | **100%** |
| Deterministic MCQ-key validity | 100% | **100%** |
| Invalid rubrics entering grading metrics | 0 | 0 |
| Cross-material evidence defects | 0 | 0 |
| Fabricated weaknesses | 0 | 0 |
| Duplicate diagnostics | 16.67% | **13.04%** |
| `LANG_*` semantic failures | 9 | **0** |

The project's strict 43/45 internal reliability gate is **not met**. All seven
remaining invalid operations are provider transport failures — eight first-pass
`MAX_TOKENS` repetition loops of which four were not recovered, and four
`RECITATION` stops — and four of the seven are the explicit
`DEPENDENCY_UNAVAILABLE` consequence of one failed analysis. No fresh
independent human review has been performed; all human metrics remain pending.
Task 07 remains unauthorized.

> Ankur rejects invalid generated artifacts rather than persisting them. In the
> latest fixed evaluation every persisted question was grounded in its source and
> had a deterministically valid answer key, and no weakness was fabricated, while
> overall structured-generation availability improved substantially but remained
> below the project's strict reliability target.

## Sanitized environment audit

No values from local secret files were inspected.

| Variable | Classification | Local | Preview | Production | Purpose |
|---|---|---|---|---|---|
| `GEMINI_API_KEY` | Required for live AI; server-only secret | Present | Present, encrypted | Present, encrypted | Hosted Gemma authentication |
| `ANKUR_LIVE_AI_ENABLED` | Non-secret flag | Enabled for live verification | `true` | Unchanged | Live-generation kill switch |
| `ANKUR_SAMPLE_MODE_ENABLED` | Non-secret flag | Enabled | `true` | Unchanged | Provider-free demonstration |
| `GEMMA_PRIMARY_MODEL` | Non-secret locked model | Default locked | `gemma-4-26b-a4b-it` | Unchanged | Sole application model |
| `GEMMA_NATIVE_STRUCTURED_OUTPUT` | Non-secret | Native | `native` | Unchanged | Structured-output mode |
| `AI_REQUEST_TIMEOUT_MS` | Non-secret | 120,000 ms | 90,000 ms | Unchanged | Provider timeout |
| `ANKUR_BUILD_ID` | Optional release metadata | Local fallback | Vercel Git SHA | Unchanged | Health/build correlation |

No `NEXT_PUBLIC_*` provider secret or model override exists. No production
environment variable was changed.

## Vercel project and preview deployment

- Project: `ankur` (`prj_p9iokXO06qrp6LLremLvm5PxXMAZ`)
- Framework: Next.js; root directory `.`; Node.js 24.x
- API routes: Node.js runtime; AI route maximum duration 180 seconds
- Preview deployment ID: `dpl_3R2Eeu2jeETE5rqYgv1FqKbZf6Ba`
- Preview URL:
  `https://ankur-hc712m3ak-saminulamin-gmailcoms-projects.vercel.app`
- Deployment status: Ready, preview target
- Production environment and deployment: unchanged

## Known limitations

- Structured generation reached 38/45 in the latest evaluation, below the
  internal 43/45 target. A learner can still see a controlled failure instead of
  a generated assessment.
- Gemma can enter a degenerate repetition loop that exhausts its output budget,
  or stop on recitation. Bounded deterministic recovery handles most but not all
  of these.
- Provider latency, rate limits, timeout, quota, and availability remain external
  dependencies, and were visibly variable during this verification.
- Sample mode is required as a safe fallback.
- Browser persistence is device-local with no account synchronization.
- No fresh independent human review of R2G output has been performed.
- The preview remains protected by Vercel SSO and is not yet reachable by an
  unauthenticated reviewer.

## Required human action

One action is needed before an outside reviewer can open the preview:

```text
Create a Vercel shareable preview link for deployment
dpl_3R2Eeu2jeETE5rqYgv1FqKbZf6Ba, or add the reviewer to the Vercel team.
```

Production protection must not be weakened to work around this.

After that, review the preview using
[`ANKUR_R2F_HUMAN_APPROVAL_CHECKLIST.md`](ANKUR_R2F_HUMAN_APPROVAL_CHECKLIST.md)
and reply `APPROVE PRODUCTION` or list specific issues.

## Production status and rollback

Production is unchanged and unauthorized. The preview must not be promoted
directly. If human review rejects it, leave the current production deployment
and variables unchanged, correct only a reproduced release blocker on the
release branch, rerun the affected gates, and create a new preview. Production
rollback remains the last known-good Vercel production deployment.
