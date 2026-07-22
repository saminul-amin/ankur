import { describe, expect, it } from "vitest";

import { createSampleActivitySet, createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { gradeMcq, promptsMateriallyEquivalent, validateActivitySet } from "../../src/domain/assessments/mcq.js";

describe("mixed activity-set invariants", () => {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const activity = createSampleActivitySet(source, map);

  it("accepts exactly one 1-mark MCQ and one 5-mark written question", () => {
    expect(validateActivitySet(source, map, activity)).toEqual([]);
    expect(activity.questions.map((question) => [question.type, question.marks])).toEqual([["single_mcq", 1], ["short_written", 5]]);
    expect(activity.questions[1].rubric.reduce((sum, criterion) => sum + criterion.maximumMarks, 0)).toBe(5);
    expect(new Set(activity.questions[1].rubric.map((criterion) => criterion.id)).size).toBe(activity.questions[1].rubric.length);
  });

  it("rejects invalid rubric sums, duplicate criterion IDs, and unknown concepts", () => {
    const written = activity.questions[1];
    const firstCriterion = written.rubric[0];
    const secondCriterion = written.rubric[1];
    expect(firstCriterion).toBeDefined();
    expect(secondCriterion).toBeDefined();
    if (firstCriterion === undefined || secondCriterion === undefined) return;
    const invalid = {
      ...activity,
      questions: [activity.questions[0], {
        ...written,
        requiredConceptIds: ["concept-unknown"],
        rubric: [
          { ...firstCriterion, id: "criterion-duplicate", maximumMarks: 1 },
          { ...secondCriterion, id: "criterion-duplicate", maximumMarks: 1 },
        ],
      }],
    } as const;
    const failures = validateActivitySet(source, map, invalid);
    expect(failures.map((failure) => failure.path)).toContain("questions[1]");
    expect(failures.map((failure) => failure.path)).toContain("questions[1].rubric");
  });

  it("rejects normalized-identical or materially equivalent prompts", () => {
    expect(promptsMateriallyEquivalent("Explain plant growth from the source", "Explain plant growth from the source.")).toBe(true);
    const written = activity.questions[1];
    const invalid = { ...activity, questions: [activity.questions[0], { ...written, prompt: activity.questions[0].prompt }] } as const;
    expect(validateActivitySet(source, map, invalid)).toContainEqual({ path: "questions", reason: "DUPLICATE_PROMPT" });
  });

  it("keeps MCQ grading deterministic, including explicit unanswered state", () => {
    expect(gradeMcq(activity.questions[0], "B")).toMatchObject({ status: "correct", earnedMarks: 1 });
    expect(gradeMcq(activity.questions[0], "A")).toMatchObject({ status: "incorrect", earnedMarks: 0 });
    expect(gradeMcq(activity.questions[0], "")).toEqual({ status: "unanswered", correct: false, earnedMarks: 0, availableMarks: 1, correctOptionId: "B" });
  });
});
