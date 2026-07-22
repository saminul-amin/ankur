# Ankur UI/UX Design System

> **Document status:** APPROVED IMPLEMENTATION CONTRACT  
> **Version:** 1.0.0  
> **Product:** Ankur — Adaptive Learning from Any Source  
> **Purpose:** Define the visual, interaction, accessibility, responsive, and component rules that every Ankur screen must follow.

---

## 1. Design mandate

Ankur must not look like:

- a generic AI chatbot;
- an unmodified shadcn/ui starter;
- an ordinary university project;
- a template marketplace dashboard;
- a children's learning application;
- a purple-and-blue “AI gradient” landing page;
- a dense enterprise administration panel.

Ankur should feel like a premium learning product in which knowledge visibly progresses from raw material to understanding, practice, diagnosis, and growth.

The defining visual idea is:

> **From source to growth.**

Documents are the seed. Confirmed knowledge forms roots. Concepts become branches. Practice produces visible growth.

Visual quality is a product requirement, not post-development decoration.

---

## 2. Experience principles

### 2.1 Calm intelligence

The interface should look capable and sophisticated without becoming noisy. Use strong hierarchy, generous spacing, controlled color, precise typography, and restrained motion.

### 2.2 Guided, not dashboard-heavy

Users should always understand:

- where they are;
- what Ankur is doing;
- what they need to do next;
- what has been saved;
- what evidence supports generated content.

Use progressive disclosure instead of showing every control at once.

### 2.3 Source confidence

The interface must make source grounding visible through:

- page and segment references;
- evidence drawers;
- processing-method labels;
- confirmation states;
- uncertainty warnings;
- clear separation of source content from learner instructions.

### 2.4 Growth as feedback

Progress should be represented through a restrained growth language:

- seed;
- root;
- sprout;
- branch;
- canopy;
- bloom.

These are interaction metaphors, not decorative cartoons.

### 2.5 Bengali-first quality

Bengali content must look intentionally designed rather than added after English. Bengali line height, wrapping, numerals, punctuation, form fields, and mixed Bengali-English content must be tested directly.

### 2.6 Premium restraint

“Gorgeous” means:

- original composition;
- deliberate type;
- polished states;
- subtle depth;
- memorable transitions;
- consistent components;
- excellent mobile behavior.

It does not mean:

- excessive gradients;
- glass effects everywhere;
- constant motion;
- huge shadows;
- neon colors;
- decorative clutter.

---

## 3. Brand personality

Ankur is:

- intelligent;
- grounded;
- hopeful;
- calm;
- trustworthy;
- modern;
- academically serious;
- accessible;
- warm without being childish.

Ankur is not:

- robotic;
- flashy;
- clinical;
- playful to the point of losing credibility;
- exam-coaching spam;
- a generic AI assistant.

---

## 4. Visual concept: Luminous Knowledge Garden

The visual language combines three ideas:

1. **Paper and ink** — trusted source material.
2. **Botanical growth** — adaptive learning and improvement.
3. **Luminous intelligence** — Gemma-powered analysis.

Use abstract geometry inspired by:

- document edges;
- highlighted lines;
- leaf veins;
- growth rings;
- node-and-branch concept maps;
- soft pools of light.

Do not use literal stock photographs of students or teachers. Prefer product visuals, abstract SVG illustration, source-page previews, concept networks, and subtle botanical line work.

---

## 5. Logo direction

Create a custom vector mark that can be rendered as inline SVG.

Recommended construction:

- an open page or folded document at the bottom;
- two restrained sprout leaves emerging from its center;
- a central vertical line that can also read as a knowledge path;
- rounded but precise geometry;
- recognizable at 20–24 pixels;
- no gradients required for the compact mark;
- one-color and reversed variants.

Required variants:

- full lockup: mark + `Ankur`;
- compact mark;
- monochrome;
- light-surface;
- dark-surface.

The logo must be original code/SVG, not copied from a registry or icon set.

---

## 6. Color system

Use semantic design tokens. Do not scatter raw color classes through feature components.

The initial product is a luminous light interface with selective dark “ink” surfaces. Full dark mode remains deferred unless all P0 work is complete.

### 6.1 Core tokens

Suggested starting tokens in OKLCH. Codex may make small measured adjustments for contrast, but must preserve the intent.

