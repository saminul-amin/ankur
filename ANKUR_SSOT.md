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
