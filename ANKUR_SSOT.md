# ANKUR SSOT Update — CI Deferred, Manual Release Gate Adopted

> Apply to the private authoritative `ANKUR_SSOT.md`.
> Proposed version: **1.2.2**

## 1. Replace the CI requirement in Section 27.3

Replace:

> CI must use `npm ci` against the committed lockfile and run the same quality commands on every pull request and push to the submission branch.

With:

> For the hackathon submission, GitHub Actions CI is deferred because the owner's GitHub account is currently billing-locked and hosted runners cannot start. Every accepted implementation task must instead run and record the following manual release checks against the committed lockfile:
>
> ```bash
> npm ci
> npm run lint
> npm run typecheck
> npm test
> npm run build
> npm run test:e2e
> npm audit --audit-level=moderate
> git diff --check
> ```
>
> Vercel must also complete a clean production build from the same commit. GitHub Actions may be restored after the billing restriction is resolved, but it is not a hackathon submission gate.

## 2. Add to delivery policy

### Manual release gate

**Status: LOCKED FOR HACKATHON**

A release may proceed without GitHub Actions when all of the following are true:

- the working tree is clean;
- local `HEAD` equals `origin/main`;
- `npm ci` succeeds from the committed lockfile;
- lint passes;
- typecheck passes;
- all unit, integration, component, and Playwright tests pass;
- production build passes;
- audit reports no moderate-or-higher vulnerability;
- secret and client-bundle scans pass;
- Vercel deploys the exact same build ID;
- production health and golden-path verification pass;
- command outputs are recorded in the task result report.

A GitHub billing restriction is classified as an administrative limitation, not a product-code defect.

## 3. Add decision-register entries

| ID | Decision | Status | Date | Reason |
|---|---|---|---|---|
| D-044 | GitHub Actions CI is deferred for the hackathon because the account billing lock prevents hosted runners from starting | APPROVED | 2026-07-22 | The team cannot currently resolve the billing issue, and all equivalent checks can be executed manually. |
| D-045 | A documented manual release gate plus a matching Vercel production build replaces CI as the hackathon verification mechanism | LOCKED | 2026-07-22 | Preserves engineering quality without blocking product completion on an administrative account issue. |
| D-046 | The public repository will not retain a knowingly failing CI workflow while the account remains billing-locked | APPROVED | 2026-07-22 | Avoids misleading failed checks and repeated non-code failures on every push. |

## 4. Update definition of done

Under Technical quality, add:

- [ ] Manual release-gate commands pass and are recorded.
- [ ] Local, GitHub, and Vercel build identifiers match.
- [ ] GitHub Actions is either passing or explicitly deferred under D-044–D-046.

## 5. Add risk-register entry

| ID | Risk | Severity | Mitigation |
|---|---|---:|---|
| R-023 | GitHub Actions cannot start because the account is billing-locked | Low | Remove the failing workflow for the hackathon, use the locked manual release gate, and restore CI after the billing issue is resolved. |

## 6. Changelog entry

### Version 1.2.2 — 22 July 2026

- Deferred GitHub Actions CI for the hackathon due to the account billing lock.
- Adopted a locked manual release gate using clean-install, quality, test, audit, secret, deployment, and production checks.
- Approved removal of the knowingly non-runnable workflow from the public repository.
- Clarified that CI may be restored after the billing issue is resolved.

## Task 06C authority addendum — version 1.3.1

`SSOT_UPDATE_v1.3.0_TASK06_CLOSED.md` freezes the failed Task 06 quality result and blocks Task 07. `SSOT_UPDATE_v1.3.1_TASK06C_EVIDENCE_FIRST_REMEDIATION.md` authorizes the evidence-first v2 remediation while preserving those historical facts.

D-047 through D-050 are authoritative. Task 07 remains unauthorized until every unchanged Task 06C acceptance threshold has a fresh measured passing result and the SSOT is explicitly updated again.

## Task 06C outcome addendum — version 1.3.2

`SSOT_UPDATE_v1.3.2_TASK06C_FAILED.md` records the frozen Task 06C live-run
failure: 33/45 final-valid logical operations and seven eligible written cases.
No fresh human review was started from the incomplete sample. Historical Task 06
evidence remains immutable, all unchanged thresholds remain authoritative, and
Task 07 remains unauthorized.

