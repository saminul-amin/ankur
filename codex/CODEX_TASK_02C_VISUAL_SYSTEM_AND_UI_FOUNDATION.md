# Codex Task 02C — Visual System and Premium UI Foundation

> Execute after the grounded vertical slice is committed and deployed.  
> Execute before Task 03 document-ingestion expansion.

## Context

Task 02 produced a correct grounded vertical slice. The product now needs a locked visual system before additional screens multiply.

The user requires Ankur to have an exceptionally polished, memorable, premium interface. This task is not permission for uncontrolled decoration or feature expansion. It establishes the reusable visual and interaction foundation for the rest of the product.

## Objective

Transform the existing vertical slice into a production-quality Ankur experience and create the reusable design system that Task 03 and later tasks must follow.

```text
existing functional vertical slice
→ design tokens
→ original Ankur identity
→ reusable accessible primitives
→ stable workflow shell
→ polished existing screens
→ responsive and motion system
→ visual QA evidence
```

## Authority order

Read before editing:

1. `ANKUR_SSOT.md`
2. `AGENTS.md`
3. all accepted ADRs under `docs/adr/`
4. `docs/UI_UX_DESIGN_SYSTEM.md`
5. `docs/PRODUCT_SPEC.md`
6. `docs/ARCHITECTURE.md`
7. `docs/SECURITY.md`
8. `docs/TEST_STRATEGY.md`
9. `docs/DELIVERY_PLAN.md`
10. provider and vertical-slice result reports

If `docs/UI_UX_DESIGN_SYSTEM.md` conflicts with a higher-authority product or security rule, report the conflict instead of silently choosing.

## Required scope

### 1. Design-system foundation

Implement centralized semantic tokens for:

- color;
- surfaces;
- typography;
- spacing;
- radius;
- border;
- shadow;
- motion;
- focus;
- semantic states.

Do not scatter arbitrary styling values throughout feature components.

### 2. Brand identity

Create an original inline-SVG Ankur mark and wordmark following the approved document-to-sprout concept.

Required:

- compact mark;
- horizontal lockup;
- light-surface variant;
- dark-surface variant;
- accessible text alternative where needed;
- no copied logo asset.

### 3. Typography

Implement the approved English and Bengali font strategy with `next/font` where practical.

Verify:

- Bengali line height;
- mixed Bengali-English rendering;
- form control rendering;
- numerals;
- long educational passages;
- no clipping.

### 4. Component foundation

Inspect the existing component stack before installing anything.

Use:

- Tailwind semantic variables;
- customized shadcn/ui open-code primitives where useful;
- Motion for React only for meaningful transitions;
- one consistent icon family;
- original SVG for brand-specific motifs.

Create or refine reusable primitives for:

- button;
- input;
- textarea;
- label;
- badge/status;
- card/surface;
- alert;
- tooltip;
- dialog/drawer if currently required;
- skeleton/progress;
- segmented control;
- workflow step;
- evidence chip/drawer.

Do not install a second broad component library.

### 5. Signature Ankur components

Implement at least:

- `AnkurMark`;
- `GrowthRail`;
- `RuntimePill`;
- `SourceCanvas`;
- `EvidenceChip`;
- `EvidenceDrawer`;
- `ProcessNarrative`;
- a preparation-map presentation component;
- a polished MCQ/practice card;
- a polished result summary.

Names may differ if the repository conventions require it, but responsibilities must remain clear.

### 6. Existing-screen redesign

Polish the complete currently implemented flow:

- landing/introduction;
- source selection;
- pasted-text entry;
- one-page PDF input;
- editable confirmation;
- preparation map;
- MCQ;
- result;
- source evidence;
- sample/live mode;
- loading;
- errors;
- clear session.

Do not change domain behavior or provider contracts.

### 7. Motion and interaction

Use restrained motion to explain stage changes, selection, evidence expansion, success, and loading.

Required:

