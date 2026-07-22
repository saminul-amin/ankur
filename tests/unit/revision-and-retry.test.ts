import { describe, expect, it } from "vitest";

import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleRevisionPlan,
  createSampleRetryWrittenEvaluation,
  createSampleSource,
  createSampleWrittenEvaluation,
} from "../../src/application/sample/sample-vertical-slice.js";
import { calculateConceptPerformance, type ConceptPerformance } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq } from "../../src/domain/assessments/mcq.js";
import { compareAssessmentAttempts } from "../../src/domain/revision/improvement-comparison.js";
import { selectRevisionTargets, validateRevisionPlan } from "../../src/domain/revision/revision-plan.js";

function performanceFixture(input: Partial<ConceptPerformance> & Pick<ConceptPerformance, "conceptId" | "strength" | "percentage">): ConceptPerformance {
  return {
    conceptId: input.conceptId,
    name: input.name ?? input.conceptId,
    priority: input.priority ?? "medium",
    availableMarks: input.availableMarks ?? 1,
    earnedMarks: input.earnedMarks ?? input.percentage / 100,
    percentage: input.percentage,
    questionsAttempted: input.questionsAttempted ?? 1,
    objective: input.objective ?? { availableMarks: 1, earnedMarks: input.percentage / 100 },
    written: input.written ?? { availableMarks: 0, earnedMarks: 0 },
    hasCriticalIncorrectClaim: input.hasCriticalIncorrectClaim ?? false,
    strength: input.strength,
  };
}

describe("personalized revision and retry domain", () => {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const activity = createSampleActivitySet(source, map);
  const originalMcq = gradeMcq(activity.questions[0], activity.questions[0].correctOptionId);
  const originalWritten = createSampleWrittenEvaluation(activity);
  const originalPerformance = calculateConceptPerformance({
    concepts: map.concepts,
    mcqQuestion: activity.questions[0],
    mcqGrade: originalMcq,
    writtenQuestion: activity.questions[1],
    writtenEvaluation: originalWritten,
  });

  it("selects only real non-mastered concepts in deterministic urgency order", () => {
    const selection = selectRevisionTargets({ preparationMap: map, performance: originalPerformance, writtenEvaluation: originalWritten });
    expect(selection).toEqual({
      mode: "weak_area",
      targetConceptIds: ["concept-photosynthesis-light", "concept-photosynthesis-result"],
    });
    expect(selection.targetConceptIds).not.toContain("concept-photosynthesis-inputs");
  });

  it("uses reinforcement for developing-only results and challenge for all-mastered results", () => {
    const developing = performanceFixture({ conceptId: map.concepts[0]?.id ?? "", percentage: 65, strength: "developing" });
    const strongerDeveloping = performanceFixture({ conceptId: map.concepts[1]?.id ?? "", percentage: 75, strength: "developing" });
    expect(selectRevisionTargets({ preparationMap: map, performance: [strongerDeveloping, developing], writtenEvaluation: originalWritten }))
      .toEqual({ mode: "reinforcement", targetConceptIds: [developing.conceptId] });

    const mastered = map.concepts.map((concept, index) => performanceFixture({
      conceptId: concept.id,
      name: concept.name,
      percentage: 90 + index,
      strength: "mastered",
      priority: concept.priority,
    }));
    const challenge = selectRevisionTargets({ preparationMap: map, performance: mastered, writtenEvaluation: { ...originalWritten, missingConceptIds: [], recommendedRevisionConceptIds: [] } });
    expect(challenge.mode).toBe("challenge");
    expect(challenge.targetConceptIds).toEqual([mastered[0]?.conceptId]);
  });

  it("accepts a grounded plan and rejects unsupported evidence or repeated retry wording", () => {
    const plan = createSampleRevisionPlan({
      source,
      preparationMap: map,
      originalActivity: activity,
      originalResultId: "result-original",
      performance: originalPerformance,
      writtenEvaluation: originalWritten,
    });
    const selection = selectRevisionTargets({ preparationMap: map, performance: originalPerformance, writtenEvaluation: originalWritten });
    expect(validateRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId: "result-original", expectedSelection: selection, writtenEvaluation: originalWritten, plan })).toEqual([]);

    const unsupported = { ...plan, items: plan.items.map((item, index) => index === 0 ? { ...item, importantFact: "Invented external fact" } : item) };
    expect(validateRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId: "result-original", expectedSelection: selection, writtenEvaluation: originalWritten, plan: unsupported }))
      .toContainEqual({ path: "items[0].importantFact", reason: "QUOTE_NOT_FOUND" });

    const repeated = {
      ...plan,
      retryActivity: {
        ...plan.retryActivity,
        questions: [{ ...plan.retryActivity.questions[0], prompt: activity.questions[0].prompt }, plan.retryActivity.questions[1]] as const,
      },
    };
    expect(validateRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId: "result-original", expectedSelection: selection, writtenEvaluation: originalWritten, plan: repeated }))
      .toContainEqual({ path: "retryActivity.questions[0].prompt", reason: "DUPLICATE_PROMPT" });

    const crossRepeated = {
      ...plan,
      retryActivity: {
        ...plan.retryActivity,
        questions: [plan.retryActivity.questions[0], { ...plan.retryActivity.questions[1], prompt: activity.questions[0].prompt }] as const,
      },
    };
    expect(validateRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId: "result-original", expectedSelection: selection, writtenEvaluation: originalWritten, plan: crossRepeated }))
      .toContainEqual({ path: "retryActivity.questions[1].prompt", reason: "DUPLICATE_PROMPT" });
  });

  it("calculates score and per-concept improvement without a model", () => {
    const plan = createSampleRevisionPlan({ source, preparationMap: map, originalActivity: activity, originalResultId: "result-original", performance: originalPerformance, writtenEvaluation: originalWritten });
    const retryWritten = createSampleRetryWrittenEvaluation(plan.retryActivity);
    const retryMcq = gradeMcq(plan.retryActivity.questions[0], plan.retryActivity.questions[0].correctOptionId);
    const retryPerformance = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: plan.retryActivity.questions[0],
      mcqGrade: retryMcq,
      writtenQuestion: plan.retryActivity.questions[1],
      writtenEvaluation: retryWritten,
    });
    const comparison = compareAssessmentAttempts({
      originalMcqGrade: originalMcq,
      originalWrittenEvaluation: originalWritten,
      originalPerformance,
      retryMcqGrade: retryMcq,
      retryWrittenEvaluation: retryWritten,
      retryPerformance,
    });
    expect(comparison.originalScore).toBe(3);
    expect(comparison.retryScore).toBe(6);
    expect(comparison.absoluteChange).toBe(3);
    for (const conceptId of plan.targetConceptIds) expect(comparison.improvedConceptIds).toContain(conceptId);
    expect(comparison.stillNeedsReviewConceptIds).toEqual([]);
  });
});
