import { describe, expect, it, vi } from "vitest";

import type { RevisionGenerationPort } from "../../src/application/ports/revision-generation-port.js";
import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleRevisionPlan,
  createSampleSource,
  createSampleWrittenEvaluation,
} from "../../src/application/sample/sample-vertical-slice.js";
import { GeneratePersonalizedRevision } from "../../src/application/use-cases/generate-personalized-revision.js";
import { calculateConceptPerformance } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq } from "../../src/domain/assessments/mcq.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";

describe("revision generation use case", () => {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const activity = createSampleActivitySet(source, map);
  const mcqGrade = gradeMcq(activity.questions[0], activity.questions[0].correctOptionId);
  const writtenEvaluation = createSampleWrittenEvaluation(activity);
  const performance = calculateConceptPerformance({
    concepts: map.concepts,
    mcqQuestion: activity.questions[0],
    mcqGrade,
    writtenQuestion: activity.questions[1],
    writtenEvaluation,
  });
  const originalResultId = `result-${activity.id}`;
  const valid = createSampleRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId, performance, writtenEvaluation });

  it("repairs one invalid evidence artifact and returns the complete grounded plan", async () => {
    const invalid = { ...valid, items: valid.items.map((item, index) => index === 0 ? { ...item, evidence: [{ segmentId: "M01-P001-S999" }] } : item) };
    const generateRevisionPlan = vi.fn<RevisionGenerationPort["generateRevisionPlan"]>()
      .mockResolvedValueOnce(invalid)
      .mockResolvedValueOnce(valid);
    const result = await new GeneratePersonalizedRevision({ generateRevisionPlan }).execute({
      source, preparationMap: map, originalActivity: activity, originalResultId,
      originalMcqGrade: mcqGrade, performance, writtenEvaluation, requestId: "revision-request-1",
    });
    expect(result).toEqual(valid);
    expect(generateRevisionPlan).toHaveBeenCalledTimes(2);
    expect(generateRevisionPlan.mock.calls[1]?.[0].repair?.validationErrors.join(" ")).toContain("UNKNOWN_SEGMENT");
    expect(generateRevisionPlan.mock.calls[0]?.[0].source.segments.length).toBeLessThanOrEqual(source.segments.length);
  });

  it("rejects an unresolved duplicate retry atomically", async () => {
    const duplicate = {
      ...valid,
      retryActivity: {
        ...valid.retryActivity,
        questions: [{ ...valid.retryActivity.questions[0], prompt: activity.questions[0].prompt }, valid.retryActivity.questions[1]] as const,
      },
    };
    const port: RevisionGenerationPort = { generateRevisionPlan: vi.fn().mockResolvedValue(duplicate) };
    await expect(new GeneratePersonalizedRevision(port).execute({
      source, preparationMap: map, originalActivity: activity, originalResultId,
      originalMcqGrade: mcqGrade, performance, writtenEvaluation, requestId: "revision-request-2",
    })).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
  });

  it("rejects source-version mismatch before calling the provider", async () => {
    const generateRevisionPlan = vi.fn<RevisionGenerationPort["generateRevisionPlan"]>();
    await expect(new GeneratePersonalizedRevision({ generateRevisionPlan }).execute({
      source, preparationMap: { ...map, sourceVersionId: "source-deadbeef" }, originalActivity: activity,
      originalResultId, originalMcqGrade: mcqGrade, performance, writtenEvaluation, requestId: "revision-request-3",
    })).rejects.toMatchObject({ code: "SOURCE_VERSION_MISMATCH" });
    expect(generateRevisionPlan).not.toHaveBeenCalled();
  });

  it("rejects client-reported concept performance that does not match deterministic grading", async () => {
    const generateRevisionPlan = vi.fn<RevisionGenerationPort["generateRevisionPlan"]>();
    const fabricated = performance.map((item, index) => index === 0
      ? { ...item, earnedMarks: 0, percentage: 0, strength: "needs_review" as const }
      : item);
    await expect(new GeneratePersonalizedRevision({ generateRevisionPlan }).execute({
      source, preparationMap: map, originalActivity: activity, originalResultId,
      originalMcqGrade: mcqGrade, performance: fabricated, writtenEvaluation, requestId: "revision-request-4",
    })).rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(generateRevisionPlan).not.toHaveBeenCalled();
  });

  it("propagates a safe provider timeout without manufacturing a partial plan", async () => {
    const timeout = new ProviderError("TIMEOUT");
    const generateRevisionPlan = vi.fn<RevisionGenerationPort["generateRevisionPlan"]>().mockRejectedValue(timeout);
    await expect(new GeneratePersonalizedRevision({ generateRevisionPlan }).execute({
      source, preparationMap: map, originalActivity: activity, originalResultId,
      originalMcqGrade: mcqGrade, performance, writtenEvaluation, requestId: "revision-request-5",
    })).rejects.toBe(timeout);
    expect(generateRevisionPlan).toHaveBeenCalledOnce();
  });
});