- global reduced-motion behavior;
- no decorative infinite loops;
- no parallax on working screens;
- no motion that blocks input;
- no animation-dependent information.

### 8. Accessibility

Target WCAG 2.2 AA.

Verify:

- keyboard completion of the sample flow;
- logical focus order;
- visible focus indicators;
- labelled controls;
- accessible status updates;
- non-color status communication;
- practical touch targets;
- reduced motion;
- sticky controls do not hide focus/content.

### 9. Responsive behavior

Test and polish at:

- 360 × 800;
- 390 × 844;
- 768 × 1024;
- 1280 × 800;
- 1440 × 900.

No horizontal overflow is acceptable.

### 10. Visual QA evidence

Capture implemented stages under `evaluation/ui/`.

At minimum:

- landing desktop;
- landing mobile;
- source desktop;
- source mobile;
- review/confirmation desktop;
- preparation map desktop;
- assessment mobile;
- result desktop.

Add `evaluation/ui/RESULTS.md` recording viewport, fixture, runtime mode, and known limitations.

## Explicit non-goals

Do not implement:

- scanned-PDF transcription;
- multiple page ingestion;
- image ingestion;
- written-answer grading;
- revision notes;
- retry;
- timers;
- negative marking;
- authentication;
- database;
- admin interface;
- complete dark mode;
- WebGL/3D;
- background video;
- another backend;
- provider replacement;
- business-logic refactoring without a demonstrated defect.

## Architecture constraints

- React components must not contain provider calls, prompts, grading rules, or grounding logic.
- Keep the existing Route Handler → application → domain → infrastructure boundary.
- Keep `GEMINI_API_KEY` server-only.
- Do not weaken evidence validation.
- Do not hide errors to preserve appearance.
- Do not introduce UI state that bypasses source confirmation.
- Reuse existing tests and behavior.

## Required tests

### Unit/component

- token-driven variant behavior where valuable;
- workflow-step state rendering;
- evidence expansion;
- runtime status rendering;
- reduced-motion behavior;
- persisted-state revalidation remains intact.

### Accessibility

Add automated checks where deployment-safe for:

- obvious accessibility violations;
- keyboard navigation;
- labelled controls;
- focus visibility/state;
- dialog/drawer semantics if used.

### End-to-end

The provider-free sample journey must still pass in Chromium at desktop and mobile viewports.

The test should verify:

1. landing CTA;
2. source selection;
3. review confirmation;
4. preparation map;
5. MCQ selection;
6. result;
7. evidence expansion;
8. clear-session behavior;
9. keyboard operation for the critical flow.

## Required commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Run screenshot capture through a deterministic local or preview environment. Do not place live provider calls in ordinary UI tests.

## Acceptance criteria

- The existing flow is visually transformed and no longer resembles a default starter/template.
- The approved Ankur identity is evident within five seconds.
- Bengali and mixed-language typography are polished.
- Every implemented screen uses centralized tokens and shared primitives.
- Responsive layouts pass required viewports without overflow.
- Keyboard and reduced-motion behavior are verified.
- Loading, empty, error, success, and unavailable states are intentionally designed.
- Sample/live status and source evidence are visually clear.
- Visual screenshots are produced.
- Existing domain, grounding, provider, and secret-isolation tests remain passing.
- Production build passes.
- No deferred product feature is added.

## Final report

Report:

1. Implementation summary
2. Changed files
3. Design-system architecture
4. Brand and visual decisions
5. Components created or changed
6. Screen-by-screen improvements
7. Responsive verification
8. Accessibility verification
9. Motion and reduced-motion behavior
10. Commands run and exact outcomes
11. Screenshot inventory
12. Performance/bundle impact
13. Domain/provider regression result
14. Known visual limitations
15. Manual QA steps
16. Recommendation: `UI Gate PASSED` or `UI Gate BLOCKED`
17. Recommended next task
18. `SSOT Update: none` or exact proposed changes

Do not begin Task 03 automatically.
