import { describe, expect, it } from "vitest";

import { ArtifactRepairCoordinator } from "../../src/application/services/artifact-repair-coordinator.js";
import {
  assembleEvidenceFirstAssessment,
  createEvidenceFirstAssessmentPlan,
} from "../../src/application/services/evidence-first-assessment-builder.js";
import {
  aggregateEvaluationReliability,
  buildCanonicalAnswer,
  detectQuestionDuplicate,
  validateCanonicalAnswer,
  validateLanguageQuality,
  validateQuestionRubricAlignment,
  validateRepairLockedFields,
  validateRevisionQuestion,
  validateSingleMcqQuestion,
} from "../../src/domain/assessments/evidence-first-validation.js";
import { createEmptyWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import type { PreparationMap } from "../../src/domain/preparation/preparation-map.js";
import type { ModelArtifactMetadata } from "../../src/domain/ai/model-artifact.js";

const metadata: ModelArtifactMetadata = {
  provider: "gemini_api",
  modelId: "gemma-4-26b-a4b-it",
  task: "assessment_generation",
  promptVersion: "assessment-evidence-first.v6",
  schemaVersion: "activity-set.v2",
  thinkingLevel: "minimal",
  requestId: "quality-fixture",
  createdAt: "2026-07-24T00:00:00.000Z",
  latencyMs: 0,
  repaired: false,
};

function fixture() {
  const source = createConfirmedSource({
    pages: [{
      pageNumber: 1,
      text: "Photosynthesis uses sunlight to produce glucose. The process releases oxygen into the air.",
    }],
    language: "en",
    method: "pasted_text",
    confirmedAt: "2026-07-24T00:00:00.000Z",
  });
  const segmentId = source.segments[0]?.id ?? "";
  const map: PreparationMap = {
    schemaVersion: "preparation-map.v1",
    id: "preparation-fixture",
    sourceVersionId: source.sourceVersionId,
    title: "Photosynthesis",
    language: "en",
    domain: "science",
    topics: [{
      id: "topic-photosynthesis",
      name: "Photosynthesis",
      priority: "high",
      evidence: [{ segmentId }],
    }],
    concepts: [{
      id: "concept-photosynthesis",
      topicId: "topic-photosynthesis",
      name: "Photosynthesis",
      description: "Plants use sunlight to produce glucose and release oxygen.",
      priority: "high",
      evidence: [{ segmentId }],
    }],
    objectives: [{
      id: "objective-photosynthesis",
      description: "Explain the source-backed process.",
      conceptIds: ["concept-photosynthesis"],
      evidence: [{ segmentId }],
    }],
    warnings: [],
    artifact: metadata,
  };
  const plan = createEvidenceFirstAssessmentPlan({
    source,
    preparationMap: map,
    selectedConceptIds: ["concept-photosynthesis"],
  });
  const artifacts = assembleEvidenceFirstAssessment({
    source,
    plan,
    mcqProvider: {
      prompt: "What does photosynthesis use to produce glucose?",
      explanation: "The permitted source identifies sunlight and glucose.",
      distractor1: "It uses soil to produce rain.",
      distractor1Classification: "unsupported_by_evidence",
      distractor2: "It removes all oxygen from the air.",
      distractor2Classification: "contradicted_by_evidence",
      distractor3: "It turns roots into sunlight.",
      distractor3Classification: "plausible_misconception",
    },
    writtenQuestionProvider: {
      prompt: "How does the source describe photosynthesis and its result?",
      explanation: "A complete answer addresses the process and result.",
      expectedLength: "short_paragraph",
    },
    rubricProvider: {
      criterion1Description: "Identifies sunlight used in photosynthesis.",
      criterion2Description: "Explains that the process releases oxygen.",
      criterion3Description: "States that sunlight supports glucose production.",
    },
    title: "Photosynthesis check",
    difficulty: "medium",
    metadata,
  });
  return { source, map, plan, artifacts };
}

function codes(failures: readonly { readonly code: string }[]): string[] {
  return failures.map((failure) => failure.code);
}

function required<T>(value: T | undefined): T {
  if (value === undefined) throw new Error("Required test fixture value is missing.");
  return value;
}

describe("Task 06C evidence-first question quality", () => {
  it("rejects duplicate MCQ options after punctuation and whitespace normalization", () => {
    const { source, plan, artifacts } = fixture();
    const options = artifacts.mcq.options.map((option) => ({ ...option }));
    const duplicate = required(options[1]);
    options[2] = { ...duplicate, text: `  ${duplicate.text}!!! `, id: "C" };
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, {
      ...artifacts.mcq,
      options,
    }))).toContain("MCQ_DUPLICATE_OPTIONS");
  });

  it("rejects two substantively supported correct options", () => {
    const { source, plan, artifacts } = fixture();
    const options = artifacts.mcq.options.map((option) => ({ ...option }));
    options[1] = {
      ...required(options[1]),
      text: plan.mcqCanonicalAnswer.canonicalAnswer,
      role: "distractor",
      validationClassification: "unsupported_by_evidence",
    };
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, {
      ...artifacts.mcq,
      options,
    }))).toContain("MCQ_MULTIPLE_CORRECT_OPTIONS");
  });

  it("rejects an MCQ with no source-supported correct option", () => {
    const { source, plan, artifacts } = fixture();
    const options = artifacts.mcq.options.map((option) => ({
      ...option,
      text: `${option.id} unrelated response`,
      role: option.id === "A" ? "correct" as const : "distractor" as const,
      validationClassification: option.id === "A"
        ? "supported_by_evidence" as const
        : "unsupported_by_evidence" as const,
    }));
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, {
      ...artifacts.mcq,
      options,
    }))).toContain("MCQ_NO_SUPPORTED_CORRECT_OPTION");
  });

  it("rejects a correct key that does not match the locked canonical answer", () => {
    const { source, plan, artifacts } = fixture();
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, {
      ...artifacts.mcq,
      correctOptionId: "B",
    }))).toContain("MCQ_KEY_CANONICAL_MISMATCH");
  });

  it.each(["A. sunlight", "B) oxygen", "optionD"])(
    "rejects embedded option labels and placeholder text: %s",
    (text) => {
      const { source, plan, artifacts } = fixture();
      const options = artifacts.mcq.options.map((option) => ({ ...option }));
      options[1] = { ...required(options[1]), text };
      const failures = validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, {
        ...artifacts.mcq,
        options,
      });
      expect(codes(failures)).toContain("MCQ_PLACEHOLDER_OPTION");
    },
  );

  it("rejects malformed Bengali wording and repeated Bengali words", () => {
    expect(codes(validateLanguageQuality("কেন কেন গাছ আলো ব্যবহার করে", {
      kind: "question",
      sourceLanguage: "bn",
    }))).toEqual(expect.arrayContaining(["LANG_REPEATED_TOKEN", "LANG_TRUNCATED_SENTENCE"]));
  });

  it("rejects malformed English verbs and repeated English clauses", () => {
    expect(codes(validateLanguageQuality("Why photosynthesis is?", {
      kind: "question",
      sourceLanguage: "en",
    }))).toContain("LANG_MALFORMED_VERB");
    expect(codes(validateLanguageQuality("Explain glucose, explain glucose.", {
      kind: "rubric",
      sourceLanguage: "en",
    }))).toContain("LANG_DUPLICATED_CLAUSE");
  });

  it("rejects suspicious mixed-language corruption", () => {
    expect(codes(validateLanguageQuality("আloকে কী ঘটে?", {
      kind: "question",
      sourceLanguage: "bn",
    }))).toContain("LANG_MIXED_LANGUAGE_CORRUPTION");
  });

  it("rejects cross-material and cross-source-version evidence identities", () => {
    const { source, plan, artifacts } = fixture();
    const crossMaterial = {
      ...artifacts.mcq,
      evidenceReferences: artifacts.mcq.evidenceReferences.map((reference) => ({
        ...reference,
        materialId: "material-02",
      })),
    };
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, crossMaterial)))
      .toContain("MCQ_CROSS_SOURCE_EVIDENCE");
    const crossVersion = {
      ...artifacts.mcq,
      evidenceReferences: artifacts.mcq.evidenceReferences.map((reference) => ({
        ...reference,
        sourceVersionId: "source-other",
      })),
    };
    expect(codes(validateSingleMcqQuestion(source, plan.mcqCanonicalAnswer, crossVersion)))
      .toContain("MCQ_CROSS_SOURCE_EVIDENCE");
  });

  it("rejects canonical answers not entailed by evidence or containing external claims", () => {
    const { source, plan } = fixture();
    const claim = required(plan.mcqCanonicalAnswer.requiredClaims[0]);
    const unsupported = {
      ...plan.mcqCanonicalAnswer,
      canonicalAnswer: "The process was invented in 1776.",
      requiredClaims: [{ ...claim, text: "The process was invented in 1776." }],
    };
    const failureCodes = codes(validateCanonicalAnswer(source, unsupported));
    expect(failureCodes).toEqual(expect.arrayContaining([
      "CANONICAL_ANSWER_NOT_ENTAILED",
      "CANONICAL_ANSWER_UNSUPPORTED_CLAIM",
    ]));
  });

  it("builds deterministic canonical IDs and composite grounding assignments", () => {
    const { source } = fixture();
    const segmentId = required(source.segments[0]).id;
    const first = buildCanonicalAnswer({
      source,
      evidenceSegmentIds: [segmentId],
      conceptIds: ["concept-photosynthesis"],
      idSuffix: "stable",
      maximumClaims: 1,
    });
    const second = buildCanonicalAnswer({
      source,
      evidenceSegmentIds: [segmentId],
      conceptIds: ["concept-photosynthesis"],
      idSuffix: "stable",
      maximumClaims: 1,
    });
    expect(second).toEqual(first);
    expect(first.evidenceReferences[0]).toMatchObject({
      materialId: "material-01",
      sourceVersionId: source.sourceVersionId,
      segmentId,
    });
  });

  it("rejects a retry that duplicates the original assessment question", () => {
    const { source, plan, artifacts } = fixture();
    const revision = {
      schemaVersion: "revision-question.v2" as const,
      id: "retry-question-001",
      originalQuestionId: artifacts.mcq.id,
      retryMode: "weak_area" as const,
      materialId: artifacts.mcq.materialId,
      sourceVersionId: artifacts.mcq.sourceVersionId,
      prompt: artifacts.mcq.prompt,
      canonicalAnswerId: plan.mcqCanonicalAnswer.id,
      requiredClaimIds: artifacts.mcq.requiredClaimIds,
      requiredConceptIds: artifacts.mcq.conceptIds,
      evidenceReferences: artifacts.mcq.evidenceReferences,
      questionType: "single_mcq" as const,
    };
    expect(codes(validateRevisionQuestion(source, plan.mcqCanonicalAnswer, revision, [{
      recordId: artifacts.mcq.id,
      prompt: artifacts.mcq.prompt,
      materialId: artifacts.mcq.materialId,
      pipeline: "ankur_structured",
      operationId: "original-operation",
      kind: "assessment",
    }]))).toContain("QUESTION_DUPLICATE");
  });

  it("distinguishes within-pipeline from cross-pipeline duplicate scope", () => {
    const candidate = {
      recordId: "q-new",
      prompt: "What does photosynthesis produce?",
      materialId: "material-01",
      pipeline: "ankur_structured" as const,
      operationId: "op-new",
      kind: "assessment" as const,
    };
    const within = detectQuestionDuplicate(candidate, [{
      ...candidate,
      recordId: "q-within",
      operationId: "op-old",
    }]);
    const cross = detectQuestionDuplicate(candidate, [{
      ...candidate,
      recordId: "q-baseline",
      pipeline: "one_prompt_baseline",
      operationId: "op-baseline",
    }]);
    expect(within.comparisonScope).toBe("within_pipeline");
    expect(cross.comparisonScope).toBe("cross_pipeline");
  });

  it("rejects an unrelated rubric criterion and an omitted central claim", () => {
    const { source, plan, artifacts } = fixture();
    const first = required(artifacts.rubric.criteria[0]);
    const unrelated = {
      ...artifacts.rubric,
      criteria: [{
        ...first,
        description: "Lists unrelated bicycle maintenance steps.",
      }, ...artifacts.rubric.criteria.slice(1)],
    };
    expect(codes(validateQuestionRubricAlignment(
      source,
      plan.writtenCanonicalAnswer,
      artifacts.writtenQuestion,
      unrelated,
    ))).toContain("RUBRIC_CANONICAL_ANSWER_MISMATCH");
    const missing = {
      ...artifacts.rubric,
      criteria: artifacts.rubric.criteria.map((criterion) => ({
        ...criterion,
        requiredClaimIds: [required(plan.writtenCanonicalAnswer.requiredClaims[0]).id],
      })),
    };
    expect(codes(validateQuestionRubricAlignment(
      source,
      plan.writtenCanonicalAnswer,
      artifacts.writtenQuestion,
      missing,
    ))).toContain("RUBRIC_MISSING_CENTRAL_CONCEPT");
  });

  it("rejects unrelated checklist items, cross-material rubric evidence, and duplicate criteria", () => {
    const { source, plan, artifacts } = fixture();
    const first = required(artifacts.rubric.criteria[0]);
    const invalid = {
      ...artifacts.rubric,
      criteria: artifacts.rubric.criteria.map((criterion, index) => ({
        ...criterion,
        description: index === 0 ? "Checks attendance and notebook color." : first.description,
        evidenceReferences: index === 0
          ? criterion.evidenceReferences.map((reference) => ({ ...reference, materialId: "material-02" }))
          : criterion.evidenceReferences,
      })),
    };
    const failureCodes = codes(validateQuestionRubricAlignment(
      source,
      plan.writtenCanonicalAnswer,
      artifacts.writtenQuestion,
      invalid,
    ));
    expect(failureCodes).toEqual(expect.arrayContaining([
      "RUBRIC_CANONICAL_ANSWER_MISMATCH",
      "RUBRIC_EVIDENCE_SCOPE_INVALID",
      "RUBRIC_DUPLICATE_CRITERIA",
    ]));
  });

  it("rejects rubric marks that do not sum to five", () => {
    const { source, plan, artifacts } = fixture();
    const invalid = {
      ...artifacts.rubric,
      criteria: artifacts.rubric.criteria.map((criterion) => ({
        ...criterion,
        maximumMarks: 1,
      })),
    };
    expect(codes(validateQuestionRubricAlignment(
      source,
      plan.writtenCanonicalAnswer,
      artifacts.writtenQuestion,
      invalid,
    ))).toContain("RUBRIC_MARK_TOTAL_INVALID");
  });

  it("returns a controlled failure after one unsuccessful repair", async () => {
    const coordinator = new ArtifactRepairCoordinator();
    const result = await coordinator.execute({
      firstPass: { prompt: "broken", lockedAnswer: "fixed" },
      validate: (artifact) => artifact.prompt.endsWith("?")
        ? []
        : [{ code: "LANG_TRUNCATED_SENTENCE" as const, path: "prompt" }],
      repair: () => Promise.resolve({ prompt: "still broken", lockedAnswer: "fixed" }),
      lockedFields: ["lockedAnswer"],
    });
    expect(result).toMatchObject({
      status: "controlled_failure",
      repairAttempted: true,
      repairSuccess: false,
      providerAttemptCount: 2,
      logicalOperationCount: 1,
    });
    expect(codes(result.finalFailures)).toContain("REPAIR_FAILED");
  });

  it("rejects a repair that changes source, canonical answer, or another locked field", () => {
    expect(codes(validateRepairLockedFields(
      { sourceVersionId: "source-1", canonicalAnswer: "locked", prompt: "bad" },
      { sourceVersionId: "source-2", canonicalAnswer: "locked", prompt: "better?" },
      ["sourceVersionId", "canonicalAnswer"],
    ))).toContain("REPAIR_LOCKED_FIELD_CHANGED");
  });

  it("keeps provider-attempt and logical-operation denominators separate", () => {
    const summary = aggregateEvaluationReliability([{
      logicalOperationId: "logical-1",
      artifactType: "single_mcq",
      providerAttempts: [
        { available: true, schemaValid: false, latencyMs: 10, stage: "first_pass" },
        { available: true, schemaValid: true, latencyMs: 12, stage: "repair" },
      ],
      firstPassSemanticValid: false,
      repairAttempted: true,
      repairSuccess: true,
      finalValid: true,
      alignmentValid: true,
      controlledFailure: false,
      logicalLatencyMs: 25,
      failureCodes: ["MCQ_DUPLICATE_OPTIONS"],
    }]);
    expect(summary.denominators).toEqual({ providerAttempts: 2, logicalOperations: 1 });
    expect(summary.repairAttempted).toEqual({ numerator: 1, denominator: 1 });
    expect(summary.repairSuccess).toEqual({ numerator: 1, denominator: 1 });
  });

  it("keeps empty-answer evaluation provider-free and returns no invented feedback", () => {
    const { artifacts } = fixture();
    const result = createEmptyWrittenEvaluation({
      question: artifacts.activitySet.questions[1],
      requestId: "empty-answer-v2",
      createdAt: "2026-07-24T00:00:00.000Z",
    });
    expect(result).toMatchObject({
      awardedMarks: 0,
      status: "not_answered",
      feedback: "",
      artifact: {
        promptVersion: "deterministic-empty.v1",
        latencyMs: 0,
      },
    });
  });
});
