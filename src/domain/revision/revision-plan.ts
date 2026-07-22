import type { ModelArtifactMetadata } from "../ai/model-artifact";
import type { ConceptPerformance } from "../assessments/concept-performance";
import { weakConcepts } from "../assessments/concept-performance";
import type { ActivitySet } from "../assessments/mcq";
import { promptsMateriallyEquivalent, validateActivitySet } from "../assessments/mcq";
import type { WrittenAnswerEvaluation } from "../assessments/written-evaluation";
import type { EvidenceReference, EvidenceValidationFailure } from "../grounding/evidence";
import { validateEvidence } from "../grounding/evidence";
import type { PreparationMap } from "../preparation/preparation-map";
import type { ConfirmedSource } from "../source/confirmed-source";
import { normalizeSourceText } from "../source/confirmed-source";

export type RetryMode = "weak_area" | "reinforcement" | "challenge";

export interface RevisionTargetSelection {
  readonly mode: RetryMode;
  readonly targetConceptIds: readonly string[];
}

export interface RevisionItem {
  readonly id: string;
  readonly conceptId: string;
  readonly learnerIssueSummary: string;
  readonly correctedConcept: string;
  readonly explanation: string;
  readonly importantFact: string;
  readonly memoryAid: string;
  readonly modelAnswerOutline: string;
  readonly evidence: readonly EvidenceReference[];
  readonly linkedClaims: readonly string[];
}

