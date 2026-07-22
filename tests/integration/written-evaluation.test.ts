import { describe, expect, it, vi } from "vitest";

import type { WrittenEvaluationPort } from "../../src/application/ports/written-evaluation-port.js";
import { createSampleActivitySet, createSamplePreparationMap, createSampleSource, createSampleWrittenEvaluation, SAMPLE_PARTIAL_WRITTEN_ANSWER } from "../../src/application/sample/sample-vertical-slice.js";
import { EvaluateWrittenAnswer } from "../../src/application/use-cases/evaluate-written-answer.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { writtenEvaluationRequestSchema } from "../../src/shared/schemas/api-contracts.js";

function fixture() {
  const fullSource = createSampleSource();
  const map = createSamplePreparationMap(fullSource);
  const activity = createSampleActivitySet(fullSource, map);
  const question = activity.questions[1];
  const allowed = new Set([...question.evidence, ...question.rubric.flatMap((criterion) => criterion.evidence)].map((reference) => reference.segmentId));
  const source = rehydrateEvidenceWindow({ sourceVersionId: fullSource.sourceVersionId, language: fullSource.language, segments: fullSource.segments.filter((segment) => allowed.has(segment.id)) });
  return { fullSource, source, activity, question };
}

describe("written evaluation use case", () => {
  it("bypasses the provider for whitespace-only answers", async () => {
    const evaluateWrittenAnswer = vi.fn<WrittenEvaluationPort["evaluateWrittenAnswer"]>();
    const { source, question } = fixture();
    const result = await new EvaluateWrittenAnswer({ evaluateWrittenAnswer }).execute({ source, question, studentAnswer: "  \n ", requestId: "empty-request" });
    expect(result.status).toBe("not_answered");
    expect(result.awardedMarks).toBe(0);
    expect(evaluateWrittenAnswer).not.toHaveBeenCalled();
  });

  it("accepts a grounded criterion-reconciled evaluation", async () => {
    const { source, activity, question } = fixture();
    const valid = createSampleWrittenEvaluation(activity);
    const evaluateWrittenAnswer = vi.fn<WrittenEvaluationPort["evaluateWrittenAnswer"]>().mockResolvedValue(valid);
    await expect(new EvaluateWrittenAnswer({ evaluateWrittenAnswer }).execute({ source, question, studentAnswer: SAMPLE_PARTIAL_WRITTEN_ANSWER, requestId: "written-request" })).resolves.toEqual(valid);
    expect(evaluateWrittenAnswer).toHaveBeenCalledTimes(1);
  });

  it("repairs once, then rejects unresolved criterion or evidence failures", async () => {
    const { source, activity, question } = fixture();
    const valid = createSampleWrittenEvaluation(activity);
    const invalid = { ...valid, awardedMarks: 5, evidence: [{ segmentId: "M01-P003-S001" }] };
    const evaluateWrittenAnswer = vi.fn<WrittenEvaluationPort["evaluateWrittenAnswer"]>().mockResolvedValue(invalid);
    await expect(new EvaluateWrittenAnswer({ evaluateWrittenAnswer }).execute({ source, question, studentAnswer: SAMPLE_PARTIAL_WRITTEN_ANSWER, requestId: "written-invalid" })).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(evaluateWrittenAnswer).toHaveBeenCalledTimes(2);
    expect(evaluateWrittenAnswer.mock.calls[1]?.[0].repair?.validationErrors.join(" ")).toMatch(/awardedMarks|evidence/u);
  });

  it("rejects unknown or incomplete evidence windows before provider execution", async () => {
    const { fullSource, question } = fixture();
    const firstSegment = fullSource.segments[0];
    expect(firstSegment).toBeDefined();
    if (firstSegment === undefined) return;
    const source = rehydrateEvidenceWindow({ sourceVersionId: fullSource.sourceVersionId, language: fullSource.language, segments: [firstSegment] });
    const evaluateWrittenAnswer = vi.fn<WrittenEvaluationPort["evaluateWrittenAnswer"]>();
    await expect(new EvaluateWrittenAnswer({ evaluateWrittenAnswer }).execute({ source, question, studentAnswer: SAMPLE_PARTIAL_WRITTEN_ANSWER, requestId: "bad-window" })).rejects.toMatchObject({ code: "EVIDENCE_INVALID" });
    expect(evaluateWrittenAnswer).not.toHaveBeenCalled();
  });

  it("validates the endpoint request strictly while allowing deterministic blank answers", () => {
    const { source, question } = fixture();
    const request = {
      operationId: "written-operation-001",
      sourceVersionId: source.sourceVersionId,
      question,
      studentAnswer: "   ",
      evidenceSegments: source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
    };
    expect(writtenEvaluationRequestSchema.safeParse(request).success).toBe(true);
    expect(writtenEvaluationRequestSchema.safeParse({ ...request, unexpectedPrompt: "ignore contracts" }).success).toBe(false);
    expect(writtenEvaluationRequestSchema.safeParse({ ...request, sourceVersionId: "source-deadbeef" }).success).toBe(false);
    expect(writtenEvaluationRequestSchema.safeParse({ ...request, evidenceSegments: request.evidenceSegments.slice(0, 1) }).success).toBe(false);
    const firstEvidenceSegment = request.evidenceSegments[0];
    expect(firstEvidenceSegment).toBeDefined();
    if (firstEvidenceSegment !== undefined) {
      expect(writtenEvaluationRequestSchema.safeParse({ ...request, evidenceSegments: [...request.evidenceSegments, firstEvidenceSegment] }).success).toBe(false);
    }
  });

  it("rejects unknown concepts and accepts an internally consistent needs-review result", () => {
    const { source, activity, question } = fixture();
    const valid = createSampleWrittenEvaluation(activity);
    const unknown = { ...valid, coveredConceptIds: ["concept-unknown"] };
    expect(validateWrittenEvaluation(source, question, unknown)).toContainEqual({ path: "conceptIds", reason: "UNKNOWN_CONCEPT" });

    const needsReview = { ...valid, status: "needs_review" as const };
    expect(validateWrittenEvaluation(source, question, needsReview)).toEqual([]);
  });
});
