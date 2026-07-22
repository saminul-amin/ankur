import {
  calculateConceptPerformance,
  reconcileAssessmentTotal,
  type ConceptPerformance,
} from "../../domain/assessments/concept-performance";
import { gradeMcq, validateActivitySet, type ActivitySet, type McqGrade } from "../../domain/assessments/mcq";
import {
  validateWrittenEvaluation,
  type WrittenAnswerEvaluation,
} from "../../domain/assessments/written-evaluation";
import { validatePreparationMap, type PreparationMap } from "../../domain/preparation/preparation-map";
import {
  selectRevisionTargets,
  validateRevisionPlan,
  type RevisionPlan,
} from "../../domain/revision/revision-plan";
import { rehydrateEvidenceWindow, type ConfirmedSource } from "../../domain/source/confirmed-source";
import { ApplicationError } from "../../shared/errors/application-error";
import {
  revisionExpectedCategory,
  sanitizeRevisionFieldPath,
  type RevisionDiagnosticObserver,
} from "../diagnostics/revision-validation-diagnostic";
import type { RevisionGenerationPort } from "../ports/revision-generation-port";

function failureMessages(failures: ReturnType<typeof validateRevisionPlan>): string[] {
  return failures.map((failure) => `${failure.path}: ${failure.reason}`);
}

function evidenceFailure(failures: ReturnType<typeof validateRevisionPlan>): boolean {
  return failures.some((failure) =>
    failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "QUOTE_NOT_FOUND" || failure.reason === "EVIDENCE_REQUIRED",
  );
}

function samePerformance(
  expected: readonly ConceptPerformance[],
  received: readonly ConceptPerformance[],
): boolean {
  if (expected.length !== received.length) return false;
  const byId = new Map(received.map((item) => [item.conceptId, item]));
  return expected.every((item) => {
    const candidate = byId.get(item.conceptId);
    return candidate !== undefined &&
      candidate.name === item.name &&
      candidate.priority === item.priority &&
      candidate.availableMarks === item.availableMarks &&
      candidate.earnedMarks === item.earnedMarks &&
      candidate.percentage === item.percentage &&
      candidate.questionsAttempted === item.questionsAttempted &&
      candidate.objective.availableMarks === item.objective.availableMarks &&
      candidate.objective.earnedMarks === item.objective.earnedMarks &&
      candidate.written.availableMarks === item.written.availableMarks &&
      candidate.written.earnedMarks === item.written.earnedMarks &&
      candidate.hasCriticalIncorrectClaim === item.hasCriticalIncorrectClaim &&
      candidate.strength === item.strength;
  });
}

export class GeneratePersonalizedRevision {
  constructor(
    private readonly generator: RevisionGenerationPort,
    private readonly diagnosticObserver?: RevisionDiagnosticObserver,
  ) {}

  private recordFailures(input: {
    readonly failures: ReturnType<typeof validateRevisionPlan>;
    readonly plan: RevisionPlan;
    readonly source: ConfirmedSource;
    readonly targetConceptCount: number;
    readonly phase: "first_pass" | "repair";
  }): void {
    const responseCharacterCount = JSON.stringify(input.plan).length;
    const permittedEvidenceCharacterCount = input.source.segments.reduce((sum, segment) => sum + segment.text.length, 0);
    for (const failure of input.failures) {
      this.diagnosticObserver?.({
        modelId: input.plan.artifact.modelId,
        promptVersion: input.plan.artifact.promptVersion,
        schemaVersion: input.plan.schemaVersion,
        sourceVersionId: input.source.sourceVersionId,
        targetConceptCount: input.targetConceptCount,
        permittedEvidenceSegmentCount: input.source.segments.length,
        permittedEvidenceCharacterCount,
        phase: input.phase,
        validationCode: failure.reason,
        fieldPath: sanitizeRevisionFieldPath(failure.path),
        expected: revisionExpectedCategory(failure.reason),
        responseCharacterCount,
        latencyMs: input.plan.artifact.latencyMs,
        repairAttempted: true,
      });
    }
  }

