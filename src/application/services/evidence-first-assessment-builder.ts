import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import {
  buildCanonicalAnswer,
  validateCanonicalAnswer,
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
    evidenceSegmentIds: [...new Set(written.map((assignment) => assignment.evidenceSegmentId))],
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

function rubricMarks(index: number): number {
  return index === 0 ? 2 : index === 1 ? 2 : 1;
}

function providerDescriptions(provider: EvidenceFirstRubricProviderOutput): readonly string[] {
  return [
    provider.criterion1Description,
    provider.criterion2Description,
    provider.criterion3Description,
  ];
}

export function assembleEvidenceFirstAssessment(input: {
  readonly source: ConfirmedSource;
  readonly plan: EvidenceFirstAssessmentPlan;
  readonly mcqProvider: EvidenceFirstMcqProviderOutput;
  readonly writtenQuestionProvider: EvidenceFirstWrittenQuestionProviderOutput;
  readonly rubricProvider: EvidenceFirstRubricProviderOutput;
  readonly title: string;
  readonly difficulty: AssessmentDifficulty;
  readonly metadata: ModelArtifactMetadata;
  readonly idPrefix?: string;
  readonly criterionIdPrefix?: string;
}): EvidenceFirstAssessmentArtifacts {
  const prefix = input.idPrefix ?? "question";
  const criterionPrefix = input.criterionIdPrefix ?? prefix;
  const correctOptionId = "A" as const;
  const mcq: SingleMcqQuestionV2 = {
    schemaVersion: "single-mcq-question.v2",
    id: `${prefix}-001`,
    materialId: input.plan.mcqCanonicalAnswer.materialId,
    sourceVersionId: input.source.sourceVersionId,
    prompt: input.mcqProvider.prompt,
    explanation: input.plan.mcqCanonicalAnswer.canonicalAnswer,
    canonicalAnswerId: input.plan.mcqCanonicalAnswer.id,
    requiredClaimIds: input.plan.mcqCanonicalAnswer.requiredClaims.map((claim) => claim.id),
    conceptIds: [input.plan.mcq.conceptId],
    evidenceReferences: [...evidenceForCanonical(input.plan.mcqCanonicalAnswer)],
    options: [
      {
        id: "A",
        text: input.plan.mcqCanonicalAnswer.canonicalAnswer,
        role: "correct",
        validationClassification: "supported_by_evidence",
      },
      {
        id: "B",
        text: input.mcqProvider.distractor1,
        role: "distractor",
        validationClassification: input.mcqProvider.distractor1Classification,
      },
      {
        id: "C",
        text: input.mcqProvider.distractor2,
        role: "distractor",
        validationClassification: input.mcqProvider.distractor2Classification,
      },
      {
        id: "D",
        text: input.mcqProvider.distractor3,
        role: "distractor",
        validationClassification: input.mcqProvider.distractor3Classification,
      },
    ],
    correctOptionId,
    difficulty: input.difficulty,
    marks: 1,
  };
  const writtenQuestion: ShortWrittenQuestionV2 = {
    schemaVersion: "short-written-question.v2",
    id: `${prefix}-002`,
    materialId: input.plan.writtenCanonicalAnswer.materialId,
    sourceVersionId: input.source.sourceVersionId,
    prompt: input.writtenQuestionProvider.prompt,
    explanation: input.plan.writtenCanonicalAnswer.canonicalAnswer,
    canonicalAnswerId: input.plan.writtenCanonicalAnswer.id,
    requiredClaimIds: input.plan.writtenCanonicalAnswer.requiredClaims.map((claim) => claim.id),
    conceptIds: [...new Set(input.plan.written.map((assignment) => assignment.conceptId))],
    evidenceReferences: [...evidenceForCanonical(input.plan.writtenCanonicalAnswer)],
    expectedLength: input.writtenQuestionProvider.expectedLength,
    difficulty: input.difficulty,
    marks: 5,
  };
  const descriptions = providerDescriptions(input.rubricProvider);
  const claims = input.plan.writtenCanonicalAnswer.requiredClaims;
  const rubric: WrittenRubricV2 = {
    schemaVersion: "written-rubric.v2",
    id: `rubric-${prefix}`,
    questionId: writtenQuestion.id,
    canonicalAnswerId: input.plan.writtenCanonicalAnswer.id,
    materialId: writtenQuestion.materialId,
    sourceVersionId: writtenQuestion.sourceVersionId,
    language: input.plan.writtenCanonicalAnswer.language,
    criteria: descriptions.map((providerDescription, index) => {
      const claim = claims[index % claims.length];
      if (claim === undefined) throw new Error("A rubric requires a canonical claim.");
      const assignment = input.plan.written[index] ?? input.plan.written[0];
      if (assignment === undefined) throw new Error("A rubric requires a grounded concept.");
      return {
        id: `criterion-${criterionPrefix}-${String(index + 1).padStart(3, "0")}`,
        description: `${providerDescription.trim()} — ${claim.text}`.slice(0, 600),
        maximumMarks: rubricMarks(index),
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
  const providerRubricFailures = descriptions.flatMap<ArtifactValidationFailure>((description, index) => {
    const claim = claims[index % claims.length];
    if (claim === undefined) {
      return [{ code: "RUBRIC_MISSING_CENTRAL_CONCEPT" as const, path: `criteria[${String(index)}]` }];
    }
    const descriptionTokens = new Set(description.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []);
    const claimTokens = new Set(claim.text.toLocaleLowerCase().match(/[\p{L}\p{M}\p{N}]+/gu) ?? []);
    const shared = [...descriptionTokens].filter((token) => claimTokens.has(token)).length;
    return shared === 0
      ? [{ code: "RUBRIC_CANONICAL_ANSWER_MISMATCH" as const, path: `criteria[${String(index)}].description` }]
      : [];
  });
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
      ...mcqFailures,
      ...writtenFailures,
      ...rubricFailures,
      ...providerRubricFailures,
    ],
  };
}
