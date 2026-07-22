import type { ModelArtifactMetadata } from "../ai/model-artifact";
import type { EvidenceReference, EvidenceValidationFailure } from "../grounding/evidence";
import { validateEvidence } from "../grounding/evidence";
import type { PreparationMap } from "../preparation/preparation-map";
import type { ConfirmedSource } from "../source/confirmed-source";
import { normalizeSourceText } from "../source/confirmed-source";

export interface McqOption {
  readonly id: string;
  readonly text: string;
}

export interface SingleMcqQuestion {
  readonly id: string;
  readonly type: "single_mcq";
  readonly prompt: string;
  readonly conceptIds: readonly string[];
  readonly difficulty: "easy" | "medium" | "hard";
  readonly marks: 1;
  readonly explanation: string;
  readonly options: readonly [McqOption, McqOption, McqOption, McqOption];
  readonly correctOptionId: string;
  readonly evidence: readonly EvidenceReference[];
}

export interface ActivitySet {
  readonly schemaVersion: "activity-set.v1";
  readonly id: string;
  readonly sourceVersionId: string;
  readonly title: string;
  readonly questions: readonly [SingleMcqQuestion];
  readonly warnings: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

export interface McqGrade {
  readonly correct: boolean;
  readonly earnedMarks: 0 | 1;
  readonly availableMarks: 1;
  readonly selectedOptionId: string;
  readonly correctOptionId: string;
}

export function validateActivitySet(
  source: ConfirmedSource,
  preparationMap: PreparationMap,
  activitySet: ActivitySet,
): EvidenceValidationFailure[] {
  const failures: EvidenceValidationFailure[] = [];
  if (activitySet.sourceVersionId !== source.sourceVersionId) {
    failures.push({ path: "sourceVersionId", reason: "UNKNOWN_SEGMENT" });
  }
  const question = activitySet.questions[0];
  const optionTexts = question.options.map((option) => normalizeSourceText(option.text).toLocaleLowerCase());
  const optionIds = new Set(question.options.map((option) => option.id));
  if (new Set(optionTexts).size !== 4 || optionIds.size !== 4 || !optionIds.has(question.correctOptionId)) {
    failures.push({ path: "questions[0].options", reason: "EVIDENCE_REQUIRED" });
  }
  const conceptIds = new Set(preparationMap.concepts.map((concept) => concept.id));
  if (question.conceptIds.length === 0 || question.conceptIds.some((id) => !conceptIds.has(id))) {
    failures.push({ path: "questions[0].conceptIds", reason: "UNKNOWN_SEGMENT" });
  }
  failures.push(...validateEvidence(source, question.evidence, "questions[0].evidence"));
  return failures;
}

export function gradeMcq(question: SingleMcqQuestion, selectedOptionId: string): McqGrade {
  const optionExists = question.options.some((option) => option.id === selectedOptionId);
  if (!optionExists) {
    throw new Error("Selected option does not exist.");
  }
  const correct = selectedOptionId === question.correctOptionId;
  return {
    correct,
    earnedMarks: correct ? 1 : 0,
    availableMarks: 1,
    selectedOptionId,
    correctOptionId: question.correctOptionId,
  };
}