  async execute(input: {
    readonly source: ConfirmedSource;
    readonly preparationMap: PreparationMap;
    readonly originalActivity: ActivitySet;
    readonly originalResultId: string;
    readonly originalMcqGrade: McqGrade;
    readonly performance: readonly ConceptPerformance[];
    readonly writtenEvaluation: WrittenAnswerEvaluation;
    readonly requestId: string;
  }): Promise<RevisionPlan> {
    if (
      input.preparationMap.sourceVersionId !== input.source.sourceVersionId ||
      input.originalActivity.sourceVersionId !== input.source.sourceVersionId ||
      input.writtenEvaluation.sourceVersionId !== input.source.sourceVersionId ||
      input.writtenEvaluation.questionId !== input.originalActivity.questions[1].id
    ) throw new ApplicationError("SOURCE_VERSION_MISMATCH");
    if (
      input.originalResultId !== `result-${input.originalActivity.id}` ||
      validatePreparationMap(input.source, input.preparationMap).length > 0 ||
      validateActivitySet(input.source, input.preparationMap, input.originalActivity).length > 0
    ) throw new ApplicationError("MODEL_OUTPUT_INVALID");

    const expectedMcqGrade = gradeMcq(
      input.originalActivity.questions[0],
      input.originalMcqGrade.selectedOptionId,
    );
    if (
      expectedMcqGrade.status !== input.originalMcqGrade.status ||
      expectedMcqGrade.correct !== input.originalMcqGrade.correct ||
      expectedMcqGrade.earnedMarks !== input.originalMcqGrade.earnedMarks ||
      expectedMcqGrade.correctOptionId !== input.originalMcqGrade.correctOptionId ||
      expectedMcqGrade.selectedOptionId !== input.originalMcqGrade.selectedOptionId ||
      validateWrittenEvaluation(input.source, input.originalActivity.questions[1], input.writtenEvaluation).length > 0
    ) throw new ApplicationError("MODEL_OUTPUT_INVALID");

    const performance = calculateConceptPerformance({
      concepts: input.preparationMap.concepts,
      mcqQuestion: input.originalActivity.questions[0],
      mcqGrade: expectedMcqGrade,
      writtenQuestion: input.originalActivity.questions[1],
      writtenEvaluation: input.writtenEvaluation,
    });
    if (
      !reconcileAssessmentTotal({
        mcqGrade: expectedMcqGrade,
        writtenEvaluation: input.writtenEvaluation,
        performance,
      }) ||
      !samePerformance(performance, input.performance)
    ) throw new ApplicationError("MODEL_OUTPUT_INVALID");

    const selection = selectRevisionTargets({
      preparationMap: input.preparationMap,
      performance,
      writtenEvaluation: input.writtenEvaluation,
    });
    if (selection.targetConceptIds.length === 0) throw new ApplicationError("MODEL_OUTPUT_INVALID");
    const conceptById = new Map(input.preparationMap.concepts.map((concept) => [concept.id, concept]));
    const performanceIds = new Set(performance.map((item) => item.conceptId));
    if (selection.targetConceptIds.some((id) => !conceptById.has(id) || !performanceIds.has(id))) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }
    const authorizedIds = new Set(selection.targetConceptIds.flatMap((id) =>
      conceptById.get(id)?.evidence.map((reference) => reference.segmentId) ?? [],
    ));
    const segments = input.source.segments
      .filter((segment) => authorizedIds.has(segment.id))
      .map(({ id, pageNumber, text }) => ({ id, pageNumber, text }));
    if (segments.length === 0 || authorizedIds.size !== new Set(segments.map((segment) => segment.id)).size) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }
    const evidenceWindow = rehydrateEvidenceWindow({
      sourceVersionId: input.source.sourceVersionId,
      language: input.source.language,
      segments,
    });
    const generationInput = { ...input, source: evidenceWindow, performance, selection };
    const first = await this.generator.generateRevisionPlan(generationInput);
    const firstFailures = validateRevisionPlan({
      source: evidenceWindow,
      preparationMap: input.preparationMap,
      originalActivity: input.originalActivity,
      originalResultId: input.originalResultId,
      expectedSelection: selection,
      writtenEvaluation: input.writtenEvaluation,
      plan: first,
    });
    if (firstFailures.length === 0) return first;
    this.recordFailures({
      failures: firstFailures,
      plan: first,
      source: evidenceWindow,
      targetConceptCount: selection.targetConceptIds.length,
      phase: "first_pass",
    });

    const repaired = await this.generator.generateRevisionPlan({
      ...generationInput,
      repair: { invalidArtifact: first, validationErrors: failureMessages(firstFailures) },
    });
    const repairedFailures = validateRevisionPlan({
      source: evidenceWindow,
      preparationMap: input.preparationMap,
      originalActivity: input.originalActivity,
      originalResultId: input.originalResultId,
      expectedSelection: selection,
      writtenEvaluation: input.writtenEvaluation,
      plan: repaired,
    });
    if (repairedFailures.length > 0) {
      this.recordFailures({
        failures: repairedFailures,
        plan: repaired,
        source: evidenceWindow,
        targetConceptCount: selection.targetConceptIds.length,
        phase: "repair",
      });
      throw new ApplicationError(evidenceFailure(repairedFailures) ? "EVIDENCE_INVALID" : "MODEL_OUTPUT_INVALID");
    }
    return repaired;
  }
}
