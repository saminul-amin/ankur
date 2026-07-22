import type { ModelArtifactMetadata } from "../ai/model-artifact";
import type { EvidenceReference, EvidenceValidationFailure } from "../grounding/evidence";
import { validateEvidence } from "../grounding/evidence";
import type { ConfirmedSource } from "../source/confirmed-source";
import type { ShortWrittenQuestion } from "./mcq";

export type WrittenEvaluationStatus =
  | "correct"
  | "partially_correct"
  | "incorrect"
  | "not_answered"
  | "needs_review";

export type CriterionState = "met" | "partial" | "not_met";

export interface RubricCriterionResult {
  readonly criterionId: string;
  readonly awardedMarks: number;
  readonly maximumMarks: number;
  readonly state: CriterionState;
  readonly reason: string;
}

export interface WrittenAnswerEvaluation {
  readonly schemaVersion: "written-evaluation.v1";
  readonly questionId: string;
  readonly sourceVersionId: string;
  readonly awardedMarks: number;
  readonly maximumMarks: 5;
  readonly status: WrittenEvaluationStatus;
  readonly criterionResults: readonly RubricCriterionResult[];
  readonly coveredConceptIds: readonly string[];
  readonly missingConceptIds: readonly string[];
  readonly incorrectClaims: readonly string[];
  readonly unsupportedClaims: readonly string[];
  readonly feedback: string;
  readonly evidence: readonly EvidenceReference[];
  readonly recommendedRevisionConceptIds: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

export function createEmptyWrittenEvaluation(input: {
  readonly question: ShortWrittenQuestion;
  readonly requestId: string;
  readonly createdAt?: string;
}): WrittenAnswerEvaluation {
  const question = input.question;
  return {
    schemaVersion: "written-evaluation.v1",
    questionId: question.id,
    sourceVersionId: question.sourceVersionId,
    awardedMarks: 0,
    maximumMarks: 5,
    status: "not_answered",
    criterionResults: question.rubric.map((criterion) => ({
      criterionId: criterion.id,
      awardedMarks: 0,
      maximumMarks: criterion.maximumMarks,
      state: "not_met",
      reason: "No answer was submitted for this criterion.",
    })),
    coveredConceptIds: [],
    missingConceptIds: [...new Set(question.requiredConceptIds)],
    incorrectClaims: [],
    unsupportedClaims: [],
    feedback: "No written answer was submitted. Review the source evidence and answer each rubric point next time.",
    evidence: question.evidence,
    recommendedRevisionConceptIds: [...new Set(question.requiredConceptIds)],
    artifact: {
      provider: "gemini_api",
      modelId: "gemma-4-26b-a4b-it",
      task: "written_evaluation",
      promptVersion: "deterministic-empty.v1",
      schemaVersion: "written-evaluation.v1",
      thinkingLevel: "minimal",
      requestId: input.requestId,
      createdAt: input.createdAt ?? new Date().toISOString(),
      latencyMs: 0,
      repaired: false,
    },
  };
}

function invariant(path: string): EvidenceValidationFailure {
  return { path, reason: "INVARIANT_VIOLATION" };
}

function isUnique(values: readonly string[]): boolean {
  return new Set(values).size === values.length;
}

export function validateWrittenEvaluation(
  source: ConfirmedSource,
  question: ShortWrittenQuestion,
  evaluation: WrittenAnswerEvaluation,
): EvidenceValidationFailure[] {
  const failures: EvidenceValidationFailure[] = [];
  const maximumMarks: unknown = Reflect.get(evaluation, "maximumMarks");
  if (
    evaluation.questionId !== question.id ||
    evaluation.sourceVersionId !== question.sourceVersionId ||
    evaluation.sourceVersionId !== source.sourceVersionId ||
    maximumMarks !== 5 ||
    evaluation.awardedMarks < 0 ||
    evaluation.awardedMarks > 5
  ) {
    failures.push(invariant("evaluation.identity"));
  }

  const rubricById = new Map(question.rubric.map((criterion) => [criterion.id, criterion]));
  if (
    evaluation.criterionResults.length !== question.rubric.length ||
    new Set(evaluation.criterionResults.map((result) => result.criterionId)).size !== question.rubric.length
  ) {
    failures.push(invariant("criterionResults"));
  }
  for (const [index, result] of evaluation.criterionResults.entries()) {
    const criterion = rubricById.get(result.criterionId);
    const stateMatchesMarks = result.state === "met"
      ? result.awardedMarks === result.maximumMarks
      : result.state === "partial"
        ? result.awardedMarks > 0 && result.awardedMarks < result.maximumMarks
        : result.awardedMarks === 0;
    if (
      criterion === undefined ||
      result.maximumMarks !== criterion.maximumMarks ||
      result.awardedMarks < 0 ||
      result.awardedMarks > result.maximumMarks ||
      !stateMatchesMarks ||
      result.reason.trim().length === 0 ||
      result.reason.length > 400
    ) {
      failures.push(invariant(`criterionResults[${String(index)}]`));
    }
  }
  const criterionTotal = evaluation.criterionResults.reduce((sum, result) => sum + result.awardedMarks, 0);
  if (Math.abs(criterionTotal - evaluation.awardedMarks) > Number.EPSILON) {
    failures.push(invariant("awardedMarks"));
  }

  const allowedConceptIds = new Set(question.requiredConceptIds);
  const conceptLists = [
    evaluation.coveredConceptIds,
    evaluation.missingConceptIds,
    evaluation.recommendedRevisionConceptIds,
  ];
  if (conceptLists.some((ids) => !isUnique(ids) || ids.some((id) => !allowedConceptIds.has(id)))) {
    failures.push({ path: "conceptIds", reason: "UNKNOWN_CONCEPT" });
  }
  if (evaluation.coveredConceptIds.some((id) => evaluation.missingConceptIds.includes(id))) {
    failures.push(invariant("coveredConceptIds"));
  }
  const classifiedConceptIds = new Set([...evaluation.coveredConceptIds, ...evaluation.missingConceptIds]);
  if ([...allowedConceptIds].some((id) => !classifiedConceptIds.has(id))) {
    failures.push(invariant("missingConceptIds"));
  }
  if (evaluation.feedback.trim().length === 0 || evaluation.feedback.length > 800) failures.push(invariant("feedback"));
  if (
    evaluation.incorrectClaims.some((claim) => claim.trim().length === 0 || claim.length > 500) ||
    evaluation.unsupportedClaims.some((claim) => claim.trim().length === 0 || claim.length > 500)
  ) {
    failures.push(invariant("claims"));
  }

  const statusMatchesMarks = evaluation.status === "correct"
    ? evaluation.awardedMarks === 5
    : evaluation.status === "partially_correct"
      ? evaluation.awardedMarks > 0 && evaluation.awardedMarks < 5
      : evaluation.status === "incorrect"
        ? evaluation.awardedMarks === 0
        : evaluation.status === "not_answered"
          ? evaluation.awardedMarks === 0
          : true;
  if (!statusMatchesMarks) failures.push(invariant("status"));

  const allowedEvidenceIds = new Set([
    ...question.evidence.map((reference) => reference.segmentId),
    ...question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
  ]);
  if (evaluation.evidence.some((reference) => !allowedEvidenceIds.has(reference.segmentId))) {
    failures.push({ path: "evidence", reason: "UNKNOWN_SEGMENT" });
  }
  if (evaluation.evidence.length === 0) failures.push({ path: "evidence", reason: "EVIDENCE_REQUIRED" });
  failures.push(...validateEvidence(source, evaluation.evidence, "evidence"));
  return failures;
}
