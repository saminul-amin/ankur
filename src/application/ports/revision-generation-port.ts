import type { ConceptPerformance } from "../../domain/assessments/concept-performance";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { RevisionPlan, RevisionTargetSelection } from "../../domain/revision/revision-plan";
import type { ConfirmedSource } from "../../domain/source/confirmed-source";
import type { EvidenceRepairContext } from "./learning-content-port";

export interface RevisionGenerationPort {
  generateRevisionPlan(input: {
    readonly source: ConfirmedSource;
    readonly preparationMap: PreparationMap;
    readonly originalActivity: ActivitySet;
    readonly originalResultId: string;
    readonly performance: readonly ConceptPerformance[];
    readonly writtenEvaluation: WrittenAnswerEvaluation;
    readonly selection: RevisionTargetSelection;
    readonly requestId: string;
    readonly repair?: EvidenceRepairContext<RevisionPlan>;
  }): Promise<RevisionPlan>;
}
