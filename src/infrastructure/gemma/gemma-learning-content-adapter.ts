import type { LearningContentGenerationPort } from "../../application/ports/learning-content-port";
import type { GenerativeModelPort } from "../../application/ports/generative-model-port";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import {
  activitySetProviderJsonSchema,
  activitySetProviderSchema,
  preparationMapProviderJsonSchema,
  preparationMapProviderSchema,
} from "../../shared/schemas/learning-content-schemas";
import {
  buildAnalysisPrompt,
  buildAssessmentPrompt,
  LEARNING_PROMPT_VERSIONS,
} from "./learning-content-prompts";

const PRIMARY_MODEL = "gemma-4-26b-a4b-it" as const;

function artifact(input: {
  readonly result: Awaited<ReturnType<GenerativeModelPort["generateStructured"]>>;
  readonly task: ModelArtifactMetadata["task"];
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly requestId: string;
}): ModelArtifactMetadata {
  return {
    provider: "gemini_api",
    modelId: PRIMARY_MODEL,
    task: input.task,
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    thinkingLevel: "minimal",
    requestId: input.requestId,
    createdAt: new Date().toISOString(),
    latencyMs: input.result.metadata.latencyMs,
    repaired: input.result.repaired,
  };
}

export class GemmaLearningContentAdapter implements LearningContentGenerationPort {
  constructor(
    private readonly model: GenerativeModelPort,
    private readonly timeoutMs = 90_000,
  ) {}

  async generatePreparationMap(
    input: Parameters<LearningContentGenerationPort["generatePreparationMap"]>[0],
  ): Promise<PreparationMap> {
    const promptVersion =
      input.repair === undefined
        ? LEARNING_PROMPT_VERSIONS.analysis
        : LEARNING_PROMPT_VERSIONS.analysisEvidenceRepair;
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "preparation-map.v1",
      thinkingLevel: "minimal",
      temperature: 0.1,
      maxOutputTokens: 2_500,
      timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAnalysisPrompt(input) }],
      outputMode: "native",
      jsonSchema: preparationMapProviderJsonSchema,
      schema: preparationMapProviderSchema,
      maxSchemaRepairs: 1,
    });
    const evidence = [{
      segmentId: result.value.evidenceSegmentId,
      quote: result.value.evidenceQuote,
    }];
    return {
      schemaVersion: result.value.schemaVersion,
      id: `preparation-${input.source.sourceVersionId}`,
      sourceVersionId: result.value.sourceVersionId,
      title: result.value.title,
      language: result.value.language,
      domain: result.value.domain,
      topics: [{
        id: result.value.topicId,
        name: result.value.topicName,
        priority: result.value.topicPriority,
        evidence,
      }],
      concepts: [{
        id: result.value.conceptId,
        topicId: result.value.topicId,
        name: result.value.conceptName,
        description: result.value.conceptDescription,
        priority: result.value.conceptPriority,
        evidence,
      }],
      objectives: [{
        id: result.value.objectiveId,
        description: result.value.objectiveDescription,
        conceptIds: [result.value.conceptId],
        evidence,
      }],
      warnings: result.value.warnings,
      artifact: artifact({
        result,
        task: "material_analysis",
        promptVersion,
        schemaVersion: "preparation-map.v1",
        requestId: input.requestId,
      }),
    };
  }

  async generateOneMcq(
    input: Parameters<LearningContentGenerationPort["generateOneMcq"]>[0],
  ): Promise<ActivitySet> {
    const promptVersion =
      input.repair === undefined
        ? LEARNING_PROMPT_VERSIONS.assessment
        : LEARNING_PROMPT_VERSIONS.assessmentEvidenceRepair;
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "activity-set.v1",
      thinkingLevel: "minimal",
      temperature: 0.1,
      maxOutputTokens: 2_000,
      timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAssessmentPrompt(input) }],
      outputMode: "native",
      jsonSchema: activitySetProviderJsonSchema,
      schema: activitySetProviderSchema,
      maxSchemaRepairs: 1,
    });
    return {
      schemaVersion: result.value.schemaVersion,
      id: `activity-${input.source.sourceVersionId}`,
      sourceVersionId: result.value.sourceVersionId,
      title: result.value.title,
      questions: [{
        id: "question-001",
        type: "single_mcq",
        prompt: result.value.prompt,
        conceptIds: [result.value.conceptId],
        difficulty: result.value.difficulty,
        marks: 1,
        explanation: result.value.explanation,
        options: [
          { id: "A", text: result.value.optionA },
          { id: "B", text: result.value.optionB },
          { id: "C", text: result.value.optionC },
          { id: "D", text: result.value.optionD },
        ],
        correctOptionId: result.value.correctOptionId,
        evidence: [{
          segmentId: result.value.evidenceSegmentId,
          quote: result.value.evidenceQuote,
        }],
      }],
      warnings: result.value.warnings,
      artifact: artifact({
        result,
        task: "assessment_generation",
        promptVersion,
        schemaVersion: "activity-set.v1",
        requestId: input.requestId,
      }),
    };
  }
}
