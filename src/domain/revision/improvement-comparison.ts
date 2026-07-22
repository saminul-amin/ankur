import type { ConceptPerformance } from "../assessments/concept-performance";
import type { McqGrade } from "../assessments/mcq";
import type { WrittenAnswerEvaluation } from "../assessments/written-evaluation";

export type ConceptChange = "improved" | "unchanged" | "regressed";

export interface ConceptImprovement {
  readonly conceptId: string;
  readonly name: string;
  readonly originalPercentage: number;
  readonly retryPercentage: number;
  readonly change: ConceptChange;
  readonly mastered: boolean;
  readonly stillNeedsReview: boolean;
}

export interface ImprovementComparison {
  readonly schemaVersion: "improvement-comparison.v1";
  readonly originalScore: number;
  readonly retryScore: number;
  readonly maximumScore: 6;
  readonly absoluteChange: number;
  readonly percentagePointChange: number;
  readonly concepts: readonly ConceptImprovement[];
  readonly improvedConceptIds: readonly string[];
  readonly unchangedConceptIds: readonly string[];
  readonly regressedConceptIds: readonly string[];
  readonly masteredConceptIds: readonly string[];
  readonly stillNeedsReviewConceptIds: readonly string[];
  readonly remainingUrgentConceptIds: readonly string[];
  readonly recommendation: string;
}

export function compareAssessmentAttempts(input: {
  readonly originalMcqGrade: McqGrade;
  readonly originalWrittenEvaluation: WrittenAnswerEvaluation;
  readonly originalPerformance: readonly ConceptPerformance[];
  readonly retryMcqGrade: McqGrade;
  readonly retryWrittenEvaluation: WrittenAnswerEvaluation;
  readonly retryPerformance: readonly ConceptPerformance[];
}): ImprovementComparison {
  const originalScore = input.originalMcqGrade.earnedMarks + input.originalWrittenEvaluation.awardedMarks;
  const retryScore = input.retryMcqGrade.earnedMarks + input.retryWrittenEvaluation.awardedMarks;
  const originalById = new Map(input.originalPerformance.map((item) => [item.conceptId, item]));
  const concepts = input.retryPerformance.map((retry): ConceptImprovement => {
    const original = originalById.get(retry.conceptId);
    const originalPercentage = original?.percentage ?? 0;
    const change: ConceptChange = retry.percentage > originalPercentage ? "improved"
      : retry.percentage < originalPercentage ? "regressed" : "unchanged";
    return {
      conceptId: retry.conceptId,
      name: retry.name,
      originalPercentage,
      retryPercentage: retry.percentage,
      change,
      mastered: retry.strength === "mastered",
      stillNeedsReview: retry.strength !== "mastered",
    };
  });
  const idsFor = (predicate: (item: ConceptImprovement) => boolean) => concepts.filter(predicate).map((item) => item.conceptId);
  const remainingUrgentConceptIds = input.retryPerformance
    .filter((item) => item.strength === "urgent_priority" || item.hasCriticalIncorrectClaim)
    .map((item) => item.conceptId);
  const absoluteChange = retryScore - originalScore;
  return {
    schemaVersion: "improvement-comparison.v1",
    originalScore,
    retryScore,
    maximumScore: 6,
    absoluteChange,
    percentagePointChange: Math.round((absoluteChange / 6) * 1000) / 10,
    concepts,
    improvedConceptIds: idsFor((item) => item.change === "improved"),
    unchangedConceptIds: idsFor((item) => item.change === "unchanged"),
    regressedConceptIds: idsFor((item) => item.change === "regressed"),
    masteredConceptIds: idsFor((item) => item.mastered),
    stillNeedsReviewConceptIds: idsFor((item) => item.stillNeedsReview),
    remainingUrgentConceptIds,
    recommendation: remainingUrgentConceptIds.length > 0
      ? "Retry performance still shows an urgent source-backed review need. Revisit the cited note before another attempt."
      : absoluteChange > 0
        ? "Retry performance improved in this short check. Revisit the evidence later to see whether the improvement holds."
        : absoluteChange === 0
          ? "Retry performance was unchanged in this short check. Review the cited evidence before trying a different explanation."
          : "Retry performance was lower in this short check. Return to the cited source and rebuild the answer one criterion at a time.",
  };
}