```css
:root {
  --background: oklch(0.985 0.010 95);
  --foreground: oklch(0.205 0.030 155);

  --surface-1: oklch(0.997 0.004 95);
  --surface-2: oklch(0.970 0.018 105);
  --surface-3: oklch(0.935 0.030 120);

  --ink: oklch(0.205 0.030 155);
  --ink-soft: oklch(0.365 0.030 155);
  --muted-foreground: oklch(0.505 0.025 150);

  --sprout-900: oklch(0.285 0.080 155);
  --sprout-700: oklch(0.405 0.115 154);
  --sprout-600: oklch(0.500 0.145 151);
  --sprout-500: oklch(0.610 0.165 145);
  --sprout-300: oklch(0.815 0.135 132);
  --sprout-100: oklch(0.945 0.050 125);

  --sun-500: oklch(0.770 0.145 82);
  --sun-100: oklch(0.955 0.048 88);

  --indigo-500: oklch(0.575 0.150 274);
  --indigo-100: oklch(0.945 0.035 276);

  --success: oklch(0.550 0.145 150);
  --warning: oklch(0.730 0.155 78);
  --danger: oklch(0.580 0.190 28);
  --info: oklch(0.590 0.140 255);

  --border: oklch(0.885 0.025 130);
  --border-strong: oklch(0.750 0.050 145);
  --focus: oklch(0.610 0.180 145);

  --shadow-color: 150 35% 18%;
}
```

### 6.2 Usage rules

- Primary actions use deep sprout green, not bright lime.
- Bright sprout colors are reserved for active progress, selected concepts, and restrained highlights.
- Sun/gold is used for achievement, attention, and high priority.
- Indigo is used for AI processing and generated intelligence—not as the global primary.
- Red is reserved for destructive or invalid states.
- Never communicate status by color alone.
- Avoid large pure-white expanses; use warm paper surfaces.
- Dark ink sections may be used for hero, runtime status, result emphasis, or architecture storytelling.

### 6.3 Gradient rules

Approved:

- subtle radial illumination;
- forest-to-sprout tonal gradient;
- warm paper glow;
- very low-opacity mesh behind hero or progress elements.

Rejected:

- saturated purple/blue AI gradients;
- rainbow gradients;
- animated gradients behind long-form content;
- gradients on every card and button.

---

## 7. Typography

### 7.1 Font families

Recommended implementation through `next/font`:

- English/UI: `Manrope` or `Geist Sans`;
- Bengali: `Noto Sans Bengali` or `Hind Siliguri`;
- Monospace/evidence IDs: `Geist Mono` or a system monospace.

Use a font-family stack that switches gracefully for Bengali and mixed text.

### 7.2 Type roles

| Role | Desktop target | Mobile target | Notes |
|---|---:|---:|---|
| Display | 64–76 px | 40–48 px | Landing hero only |
| H1 | 44–56 px | 34–40 px | Major workflow title |
| H2 | 32–40 px | 28–32 px | Screen section |
| H3 | 22–28 px | 20–24 px | Card/feature heading |
| Body large | 18–20 px | 17–18 px | Introductory content |
| Body | 16–18 px | 16–17 px | Default reading |
| Small | 13–14 px | 13–14 px | Metadata |
| Micro | 11–12 px | 11–12 px | IDs/status only |

### 7.3 Bengali typography rules

- Use approximately 1.65–1.8 line height for Bengali body copy.
- Avoid overly tight tracking.
- Do not force uppercase transformations.
- Test Bengali numerals and English numerals inside the same line.
- Prevent labels from clipping vertically.
- Give textareas comfortable vertical rhythm.
- Long educational passages should use a reading width around 68–78 characters where practical.

---

## 8. Spacing, shape, and depth

### 8.1 Spacing

Use a 4-pixel base system, with common semantic steps:

```text
4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96
```

Large workflow screens require generous breathing room.

### 8.2 Radius

Use a controlled radius family:

```css
--radius-xs: 8px;
--radius-sm: 12px;
--radius-md: 16px;
--radius-lg: 22px;
--radius-xl: 30px;
--radius-pill: 999px;
```

Avoid making every element a large pill.

### 8.3 Shadows

Use soft layered shadows with low opacity. Depth hierarchy:

- Level 0: no shadow;
- Level 1: interactive surface;
- Level 2: active panel or floating toolbar;
- Level 3: modal or critical overlay.

Cards should rely more on border, surface tone, and composition than heavy shadows.

### 8.4 Borders and separators

Use subtle green-tinted neutral borders. Important active states may use a stronger green border and a faint inner glow.

---

## 9. Layout system

### 9.1 Global shell

Desktop:

- maximum page width around 1440 px;
- main working width around 1180–1240 px;
- reading width around 760–840 px;
- 12-column grid;
- persistent but compact top navigation;
- optional workflow rail for multi-stage screens.

Mobile:

- single-column;
- 16–20 px side padding;
- sticky bottom primary action where helpful;
- no horizontal scrolling;
- workflow rail becomes a compact step indicator.

### 9.2 Navigation

Top navigation should include:

- Ankur logo;
- concise product descriptor;
- runtime status;
- sample/live mode indicator;
- clear-session action where appropriate.

Do not create a heavy dashboard sidebar for P0.

### 9.3 Workflow rail

