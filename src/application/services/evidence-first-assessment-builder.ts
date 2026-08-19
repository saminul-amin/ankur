import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import {
  buildCanonicalAnswer,
  isOptionSupportedByCanonical,
  semanticTextSimilarity,
  validateCanonicalAnswer,
  validateLanguageQuality,
  validateQuestionRubricAlignment,
  validateShortWrittenQuestion,
  validateSingleMcqQuestion,
  type ArtifactValidationFailure,
} from "../../domain/assessments/evidence-first-validation";
import type {
  ActivitySet,
  AssessmentDifficulty,
  McqOption,
} from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import type {
  CanonicalAnswerV2,
  EvidenceFirstMcqProviderOutput,
  EvidenceFirstRubricProviderOutput,
  EvidenceFirstWrittenQuestionProviderOutput,
  ScopedEvidenceReference,
  ShortWrittenQuestionV2,
  SingleMcqQuestionV2,
  WrittenRubricV2,
} from "../../shared/schemas/evidence-first-question-schemas";

export interface GroundedConceptAssignment {
  readonly conceptId: string;
  readonly conceptName: string;
  readonly conceptDescription: string;
  readonly materialId: string;
  readonly sourceVersionId: string;
  readonly evidenceSegmentId: string;
}

export interface EvidenceFirstAssessmentPlan {
  readonly mcq: GroundedConceptAssignment;
  readonly written: readonly GroundedConceptAssignment[];
  readonly mcqCanonicalAnswer: CanonicalAnswerV2;
  readonly writtenCanonicalAnswer: CanonicalAnswerV2;
}

export interface EvidenceFirstAssessmentArtifacts {
  readonly plan: EvidenceFirstAssessmentPlan;
  readonly mcq: SingleMcqQuestionV2;
  readonly writtenQuestion: ShortWrittenQuestionV2;
  readonly rubric: WrittenRubricV2;
  readonly activitySet: ActivitySet;
  readonly failures: readonly ArtifactValidationFailure[];
}

export function createEvidenceFirstAssessmentPlan(input: {
  readonly source: ConfirmedSource;
  readonly preparationMap: PreparationMap;
  readonly selectedConceptIds: readonly string[];
  readonly idPrefix?: string;
}): EvidenceFirstAssessmentPlan {
  const segmentById = new Map(input.source.segments.map((segment) => [segment.id, segment]));
  const assignments = input.selectedConceptIds.map((conceptId): GroundedConceptAssignment => {
    const concept = input.preparationMap.concepts.find((candidate) => candidate.id === conceptId);
    const evidence = concept?.evidence.find((reference) => segmentById.has(reference.segmentId));
    const segment = segmentById.get(evidence?.segmentId ?? "");
    if (concept === undefined || evidence === undefined || segment === undefined) {
      throw new Error("Selected concept does not have source-scoped evidence.");
    }
    return {
      conceptId: concept.id,
      conceptName: concept.name,
      conceptDescription: concept.description,
      materialId: segment.materialId,
      sourceVersionId: input.source.sourceVersionId,
      evidenceSegmentId: segment.id,
    };
  });
  const first = assignments[0];
  if (first === undefined) throw new Error("At least one grounded concept is required.");
  const written = [
    assignments[0] ?? first,
    assignments[1] ?? assignments[0] ?? first,
    assignments[2] ?? assignments[0] ?? first,
  ] as const;
  const prefix = input.idPrefix ?? "assessment";
  const firstEvidenceSegment = segmentById.get(first.evidenceSegmentId);
  const writtenEvidenceSegmentIds = [...new Set(written.map((assignment) => assignment.evidenceSegmentId))];
  if (writtenEvidenceSegmentIds.length < 2 && firstEvidenceSegment !== undefined) {
    for (const segment of input.source.segments) {
      if (!writtenEvidenceSegmentIds.includes(segment.id)) {
        writtenEvidenceSegmentIds.push(segment.id);
      }
      if (writtenEvidenceSegmentIds.length === 3) break;
    }
  }
  const mcqCanonicalAnswer = buildCanonicalAnswer({
    source: input.source,
    evidenceSegmentIds: [first.evidenceSegmentId],
    conceptIds: [first.conceptId],
    idSuffix: `${prefix}-mcq`,
    maximumAnswerCharacters: 240,
    maximumClaims: 1,
  });
  const writtenCanonicalAnswer = buildCanonicalAnswer({
    source: input.source,
    evidenceSegmentIds: writtenEvidenceSegmentIds,
    conceptIds: [...new Set(written.map((assignment) => assignment.conceptId))],
    idSuffix: `${prefix}-written`,
    maximumAnswerCharacters: 1_200,
    maximumClaims: 3,
  });
  return {
    mcq: first,
    written,
    mcqCanonicalAnswer,
    writtenCanonicalAnswer,
  };
}

