# Codex Task 04 — P0 Mixed Assessment, Written Grading, and Concept Diagnosis

> Run only after Task 03 passes.
> Do not begin revision-note or weak-area-retry generation in this task.

## Context

Ankur now has a verified premium source-ingestion journey:

```text
pasted text / digital PDF / scanned PDF / mixed PDF / page images
→ browser-side processing
→ editable extraction review
→ explicit confirmation
→ immutable source segments
→ grounded preparation map
→ one grounded MCQ
→ deterministic grading and evidence
```

The remaining P0 learning loop requires a mixed assessment containing one single-answer MCQ and one short written question, transparent rubric-based grading, and concept-level performance that can later drive revision and retry.

This task completes only the assessment, grading, and diagnosis foundation. It must not implement revision notes or retry generation.

## Objective

Deliver this bounded journey:

```text
confirmed source + preparation map
→ focused P0 assessment configuration
→ one grounded MCQ + one grounded short written question
→ answer both questions
→ deterministic MCQ grading
→ deterministic empty-answer handling
→ Gemma 4 criterion-level written grading
→ evidence-linked feedback
→ deterministic concept-performance aggregation
→ weak-concept identification
→ polished results experience
```

## Authority order

Read completely before editing:

1. `ANKUR_SSOT.md`
2. `AGENTS.md`
3. all accepted ADRs under `docs/adr/`
4. `docs/UI_UX_DESIGN_SYSTEM.md`
5. `docs/PRODUCT_SPEC.md`
6. `docs/ARCHITECTURE.md`
7. `docs/DOMAIN_MODEL.md`
8. `docs/API_CONTRACTS.md`
9. `docs/AI_CONTRACTS.md`
10. `docs/SECURITY.md`
11. `docs/TEST_STRATEGY.md`
12. `docs/EVALUATION.md`
13. `docs/DELIVERY_PLAN.md`
14. provider, vertical-slice, UI-gate, and ingestion result reports

If a required contract and the current code differ, report the conflict before altering a locked boundary.

## Required scope

### 1. P0 assessment configuration

Create one intentionally narrow configuration experience.

Required controls:

- Assessment title with a sensible generated/default value.
- Selected concepts from the confirmed preparation map.
- Difficulty: `easy`, `medium`, or `hard`.
- Language inherited from the source, with no unsupported translation mode.
- Fixed P0 composition:
  - one single-answer MCQ worth 1 mark;
  - one short written question worth 5 marks.
- Feedback shown after complete assessment submission.

Do not add:

- timers;
- negative marking;
- user-selected question counts;
- true/false;
- fill-in-the-blank;
- multiple-answer MCQ;
- custom mark allocation;
- immediate per-question feedback.

Those remain P1 or later work.

The UI must explain the fixed P0 composition honestly.

### 2. Mixed assessment domain model

Extend or introduce the provider-independent activity-set model required by the existing contracts.

The P0 `ActivitySet` must include exactly:

- one valid `single_mcq`;
- one valid `short_written`.

Each question must contain:

- immutable question ID;
- prompt;
- selected concept IDs;
- source version ID;
- valid evidence references;
- difficulty;
- marks;
- explanation or reference-answer data;
- model-artifact metadata.

The short written question must additionally contain:

- maximum marks: exactly 5 for P0;
- expected answer length;
- concise reference answer;
- required concept IDs;
- two to four rubric criteria;
- stable criterion IDs;
- criterion descriptions;
- criterion maximum marks;
- evidence references for the question/rubric.

The rubric-criterion maximum marks must sum to exactly 5.

### 3. Assessment generation

Evolve the existing assessment generation path without weakening the verified MCQ behavior.

Required provider behavior:

- Model: `gemma-4-26b-a4b-it`.
- Thinking:
  - minimal for straightforward candidate generation;
  - high only for a measured review or repair operation where required.
- Native JSON-schema mode first.
- Zod validation.
- One bounded schema/evidence repair attempt.
- No automatic 31B fallback.
- No use of any Gemini-branded model or other LLM.

Required deterministic validation:

- exact question composition;
- source-version consistency;
- concept existence;
- evidence segment existence;
- supplied quote verification where present;
- MCQ exactly four non-empty normalized-unique options;
- one valid correct option;
- short-written maximum marks equals 5;
- rubric contains two to four unique stable criteria;
- rubric marks sum exactly to 5;
- reference answer and expected length exist;
- duplicate or materially equivalent prompts are rejected;
- all questions are answerable from confirmed source evidence.

If one question remains invalid after the bounded repair, reject the whole activity set rather than silently showing a partial or ungrounded assessment.

### 4. Assessment player

Upgrade the current one-question experience into a two-question guided assessment.

Required behavior:

- clear progress: `Question 1 of 2`, `Question 2 of 2`;
- MCQ selection;
- Bengali-aware short-answer textarea;
- expected answer-length guidance;
- marks and difficulty metadata;
- previous/next navigation;
- unanswered state;
- final submit confirmation;
- duplicate submission disabled while pending;
- no grading/evidence shown before full submission;
- answers persisted in a versioned browser envelope;
- refresh recovery at stable assessment stages;
- source-version mismatch invalidates stale assessment and answers;
- changing confirmed source or selected concepts invalidates assessment artifacts.

The interface must use the approved Luminous Knowledge Garden components and must remain keyboard-operable and mobile-safe.

### 5. Objective grading

MCQ grading remains deterministic application code.

Required:

- no provider call for MCQ equality;
- 1 mark for the correct option;
- 0 marks otherwise;
- explicit unanswered result;
- explanation and evidence shown after assessment submission;
- no negative marking.

### 6. Empty short-answer grading

Whitespace-only short answers must be handled deterministically and must never call Gemma.

Return:

- 0/5;
- `not_answered`;
- zero awarded marks for every rubric criterion;
- all required concepts as missing;
- concise user-safe feedback;
- valid question/source evidence;
- no fabricated incorrect or unsupported claims.

### 7. Written-evaluation endpoint

Implement or complete:

```text
POST /api/written-evaluations
```

Use the approved API and AI contracts.

Request must include only:

- operation/request ID;
- source version ID;
- short-written question;
- student answer;
- only the confirmed evidence segments referenced by the question.

Constraints:

- student answer maximum 3,000 characters;
- evidence segment IDs and source version must match;
- unknown fields rejected where practical;
- user-specific response uses `Cache-Control: no-store`;
- typed safe errors;
- request timeout;
- configured rate limit;
- no raw answer/source/provider response in logs.

Provider behavior:

- `gemma-4-26b-a4b-it`;
- high thinking for rubric-based semantic grading;
- native JSON schema;
- Zod validation;
- one bounded repair attempt;
- no hidden reasoning requested or exposed.

### 8. Written evaluation contract

The provider returns a structured evaluation containing:

- awarded marks;
- maximum marks;
- status:
  - `correct`;
  - `partially_correct`;
  - `incorrect`;
  - `not_answered`;
  - `needs_review`;
- criterion-level results:
  - criterion ID;
  - awarded marks;
  - maximum marks;
  - met/partial/not-met state;
  - concise reason;
- covered concept IDs;
- missing concept IDs;
- incorrect claims;
- unsupported claims;
- concise actionable feedback;
- source evidence;
- recommended revision concept IDs;
- artifact metadata.

Required deterministic post-validation:

- maximum marks equals 5;
- awarded marks is between 0 and 5;
- each returned criterion exists in the question rubric;
- criterion maximums match the question;
- each criterion award is bounded;
- criterion awarded marks sum exactly to total awarded marks;
- returned concept IDs belong to the question/preparation map;
- covered and missing concepts do not conflict;
- evidence references exist and quotes match where supplied;
- no evidence outside the question’s allowed evidence window;
- feedback and reasons are non-empty and bounded;
- no raw provider chain-of-thought or hidden reasoning.

Invalid results receive one bounded repair attempt and then fail safely as `needs_review` only when the contract explicitly permits it. Do not invent marks locally after an unresolved malformed response.

### 9. Concept-performance aggregation

Create deterministic concept-performance calculation over the completed assessment.

For each attempted concept calculate:

- available marks;
- earned marks;
- percentage;
- questions attempted;
- objective/written contribution;
- priority;
- strength category:
  - `mastered`: at least 80% and no critical incorrect claim;
  - `developing`: 50–79%;
  - `needs_review`: below 50%;
  - `urgent_priority`: high-priority concept below 50% or a critical grounded misconception/incorrect claim.

Required:

- no model call to calculate totals or categories;
- totals exactly reconcile with question results;
- written criterion results contribute only to linked concepts according to a documented deterministic allocation policy;
- weak concepts are ordered by urgency, priority, then performance;
- evidence from the original questions remains visible.

Misconception prose generation is not required in this task. Use only explicit incorrect/unsupported claims returned by the written evaluator.

### 10. Results experience

Build or extend a premium mixed-assessment result screen containing:

- total score out of 6;
- MCQ result;
- short-written result;
- criterion-by-criterion mark breakdown;
- covered and missing concepts;
- incorrect/unsupported claims when present;
- concise feedback;
- source evidence disclosures;
- concept-performance summary;
- weak-concept list;
- clear disclosure that written grading is an AI estimate grounded in the confirmed source;
- a disabled or clearly labelled “Revision coming next” continuation state rather than implementing Task 05.

Do not imply that a revision plan exists until Task 05 is complete.

### 11. Persistence and recovery

Version and validate persisted assessment state.

Preserve:

- assessment configuration;
- generated activity set;
- source version ID;
- selected answers;
- submitted result;
- concept performance;
- safe workflow stage.

Do not persist:

- API key;
- provider prompt;
- raw provider response;
- hidden reasoning;
- unnecessary full source copies if validated segment references suffice.

Required:

- corrupted envelopes rejected safely;
- stale source version invalidates assessment and results;
- uncertain network outcomes do not silently duplicate written-evaluation calls;
- successful grading is persisted before navigation;
- clear-session removes assessment artifacts.

### 12. Sample and live evaluation

Extend the provider-free sample flow with:

- one MCQ;
- one short written question;
- one partially correct sample answer;
- deterministic pre-generated Gemma 4 evaluation;
- concept-performance result;
- weak concept.

Add explicit-opt-in live verification that:

- generates the mixed assessment from a team-authored confirmed source;
- validates all grounding and rubric invariants;
- evaluates at least:
  - one correct written answer;
  - one partially correct written answer;
  - one empty written answer without provider call;
- records latency, schema mode, repair count, scores, evidence validity, and redacted safe metadata;
- does not publish the full live student answer/source if the evaluation contract treats them as private.

### 13. Visual-system compliance

All new UI must follow `docs/UI_UX_DESIGN_SYSTEM.md`.

Reuse or appropriately extend:

- GrowthRail;
- ProcessNarrative;
- PracticeCard;
- ResultPulse/result summary;
- EvidenceChip and EvidenceDrawer;
- semantic alerts;
- form primitives;
- accessible progress and status components.

Required visual evidence under `evaluation/ui/`:

- assessment builder desktop;
- assessment builder mobile;
- MCQ desktop;
- short-written mobile;
- submission confirmation;
- written-grading loading;
- mixed result desktop;
- mixed result mobile;
- rubric breakdown;
- weak-concept summary.

## Explicit non-goals

Do not implement:

- revision-note generation;
- revision-note UI;
- weak-area retry generation;
- retry player;
- improvement comparison;
- true/false;
- factual/fill-blank questions;
- timers;
- negative marking;
- multiple files;
- increased document limits;
- authentication;
- database;
- admin interface;
- server queues;
- vector database;
- another backend;
- full dark mode;
- automatic 31B fallback;
- Task 05 or submission-package work.

## Architecture constraints

Preserve:

```text
Route Handler
→ application use case
→ domain rules
→ provider port
→ Gemma adapter
```

Additional rules:

- no prompt/provider call inside React components or Route Handlers;
- no grading rules inside presentation components;
- no model response displayed without Zod and evidence validation;
- no client-side provider SDK;
- `GEMINI_API_KEY` remains server-only;
- do not weaken Task 03 source confirmation, persistence, or invalidation;
- do not send the complete confirmed source for written grading—send only allowed evidence segments;
- do not log raw student answers or source content;
- do not create a parallel activity-set model that conflicts with existing contracts.

