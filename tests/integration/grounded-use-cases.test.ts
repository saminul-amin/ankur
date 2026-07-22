import { describe, expect, it, vi } from "vitest";

import type { LearningContentGenerationPort } from "../../src/application/ports/learning-content-port.js";
import { createSampleActivitySet, createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { AnalyzeConfirmedSource } from "../../src/application/use-cases/analyze-confirmed-source.js";
import { GenerateOneMcq } from "../../src/application/use-cases/generate-one-mcq.js";
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
  const question = activity.questions[0];
  return {
    ...activity,
    questions: [{ ...question, evidence: [{ segmentId: "M01-P001-S999" }] }],
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
      generateOneMcq: vi.fn(),
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
      generateOneMcq: vi.fn(),
    };

    await expect(new AnalyzeConfirmedSource(port).execute({ source, requestId: "request-2" }))
      .rejects.toMatchObject({ code: "EVIDENCE_INVALID" } satisfies Partial<ApplicationError>);
  });

  it("performs exactly one bounded repair for an ungrounded MCQ", async () => {
    const generateOneMcq = vi
      .fn<LearningContentGenerationPort["generateOneMcq"]>()
      .mockResolvedValueOnce(invalidActivity(validActivity))
      .mockResolvedValueOnce(validActivity);
    const port: LearningContentGenerationPort = {
      generatePreparationMap: vi.fn(),
      generateOneMcq,
    };

    const concept = validMap.concepts[0];
    expect(concept).toBeDefined();
    if (concept === undefined) return;
    await expect(new GenerateOneMcq(port).execute({
      source,
      preparationMap: validMap,
      selectedConceptIds: [concept.id],
      requestId: "request-3",
    })).resolves.toEqual(validActivity);
    expect(generateOneMcq).toHaveBeenCalledTimes(2);
  });
});
