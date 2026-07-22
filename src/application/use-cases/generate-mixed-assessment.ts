import { validateActivitySet, type ActivitySet, type AssessmentDifficulty } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import { ApplicationError } from "../../shared/errors/application-error";
import type { LearningContentGenerationPort } from "../ports/learning-content-port";

function failureMessages(failures: ReturnType<typeof validateActivitySet>): string[] {
  return failures.map((failure) => `${failure.path}: ${failure.reason}`);
}

function configurationFailures(input: {
  readonly activitySet: ActivitySet;
  readonly selectedConceptIds: readonly string[];
  readonly title: string;
  readonly difficulty: AssessmentDifficulty;
}): ReturnType<typeof validateActivitySet> {
  const selected = new Set(input.selectedConceptIds);
  const failures: ReturnType<typeof validateActivitySet> = [];
  if (input.activitySet.title !== input.title) failures.push({ path: "title", reason: "INVARIANT_VIOLATION" });
  for (const [index, question] of input.activitySet.questions.entries()) {
    if (question.difficulty !== input.difficulty) failures.push({ path: `questions[${String(index)}].difficulty`, reason: "INVARIANT_VIOLATION" });
    if (question.conceptIds.some((conceptId) => !selected.has(conceptId))) {
      failures.push({ path: `questions[${String(index)}].conceptIds`, reason: "UNKNOWN_CONCEPT" });
    }
  }
  return failures;
}

export class GenerateMixedAssessment {
  constructor(private readonly generator: LearningContentGenerationPort) {}

  async execute(input: {
    readonly source: ConfirmedSource;
    readonly preparationMap: PreparationMap;
    readonly selectedConceptIds: readonly string[];
    readonly title: string;
    readonly difficulty: AssessmentDifficulty;
    readonly requestId: string;
  }): Promise<ActivitySet> {
    if (input.preparationMap.sourceVersionId !== input.source.sourceVersionId) {
      throw new ApplicationError("SOURCE_VERSION_MISMATCH");
    }
    const availableConceptIds = new Set(input.preparationMap.concepts.map((concept) => concept.id));
    if (
      input.title.trim().length === 0 ||
      input.title.length > 160 ||
      input.selectedConceptIds.length === 0 ||
      new Set(input.selectedConceptIds).size !== input.selectedConceptIds.length ||
      input.selectedConceptIds.some((conceptId) => !availableConceptIds.has(conceptId))
    ) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }

    const first = await this.generator.generateMixedAssessment(input);
    const firstFailures = [
      ...validateActivitySet(input.source, input.preparationMap, first),
      ...configurationFailures({ activitySet: first, selectedConceptIds: input.selectedConceptIds, title: input.title, difficulty: input.difficulty }),
    ];
    if (firstFailures.length === 0) return first;

    const repaired = await this.generator.generateMixedAssessment({
      ...input,
      repair: { invalidArtifact: first, validationErrors: failureMessages(firstFailures) },
    });
    const repairedFailures = [
      ...validateActivitySet(input.source, input.preparationMap, repaired),
      ...configurationFailures({ activitySet: repaired, selectedConceptIds: input.selectedConceptIds, title: input.title, difficulty: input.difficulty }),
    ];
    if (repairedFailures.length > 0) {
      const isEvidenceFailure = repairedFailures.some((failure) =>
        failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "QUOTE_NOT_FOUND" || failure.reason === "EVIDENCE_REQUIRED",
      );
      throw new ApplicationError(isEvidenceFailure ? "EVIDENCE_INVALID" : "MODEL_OUTPUT_INVALID");
    }
    return repaired;
  }
}
