import { validatePreparationMap, type PreparationMap } from "../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import { ApplicationError } from "../../shared/errors/application-error";
import type { LearningContentGenerationPort } from "../ports/learning-content-port";

function failureMessages(failures: ReturnType<typeof validatePreparationMap>): string[] {
  return failures.map((failure) => `${failure.path}: ${failure.reason}`);
}

export class AnalyzeConfirmedSource {
  constructor(private readonly generator: LearningContentGenerationPort) {}

  async execute(input: {
    readonly source: ConfirmedSource;
    readonly requestId: string;
  }): Promise<PreparationMap> {
    const first = await this.generator.generatePreparationMap(input);
    const firstFailures = validatePreparationMap(input.source, first);
    if (firstFailures.length === 0) {
      return first;
    }

    const repaired = await this.generator.generatePreparationMap({
      ...input,
      repair: {
        invalidArtifact: first,
        validationErrors: failureMessages(firstFailures),
      },
    });
    const repairedFailures = validatePreparationMap(input.source, repaired);
    if (repairedFailures.length > 0) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }
    return repaired;
  }
}
