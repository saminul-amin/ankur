import { validateActivitySet, type ActivitySet } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import { ApplicationError } from "../../shared/errors/application-error";
import type { LearningContentGenerationPort } from "../ports/learning-content-port";

function failureMessages(failures: ReturnType<typeof validateActivitySet>): string[] {
  return failures.map((failure) => `${failure.path}: ${failure.reason}`);
}

export class GenerateOneMcq {
  constructor(private readonly generator: LearningContentGenerationPort) {}

  async execute(input: {
    readonly source: ConfirmedSource;
    readonly preparationMap: PreparationMap;
    readonly selectedConceptIds: readonly string[];
    readonly requestId: string;
  }): Promise<ActivitySet> {
    if (input.preparationMap.sourceVersionId !== input.source.sourceVersionId) {
      throw new ApplicationError("SOURCE_VERSION_MISMATCH");
    }
    const availableConceptIds = new Set(input.preparationMap.concepts.map((concept) => concept.id));
    if (
      input.selectedConceptIds.length === 0 ||
      input.selectedConceptIds.some((conceptId) => !availableConceptIds.has(conceptId))
    ) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }

    const first = await this.generator.generateOneMcq(input);
    const firstFailures = validateActivitySet(input.source, input.preparationMap, first);
    if (firstFailures.length === 0) {
      return first;
    }

    const repaired = await this.generator.generateOneMcq({
      ...input,
      repair: {
        invalidArtifact: first,
        validationErrors: failureMessages(firstFailures),
      },
    });
    const repairedFailures = validateActivitySet(input.source, input.preparationMap, repaired);
    if (repairedFailures.length > 0) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }
    return repaired;
  }
}
