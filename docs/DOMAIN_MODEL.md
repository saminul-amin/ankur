# Ankur Domain Model

> **Version:** 1.0.0  
> **Status:** LOCKED FOR P0

## 1. Ubiquitous language

| Term | Meaning |
|---|---|
| Learning Session | One end-to-end source-to-retry journey stored in the learner's browser. |
| Material | A PDF, image collection, or pasted text selected by the learner. |
| Page | A numbered visual or textual unit belonging to a material. |
| Confirmed Source | The learner-approved immutable snapshot used for all generation and grading. |
| Segment | A deterministic immutable piece of confirmed text with a stable ID. |
| Preparation Map | Source-derived topics, concepts, objectives, priorities, and evidence. |
| Concept | A unit of understanding tested by one or more questions. |
| Activity Set | A generated assessment with questions, answer keys, rubrics, and evidence. |
| Attempt | Learner answers for one Activity Set. |
| Evaluation | Deterministic and model-assisted grading results. |
| Revision Plan | Weak-concept notes and the associated retry activity. |
| Evidence | Existing segment IDs and optional supporting quotes verified against confirmed text. |

## 2. Aggregate boundaries

### LearningSession aggregate

Owns the workflow state and references:

- one active source snapshot;
- zero or one preparation map;
- zero or more activity sets;
- zero or more attempts;
- zero or one active revision plan.

### ConfirmedSource aggregate

Owns materials, pages, and immutable segments. Once confirmed, source text cannot be edited in place. Editing creates a new source version and invalidates downstream generated artifacts.

### ActivitySet aggregate

Owns question ordering, answer keys, rubrics, concept links, marks, and source evidence. It is immutable after an attempt starts.

### Attempt aggregate

Owns answers, timestamps, deterministic results, model-assisted results, and concept performance for one activity set.

## 3. Core identifiers

Use opaque application IDs for aggregates and deterministic readable IDs for source evidence.

```ts
export type LearningSessionId = string & { readonly __brand: "LearningSessionId" };
export type MaterialId = string & { readonly __brand: "MaterialId" };
export type QuestionId = string & { readonly __brand: "QuestionId" };
export type ConceptId = string & { readonly __brand: "ConceptId" };
```

Segment format:

```text
M01-P001-S001
```

Rules:

- Material, page, and segment ordinals are one-based and zero-padded.
- IDs are deterministic for one confirmed-source version.
- Reconfirming edited text creates a new `sourceVersionId`; downstream artifacts from the previous version become stale.

## 4. Reference TypeScript contracts

### Learning session

```ts
export interface LearningSession {
  id: LearningSessionId;
  schemaVersion: 1;
  state: LearningSessionState;
  title: string;
  language: "bn" | "en" | "mixed";
  sourceDraft?: SourceDraft;
  confirmedSource?: ConfirmedSource;
  preparationMap?: PreparationMap;
  activitySets: ActivitySet[];
  attempts: Attempt[];
  revisionPlan?: RevisionPlan;
  createdAt: string;
  updatedAt: string;
}
```

### Confirmed source

```ts
export interface ConfirmedSource {
  sourceVersionId: string;
  confirmedAt: string;
  materials: ConfirmedMaterial[];
  segments: ConfirmedSegment[];
  normalizedTextHash: string;
  priorityInstruction?: string;
}

export interface ConfirmedSegment {
  id: string; // M01-P001-S001
  materialId: MaterialId;
  pageNumber: number;
  ordinal: number;
  text: string;
  normalizedText: string;
  textHash: string;
}
```

### Preparation map

```ts
export interface PreparationMap {
  id: string;
  sourceVersionId: string;
  title: string;
  language: "bn" | "en" | "mixed";
  domain: string;
  topics: Topic[];
  concepts: LearningConcept[];
  objectives: LearningObjective[];
  warnings: string[];
  artifact: ModelArtifactMetadata;
}

export interface LearningConcept {
  id: ConceptId;
  topicId: string;
  name: string;
  description: string;
  priority: "high" | "medium" | "low";
  evidence: EvidenceReference[];
}
```

### Questions