Required stages:

```text
Source → Review → Map → Practice → Result → Revise
```

Only implemented stages should be interactive. Future stages may appear subtly but must not falsely imply completion.

The rail should communicate growth:

- source: seed;
- review: roots;
- map: stem;
- practice: branches;
- result: canopy;
- revise: bloom.

Use restrained icons or custom line motifs rather than emoji.

---

## 10. Signature components

These components should make Ankur visually distinctive.

### 10.1 `AnkurMark`

Original inline SVG logo with compact and lockup variants.

### 10.2 `GrowthRail`

Accessible workflow progression component.

Required states:

- complete;
- active;
- upcoming;
- blocked;
- error.

### 10.3 `SourceCanvas`

A premium material workspace containing:

- upload/paste choice;
- document preview;
- processing progress;
- source metadata;
- confirmation state.

### 10.4 `PageReviewCard`

For extraction review:

- page preview;
- processing-method badge;
- editable content;
- uncertainty callouts;
- include/exclude state;
- retry action;
- page number;
- responsive split/stack layout.

### 10.5 `EvidenceChip` and `EvidenceDrawer`

Compact segment references such as `M01-P002-S004`, with a drawer that reveals the exact confirmed quote and page context.

### 10.6 `ConceptCanopy`

Preparation map visualization. It may use grouped cards or a subtle branching layout, but it must remain usable on mobile and must not depend on a complex canvas library.

### 10.7 `PracticeCard`

Question presentation with:

- excellent reading hierarchy;
- large answer targets;
- selected state;
- marks/difficulty metadata;
- evidence shown only after submission unless configuration says otherwise.

### 10.8 `ResultPulse`

A results hero that combines score, status, and concept outcome without becoming a generic circular chart.

### 10.9 `RuntimePill`

Displays:

- Gemma ready;
- generating;
- service unavailable;
- sample mode.

It must never expose provider internals or quota.

### 10.10 `ProcessNarrative`

Loading state that explains the actual stage:

```text
Reading confirmed source
Mapping concepts
Validating evidence
Preparing practice
```

Use this instead of an unexplained spinner.

---

## 11. Landing page composition

The landing page must communicate the product in less than ten seconds.

### Section 1 — Hero

Left:

- product label;
- strong headline;
- concise description;
- primary and secondary actions;
- source-grounded trust signal.

Right:

- interactive or animated product composition showing:
  document → confirmed segments → concept map → practice card.

Use product UI rather than a generic illustration.

Suggested headline direction:

> Turn trusted material into a learning journey that adapts to you.

### Section 2 — The learning loop

Show the six-stage loop with rich but concise cards.

### Section 3 — Source confidence

Demonstrate evidence chips, confirmed excerpts, and editable extraction.

### Section 4 — Adaptive outcome

Show weak concept → targeted note → retry → improvement.

### Section 5 — Use cases

Use compact domain tiles:

- academic;
- competitive examination;
- vocational;
- language;
- certification;
- source-based Islamic learning.

### Section 6 — Technical trust

A concise statement:

- Gemma 4;
- source-grounded generation;
- no login for demo;
- user-confirmed text;
- transparent evidence.

### Section 7 — Final CTA

Keep the closing focused and premium.

---

## 12. Workspace screen composition

The workspace should feel like a focused studio, not a form page.

Recommended composition:

```text
Top: workflow stage + runtime status
Main left/center: current task
Context right: source/session summary on desktop
Bottom/sticky: primary progression action
```

Use a stable shell so transitions between review, map, assessment, and result feel continuous.

---

## 13. Motion system

Use Motion for React only when it adds understanding.

### 13.1 Motion principles

- Motion explains state change.
- Motion should never delay task completion.
- Avoid decorative infinite loops.
- Keep main interactions responsive.
- Respect `prefers-reduced-motion`.

### 13.2 Duration scale

```css
--motion-fast: 120ms;
--motion-base: 220ms;
--motion-slow: 380ms;
--motion-emphasis: 520ms;
```

### 13.3 Approved motion

- page-stage crossfade and small vertical movement;
- evidence drawer expansion;
- progress-node transition;
- card selection feedback;
- success pulse;
- source-to-segment transformation;
- skeleton-to-content reveal.

### 13.4 Rejected motion

- parallax on working screens;
- bouncing buttons;
- continuous floating cards;
- typing animation for normal text;
- animated counters that obscure final values;
- autoplay background video;
- long route transitions.

### 13.5 Accessibility

Use global reduced-motion handling. Under reduced motion:

- remove transform and layout animation;
- retain short opacity transitions where safe;
- disable decorative SVG drawing;
- show progress instantly or with minimal fade.

---

## 14. Component foundation

Preferred approach:

