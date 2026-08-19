# Ankur preview human approval checklist

Release branch: `release/ankur-r2f-preview`

Preview URL:
`https://ankur-pa7zsswux-saminulamin-gmailcoms-projects.vercel.app`

The preview URL, deployed commit, and smoke-test matrix are recorded in
[`ANKUR_R2F_PREVIEW_RELEASE_REPORT.md`](ANKUR_R2F_PREVIEW_RELEASE_REPORT.md).

## Before you start

One action is required from the project owner before an outside reviewer can
open the preview at all:

- [ ] Create a Vercel shareable preview link for the deployed commit, or add the
      reviewer to the Vercel team. Unauthenticated requests are redirected to
      Vercel SSO by design, and production protection must not be weakened to
      work around it.

## Review in a clean browser

- [ ] Visual polish is suitable for a judge-facing demonstration.
- [ ] Light appearance is readable.
- [ ] Dark appearance is readable, including badges, evidence drawers, and the
      progress rail.
- [ ] Bengali text is readable and correctly shaped.
- [ ] English text is readable.
- [ ] Mixed Bengali-English content remains readable.
- [ ] The main source-to-learning demo flow is clear.
- [ ] Assessment questions and answer controls are clear.
- [ ] Written grading and evidence presentation are understandable.
- [ ] Revision and retry guidance is understandable.
- [ ] Mobile layout has no blocking overflow or inaccessible controls.
- [ ] Controlled-failure messages are safe and useful.
- [ ] No credentials, private evaluation data, or sensitive source content is
      exposed.
- [ ] Sample mode is clearly distinguished from live generation.
- [ ] The disclosed reliability limitation reads honestly and is not overstated
      in either direction.
- [ ] The overall experience is ready for judges.

## Response

```text
APPROVE PRODUCTION
```

Alternatively, provide a concise list of specific issues.

Approval authorizes production promotion of the reviewed commit only. It does
not authorize Task 07, reviewer packets, or any human evaluation metric.
