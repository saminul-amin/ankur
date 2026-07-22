import type { LearningContentGenerationPort } from "../../application/ports/learning-content-port";
import type { GenerativeModelPort, ThinkingLevel } from "../../application/ports/generative-model-port";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import { ProviderError } from "../../shared/errors/provider-error";
import {
  createMcqCandidateProviderJsonSchema,
  createWrittenQuestionCandidateProviderJsonSchema,
  createWrittenRubricCandidateProviderJsonSchema,
  mcqCandidateProviderSchema,
  preparationMapProviderJsonSchema,
  preparationMapProviderSchema,
  writtenQuestionCandidateProviderSchema,
  writtenRubricCandidateProviderSchema,
} from "../../shared/schemas/learning-content-schemas";
import { buildAnalysisPrompt, buildAssessmentPrompt, LEARNING_PROMPT_VERSIONS, type AssessmentGroundingAssignment } from "./learning-content-prompts";

const PRIMARY_MODEL = "gemma-4-26b-a4b-it" as const;

function artifact(input: {
  readonly result: Awaited<ReturnType<GenerativeModelPort["generateStructured"]>>;
  readonly task: ModelArtifactMetadata["task"];
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly requestId: string;
  readonly thinkingLevel: ThinkingLevel;
}): ModelArtifactMetadata {
  return {
    provider: "gemini_api", modelId: PRIMARY_MODEL, task: input.task,
    promptVersion: input.promptVersion, schemaVersion: input.schemaVersion,
    thinkingLevel: input.thinkingLevel, requestId: input.requestId,
    createdAt: new Date().toISOString(), latencyMs: input.result.metadata.latencyMs,
    repaired: input.result.repaired,
  };
}

export class GemmaLearningContentAdapter implements LearningContentGenerationPort {
  constructor(private readonly model: GenerativeModelPort, private readonly timeoutMs = 90_000) {}