export interface RevisionPlan {
  readonly schemaVersion: "revision-plan.v1";
  readonly id: string;
  readonly sourceVersionId: string;
  readonly originalActivitySetId: string;
  readonly originalResultId: string;
  readonly retryMode: RetryMode;
  readonly targetConceptIds: readonly string[];
  readonly items: readonly RevisionItem[];
  readonly retryActivity: ActivitySet;
  readonly warnings: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

const priorityOrder = { high: 0, medium: 1, low: 2 } as const;

function rankedDeveloping(performance: readonly ConceptPerformance[]): ConceptPerformance[] {
  return performance
    .filter((item) => item.strength === "developing")
    .toSorted((left, right) =>
      left.percentage - right.percentage ||
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.name.localeCompare(right.name),
    );
}

export function selectRevisionTargets(input: {
  readonly preparationMap: PreparationMap;
  readonly performance: readonly ConceptPerformance[];
  readonly writtenEvaluation: WrittenAnswerEvaluation;
  readonly maximumTargets?: number;
}): RevisionTargetSelection {
  const maximumTargets = Math.max(1, Math.min(input.maximumTargets ?? 3, 3));
  const conceptIds = new Set(input.preparationMap.concepts.map((concept) => concept.id));
  const assessed = input.performance.filter((item) => conceptIds.has(item.conceptId));
  const urgentOrNeeds = weakConcepts(assessed).filter((item) =>
    item.strength === "urgent_priority" || item.strength === "needs_review",
  );
  const signalled = new Set([
    ...input.writtenEvaluation.missingConceptIds,
    ...input.writtenEvaluation.recommendedRevisionConceptIds,
  ]);

  if (urgentOrNeeds.length > 0) {
    const baseline = weakConcepts(assessed).filter((item) => item.strength !== "mastered");
    const rank = new Map(baseline.map((item, index) => [item.conceptId, index]));
    const ordered = baseline
      .toSorted((left, right) =>
        Number(signalled.has(right.conceptId)) - Number(signalled.has(left.conceptId)) ||
        (rank.get(left.conceptId) ?? 0) - (rank.get(right.conceptId) ?? 0),
      );
    return { mode: "weak_area", targetConceptIds: ordered.slice(0, maximumTargets).map((item) => item.conceptId) };
  }

  const developing = rankedDeveloping(assessed);
  if (developing.length > 0) {
    return { mode: "reinforcement", targetConceptIds: developing.slice(0, 1).map((item) => item.conceptId) };
  }

  const mastered = assessed
    .filter((item) => item.strength === "mastered")
    .toSorted((left, right) =>
      left.percentage - right.percentage ||
      priorityOrder[left.priority] - priorityOrder[right.priority] ||
      left.name.localeCompare(right.name),
    );
  return { mode: "challenge", targetConceptIds: mastered.slice(0, 1).map((item) => item.conceptId) };
}

function invariant(path: string): EvidenceValidationFailure {
  return { path, reason: "INVARIANT_VIOLATION" };
}

function normalizedOptionOrder(activity: ActivitySet): readonly string[] {
  return activity.questions[0].options.map((option) => normalizeSourceText(option.text).toLocaleLowerCase());
}

export function validateRevisionPlan(input: {
  readonly source: ConfirmedSource;
  readonly preparationMap: PreparationMap;
  readonly originalActivity: ActivitySet;
  readonly originalResultId: string;
  readonly expectedSelection: RevisionTargetSelection;
  readonly writtenEvaluation: WrittenAnswerEvaluation;
  readonly plan: RevisionPlan;
}): EvidenceValidationFailure[] {
  const failures: EvidenceValidationFailure[] = [];
  const { plan } = input;
  if (
    plan.sourceVersionId !== input.source.sourceVersionId ||
    plan.originalActivitySetId !== input.originalActivity.id ||
    plan.originalResultId !== input.originalResultId ||
    plan.retryMode !== input.expectedSelection.mode ||
    plan.artifact.task !== "revision_generation"
  ) failures.push(invariant("identity"));

  const expectedIds = input.expectedSelection.targetConceptIds;
  if (
    expectedIds.length === 0 ||
    plan.targetConceptIds.length !== expectedIds.length ||
    plan.targetConceptIds.some((id, index) => id !== expectedIds[index]) ||
    new Set(plan.targetConceptIds).size !== plan.targetConceptIds.length
  ) failures.push({ path: "targetConceptIds", reason: "UNKNOWN_CONCEPT" });

  const concepts = new Map(input.preparationMap.concepts.map((concept) => [concept.id, concept]));
  const allowedClaims = new Set([
    ...input.writtenEvaluation.incorrectClaims,
    ...input.writtenEvaluation.unsupportedClaims,
  ]);
  if (plan.items.length !== expectedIds.length) failures.push(invariant("items"));
  const normalizedItems = new Set<string>();
  for (const [index, item] of plan.items.entries()) {
    const path = `items[${String(index)}]`;
    const expectedConceptId = expectedIds[index];
    const concept = concepts.get(item.conceptId);
    if (concept === undefined || item.conceptId !== expectedConceptId || item.id !== `revision-item-${String(index + 1).padStart(3, "0")}`) {
      failures.push({ path: `${path}.conceptId`, reason: "UNKNOWN_CONCEPT" });
      continue;
    }
    if (
      item.learnerIssueSummary.trim().length === 0 || item.learnerIssueSummary.length > 400 ||
      item.correctedConcept !== concept.description ||
      item.explanation !== concept.description ||
      item.importantFact.trim().length === 0 || item.importantFact.length > 600 ||
      !item.memoryAid.startsWith("Memory aid (not evidence): ") || item.memoryAid.length > 300 ||
      item.modelAnswerOutline !== `Use this source-backed point: ${concept.description}` ||
      item.linkedClaims.some((claim) => !allowedClaims.has(claim))
    ) failures.push(invariant(path));

    const authorizedIds = new Set(concept.evidence.map((reference) => reference.segmentId));
    if (item.evidence.length === 0 || item.evidence.some((reference) => !authorizedIds.has(reference.segmentId))) {
      failures.push({ path: `${path}.evidence`, reason: "UNKNOWN_SEGMENT" });
    }
    failures.push(...validateEvidence(input.source, item.evidence, `${path}.evidence`));
    const importantFact = normalizeSourceText(item.importantFact);
    const factSupported = item.evidence.some((reference) => {
      const segment = input.source.segments.find((candidate) => candidate.id === reference.segmentId);
      return segment !== undefined && normalizeSourceText(segment.text).includes(importantFact);
    });
    if (!factSupported) failures.push({ path: `${path}.importantFact`, reason: "QUOTE_NOT_FOUND" });

    const fingerprint = normalizeSourceText(`${item.correctedConcept} ${item.importantFact}`).toLocaleLowerCase();
    if (normalizedItems.has(fingerprint)) failures.push({ path, reason: "DUPLICATE_PROMPT" });
    normalizedItems.add(fingerprint);
  }

  failures.push(...validateActivitySet(input.source, input.preparationMap, plan.retryActivity)
    .map((failure) => ({ ...failure, path: `retryActivity.${failure.path}` })));
  const targetIds = new Set(plan.targetConceptIds);
  for (const [index, question] of plan.retryActivity.questions.entries()) {
    if (question.conceptIds.some((conceptId) => !targetIds.has(conceptId))) {
      failures.push({ path: `retryActivity.questions[${String(index)}].conceptIds`, reason: "UNKNOWN_CONCEPT" });
    }
    if (input.originalActivity.questions.some((originalQuestion) => promptsMateriallyEquivalent(question.prompt, originalQuestion.prompt))) {
      failures.push({ path: `retryActivity.questions[${String(index)}].prompt`, reason: "DUPLICATE_PROMPT" });
    }
  }
  if (
    normalizedOptionOrder(plan.retryActivity).every((value, index) => value === normalizedOptionOrder(input.originalActivity)[index])
  ) failures.push({ path: "retryActivity.questions[0].options", reason: "DUPLICATE_PROMPT" });
  if (
    plan.retryActivity.id === input.originalActivity.id ||
    plan.retryActivity.questions.some((question, index) => question.id === input.originalActivity.questions[index]?.id)
  ) failures.push(invariant("retryActivity.identity"));
  return failures;
}
