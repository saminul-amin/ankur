import { describe, expect, it } from "vitest";

import { createSampleActivitySet, createSamplePreparationMap, createSampleSource, createSampleWrittenEvaluation } from "../../src/application/sample/sample-vertical-slice.js";
import { calculateConceptPerformance, reconcileAssessmentTotal, weakConcepts } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq } from "../../src/domain/assessments/mcq.js";
import { createEmptyWrittenEvaluation, validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";

describe("written grading and deterministic diagnosis", () => {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const activity = createSampleActivitySet(source, map);
  const mcqGrade = gradeMcq(activity.questions[0], "B");

  it("creates a deterministic 0/5 empty-answer result with every criterion and required concept missing", () => {
    const result = createEmptyWrittenEvaluation({ question: activity.questions[1], requestId: "empty-answer" });
    expect(result).toMatchObject({ awardedMarks: 0, maximumMarks: 5, status: "not_answered", coveredConceptIds: [] });
    expect(result.criterionResults.every((criterion) => criterion.awardedMarks === 0 && criterion.state === "not_met")).toBe(true);
    expect(result.missingConceptIds).toEqual(activity.questions[1].requiredConceptIds);
    expect(validateWrittenEvaluation(source, activity.questions[1], result)).toEqual([]);
  });

  it("allocates written criterion marks only to their linked concepts and reconciles all six marks", () => {
    const written = createSampleWrittenEvaluation(activity);
    const performance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: activity.questions[0], mcqGrade, writtenQuestion: activity.questions[1], writtenEvaluation: written });
    expect(reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: written, performance })).toBe(true);
    expect(performance.reduce((sum, item) => sum + item.availableMarks, 0)).toBe(6);
    expect(performance.reduce((sum, item) => sum + item.earnedMarks, 0)).toBe(3);
    expect(performance.find((item) => item.conceptId === "concept-photosynthesis-inputs")).toMatchObject({ earnedMarks: 2, availableMarks: 2, strength: "mastered" });
  });

  it("orders weak concepts by urgency, priority, then performance", () => {
    const written = createSampleWrittenEvaluation(activity);
    const performance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: activity.questions[0], mcqGrade, writtenQuestion: activity.questions[1], writtenEvaluation: written });
    expect(weakConcepts(performance).map((item) => item.conceptId)).toEqual(["concept-photosynthesis-light", "concept-photosynthesis-result"]);
  });

  it("classifies intentionally low-scoring assessed concepts as weak", () => {
    const incorrectMcq = gradeMcq(activity.questions[0], "A");
    const emptyWritten = createEmptyWrittenEvaluation({ question: activity.questions[1], requestId: "low-score" });
    const performance = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: activity.questions[0],
      mcqGrade: incorrectMcq,
      writtenQuestion: activity.questions[1],
      writtenEvaluation: emptyWritten,
    });

    expect(performance.length).toBeGreaterThan(0);
    expect(performance.every((item) => item.percentage < 80)).toBe(true);
    expect(new Set(weakConcepts(performance).map((item) => item.conceptId))).toEqual(
      new Set(performance.map((item) => item.conceptId)),
    );
  });

  it("rejects criterion totals that do not reconcile with the awarded mark", () => {
    const valid = createSampleWrittenEvaluation(activity);
    const invalid = { ...valid, awardedMarks: 4 };
    expect(validateWrittenEvaluation(source, activity.questions[1], invalid)).toContainEqual({ path: "awardedMarks", reason: "INVARIANT_VIOLATION" });
  });
});