  async generatePreparationMap(input: Parameters<LearningContentGenerationPort["generatePreparationMap"]>[0]): Promise<PreparationMap> {
    const promptVersion = input.repair === undefined ? LEARNING_PROMPT_VERSIONS.analysis : LEARNING_PROMPT_VERSIONS.analysisEvidenceRepair;
    const thinkingLevel = input.repair === undefined ? "minimal" : "high";
    const result = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "preparation-map.v1",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 2_500, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAnalysisPrompt(input) }], outputMode: "native",
      jsonSchema: preparationMapProviderJsonSchema, schema: preparationMapProviderSchema, maxSchemaRepairs: 1,
    });
    const evidence = [{ segmentId: result.value.evidenceSegmentId, quote: result.value.evidenceQuote }];
    return {
      schemaVersion: result.value.schemaVersion, id: `preparation-${input.source.sourceVersionId}`,
      sourceVersionId: result.value.sourceVersionId, title: result.value.title, language: result.value.language, domain: result.value.domain,
      topics: [{ id: result.value.topicId, name: result.value.topicName, priority: result.value.topicPriority, evidence }],
      concepts: [{ id: result.value.conceptId, topicId: result.value.topicId, name: result.value.conceptName, description: result.value.conceptDescription, priority: result.value.conceptPriority, evidence }],
      objectives: [{ id: result.value.objectiveId, description: result.value.objectiveDescription, conceptIds: [result.value.conceptId], evidence }],
      warnings: result.value.warnings,
      artifact: artifact({ result, task: "material_analysis", promptVersion, schemaVersion: "preparation-map.v1", requestId: input.requestId, thinkingLevel }),
    };
  }

  async generateMixedAssessment(input: Parameters<LearningContentGenerationPort["generateMixedAssessment"]>[0]): Promise<ActivitySet> {
    const promptVersion = input.repair === undefined ? LEARNING_PROMPT_VERSIONS.assessment : LEARNING_PROMPT_VERSIONS.assessmentEvidenceRepair;
    const thinkingLevel = input.repair === undefined ? "minimal" : "high";
    const allowedSegmentIds = new Set(input.source.segments.map((segment) => segment.id));
    const selectedConcepts = input.selectedConceptIds.map((conceptId) =>
      input.preparationMap.concepts.find((concept) => concept.id === conceptId),
    );
    if (selectedConcepts.some((concept) => concept === undefined)) throw new ProviderError("INVALID_OUTPUT");
    const groundedConcepts = selectedConcepts.flatMap((concept) => {
      if (concept === undefined) return [];
      const evidence = concept.evidence.find((reference) => allowedSegmentIds.has(reference.segmentId));
      return evidence === undefined ? [] : [{ concept, evidence }];
    });
    if (groundedConcepts.length !== selectedConcepts.length || groundedConcepts.length === 0) {
      throw new ProviderError("INVALID_OUTPUT");
    }
    const assignmentFor = (index: number): AssessmentGroundingAssignment["mcq"] => {
      const grounded = groundedConcepts[index % groundedConcepts.length];
      if (grounded === undefined) throw new ProviderError("INVALID_OUTPUT");
      return {
        conceptId: grounded.concept.id,
        conceptName: grounded.concept.name,
        conceptDescription: grounded.concept.description,
        evidenceSegmentId: grounded.evidence.segmentId,
      };
    };
    const assignment: AssessmentGroundingAssignment = {
      mcq: assignmentFor(0),
      writtenCriteria: [assignmentFor(0), assignmentFor(1), assignmentFor(2)],
    };
    const referenceAnswer = [...new Set(groundedConcepts.map(({ concept }) => concept.description))]
      .join(" ")
      .slice(0, 1_200)
      .trim();
    if (referenceAnswer.length === 0) throw new ProviderError("INVALID_OUTPUT");
    const mcqResult = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "assessment-mcq.v5",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 900, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input, "mcq", assignment) }], outputMode: "native",
      jsonSchema: createMcqCandidateProviderJsonSchema(), schema: mcqCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const writtenQuestionResult = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "assessment-written-question.v5",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 1_800, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input, "written_question", assignment, mcqResult.value.prompt) }], outputMode: "native",
      jsonSchema: createWrittenQuestionCandidateProviderJsonSchema(), schema: writtenQuestionCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const writtenRubricResult = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "assessment-written-rubric.v5",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 1_200, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input, "written_rubric", assignment, referenceAnswer) }], outputMode: "native",
      jsonSchema: createWrittenRubricCandidateProviderJsonSchema(), schema: writtenRubricCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const { optionA, optionB, optionC, optionD } = mcqResult.value;
    const criterionDescription = (
      grounding: AssessmentGroundingAssignment["mcq"],
      providerDescription: string,
    ) => `${grounding.conceptName}: ${grounding.conceptDescription.slice(0, 220)} — ${providerDescription.slice(0, 160)}`.slice(0, 400);
    const rubric = [
      {
        id: "criterion-001", description: criterionDescription(assignment.writtenCriteria[0], writtenRubricResult.value.criterion1Description), maximumMarks: 2,
        requiredConceptIds: [assignment.writtenCriteria[0].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[0].evidenceSegmentId }],
      },
      {
        id: "criterion-002", description: criterionDescription(assignment.writtenCriteria[1], writtenRubricResult.value.criterion2Description), maximumMarks: 2,
        requiredConceptIds: [assignment.writtenCriteria[1].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[1].evidenceSegmentId }],
      },
      {
        id: "criterion-003", description: criterionDescription(assignment.writtenCriteria[2], writtenRubricResult.value.criterion3Description), maximumMarks: 1,
        requiredConceptIds: [assignment.writtenCriteria[2].conceptId], evidence: [{ segmentId: assignment.writtenCriteria[2].evidenceSegmentId }],
      },
    ] as const;
    const writtenConceptIds = [...new Set(rubric.flatMap((criterion) => criterion.requiredConceptIds))];
    const writtenEvidence = [...new Set(rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)))]
      .map((segmentId) => ({ segmentId }));
    const metadata: ModelArtifactMetadata = {
      provider: "gemini_api", modelId: PRIMARY_MODEL, task: "assessment_generation", promptVersion,
      schemaVersion: "activity-set.v2", thinkingLevel, requestId: input.requestId, createdAt: new Date().toISOString(),
      latencyMs: mcqResult.metadata.latencyMs + writtenQuestionResult.metadata.latencyMs + writtenRubricResult.metadata.latencyMs,
      repaired: mcqResult.repaired || writtenQuestionResult.repaired || writtenRubricResult.repaired || input.repair !== undefined,
    };
    return {
      schemaVersion: "activity-set.v2", id: `activity-${input.source.sourceVersionId}`, sourceVersionId: input.source.sourceVersionId,
      title: input.title,
      questions: [
        {
          id: "question-001", type: "single_mcq", sourceVersionId: input.source.sourceVersionId,
          prompt: mcqResult.value.prompt, conceptIds: [assignment.mcq.conceptId], difficulty: input.difficulty, marks: 1,
          explanation: mcqResult.value.explanation,
          options: [
            { id: "A", text: optionA }, { id: "B", text: optionB },
            { id: "C", text: optionC }, { id: "D", text: optionD },
          ],
          correctOptionId: mcqResult.value.correctOptionId, evidence: [{ segmentId: assignment.mcq.evidenceSegmentId }], artifact: metadata,
        },
        {
          id: "question-002", type: "short_written", sourceVersionId: input.source.sourceVersionId,
          prompt: writtenQuestionResult.value.prompt, conceptIds: writtenConceptIds, difficulty: input.difficulty, marks: 5,
          explanation: writtenQuestionResult.value.explanation, expectedLength: writtenQuestionResult.value.expectedLength,
          referenceAnswer, requiredConceptIds: writtenConceptIds,
          evidence: writtenEvidence,
          rubric, artifact: metadata,
        },
      ],
      warnings: [], artifact: metadata,
    };
  }
}
