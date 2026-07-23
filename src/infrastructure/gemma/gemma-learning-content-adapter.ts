import type { LearningContentGenerationPort } from "../../application/ports/learning-content-port";
import type { GenerativeModelPort, ThinkingLevel } from "../../application/ports/generative-model-port";
import {
  assembleEvidenceFirstAssessment,
  createEvidenceFirstAssessmentPlan,
} from "../../application/services/evidence-first-assessment-builder";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { ActivitySet } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import { ProviderError } from "../../shared/errors/provider-error";
import {
  evidenceFirstMcqProviderJsonSchema,
  evidenceFirstMcqProviderSchema,
  evidenceFirstRubricProviderJsonSchema,
  evidenceFirstRubricProviderSchema,
  evidenceFirstWrittenQuestionProviderJsonSchema,
  evidenceFirstWrittenQuestionProviderSchema,
} from "../../shared/schemas/evidence-first-question-schemas";
import {
  preparationMapProviderJsonSchema,
  preparationMapProviderSchema,
} from "../../shared/schemas/learning-content-schemas";
import {
  buildAnalysisPrompt,
  buildEvidenceFirstAssessmentPrompt,
  LEARNING_PROMPT_VERSIONS,
} from "./learning-content-prompts";

const PRIMARY_MODEL = "gemma-4-26b-a4b-it" as const;
type RepairPromptContext = NonNullable<
  Parameters<typeof buildEvidenceFirstAssessmentPrompt>[0]["repair"]
>;

function artifact(input: {
  readonly result: Awaited<ReturnType<GenerativeModelPort["generateStructured"]>>;
  readonly task: ModelArtifactMetadata["task"];
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly requestId: string;
  readonly thinkingLevel: ThinkingLevel;
}): ModelArtifactMetadata {
  return {
    provider: "gemini_api",
    modelId: PRIMARY_MODEL,
    task: input.task,
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    thinkingLevel: input.thinkingLevel,
    requestId: input.requestId,
    createdAt: new Date().toISOString(),
    latencyMs: input.result.metadata.latencyMs,
    repaired: input.result.repaired,
  };
}

export class GemmaLearningContentAdapter implements LearningContentGenerationPort {
  constructor(private readonly model: GenerativeModelPort, private readonly timeoutMs = 90_000) {}

