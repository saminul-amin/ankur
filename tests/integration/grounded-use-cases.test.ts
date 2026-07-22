import { describe, expect, it, vi } from "vitest";

import type { LearningContentGenerationPort } from "../../src/application/ports/learning-content-port.js";
import { createSampleActivitySet, createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { AnalyzeConfirmedSource } from "../../src/application/use-cases/analyze-confirmed-source.js";
import { GenerateMixedAssessment } from "../../src/application/use-cases/generate-mixed-assessment.js";
import type { ActivitySet } from "../../src/domain/assessments/mcq.js";
import type { PreparationMap } from "../../src/domain/preparation/preparation-map.js";
import type { ApplicationError } from "../../src/shared/errors/application-error.js";

function invalidMap(map: PreparationMap): PreparationMap {
  return {
    ...map,
    topics: map.topics.map((topic) => ({
      ...topic,
      evidence: [{ segmentId: "M01-P001-S999", quote: "invented" }],
    })),
  };
}

function invalidActivity(activity: ActivitySet): ActivitySet {
  const mcq = activity.questions[0];
  const written = activity.questions[1];
  return {
    ...activity,
    questions: [{ ...mcq, evidence: [{ segmentId: "M01-P001-S999" }] }, written],
  };
}

function invalidRubricActivity(activity: ActivitySet): ActivitySet {
  const written = activity.questions[1];
  return {
    ...activity,
    questions: [activity.questions[0], {
      ...written,
      rubric: written.rubric.map((criterion) => ({ ...criterion, maximumMarks: 1 })),
    }],
  };
}

describe("grounded application use cases", () => {
  const source = createSampleSource();
  const validMap = createSamplePreparationMap(source);
  const validActivity = createSampleActivitySet(source, validMap);

  it("performs exactly one bounded repair when preparation evidence is invalid", async () => {
    const generatePreparationMap = vi
      .fn<LearningContentGenerationPort["generatePreparationMap"]>()
      .mockResolvedValueOnce(invalidMap(validMap))
      .mockResolvedValueOnce(validMap);
    const port: LearningContentGenerationPort = {
      generatePreparationMap,
      generateMixedAssessment: vi.fn(),
    };

    await expect(new AnalyzeConfirmedSource(port).execute({ source, requestId: "request-1" }))
      .resolves.toEqual(validMap);
    expect(generatePreparationMap).toHaveBeenCalledTimes(2);
    expect(generatePreparationMap.mock.calls[1]?.[0].repair?.validationErrors[0])
      .toContain("UNKNOWN_SEGMENT");
  });

  it("rejects preparation content when the one repair is still ungrounded", async () => {
    const bad = invalidMap(validMap);
    const port: LearningContentGenerationPort = {
      generatePreparationMap: vi.fn().mockResolvedValue(bad),
      generateMixedAssessment: vi.fn(),
    };

    await expect(new AnalyzeConfirmedSource(port).execute({ source, requestId: "request-2" }))
      .rejects.toMatchObject({ code: "EVIDENCE_INVALID" } satisfies Partial<ApplicationError>);
  });

  it("performs exactly one bounded repair for an ungrounded MCQ", async () => {
    const generateMixedAssessment = vi
      .fn<LearningContentGenerationPort["generateMixedAssessment"]>()
      .mockResolvedValueOnce(invalidActivity(validActivity))
      .mockResolvedValueOnce(validActivity);
    const port: LearningContentGenerationPort = {
      generatePreparationMap: vi.fn(),
      generateMixedAssessment,
    };

    await expect(new GenerateMixedAssessment(port).execute({
      source,
      preparationMap: validMap,
      selectedConceptIds: validMap.concepts.map((concept) => concept.id),
      title: validActivity.title,
      difficulty: "medium",
      requestId: "request-3",
    })).resolves.toEqual(validActivity);
    expect(generateMixedAssessment).toHaveBeenCalledTimes(2);
  });

  it("repairs an invalid rubric once and rejects it when the repair remains invalid", async () => {
    const bad = invalidRubricActivity(validActivity);
    const generateMixedAssessment = vi
      .fn<LearningContentGenerationPort["generateMixedAssessment"]>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(validActivity);
    const input = {
      source,
      preparationMap: validMap,
      selectedConceptIds: validMap.concepts.map((concept) => concept.id),
      title: validActivity.title,
      difficulty: "medium" as const,
      requestId: "request-rubric",
    };
    await expect(new GenerateMixedAssessment({ generatePreparationMap: vi.fn(), generateMixedAssessment }).execute(input)).resolves.toEqual(validActivity);
    expect(generateMixedAssessment).toHaveBeenCalledTimes(2);
    expect(generateMixedAssessment.mock.calls[1]?.[0].repair?.validationErrors.join(" ")).toContain("rubric");

    generateMixedAssessment.mockReset().mockResolvedValue(bad);
    await expect(new GenerateMixedAssessment({ generatePreparationMap: vi.fn(), generateMixedAssessment }).execute(input))
      .rejects.toMatchObject({ code: "MODEL_OUTPUT_INVALID" });
    expect(generateMixedAssessment).toHaveBeenCalledTimes(2);
  });

  it("rejects the whole mixed set when evidence remains invalid after repair", async () => {
    const bad = invalidActivity(validActivity);
    const generateMixedAssessment = vi.fn<LearningContentGenerationPort["generateMixedAssessment"]>().mockResolvedValue(bad);
    await expect(new GenerateMixedAssessment({ generatePreparationMap: vi.fn(), generateMixedAssessment }).execute({
      source,
      preparationMap: validMap,
      selectedConceptIds: validMap.concepts.map((concept) => concept.id),
      title: validActivity.title,
      difficulty: "medium",
      requestId: "request-evidence-reject",
    })).rejects.toMatchObject({ code: "EVIDENCE_INVALID" });
    expect(generateMixedAssessment).toHaveBeenCalledTimes(2);
  });
});
