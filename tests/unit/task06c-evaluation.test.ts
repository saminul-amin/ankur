import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { evaluateTask06cGates } from "../../src/shared/evaluation/task06c-metrics.js";
import {
  task06cGateResultSchema,
  task06cMetricsSchema,
  task06cQuestionRecordSchema,
  task06cWrittenRecordSchema,
} from "../../src/shared/evaluation/task06c-schemas.js";
import {
  task06cReviewerPacketSchema,
  validateCompletedTask06cReviewPacket,
} from "../../src/shared/evaluation/task06c-review.js";

const hash = `sha256:${"a".repeat(64)}`;

describe("Task 06C evaluation contracts", () => {
  it("keeps empty written cases deterministic and feedback usefulness not applicable", () => {
    const valid = task06cWrittenRecordSchema.parse({
      schemaVersion: "task06c-written-record.v1",
      recordId: "written-001",
      neutralReviewId: "W-N001",
      questionRecordId: "question-001",
      materialId: "SCI-BN-PASTE-01",
      answerCase: "empty",
      answerHash: hash,
      providerCalled: false,
      rubricAlignmentValid: true,
      gradingMetricEligibility: "eligible",
      awardedMarks: 0,
      status: "not_answered",
      feedbackUsefulness: "not_applicable",
      adjudicatedMark: null,
      reviewerStatus: "pending",
    });
    expect(valid.providerCalled).toBe(false);
    expect(() => task06cWrittenRecordSchema.parse({
      ...valid,
      providerCalled: true,
    })).toThrow();
  });

  it("excludes invalid rubrics from written grading metrics", () => {
    const base = {
      schemaVersion: "task06c-written-record.v1" as const,
      recordId: "written-002",
      neutralReviewId: "W-N002",
      questionRecordId: "question-002",
      materialId: "SCI-BN-PASTE-01",
      answerCase: "partially_correct" as const,
      answerHash: hash,
      providerCalled: true,
      rubricAlignmentValid: false,
      gradingMetricEligibility: "eligible" as const,
      awardedMarks: 3,
      status: "partially_correct" as const,
      feedbackUsefulness: null,
      adjudicatedMark: null,
      reviewerStatus: "pending" as const,
    };
    expect(task06cWrittenRecordSchema.safeParse(base).success).toBe(false);
    expect(task06cWrittenRecordSchema.safeParse({
      ...base,
      gradingMetricEligibility: "excluded_invalid_rubric",
    }).success).toBe(true);
  });

  it("requires composite evidence identities and strict question records", () => {
    const record = task06cQuestionRecordSchema.parse({
      schemaVersion: "task06c-question-record.v1",
      recordId: "question-001",
      neutralReviewId: "Q-N001",
      operationId: "operation-001",
      materialId: "SCI-BN-PASTE-01",
      pipeline: "ankur_structured",
      questionType: "single_mcq",
      questionHash: hash,
      canonicalAnswerHash: hash,
      materialSourceVersionId: "source-12345678",
      evidenceCompositeIds: ["SCI-BN-PASTE-01/source-12345678/M01-P001-S001"],
      firstPassSchemaValid: true,
      firstPassSemanticValid: true,
      repairAttempted: false,
      repairSuccess: false,
      finalLogicalArtifactValid: true,
      questionRubricAlignmentValid: null,
      duplicateDecision: "accepted",
      comparedRecordId: null,
      comparisonScope: null,
      similarityScore: 0,
      failureCodes: [],
      reviewerStatus: "pending",
      acceptedByAdjudication: null,
      answerKeyCorrectByAdjudication: null,
      answerKeyGroundedByAdjudication: null,
    });
    expect(record.evidenceCompositeIds[0]).toContain("/source-12345678/");
    expect(task06cQuestionRecordSchema.safeParse({
      ...record,
      providerBody: "private",
    }).success).toBe(false);
  });

  it("does not authorize Task 07 while fresh human metrics are pending", () => {
    const metrics = task06cMetricsSchema.parse(JSON.parse(readFileSync(
      resolve("evaluation/task06c/exports/task06c-metrics.pending.json"),
      "utf8",
    )));
    const gates = task06cGateResultSchema.parse(evaluateTask06cGates(metrics));
    expect(gates.overallStatus).toBe("pending");
    expect(gates.task07Authorized).toBe(false);
    expect(gates.gates).toHaveLength(12);
  });

  it("records the failed frozen live-run gates without fabricating human results", () => {
    const metrics = task06cMetricsSchema.parse(JSON.parse(readFileSync(
      resolve("evaluation/task06c/exports/task06c-metrics.live-run.json"),
      "utf8",
    )));
    const gates = task06cGateResultSchema.parse(JSON.parse(readFileSync(
      resolve("evaluation/task06c/exports/task06c-gate-status.live-run.json"),
      "utf8",
    )));

    expect(metrics.finalLogicalArtifactValidity).toEqual({
      numerator: 33,
      denominator: 45,
      percentage: 73.33,
      status: "measured",
    });
    expect(metrics.eligibleWrittenCases).toBe(7);
    expect(metrics.answerKeyCorrectness.status).toBe("pending_human_review");
    expect(gates.overallStatus).toBe("failed");
    expect(gates.task07Authorized).toBe(false);
  });

  it("uses only public-safe normalized exports in the provider-free notebook", () => {
    const notebook = readFileSync(
      resolve("evaluation/task06c/notebook/ankur_task06c_evaluation.ipynb"),
      "utf8",
    );
    expect(notebook).not.toMatch(/GEMINI_API_KEY|completed-private|records[\\/]private|annotations[\\/]private|reviewer-attestation|coordinator-mapping/u);
    expect(notebook).toContain("task06c-metrics.pending.json");
    expect(notebook).toContain("historicalTask06MetricsPath");
  });

  it("includes normalized public records in the Task 06C privacy scan boundary", () => {
    const verifier = readFileSync(
      resolve("scripts/evaluation/verify-task06c.ts"),
      "utf8",
    );

    expect(verifier).toContain('resolve(ROOT, "records/public")');
    expect(verifier).not.toContain('resolve(ROOT, "records/private")');
  });

  it("detects missing, duplicate, invalid-mark, and incomplete human-review rows", () => {
    const packet = task06cReviewerPacketSchema.parse({
      schemaVersion: "task06c-reviewer-packet.v1",
      reviewerId: "R1",
      packetId: "task06c-r1",
      authorshipConflictDeclaration: "",
      independentReviewAttestation: "",
      questionPassA: [{
        neutralQuestionId: "Q-001",
        questionType: "single_mcq",
        prompt: "What is supported?",
        options: ["One", "Two", "Three", "Four"],
        clear: null,
        ambiguous: null,
        fairDifficulty: null,
        materiallyDuplicate: null,
        languageQuality: null,
        acceptQuestionText: null,
        reviewerNotes: "",
        completedAt: null,
      }, {
        neutralQuestionId: "Q-001",
        questionType: "single_mcq",
        prompt: "Duplicate row?",
        options: ["One", "Two", "Three", "Four"],
        clear: null,
        ambiguous: null,
        fairDifficulty: null,
        materiallyDuplicate: null,
        languageQuality: null,
        acceptQuestionText: null,
        reviewerNotes: "",
        completedAt: null,
      }],
      questionPassB: [],
      writtenReviews: [],
      sourceVerification: [],
    });
    const failures = validateCompletedTask06cReviewPacket({
      packet,
      expectedQuestionCount: 2,
      expectedWrittenCount: 1,
      expectedSourcePageCount: 12,
    });
    expect(failures.map((failure) => failure.code)).toEqual(expect.arrayContaining([
      "REVIEW_MISSING_ROW",
      "REVIEW_DUPLICATE_ID",
      "REVIEW_ID_MISMATCH",
      "REVIEW_INCOMPLETE_FIELD",
    ]));
    expect(() => task06cReviewerPacketSchema.parse({
      ...packet,
      writtenReviews: [{
        neutralWrittenId: "W-001",
        neutralQuestionId: "Q-001",
        sourceReference: "source",
        question: "Question?",
        learnerAnswer: "Answer",
        modelAwardedMarks: 2,
        modelStatus: "partially_correct",
        humanMarkOutOf5: 6,
        humanStatus: "correct",
        coveredConceptIds: [],
        missingConceptIds: [],
        incorrectClaims: [],
        unsupportedClaims: [],
        feedbackUsefulness: 4,
        reviewerNotes: "",
        completedAt: "2026-07-24T00:00:00.000Z",
      }],
    })).toThrow();
  });
});