## Task 06C-R1 outcome addendum — version 1.3.3

`SSOT_UPDATE_v1.3.3_TASK06C_R1_FAILED.md` records three frozen controlled
reliability iterations. None passed the unchanged technical gate. No reviewer
packets or human metrics were produced. The best non-regressive product
configuration is retained, all Task 06/06C/R1 evidence remains immutable, and
Task 07 remains unauthorized.

## Task 06C-R2 outcome addendum — version 1.3.4

`SSOT_UPDATE_v1.3.4_TASK06C_R2.md` records the deterministic assessment
construction and its single frozen fixed-denominator evaluation. The new
assessment operations with valid upstream analyses completed successfully, but
provider timeouts, rate limiting, and unavailability limited the full run to
12/45 final-valid logical operations, 12 questions, and five written cases.
No reviewer packets or human metrics were produced. Historical evidence and
the unchanged technical thresholds remain authoritative. Task 07 remains
unauthorized.

## Task 06C-R2E outcome addendum — version 1.3.5

`SSOT_UPDATE_v1.3.5_TASK06C_R2E.md` records the provider-stable,
evaluation-only rerun of the frozen R2 implementation. The 3/3 preflight passed
and run 1 was infrastructure-valid, so it is authoritative. The run produced
24/45 final-valid logical operations, 24 questions, and 11 written cases.
Deterministic grounding and MCQ-key validity were 100% for persisted questions,
but seven assessment operations remained `INVALID_OUTPUT`; the unchanged
technical gate therefore failed. No reviewer packets or human metrics were
created, and Task 07 remains unauthorized.

## Task 06C-R2F outcome addendum — version 1.3.6

`SSOT_UPDATE_v1.3.6_TASK06C_R2F.md` records the final narrow assessment
correction and its single fixed-denominator evaluation. Deterministic distractor
salvage reduced assessment `INVALID_OUTPUT` failures from seven to two while
preserving 100% grounding and MCQ-key validity. The run improved to 33/45
final-valid logical operations, 42 persisted questions, and 18 written cases,
but it did not meet the unchanged 43/45 reliability gate.

The improved implementation is retained as `KEEP`. No further broad reliability
iteration, reviewer packet generation, or human metric is authorized by this
result. Task 07 remains unauthorized. Deployment and submission preparation may
proceed only with this limitation disclosed.

## Task 06C-R2G outcome addendum — version 1.4.0

`SSOT_UPDATE_v1.4.0_TASK06C_R2G.md` records the multilingual
generation-reliability correction and its single fixed-denominator evaluation.

Task 08A release QA had failed because live Bengali and mixed-language
assessment generation returned controlled `MODEL_OUTPUT_INVALID`. The frozen
R2F semantic diagnostics, confirmed by live replay, showed the dominant cause
was provider transport and configuration behaviour — degenerate repetition loops
under extended thinking, native JSON schemas missing the length bounds their Zod
contracts enforced, echo repair re-priming the failing sampling path, and
mechanical wording defects surviving regeneration — not generated-question
quality. D-051 therefore authorizes exactly one further correction round for
transport, configuration, and deterministic post-processing defects. D-052
authorizes bounded UI polish inside the feature freeze. D-053 classifies a
post-freeze dependency advisory as a release-blocking defect.

The preflight-validated R2G run improved final logical validity from 33/45 to
38/45 (84.44%) and first-pass validity from 22/45 to 31/45, produced 46 persisted
questions and 22 written cases, lowered the duplicate rate to 13.04%, and held
deterministic grounding, MCQ-key validity, invalid-rubric count, cross-material
evidence defects, and fabricated weaknesses at their previous perfect values.
Zero `LANG_*` semantic failures remain, against nine in R2F.

The unchanged 43/45 reliability gate still failed. The implementation is
retained as `KEEP`. No reviewer packet or human metric is authorized by this
result, and Task 07 remains unauthorized. Historical Task 06 through R2F
evidence remains immutable. Deployment and submission preparation may proceed
only with this limitation disclosed.