## Required tests

### Unit

- mixed activity-set invariants;
- rubric sum and criterion uniqueness;
- short-written question validation;
- deterministic empty-answer result;
- MCQ grading regression;
- criterion-to-concept allocation;
- concept totals and strength categories;
- source-version invalidation;
- persisted assessment envelope validation;
- duplicate prompt detection.

### Integration

- mixed assessment generation success;
- invalid rubric repair and rejection;
- invalid evidence repair and rejection;
- written-evaluation request validation;
- empty answer bypasses provider;
- criterion totals and total marks reconciliation;
- unknown concept/evidence rejection;
- timeout, 429, 5xx, malformed response, and needs-review behavior;
- safe logging with no raw source/answer/provider body;
- rate-limit and kill-switch behavior;
- provider failure preserves answers and assessment.

### Component/accessibility

- builder controls and fixed composition;
- two-question navigation;
- short-answer label and length guidance;
- submit confirmation;
- grading loading and recovery;
- criterion breakdown;
- weak-concept rendering;
- keyboard completion;
- Axe A/AA scans;
- reduced-motion behavior;
- mobile overflow.

### End-to-end

Provider-free sample flow at desktop and mobile:

1. Select and confirm sample source.
2. Generate preparation map.
3. Configure focused P0 assessment.
4. Generate one MCQ and one short written question.
5. Answer both.
6. Submit with confirmation.
7. View deterministic MCQ grading.
8. View criterion-level written grading.
9. Inspect evidence for both questions.
10. Inspect concept performance and weak concept.
11. Refresh the completed result and verify safe recovery.
12. Clear session and verify assessment artifacts are removed.
13. Complete critical controls using keyboard.
14. Verify no horizontal overflow.

Live provider calls remain explicit opt-in and outside normal CI.

## Required commands

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm audit --audit-level=moderate
```

Also run the explicit-opt-in mixed-assessment and written-grading verifier.

Where deployment access is available, deploy production and verify:

- home and health return 200;
- provider-free sample completes;
- live mode fails safely when disabled;
- after the human enables production live generation, one live mixed assessment and written evaluation complete without exposing secrets;
- client assets contain no provider key or server-only SDK.

Do not claim production live grading passed unless it actually ran.

## Acceptance criteria

- Existing Task 03 ingestion flows remain passing.
- Exactly one grounded MCQ and one grounded short-written question are generated.
- Both question types cite valid confirmed source evidence.
- The rubric contains two to four criteria and totals exactly 5 marks.
- MCQ grading is deterministic.
- Empty written answers are deterministic and generate no provider call.
- Non-empty written answers receive validated criterion-level Gemma grading.
- Written marks and criterion marks reconcile exactly.
- Invalid evidence, concepts, rubrics, or provider output fail safely.
- Concept-performance totals reconcile with the 6-mark assessment.
- At least one weak concept appears for a known partially correct sample answer.
- Results show transparent source evidence and AI-grading limitations.
- Assessment and result state recover after refresh.
- Source changes invalidate stale assessment and grading.
- The Luminous Knowledge Garden visual system is preserved.
- Desktop/mobile accessibility and screenshot evidence pass.
- No Task 05 functionality is added.
- Production remains healthy.

## Required final report

Report:

1. Implementation summary
2. Changed files
3. Architecture, contract, and visual-system compliance
4. Mixed-assessment domain model
5. Assessment-generation behavior
6. MCQ grading behavior
7. Short-written rubric model
8. Written-evaluation endpoint behavior
9. Empty-answer behavior
10. Criterion and evidence validation
11. Concept-performance calculation
12. Persistence and invalidation behavior
13. Commands run and exact outcomes
14. Tests added or changed
15. Sample-flow results
16. Live-provider verification results
17. Responsive and accessibility verification
18. Screenshot inventory
19. Secret, privacy, and logging verification
20. Production verification
21. Known limitations
22. Manual QA steps/results
23. Recommendation: `Task 04 PASSED` or `Task 04 BLOCKED`
24. Recommended next task
25. `SSOT Update: none` or exact proposed changes

Do not begin revision or retry work automatically.
