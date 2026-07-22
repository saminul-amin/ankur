import type { ActivitySet, AssessmentDifficulty } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";

export interface EvidenceRepairContext<T> {
  readonly invalidArtifact: T;
  readonly validationErrors: readonly string[];
}

export interface LearningContentGenerationPort {
  generatePreparationMap(input: {
    readonly source: ConfirmedSource;
    readonly requestId: string;
    readonly repair?: EvidenceRepairContext<PreparationMap>;
  }): Promise<PreparationMap>;

  generateMixedAssessment(input: {
    readonly source: ConfirmedSource;
    readonly preparationMap: PreparationMap;
    readonly selectedConceptIds: readonly string[];
    readonly title: string;
    readonly difficulty: AssessmentDifficulty;
    readonly requestId: string;
    readonly repair?: EvidenceRepairContext<ActivitySet>;
  }): Promise<ActivitySet>;
}
