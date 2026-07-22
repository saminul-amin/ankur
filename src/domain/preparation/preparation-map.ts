import type { ModelArtifactMetadata } from "../ai/model-artifact";
import type { EvidenceReference, EvidenceValidationFailure } from "../grounding/evidence";
import { validateEvidence } from "../grounding/evidence";
import type { ConfirmedSource, SourceLanguage } from "../source/confirmed-source";

export interface Topic {
  readonly id: string;
  readonly name: string;
  readonly priority: "high" | "medium" | "low";
  readonly evidence: readonly EvidenceReference[];
}

export interface LearningConcept {
  readonly id: string;
  readonly topicId: string;
  readonly name: string;
  readonly description: string;
  readonly priority: "high" | "medium" | "low";
  readonly evidence: readonly EvidenceReference[];
}

export interface LearningObjective {
  readonly id: string;
  readonly description: string;
  readonly conceptIds: readonly string[];
  readonly evidence: readonly EvidenceReference[];
}

export interface PreparationMap {
  readonly schemaVersion: "preparation-map.v1";
  readonly id: string;
  readonly sourceVersionId: string;
  readonly title: string;
  readonly language: SourceLanguage;
  readonly domain: string;
  readonly topics: readonly Topic[];
  readonly concepts: readonly LearningConcept[];
  readonly objectives: readonly LearningObjective[];
  readonly warnings: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

export function validatePreparationMap(
  source: ConfirmedSource,
  map: PreparationMap,
): EvidenceValidationFailure[] {
  const failures: EvidenceValidationFailure[] = [];
  if (map.sourceVersionId !== source.sourceVersionId) {
    failures.push({ path: "sourceVersionId", reason: "UNKNOWN_SEGMENT" });
  }
  const topicIds = new Set(map.topics.map((topic) => topic.id));
  const conceptIds = new Set(map.concepts.map((concept) => concept.id));
  for (const [index, topic] of map.topics.entries()) {
    failures.push(...validateEvidence(source, topic.evidence, `topics[${String(index)}].evidence`));
  }
  for (const [index, concept] of map.concepts.entries()) {
    if (!topicIds.has(concept.topicId)) {
      failures.push({ path: `concepts[${String(index)}].topicId`, reason: "UNKNOWN_SEGMENT" });
    }
    failures.push(...validateEvidence(source, concept.evidence, `concepts[${String(index)}].evidence`));
  }
  for (const [index, objective] of map.objectives.entries()) {
    if (objective.conceptIds.some((conceptId) => !conceptIds.has(conceptId))) {
      failures.push({ path: `objectives[${String(index)}].conceptIds`, reason: "UNKNOWN_SEGMENT" });
    }
    failures.push(
      ...validateEvidence(source, objective.evidence, `objectives[${String(index)}].evidence`),
    );
  }
  return failures;
}
