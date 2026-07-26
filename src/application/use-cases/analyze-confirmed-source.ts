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
    const generated = await this.generator.generatePreparationMap(input);
    const failures = validatePreparationMap(input.source, generated);
    if (failures.length === 0) return generated;
    if (generated.artifact.repaired) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }
    const repaired = await this.generator.generatePreparationMap({
      ...input,
      repair: { invalidArtifact: generated, validationErrors: failureMessages(failures) },
    });
    if (validatePreparationMap(input.source, repaired).length > 0) {
      throw new ApplicationError("EVIDENCE_INVALID");
    }
    return repaired;
  }
}
