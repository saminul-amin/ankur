import type { LearningContentGenerationPort } from "../../application/ports/learning-content-port";
import type { GenerativeModelPort, ThinkingLevel } from "../../application/ports/generative-model-port";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import {
  mcqCandidateProviderJsonSchema,
  mcqCandidateProviderSchema,
  preparationMapProviderJsonSchema,
  preparationMapProviderSchema,
  writtenCandidateProviderJsonSchema,
  writtenCandidateProviderSchema,
} from "../../shared/schemas/learning-content-schemas";
import { ProviderError } from "../../shared/errors/provider-error";
import { buildAnalysisPrompt, buildAssessmentPrompt, LEARNING_PROMPT_VERSIONS } from "./learning-content-prompts";

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
    const mcqResult = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "assessment-mcq.v2",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 1_800, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input, "mcq") }], outputMode: "native",
      jsonSchema: mcqCandidateProviderJsonSchema, schema: mcqCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const writtenResult = await this.model.generateStructured({
      task: "structured_generation", modelId: PRIMARY_MODEL, promptVersion, schemaVersion: "assessment-written.v2",
      thinkingLevel, temperature: 0.1, maxOutputTokens: 3_200, timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input, "written") }], outputMode: "native",
      jsonSchema: writtenCandidateProviderJsonSchema, schema: writtenCandidateProviderSchema, maxSchemaRepairs: 1,
    });
    const optionA = mcqResult.value.options[0];
    const optionB = mcqResult.value.options[1];
    const optionC = mcqResult.value.options[2];
    const optionD = mcqResult.value.options[3];
    if (optionA === undefined || optionB === undefined || optionC === undefined || optionD === undefined) throw new ProviderError("INVALID_OUTPUT");
    const rubric = [
      {
        id: "criterion-001", description: writtenResult.value.criterion1Description, maximumMarks: writtenResult.value.criterion1MaximumMarks,
        requiredConceptIds: writtenResult.value.criterion1RequiredConceptIds, evidence: writtenResult.value.criterion1EvidenceSegmentIds.map((segmentId) => ({ segmentId })),
      },
      {
        id: "criterion-002", description: writtenResult.value.criterion2Description, maximumMarks: writtenResult.value.criterion2MaximumMarks,
        requiredConceptIds: writtenResult.value.criterion2RequiredConceptIds, evidence: writtenResult.value.criterion2EvidenceSegmentIds.map((segmentId) => ({ segmentId })),
      },
      {
        id: "criterion-003", description: writtenResult.value.criterion3Description, maximumMarks: writtenResult.value.criterion3MaximumMarks,
        requiredConceptIds: writtenResult.value.criterion3RequiredConceptIds, evidence: writtenResult.value.criterion3EvidenceSegmentIds.map((segmentId) => ({ segmentId })),
      },
    ] as const;
    const metadata: ModelArtifactMetadata = {
      provider: "gemini_api", modelId: PRIMARY_MODEL, task: "assessment_generation", promptVersion,
      schemaVersion: "activity-set.v2", thinkingLevel, requestId: input.requestId, createdAt: new Date().toISOString(),
      latencyMs: mcqResult.metadata.latencyMs + writtenResult.metadata.latencyMs,
      repaired: mcqResult.repaired || writtenResult.repaired || input.repair !== undefined,
    };
    return {
      schemaVersion: "activity-set.v2", id: `activity-${input.source.sourceVersionId}`, sourceVersionId: input.source.sourceVersionId,
      title: input.title,
      questions: [
        {
          id: "question-001", type: "single_mcq", sourceVersionId: input.source.sourceVersionId,
          prompt: mcqResult.value.prompt, conceptIds: mcqResult.value.conceptIds, difficulty: input.difficulty, marks: 1,
          explanation: mcqResult.value.explanation,
          options: [
            { id: "A", text: optionA }, { id: "B", text: optionB },
            { id: "C", text: optionC }, { id: "D", text: optionD },
          ],
          correctOptionId: mcqResult.value.correctOptionId, evidence: mcqResult.value.evidenceSegmentIds.map((segmentId) => ({ segmentId })), artifact: metadata,
        },
        {
          id: "question-002", type: "short_written", sourceVersionId: input.source.sourceVersionId,
          prompt: writtenResult.value.prompt, conceptIds: writtenResult.value.conceptIds, difficulty: input.difficulty, marks: 5,
          explanation: writtenResult.value.explanation, expectedLength: writtenResult.value.expectedLength,
          referenceAnswer: writtenResult.value.referenceAnswer, requiredConceptIds: writtenResult.value.requiredConceptIds,
          evidence: writtenResult.value.evidenceSegmentIds.map((segmentId) => ({ segmentId })),
          rubric, artifact: metadata,
        },
      ],
      warnings: writtenResult.value.warnings, artifact: metadata,
    };
  }
}
