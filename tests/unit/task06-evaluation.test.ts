import { describe, expect, it } from "vitest";

import { computeTask06Metrics } from "../../src/shared/evaluation/task06-metrics";
import {
  adaptiveLoopRecordSchema,
  baselineRecordSchema,
  evaluationMaterialSchema,
  extractionRecordSchema,
  generatedQuestionRecordSchema,
  providerOperationSchema,
  writtenGradingRecordSchema,
} from "../../src/shared/evaluation/task06-schemas";

const hash = `sha256:${"a".repeat(64)}`;

function material() {
  return evaluationMaterialSchema.parse({
    schemaVersion: "evaluation-material.v1",
    materialId: "SCI-BN-PASTE-01",
    title: "Fixture",
    domain: "academic_science",
    language: "bn",
    inputType: "pasted_text",
    pageCount: 1,
    fixturePath: null,
    licence: "CC-BY-4.0",
    provenance: "team-authored",
    sourceUrl: null,
    redistributionAllowed: true,
    publicSafe: true,
    contentHash: hash,
    learnerPriorityHash: hash,
    manualVerificationStatus: "pending",
    reviewerNotes: "Pending.",
    createdAt: "2026-07-23T00:00:00.000Z",
    updatedAt: "2026-07-23T00:00:00.000Z",
    pages: [{
      pageNumber: 1,
      route: "pasted_text",
      expectedText: "Source",
      confirmedText: "Source",
      expectedTextHash: hash,
      confirmedTextHash: hash,
    }],
  });
}

describe("Task 06 evaluation contracts", () => {
  it("accepts only public-safe, attributed corpus materials", () => {
    expect(material().redistributionAllowed).toBe(true);
    expect(() => evaluationMaterialSchema.parse({ ...material(), provenance: "unknown" })).toThrow();
  });

  it("keeps human metrics pending until adjudicated reviews exist", () => {
    const question = generatedQuestionRecordSchema.parse({
      schemaVersion: "generated-question-record.v1",
      recordId: "q1",
      operationId: "op-question",
      materialId: material().materialId,
      language: "bn",
      domain: "academic_science",
      questionStage: "original_assessment",
      questionType: "single_mcq",
      questionOrdinal: 1,
      questionHash: hash,
      questionText: "Question?",
      correctOptionId: "A",
      conceptIds: ["concept-1"],
      evidenceSegmentIds: ["M01-P001-S001"],
      deterministicGroundingValid: true,
      deterministicKeyValid: true,
      duplicateOfRecordId: null,
      reviewerStatus: "pending",
      acceptedByAdjudication: null,
    });
    const written = writtenGradingRecordSchema.parse({
      schemaVersion: "written-grading-record.v1",
      recordId: "w1",
      operationId: null,
      materialId: material().materialId,
      questionRecordId: "q1",
      answerCase: "empty",
      answerText: "",
      answerHash: hash,
      providerCalled: false,
      awardedMarks: 0,
      status: "not_answered",
      groundingValid: true,
      reconciliationValid: true,
      reviewerStatus: "pending",
      adjudicatedMark: null,
      adjudicatedStatus: null,
    });
    const metrics = computeTask06Metrics({
      materials: [material()],
      extraction: [extractionRecordSchema.parse({
        schemaVersion: "extraction-record.v1",
        recordId: "e1",
        materialId: material().materialId,
        pageNumber: 1,
        expectedRoute: "pasted_text",
        actualRoute: "pasted_text",
        status: "success",
        referenceCharacterCount: 6,
        candidateCharacterCount: 6,
        changedCharacterCount: 0,
        characterErrorRate: 0,
        uncertainSegmentCount: 0,
        materialCorrectionRequired: false,
        candidateTextHash: hash,
        providerOperationId: null,
      })],
      questions: [question],
      written: [written],
      adaptive: [adaptiveLoopRecordSchema.parse({
        schemaVersion: "adaptive-loop-record.v1",
        recordId: "a1",
        materialId: material().materialId,
        operationId: null,
        status: "pending",
        failureCategory: null,
        revisionMode: null,
        targetConceptIds: [],
        fabricatedWeaknessCount: 0,
        revisionGroundingFailures: 0,
        retryGroundingFailures: 0,
        duplicateFailures: 0,
        originalScore: null,
        retryScore: null,
        scoreChange: null,
        persistenceRecoveryPassed: null,
        statePreservationPassed: null,
      })],
      provider: [],
      baseline: [baselineRecordSchema.parse({
        schemaVersion: "baseline-record.v1",
        recordId: "b1",
        operationId: null,
        materialId: material().materialId,
        requestedQuestionCount: 5,
        parsedQuestionCount: 0,
        parseSuccess: false,
        evidenceTransparencyCount: 0,
        outputHash: null,
        reviewerStatus: "pending",
      })],
      questionAnnotations: [],
      writtenAnnotations: [],
      generatedAt: "2026-07-23T00:00:00.000Z",
    });

    expect(metrics.humanReviewStatus).toBe("pending");
    expect(metrics.questions.humanAccepted.status).toBe("pending_human_review");
    expect(metrics.written.meanAbsoluteError).toBeNull();
  });

  it("reconciles measured reliability denominators and repairs", () => {
    const operation = providerOperationSchema.parse({
      schemaVersion: "provider-operation.v1",
      operationId: "op1",
      materialId: material().materialId,
      modelId: "gemma-4-26b-a4b-it",
      operationType: "analysis",
      promptVersion: "analysis.v1",
      providerSchemaVersion: "preparation-map.v1",
      thinkingLevel: "minimal",
      temperature: 0,
      maxOutputTokens: 1000,
      timestamp: "2026-07-23T00:00:00.000Z",
      latencyMs: 100,
      inputTokens: 10,
      outputTokens: 20,
      firstPassValid: false,
      repairAttempted: true,
      repairSuccess: true,
      finalStatus: "valid",
      failureCategory: null,
      evidenceFailureCount: 0,
      quoteFailureCount: 0,
      conceptFailureCount: 0,
      reconciliationFailureCount: 0,
      artifactHash: hash,
    });
    expect(operation.repairSuccess).toBe(true);
    expect(() => computeTask06Metrics({
      materials: [material(), material()],
      extraction: [],
      questions: [],
      written: [],
      adaptive: [],
      provider: [operation],
      baseline: [],
      questionAnnotations: [],
      writtenAnnotations: [],
      generatedAt: "2026-07-23T00:00:00.000Z",
    })).toThrow("DUPLICATE_MATERIAL_ID");
  });
});
