import { describe, expect, it } from "vitest";

import {
  assertClosureEvidence,
  closureQuestionAdjudicationFields,
  closureQuestionEvidenceSchema,
  closureWrittenAdjudicationFields,
  closureWrittenEvidenceSchema,
  computeAdjudicationSummary,
  computeQuestionPipelineMetrics,
  computeReliabilityReclassification,
} from "../../src/shared/evaluation/task06-closure";
import { providerOperationSchema } from "../../src/shared/evaluation/task06-schemas";

function question(pipeline: "ankur_structured" | "one_prompt_baseline", index: number) {
  return closureQuestionEvidenceSchema.parse({
    record_id: `${pipeline}:${String(index)}`,
    material_id: "SCI-BN-PASTE-01",
    pipeline,
    question_stage: pipeline === "ankur_structured" ? "original_assessment" : "baseline",
    adj_question_grounded_in_permitted_source: "yes",
    adj_answerable_from_source: "yes",
    adj_clear: pipeline === "ankur_structured" ? "no" : "yes",
    adj_ambiguous: pipeline === "ankur_structured" ? "yes" : "no",
    adj_fair_difficulty: "yes",
    adj_materially_duplicate: "no",
    adj_language_quality: "4",
    adj_question_text_accept_or_reject: pipeline === "ankur_structured" ? "reject" : "accept",
    adj_proposed_answer_or_key_correct: "yes",
    adj_proposed_answer_or_key_grounded: "yes",
    adj_explanation_or_evidence_usefulness: "4",
    adj_final_accept_or_reject: "accept",
    overall_accept: pipeline === "ankur_structured" ? "reject" : "accept",
  });
}

function operation(operationId: string, finalStatus: "valid" | "controlled_failure") {
  return providerOperationSchema.parse({
    schemaVersion: "provider-operation.v1",
    operationId,
    materialId: "SCI-BN-PASTE-01",
    modelId: "gemma-4-26b-a4b-it",
    operationType: "analysis",
    promptVersion: "analysis.v1",
    providerSchemaVersion: "preparation-map.v1",
    thinkingLevel: "minimal",
    temperature: 0,
    maxOutputTokens: 100,
    timestamp: "2026-07-23T00:00:00.000Z",
    latencyMs: 100,
    inputTokens: null,
    outputTokens: null,
    firstPassValid: finalStatus === "valid",
    repairAttempted: false,
    repairSuccess: false,
    finalStatus,
    failureCategory: finalStatus === "valid" ? null : "INVALID_OUTPUT",
    evidenceFailureCount: 0,
    quoteFailureCount: 0,
    conceptFailureCount: 0,
    reconciliationFailureCount: 0,
    artifactHash: finalStatus === "valid" ? `sha256:${"a".repeat(64)}` : null,
  });
}

describe("Task 06 closure metrics", () => {
  it("keeps request attempts out of the logical-artifact denominator", () => {
    const metrics = computeReliabilityReclassification([
      operation("analysis:one", "valid"),
      operation("analysis:one:attempt1", "controlled_failure"),
    ]);
    expect(metrics.provider_attempts.count).toBe(2);
    expect(metrics.logical_operations.count).toBe(1);
    expect(metrics.final_artifact_valid).toEqual({ count: 1, denominator: 1, percentage: 100 });
  });

  it("derives overall pipeline acceptance from adjudicated evidence", () => {
    const metrics = computeQuestionPipelineMetrics([question("ankur_structured", 1), question("one_prompt_baseline", 1)]);
    expect((metrics["ankur_structured"] as { overall_accepted: { percentage: number } }).overall_accepted.percentage).toBe(0);
    expect((metrics["one_prompt_baseline"] as { overall_accepted: { percentage: number } }).overall_accepted.percentage).toBe(100);
  });

  it("rejects incomplete written-evidence closure", () => {
    const questions = Array.from({ length: 30 }, (_, index) => question("ankur_structured", index))
      .concat(Array.from({ length: 30 }, (_, index) => question("one_prompt_baseline", index)));
    const written = Array.from({ length: 14 }, (_, index) => closureWrittenEvidenceSchema.parse({
      record_id: `written:${String(index)}`,
      material_id: "SCI-BN-PASTE-01",
      eligibility: "exclude_invalid_rubric",
    }));
    expect(() => assertClosureEvidence(questions, written)).not.toThrow();
    expect(() => assertClosureEvidence(questions, written.slice(1))).toThrow("CLOSURE_WRITTEN_ELIGIBILITY_INVALID");
  });

  it("counts only independently reviewed adjudication disagreements", () => {
    const questionInput: Record<string, unknown> = {
      ...question("ankur_structured", 1),
    };
    const questionValue = (
      field: (typeof closureQuestionAdjudicationFields)[number],
    ): string => {
      if (
        field === "language_quality" ||
        field === "explanation_or_evidence_usefulness"
      ) return "4";
      if (
        field === "question_text_accept_or_reject" ||
        field === "final_accept_or_reject"
      ) return "accept";
      return "yes";
    };
    for (const field of closureQuestionAdjudicationFields) {
      const shared = questionValue(field);
      questionInput[`r1_${field}`] = shared;
      questionInput[`r2_${field}`] = shared;
      questionInput[`adj_${field}`] = shared;
    }
    questionInput["r2_clear"] = "no";
    questionInput["adj_clear"] = "yes";
    questionInput["r1_overall_accept"] = "accept";
    questionInput["r2_overall_accept"] = "reject";
    const questionRecord = closureQuestionEvidenceSchema.parse(questionInput);

    const writtenInput: Record<string, unknown> = {
      record_id: "written:one",
      material_id: "SCI-BN-PASTE-01",
      eligibility: "exclude_invalid_rubric",
    };
    for (const field of closureWrittenAdjudicationFields) {
      writtenInput[`r1_${field}`] = "same";
      writtenInput[`r2_${field}`] = "same";
      writtenInput[`adj_${field}`] = "same";
    }
    writtenInput["r2_status"] = "different";
    writtenInput["adj_status"] = "resolved";
    const writtenRecord = closureWrittenEvidenceSchema.parse(writtenInput);

    expect(computeAdjudicationSummary([questionRecord], [writtenRecord])).toEqual({
      questionDisagreements: 1,
      writtenDisagreements: 1,
      totalDisagreements: 2,
      adjudicatedDisagreements: 2,
    });
  });
});