function evidenceForCanonical(canonical: CanonicalAnswerV2): readonly ScopedEvidenceReference[] {
  return canonical.evidenceReferences;
}

export function deterministicRubricMarks(criterionCount: number): readonly number[] {
  if (criterionCount < 2 || criterionCount > 5) {
    throw new Error("A deterministic rubric requires two to five claims.");
  }
  const base = Math.floor(5 / criterionCount);
  const remainder = 5 % criterionCount;
  return Array.from({ length: criterionCount }, (_, index) => base + (index < remainder ? 1 : 0));
}

function comparable(value: string): string {
  return value.normalize("NFKC").toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export const ASSESSMENT_VALIDATOR_VERSION = "evidence-first-assessment-validation.v3";
export const DISTRACTOR_SALVAGE_VERSION = "deterministic-distractor-salvage.v2";
export const PROMPT_SALVAGE_VERSION = "deterministic-question-prompt-salvage.v1";

const CLAUSE_SEPARATOR = /([.!?।;:,]+\s*)/u;

function collapseAdjacentDuplicateTokens(value: string): string {
  const parts = value.split(/(\s+)/u);
  const kept: string[] = [];
  let previousWord: string | undefined;
  for (const part of parts) {
    if (/^\s+$/u.test(part)) { kept.push(part); continue; }
    const key = comparable(part);
    if (key.length > 1 && key === previousWord) {
      if (kept.at(-1) !== undefined && /^\s+$/u.test(kept.at(-1) ?? "")) kept.pop();
      continue;
    }
    previousWord = key.length > 1 ? key : undefined;
    kept.push(part);
  }
  return kept.join("");
}

function dropRepeatedClauses(value: string): string {
  const parts = value.split(CLAUSE_SEPARATOR);
  const seen = new Set<string>();
  const kept: string[] = [];
  for (let index = 0; index < parts.length; index += 2) {
    const clause = parts[index] ?? "";
    const delimiter = parts[index + 1] ?? "";
    const key = comparable(clause);
    if (key.length >= 8 && seen.has(key)) continue;
    if (key.length >= 8) seen.add(key);
    kept.push(clause, delimiter);
  }
  return kept.join("");
}

/**
 * Repairs only mechanical wording defects a provider prompt can carry — adjacent
 * duplicated tokens, literally repeated clauses, doubled or dangling punctuation,
 * and a missing terminal question mark. Meaning is never rewritten, and the
 * unchanged validators still decide whether the salvaged prompt is acceptable.
 */
export function salvageQuestionPrompt(prompt: string): string {
  const collapsed = dropRepeatedClauses(collapseAdjacentDuplicateTokens(prompt))
    .replace(/\s+/gu, " ")
    .replace(/([!?।.,])\1+/gu, "$1")
    .replace(/[,.]\s*([?।])/gu, "$1")
    .replace(/\s+([!?।.,])/gu, "$1")
    .replace(/[,:;—-]+\s*$/u, "")
    .trim();
  if (collapsed.length === 0) return prompt.trim();
  return /[?？।.]$/u.test(collapsed) ? collapsed : `${collapsed}?`;
}

function deterministicMisconceptions(language: CanonicalAnswerV2["language"]): readonly string[] {
  if (language === "bn") return [
    "উৎসে বর্ণিত কারণ ও ফলের সম্পর্কটি উল্টো।",
    "প্রক্রিয়াটির অপরিহার্য শর্তটি সম্পূর্ণ অনুপস্থিত।",
    "ঘটনাটির শেষ ধাপটি প্রথম ধাপের আগে ঘটে।",
  ];
  if (language === "mixed") return [
    "Source-এ বর্ণিত cause এবং effect উল্টো।",
    "প্রয়োজনীয় condition-টি process থেকে অনুপস্থিত।",
    "Final stage-টি first stage-এর আগে ঘটে।",
  ];
  return [
    "The source-described cause and effect are reversed.",
    "The process occurs without its essential condition.",
    "The final stage occurs before the first stage.",
  ];
}

export function selectDeterministicDistractors(input: {
  readonly canonicalAnswer: CanonicalAnswerV2;
  readonly candidates: readonly string[];
}): readonly [string, string, string] {
  const accepted: string[] = [];
  for (const candidate of [...input.candidates, ...deterministicMisconceptions(input.canonicalAnswer.language)]) {
    const trimmed = candidate.trim().replace(/\s+/gu, " ");
    const normalized = comparable(trimmed);
    const languageFailures = validateLanguageQuality(trimmed, {
      kind: "option",
      sourceLanguage: input.canonicalAnswer.language,
    });
    if (
      normalized.length === 0 ||
      comparable(input.canonicalAnswer.canonicalAnswer) === normalized ||
      languageFailures.length > 0 ||
      isOptionSupportedByCanonical(trimmed, input.canonicalAnswer) ||
      accepted.some((existing) =>
        comparable(existing) === normalized ||
        semanticTextSimilarity(existing, trimmed) >= 0.82
      )
    ) continue;
    accepted.push(trimmed);
    if (accepted.length === 3) break;
  }
  if (accepted.length !== 3) throw new Error("No valid deterministic distractor set remained.");
  return accepted as unknown as readonly [string, string, string];
}

function seededPermutation(seed: string): readonly number[] {
  let state = 2166136261;
  for (const character of seed) {
    state ^= character.codePointAt(0) ?? 0;
    state = Math.imul(state, 16777619);
  }
  const values = [0, 1, 2, 3];
  for (let index = values.length - 1; index > 0; index -= 1) {
    state = Math.imul(state ^ (state >>> 13), 1274126177);
    const swap = Math.abs(state) % (index + 1);
    [values[index], values[swap]] = [values[swap] ?? index, values[index] ?? swap];
  }
  return values;
}

export function assembleEvidenceFirstAssessment(input: {
  readonly source: ConfirmedSource;
  readonly plan: EvidenceFirstAssessmentPlan;
  readonly mcqProvider: EvidenceFirstMcqProviderOutput;
  readonly writtenQuestionProvider: EvidenceFirstWrittenQuestionProviderOutput;
  readonly rubricProvider?: EvidenceFirstRubricProviderOutput;
  readonly title: string;
  readonly difficulty: AssessmentDifficulty;
  readonly metadata: ModelArtifactMetadata;
  readonly idPrefix?: string;
  readonly criterionIdPrefix?: string;
}): EvidenceFirstAssessmentArtifacts {
  const prefix = input.idPrefix ?? "question";
  const criterionPrefix = input.criterionIdPrefix ?? prefix;
  const distractors = selectDeterministicDistractors({
    canonicalAnswer: input.plan.mcqCanonicalAnswer,
    candidates: [
      input.mcqProvider.misconception1,
      input.mcqProvider.misconception2,
      input.mcqProvider.misconception3,
    ],
  });
  const unassignedOptions = [
    {
      text: input.plan.mcqCanonicalAnswer.canonicalAnswer,
      role: "correct" as const,
      validationClassification: "supported_by_evidence" as const,
    },
    ...distractors.map((text) => ({
      text,
      role: "distractor" as const,
      validationClassification: "plausible_misconception" as const,
    })),
  ];
  const optionIds = ["A", "B", "C", "D"] as const;
  const options = seededPermutation(input.metadata.requestId).map((sourceIndex, outputIndex) => {
    const option = unassignedOptions[sourceIndex];
    const optionId = optionIds[outputIndex];
    if (option === undefined || optionId === undefined) {
      throw new Error("Deterministic option assignment failed.");
    }
    return { ...option, id: optionId };
  });
  const correctOptionId = options.find((option) => option.role === "correct")?.id;
  if (correctOptionId === undefined) throw new Error("Correct option assignment failed.");
  const mcq: SingleMcqQuestionV2 = {
    schemaVersion: "single-mcq-question.v2",
    id: `${prefix}-001`,
    materialId: input.plan.mcqCanonicalAnswer.materialId,
    sourceVersionId: input.source.sourceVersionId,
    prompt: salvageQuestionPrompt(input.mcqProvider.prompt),
    explanation: input.plan.mcqCanonicalAnswer.canonicalAnswer,
    canonicalAnswerId: input.plan.mcqCanonicalAnswer.id,
    requiredClaimIds: input.plan.mcqCanonicalAnswer.requiredClaims.map((claim) => claim.id),
    conceptIds: [input.plan.mcq.conceptId],
    evidenceReferences: [...evidenceForCanonical(input.plan.mcqCanonicalAnswer)],
    options,
    correctOptionId,
    difficulty: input.difficulty,
    marks: 1,
  };
  const writtenQuestion: ShortWrittenQuestionV2 = {
    schemaVersion: "short-written-question.v2",
    id: `${prefix}-002`,
    materialId: input.plan.writtenCanonicalAnswer.materialId,
    sourceVersionId: input.source.sourceVersionId,
    prompt: salvageQuestionPrompt(input.writtenQuestionProvider.prompt),
    explanation: input.plan.writtenCanonicalAnswer.canonicalAnswer,
    canonicalAnswerId: input.plan.writtenCanonicalAnswer.id,
    requiredClaimIds: input.plan.writtenCanonicalAnswer.requiredClaims.map((claim) => claim.id),
    conceptIds: [...new Set(input.plan.written.map((assignment) => assignment.conceptId))],
    evidenceReferences: [...evidenceForCanonical(input.plan.writtenCanonicalAnswer)],
    expectedLength: input.writtenQuestionProvider.expectedLength,
    difficulty: input.difficulty,
    marks: 5,
  };
  const claims = input.plan.writtenCanonicalAnswer.requiredClaims;
  const marks = deterministicRubricMarks(claims.length);
  const rubric: WrittenRubricV2 = {
    schemaVersion: "written-rubric.v2",
    id: `rubric-${prefix}`,
    questionId: writtenQuestion.id,
    canonicalAnswerId: input.plan.writtenCanonicalAnswer.id,
    materialId: writtenQuestion.materialId,
    sourceVersionId: writtenQuestion.sourceVersionId,
    language: input.plan.writtenCanonicalAnswer.language,
    criteria: claims.map((claim, index) => {
      const assignment = input.plan.written[index] ?? input.plan.written[0];
      if (assignment === undefined) throw new Error("A rubric requires a grounded concept.");
      return {
        id: `criterion-${criterionPrefix}-${String(index + 1).padStart(3, "0")}`,
        description: claim.text.slice(0, 600),
        maximumMarks: marks[index] ?? 0,
        requiredClaimIds: [claim.id],
        requiredConceptIds: [assignment.conceptId],
        evidenceReferences: claim.evidenceReferences,
      };
    }),
    maximumMarks: 5,
  };
  const mcqFailures = validateSingleMcqQuestion(
    input.source,
    input.plan.mcqCanonicalAnswer,
    mcq,
  );
  const writtenFailures = validateShortWrittenQuestion(
    input.source,
    input.plan.writtenCanonicalAnswer,
    writtenQuestion,
  );
  const rubricFailures = validateQuestionRubricAlignment(
    input.source,
    input.plan.writtenCanonicalAnswer,
    writtenQuestion,
    rubric,
  );
  const canonicalFailures = [
    ...validateCanonicalAnswer(input.source, input.plan.mcqCanonicalAnswer),
    ...validateCanonicalAnswer(input.source, input.plan.writtenCanonicalAnswer),
  ];
  const toPublicEvidence = (references: readonly ScopedEvidenceReference[]) =>
    references.map((reference) => ({
      segmentId: reference.segmentId,
      ...(reference.quote === undefined ? {} : { quote: reference.quote }),
    }));
  const publicOptions = mcq.options.map((option) => ({
    id: option.id,
    text: option.text,
  })) as [McqOption, McqOption, McqOption, McqOption];
  const publicRubric = rubric.criteria.map((criterion) => ({
    id: criterion.id,
    description: criterion.description,
    maximumMarks: criterion.maximumMarks,
    requiredConceptIds: criterion.requiredConceptIds,
    evidence: toPublicEvidence(criterion.evidenceReferences),
  }));
  const activitySet: ActivitySet = {
    schemaVersion: "activity-set.v2",
    id: `activity-${input.source.sourceVersionId}`,
    sourceVersionId: input.source.sourceVersionId,
    title: input.title,
    questions: [
      {
        id: mcq.id,
        type: "single_mcq",
        sourceVersionId: mcq.sourceVersionId,
        prompt: mcq.prompt,
        conceptIds: mcq.conceptIds,
        difficulty: mcq.difficulty,
        marks: 1,
        explanation: mcq.explanation,
        options: publicOptions,
        correctOptionId: mcq.correctOptionId,
        evidence: toPublicEvidence(mcq.evidenceReferences),
        artifact: input.metadata,
      },
      {
        id: writtenQuestion.id,
        type: "short_written",
        sourceVersionId: writtenQuestion.sourceVersionId,
        prompt: writtenQuestion.prompt,
        conceptIds: writtenQuestion.conceptIds,
        difficulty: writtenQuestion.difficulty,
        marks: 5,
        explanation: writtenQuestion.explanation,
        expectedLength: writtenQuestion.expectedLength,
        referenceAnswer: input.plan.writtenCanonicalAnswer.canonicalAnswer,
        requiredConceptIds: writtenQuestion.conceptIds,
        evidence: toPublicEvidence(writtenQuestion.evidenceReferences),
        rubric: publicRubric,
        artifact: input.metadata,
      },
    ],
    warnings: [],
    artifact: input.metadata,
  };
  return {
    plan: input.plan,
    mcq,
    writtenQuestion,
    rubric,
    activitySet,
    failures: [
      ...canonicalFailures,
      ...mcqFailures.map((failure) => ({ ...failure, path: `mcq.${failure.path}` })),
      ...writtenFailures.map((failure) => ({ ...failure, path: `writtenQuestion.${failure.path}` })),
      ...rubricFailures.map((failure) => ({ ...failure, path: `rubric.${failure.path}` })),
    ],
  };
}