- Tailwind CSS theme variables for tokens;
- shadcn/ui open-code components as accessible primitives;
- customize components heavily so the result does not resemble default shadcn;
- Motion for React for controlled transitions;
- Lucide icons or another single consistent line-icon set;
- original inline SVG for brand and growth motifs.

Rules:

- Do not install a large UI kit in addition to shadcn.
- Do not mix multiple icon families.
- Do not copy entire registry sections without review.
- Do not allow feature components to invent their own visual tokens.
- Keep primitives in a dedicated UI layer.
- Preserve semantic HTML and keyboard behavior.

---

## 15. State design

Every core component must define:

- default;
- hover;
- focus-visible;
- active/pressed;
- selected;
- disabled;
- loading;
- success;
- warning;
- error;
- empty;
- offline/provider unavailable where applicable.

### 15.1 Empty states

Empty states should teach the next action. Do not use vague messages such as “Nothing here.”

### 15.2 Errors

Errors must:

- preserve user work;
- explain what failed;
- explain what remains safe;
- offer one clear recovery action;
- avoid technical provider details.

### 15.3 Loading

Loading should communicate real stages. The user should never wonder whether the application froze.

---

## 16. Accessibility contract

Target WCAG 2.2 AA.

Required:

- full keyboard operation;
- logical focus order;
- visible focus indicators;
- adequate text and non-text contrast;
- no status communicated by color alone;
- labels for every form field;
- `aria-live` for meaningful processing updates;
- accessible dialogs/drawers;
- minimum practical target size around 44 × 44 px;
- reduced-motion support;
- screen-reader-friendly progress and evidence labels;
- no focus trapping errors;
- no content hidden behind sticky controls.

Accessibility must be tested, not assumed from component-library defaults.

---

## 17. Responsive contract

Test at minimum:

- 360 × 800;
- 390 × 844;
- 768 × 1024;
- 1280 × 800;
- 1440 × 900.

Required:

- no horizontal overflow;
- Bengali content wraps naturally;
- sticky actions do not cover content;
- page review moves from split view to stacked view;
- evidence drawer remains readable;
- controls remain reachable;
- progress remains understandable;
- no essential information appears only on hover.

---

## 18. Performance contract

The UI must remain light enough for the AI workflow.

Rules:

- no WebGL or 3D framework for P0;
- no large background video;
- no unnecessary animation library duplication;
- use optimized inline SVG and CSS effects;
- lazy-load non-critical heavy UI;
- use `LazyMotion` or equivalent if Motion bundle size becomes material;
- avoid client-side hydration for static landing content where possible;
- reserve expensive blur/backdrop effects for small areas;
- prevent cumulative layout shift.

---

## 19. Design quality anti-patterns

Reject implementation when any of these dominate:

- default shadcn appearance;
- one generic card repeated everywhere;
- purple gradient on white;
- random rounded rectangles;
- excessive pills;
- large decorative blobs without product meaning;
- icon-only actions without labels/tooltips;
- placeholder Latin text where Bengali should be tested;
- dense dashboard tables;
- huge empty hero with no product preview;
- glassmorphism that reduces readability;
- animation added to compensate for weak hierarchy.

---

## 20. Visual evidence and QA

Codex must produce screenshots for review, not only claim that the UI is polished.

Required screenshots:

```text
evaluation/ui/
├── landing-desktop.png
├── landing-mobile.png
├── source-desktop.png
├── source-mobile.png
├── review-desktop.png
├── preparation-map-desktop.png
├── assessment-mobile.png
└── result-desktop.png
```

Screens that do not exist yet may be added later, but Task 02C must capture every implemented stage.

Also record:

- viewport;
- runtime mode;
- fixture used;
- date;
- known visual limitation.

---

## 21. Definition of visually done

A screen is visually complete only when:

- it follows the token system;
- it uses the approved shell and hierarchy;
- it has responsive states;
- it has keyboard and focus behavior;
- loading/error/empty/success states are designed;
- Bengali content has been inspected;
- animation respects reduced motion;
- no default-library look remains;
- screenshots exist at required viewports;
- tests and production build still pass.

---

## 22. Implementation sequence

1. Define tokens and typography.
2. Create brand mark and global shell.
3. Build accessible primitives.
4. Build signature Ankur components.
5. Restyle the existing vertical slice.
6. Add motion and reduced-motion handling.
7. Add responsive and keyboard tests.
8. Capture visual evidence.
9. Run production build and regression tests.
10. Only then add new Task 03 ingestion screens.

---

## 23. Final design decision

> Ankur will use a custom “Luminous Knowledge Garden” design language built from warm paper surfaces, deep botanical ink, restrained sprout highlights, Bengali-first typography, source-evidence visuals, and meaningful growth-based motion. shadcn/ui may provide accessible open-code primitives, but no screen may retain an unmodified default-library appearance.