  async generatePreparationMap(
    input: Parameters<LearningContentGenerationPort["generatePreparationMap"]>[0],
  ): Promise<PreparationMap> {
    const promptVersion = input.repair === undefined
      ? LEARNING_PROMPT_VERSIONS.analysis
      : LEARNING_PROMPT_VERSIONS.analysisEvidenceRepair;
    const thinkingLevel = input.repair === undefined ? "minimal" : "high";
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "preparation-map.v1",
      thinkingLevel,
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
        thinkingLevel,
      }),
    };
  }

  async generateMixedAssessment(
    input: Parameters<LearningContentGenerationPort["generateMixedAssessment"]>[0],
  ): Promise<ActivitySet> {
    const promptVersion = input.repair === undefined
      ? LEARNING_PROMPT_VERSIONS.assessment
      : LEARNING_PROMPT_VERSIONS.assessmentEvidenceRepair;
    const thinkingLevel = input.repair === undefined ? "minimal" : "high";
    let plan;
    try {
      plan = createEvidenceFirstAssessmentPlan({
        source: input.source,
        preparationMap: input.preparationMap,
        selectedConceptIds: input.selectedConceptIds,
      });
    } catch (error) {
      throw new ProviderError("INVALID_OUTPUT", { cause: error });
    }
    if (
      plan.mcqCanonicalAnswer.validationStatus !== "valid" ||
      plan.writtenCanonicalAnswer.validationStatus !== "valid"
    ) throw new ProviderError("INVALID_OUTPUT");

    const outerRepair = input.repair === undefined ? undefined : {
      failureCodes: input.repair.validationErrors,
      invalidFields: { activitySet: input.repair.invalidArtifact },
      lockedFields: {
        mcqCanonicalAnswer: plan.mcqCanonicalAnswer,
        writtenCanonicalAnswer: plan.writtenCanonicalAnswer,
      },
    };
    const generateMcq = (repair: RepairPromptContext | undefined = outerRepair) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "single-mcq-question.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 1_200,
      timeoutMs: this.timeoutMs,
      contents: [{
        kind: "text",
        text: buildEvidenceFirstAssessmentPrompt({
          source: input.source,
          title: input.title,
          difficulty: input.difficulty,
          target: "mcq",
          canonicalAnswer: plan.mcqCanonicalAnswer,
          ...(repair === undefined ? {} : { repair }),
        }),
      }],
      outputMode: "native",
      jsonSchema: evidenceFirstMcqProviderJsonSchema,
      schema: evidenceFirstMcqProviderSchema,
      maxSchemaRepairs: 1,
    });
    const generateWritten = (
      priorMcqPrompt: string,
      repair: RepairPromptContext | undefined = outerRepair,
    ) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "short-written-question.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 1_000,
      timeoutMs: this.timeoutMs,
      contents: [{
        kind: "text",
        text: buildEvidenceFirstAssessmentPrompt({
          source: input.source,
          title: input.title,
          difficulty: input.difficulty,
          target: "written_question",
          canonicalAnswer: plan.writtenCanonicalAnswer,
          priorMcqPrompt,
          ...(repair === undefined ? {} : { repair }),
        }),
      }],
      outputMode: "native",
      jsonSchema: evidenceFirstWrittenQuestionProviderJsonSchema,
      schema: evidenceFirstWrittenQuestionProviderSchema,
      maxSchemaRepairs: 1,
    });
    const generateRubric = (
      writtenQuestion: ReturnType<typeof assembleEvidenceFirstAssessment>["writtenQuestion"],
      repair: RepairPromptContext | undefined = outerRepair,
    ) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "written-rubric.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 1_200,
      timeoutMs: this.timeoutMs,
      contents: [{
        kind: "text",
        text: buildEvidenceFirstAssessmentPrompt({
          source: input.source,
          title: input.title,
          difficulty: input.difficulty,
          target: "written_rubric",
          canonicalAnswer: plan.writtenCanonicalAnswer,
          writtenQuestion,
          ...(repair === undefined ? {} : { repair }),
        }),
      }],
      outputMode: "native",
      jsonSchema: evidenceFirstRubricProviderJsonSchema,
      schema: evidenceFirstRubricProviderSchema,
      maxSchemaRepairs: 1,
    });
    const placeholderMetadata: ModelArtifactMetadata = {
      provider: "gemini_api",
      modelId: PRIMARY_MODEL,
      task: "assessment_generation",
      promptVersion,
      schemaVersion: "activity-set.v2",
      thinkingLevel,
      requestId: input.requestId,
      createdAt: new Date().toISOString(),
      latencyMs: 0,
      repaired: input.repair !== undefined,
    };
    let mcqResult = await generateMcq();
    let writtenResult = await generateWritten(mcqResult.value.prompt);
    const placeholderRubric = {
      criterion1Description:
        plan.writtenCanonicalAnswer.requiredClaims[0]?.text ??
        plan.writtenCanonicalAnswer.canonicalAnswer,
      criterion2Description:
        plan.writtenCanonicalAnswer.requiredClaims[1]?.text ??
        plan.writtenCanonicalAnswer.canonicalAnswer,
      criterion3Description:
        plan.writtenCanonicalAnswer.requiredClaims[2]?.text ??
        plan.writtenCanonicalAnswer.canonicalAnswer,
    };
    const beforeRubric = assembleEvidenceFirstAssessment({
      source: input.source,
      plan,
      mcqProvider: mcqResult.value,
      writtenQuestionProvider: writtenResult.value,
      rubricProvider: placeholderRubric,
      title: input.title,
      difficulty: input.difficulty,
      metadata: placeholderMetadata,
    });
    let rubricResult = await generateRubric(beforeRubric.writtenQuestion);
    let assembled = assembleEvidenceFirstAssessment({
      source: input.source,
      plan,
      mcqProvider: mcqResult.value,
      writtenQuestionProvider: writtenResult.value,
      rubricProvider: rubricResult.value,
      title: input.title,
      difficulty: input.difficulty,
      metadata: placeholderMetadata,
    });

    let semanticRepairAttempted = false;
    if (assembled.failures.length > 0) {
      semanticRepairAttempted = true;
      const failureCodes = [...new Set(assembled.failures.map((failure) => failure.code))];
      const lockedFields = {
        materialId: plan.mcqCanonicalAnswer.materialId,
        sourceVersionId: input.source.sourceVersionId,
        mcqCanonicalAnswer: plan.mcqCanonicalAnswer,
        writtenCanonicalAnswer: plan.writtenCanonicalAnswer,
        marks: { mcq: 1, written: 5, rubric: [2, 2, 1] },
      };
      const mcqFailed = assembled.failures.some((failure) =>
        failure.code.startsWith("MCQ_") ||
        (failure.code.startsWith("LANG_") && failure.path.startsWith("options")),
      );
      const writtenPairFailed = assembled.failures.some((failure) =>
        failure.code.startsWith("RUBRIC_") ||
        failure.code === "QUESTION_REQUIRED_CLAIM_MISSING" ||
        (failure.code.startsWith("LANG_") && failure.path === "prompt"),
      );
      if (mcqFailed) {
        mcqResult = await generateMcq({
          failureCodes,
          invalidFields: {
            prompt: assembled.mcq.prompt,
            explanation: assembled.mcq.explanation,
            distractors: assembled.mcq.options.filter((option) => option.role === "distractor"),
          },
          lockedFields,
        });
      }
      if (writtenPairFailed) {
        writtenResult = await generateWritten(mcqResult.value.prompt, {
          failureCodes,
          invalidFields: {
            prompt: assembled.writtenQuestion.prompt,
            explanation: assembled.writtenQuestion.explanation,
          },
          lockedFields,
        });
        const repairedBeforeRubric = assembleEvidenceFirstAssessment({
          source: input.source,
          plan,
          mcqProvider: mcqResult.value,
          writtenQuestionProvider: writtenResult.value,
          rubricProvider: rubricResult.value,
          title: input.title,
          difficulty: input.difficulty,
          metadata: placeholderMetadata,
        });
        rubricResult = await generateRubric(repairedBeforeRubric.writtenQuestion, {
          failureCodes,
          invalidFields: { criteria: assembled.rubric.criteria },
          lockedFields: {
            ...lockedFields,
            writtenQuestion: repairedBeforeRubric.writtenQuestion,
          },
        });
      }
      assembled = assembleEvidenceFirstAssessment({
        source: input.source,
        plan,
        mcqProvider: mcqResult.value,
        writtenQuestionProvider: writtenResult.value,
        rubricProvider: rubricResult.value,
        title: input.title,
        difficulty: input.difficulty,
        metadata: placeholderMetadata,
      });
      if (assembled.failures.length > 0) {
        throw new ProviderError("INVALID_OUTPUT", {
          cause: new Error(
            assembled.failures
              .map((failure) => `${failure.code}:${failure.path}`)
              .join(","),
          ),
        });
      }
    }
    const metadata: ModelArtifactMetadata = {
      ...placeholderMetadata,
      latencyMs:
        mcqResult.metadata.latencyMs +
        writtenResult.metadata.latencyMs +
        rubricResult.metadata.latencyMs,
      repaired:
        semanticRepairAttempted ||
        mcqResult.repaired ||
        writtenResult.repaired ||
        rubricResult.repaired ||
        input.repair !== undefined,
    };
    return assembleEvidenceFirstAssessment({
      source: input.source,
      plan,
      mcqProvider: mcqResult.value,
      writtenQuestionProvider: writtenResult.value,
      rubricProvider: rubricResult.value,
      title: input.title,
      difficulty: input.difficulty,
      metadata,
    }).activitySet;
  }
}
