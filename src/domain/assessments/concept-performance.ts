import type { LearningConcept } from "../preparation/preparation-map";
import type { McqGrade, ShortWrittenQuestion, SingleMcqQuestion } from "./mcq";
import type { WrittenAnswerEvaluation } from "./written-evaluation";

export type ConceptStrength = "mastered" | "developing" | "needs_review" | "urgent_priority";

export interface MarkContribution {
  readonly availableMarks: number;
  readonly earnedMarks: number;
}

export interface ConceptPerformance {
  readonly conceptId: string;
  readonly name: string;
  readonly priority: LearningConcept["priority"];
  readonly availableMarks: number;
  readonly earnedMarks: number;
  readonly percentage: number;
  readonly questionsAttempted: number;
  readonly objective: MarkContribution;
  readonly written: MarkContribution;
  readonly hasCriticalIncorrectClaim: boolean;
  readonly strength: ConceptStrength;
}

interface MutablePerformance {
  concept: LearningConcept;
  objectiveAvailable: number;
  objectiveEarned: number;
  writtenAvailable: number;
  writtenEarned: number;
  attemptedQuestionIds: Set<string>;
  critical: boolean;
}

function allocateEqually(value: number, conceptIds: readonly string[]): number {
  return conceptIds.length === 0 ? 0 : value / conceptIds.length;
}

function strengthFor(input: {
  readonly percentage: number;
  readonly priority: LearningConcept["priority"];
  readonly critical: boolean;
}): ConceptStrength {
  if ((input.priority === "high" && input.percentage < 50) || input.critical) return "urgent_priority";
  if (input.percentage >= 80) return "mastered";
  if (input.percentage >= 50) return "developing";
  return "needs_review";
}

export function calculateConceptPerformance(input: {
  readonly concepts: readonly LearningConcept[];
  readonly mcqQuestion: SingleMcqQuestion;
  readonly mcqGrade: McqGrade;
  readonly writtenQuestion: ShortWrittenQuestion;
  readonly writtenEvaluation: WrittenAnswerEvaluation;
}): ConceptPerformance[] {
  const byId = new Map<string, MutablePerformance>(input.concepts.map((concept) => [concept.id, {
    concept,
    objectiveAvailable: 0,
    objectiveEarned: 0,
    writtenAvailable: 0,
    writtenEarned: 0,
    attemptedQuestionIds: new Set<string>(),
    critical: false,
  }]));

  const mcqAvailable = allocateEqually(1, input.mcqQuestion.conceptIds);
  const mcqEarned = allocateEqually(input.mcqGrade.earnedMarks, input.mcqQuestion.conceptIds);
  for (const conceptId of input.mcqQuestion.conceptIds) {
    const record = byId.get(conceptId);
    if (record === undefined) continue;
    record.objectiveAvailable += mcqAvailable;
    record.objectiveEarned += mcqEarned;
    if (input.mcqGrade.status !== "unanswered") record.attemptedQuestionIds.add(input.mcqQuestion.id);
  }

  const resultByCriterion = new Map(input.writtenEvaluation.criterionResults.map((result) => [result.criterionId, result]));
  for (const criterion of input.writtenQuestion.rubric) {
    const result = resultByCriterion.get(criterion.id);
    const available = allocateEqually(criterion.maximumMarks, criterion.requiredConceptIds);
    const earned = allocateEqually(result?.awardedMarks ?? 0, criterion.requiredConceptIds);
    for (const conceptId of criterion.requiredConceptIds) {
      const record = byId.get(conceptId);
      if (record === undefined) continue;
      record.writtenAvailable += available;
      record.writtenEarned += earned;
      if (input.writtenEvaluation.status !== "not_answered") record.attemptedQuestionIds.add(input.writtenQuestion.id);
    }
  }

  // P0 has no model-generated misconception taxonomy. A grounded incorrect claim is conservatively
  // attached only to missing concepts, whose rubric links provide the deterministic concept boundary.
  if (input.writtenEvaluation.incorrectClaims.length > 0) {
    for (const conceptId of input.writtenEvaluation.missingConceptIds) {
      const record = byId.get(conceptId);
      if (record !== undefined) record.critical = true;
    }
  }

  return [...byId.values()]
    .filter((record) => record.objectiveAvailable + record.writtenAvailable > 0)
    .map((record): ConceptPerformance => {
      const availableMarks = record.objectiveAvailable + record.writtenAvailable;
      const earnedMarks = record.objectiveEarned + record.writtenEarned;
      const percentage = availableMarks === 0 ? 0 : Math.round((earnedMarks / availableMarks) * 100);
      return {
        conceptId: record.concept.id,
        name: record.concept.name,
        priority: record.concept.priority,
        availableMarks,
        earnedMarks,
        percentage,
        questionsAttempted: record.attemptedQuestionIds.size,
        objective: { availableMarks: record.objectiveAvailable, earnedMarks: record.objectiveEarned },
        written: { availableMarks: record.writtenAvailable, earnedMarks: record.writtenEarned },
        hasCriticalIncorrectClaim: record.critical,
        strength: strengthFor({ percentage, priority: record.concept.priority, critical: record.critical }),
      };
    });
}

const urgencyOrder: Readonly<Record<ConceptStrength, number>> = {
  urgent_priority: 0,
  needs_review: 1,
  developing: 2,
  mastered: 3,
};
const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

export function weakConcepts(performance: readonly ConceptPerformance[]): ConceptPerformance[] {
  return performance
    .filter((item) => item.strength !== "mastered")
    .toSorted((left, right) =>
      urgencyOrder[left.strength] - urgencyOrder[right.strength] ||
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.percentage - right.percentage ||
      left.name.localeCompare(right.name),
    );
}

export function reconcileAssessmentTotal(input: {
  readonly mcqGrade: McqGrade;
  readonly writtenEvaluation: WrittenAnswerEvaluation;
  readonly performance: readonly ConceptPerformance[];
}): boolean {
  const earned = input.mcqGrade.earnedMarks + input.writtenEvaluation.awardedMarks;
  const available = input.mcqGrade.availableMarks + input.writtenEvaluation.maximumMarks;
  const conceptEarned = input.performance.reduce((sum, item) => sum + item.earnedMarks, 0);
  const conceptAvailable = input.performance.reduce((sum, item) => sum + item.availableMarks, 0);
  return Math.abs(earned - conceptEarned) < 1e-9 && Math.abs(available - conceptAvailable) < 1e-9;
}
