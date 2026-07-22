import { describe, expect, it } from "vitest";

import {
  productionFlowPasses,
  type ProductionFlowReleaseChecks,
} from "../../scripts/production/verification-rules.js";

describe("production release verifier", () => {
  it("accepts a valid 5/6 mastered result when weak-concept count is zero", () => {
    const masteredFiveOfSix: ProductionFlowReleaseChecks = {
      activityValidationFailures: 0,
      writtenValidationFailures: 0,
      conceptPerformanceCount: 1,
      groundingFailures: 0,
      quoteFailures: 0,
      conceptReferenceFailures: 0,
      reconciliationFailures: 0,
      sourceOrAnswerLoss: 0,
      persistedResult: true,
      mcqCorrect: true,
      writtenAnswerPresent: true,
      writtenStatus: "partially_correct",
      awardedMarks: 4,
      totalsReconcile: true,
      weakConceptCount: 0,
    };

    expect(productionFlowPasses(masteredFiveOfSix)).toBe(true);
    expect(productionFlowPasses({ ...masteredFiveOfSix, conceptPerformanceCount: 0 })).toBe(false);
    expect(productionFlowPasses({ ...masteredFiveOfSix, conceptReferenceFailures: 1 })).toBe(false);
  });
});