```ts
export type Question = SingleMcqQuestion | ShortWrittenQuestion;

export interface QuestionBase {
  id: QuestionId;
  prompt: string;
  conceptIds: ConceptId[];
  difficulty: "easy" | "medium" | "hard";
  marks: number;
  explanation: string;
  evidence: EvidenceReference[];
}

export interface SingleMcqQuestion extends QuestionBase {
  type: "single_mcq";
  options: Array<{ id: string; text: string }>;
  correctOptionId: string;
}

export interface ShortWrittenQuestion extends QuestionBase {
  type: "short_written";
  expectedLength: "one_sentence" | "short_paragraph";
  referenceAnswer: string;
  rubric: RubricCriterion[];
}

export interface RubricCriterion {
  id: string;
  description: string;
  marks: number;
  requiredConceptIds: ConceptId[];
  evidence: EvidenceReference[];
}
```

### Evidence

```ts
export interface EvidenceReference {
  segmentId: string;
  quote?: string;
}
```

A valid evidence reference satisfies all of these invariants:

1. `segmentId` exists in the exact confirmed source version.
2. The segment belongs to the stated source version.
3. When a quote exists, its normalized value is a substring of the segment's normalized text.
4. The reference contains enough evidence for the claim after human review; this semantic quality is measured in evaluation.

### Attempt and evaluation

```ts
export interface Attempt {
  id: string;
  activitySetId: string;
  sourceVersionId: string;
  status: "in_progress" | "submitted" | "evaluated";
  answers: StudentAnswer[];
  evaluations: QuestionEvaluation[];
  conceptPerformance: ConceptPerformance[];
  startedAt: string;
  submittedAt?: string;
}

export interface WrittenAnswerEvaluation {
  questionId: QuestionId;
  awardedMarks: number;
  maximumMarks: number;
  status: "correct" | "partially_correct" | "incorrect" | "not_answered" | "needs_review";
  criterionResults: RubricCriterionResult[];
  coveredConceptIds: ConceptId[];
  missingConceptIds: ConceptId[];
  incorrectClaims: string[];
  unsupportedClaims: string[];
  feedback: string;
  evidence: EvidenceReference[];
  artifact: ModelArtifactMetadata;
}
```

### Model artifact metadata

```ts
export interface ModelArtifactMetadata {
  provider: "gemini_api";
  modelId: "gemma-4-26b-a4b-it" | "gemma-4-31b-it";
  task: ModelTask;
  promptVersion: string;
  schemaVersion: string;
  thinkingLevel: "minimal" | "high";
  requestId: string;
  createdAt: string;
  latencyMs?: number;
  repaired: boolean;
}
```

## 5. Domain invariants

- An assessment cannot be generated from an unconfirmed source.
- All generated artifacts must carry the same `sourceVersionId` as their evidence.
- A question must reference at least one concept and at least one source segment.
- An MCQ has exactly four non-empty normalized-unique options and exactly one valid correct option ID.
- A written rubric has at least one criterion; criterion marks sum exactly to question marks.
- Awarded marks never exceed maximum marks and never become negative.
- A retry references only concepts classified as weak or urgent.
- Retry wording cannot be normalized-identical to a previous prompt.
- Editing confirmed text invalidates preparation maps, assessments, evaluations, and revisions derived from the old source version.
- Empty written answers are evaluated deterministically without a provider call.

## 6. Deterministic normalization

Normalization functions must be pure and tested:

- Unicode normalization (`NFC` unless a measured Bengali issue requires a documented exception).
- Whitespace collapse and trim.
- Bengali and English digit equivalence for factual-answer P1 work.
- Non-semantic punctuation removal only where explicitly appropriate.
- Case-folding for English objective comparisons.

The original learner text remains preserved separately from normalized text.

## 7. Concept performance

For each concept:

```text
earnedMarks = sum awarded marks from linked question portions
availableMarks = sum available marks from linked question portions
accuracy = earnedMarks / availableMarks
```

P0 category rules:

- `mastered`: accuracy ≥ 0.80 and no critical misconception.
- `developing`: 0.50 ≤ accuracy < 0.80.
- `needs_review`: accuracy < 0.50.
- `urgent`: high-priority concept with accuracy < 0.50 or repeated misconception.

Question marks linked to multiple concepts must use explicit per-concept weights or equal distribution. The selected method must be deterministic and documented; P0 defaults to equal distribution when no rubric criterion provides a direct allocation.
