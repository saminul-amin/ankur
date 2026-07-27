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
    const promptVersion = LEARNING_PROMPT_VERSIONS.analysis;
    const thinkingLevel = "high";
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "analysis-semantic.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 4_000,
      timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAnalysisPrompt(input) }],
      outputMode: "native",
      jsonSchema: preparationMapProviderJsonSchema,
      schema: preparationMapProviderSchema,
      maxSchemaRepairs: 1,
    });
    const selected = input.source.segments[result.value.evidenceIndex - 1];
    if (selected === undefined) throw new ProviderError("INVALID_OUTPUT");
    const evidence = [{ segmentId: selected.id, quote: selected.text.slice(0, 600) }];
    return {
      schemaVersion: "preparation-map.v1",
      id: `preparation-${input.source.sourceVersionId}`,
      sourceVersionId: input.source.sourceVersionId,
      title: result.value.title,
      language: result.value.language,
      domain: result.value.domain,
      topics: [{
        id: "topic-primary",
        name: result.value.topicName,
        priority: result.value.topicPriority,
        evidence,
      }],
      concepts: [{
        id: "concept-primary",
        topicId: "topic-primary",
        name: result.value.conceptName,
        description: result.value.conceptDescription,
        priority: result.value.conceptPriority,
        evidence,
      }],
      objectives: [{
        id: "objective-primary",
        description: result.value.objectiveDescription,
        conceptIds: ["concept-primary"],
        evidence,
      }],
      warnings: result.value.warnings,
      artifact: artifact({
        result,
        task: "material_analysis",
        promptVersion,
        schemaVersion: "analysis-semantic.v2",
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

    const generateMcq = (repair?: RepairPromptContext) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "single-mcq-question.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 2_400,
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
      maxSchemaRepairs: repair === undefined ? 1 : 0,
    });
    const generateWritten = (
      priorMcqPrompt: string,
      repair?: RepairPromptContext,
    ) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "short-written-question.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 2_000,
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
      maxSchemaRepairs: repair === undefined ? 1 : 0,
    });
    const generateRubric = (
      writtenQuestion: ReturnType<typeof assembleEvidenceFirstAssessment>["writtenQuestion"],
      repair?: RepairPromptContext,
    ) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "written-rubric.v2",
      thinkingLevel,
      temperature: 0.1,
      maxOutputTokens: 2_000,
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
      maxSchemaRepairs: repair === undefined ? 1 : 0,
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
      const mcqFailed = assembled.failures.some((failure) =>
        failure.code.startsWith("MCQ_") ||
        failure.code.startsWith("QUESTION_") ||
        (failure.code.startsWith("LANG_") && failure.path.startsWith("options")),
      );
      const writtenPairFailed = assembled.failures.some((failure) =>
        failure.code.startsWith("RUBRIC_") ||
        failure.code.startsWith("QUESTION_") ||
        (failure.code.startsWith("LANG_") && failure.path === "prompt"),
      );
      if (mcqFailed) {
        if (mcqResult.repaired) throw new ProviderError("INVALID_OUTPUT");
        mcqResult = await generateMcq({
          artifactType: "single_mcq",
          outputSchemaVersion: "single-mcq-question.v2",
          failureCodes,
          invalidArtifact: {
            prompt: assembled.mcq.prompt,
            explanation: assembled.mcq.explanation,
            distractors: assembled.mcq.options.filter((option) => option.role === "distractor"),
          },
          mutableFields: ["prompt", "explanation", "distractor1", "distractor1Classification", "distractor2", "distractor2Classification", "distractor3", "distractor3Classification"],
          lockedOutputFields: {},
          referenceContext: {
            canonicalAnswer: plan.mcqCanonicalAnswer.canonicalAnswer,
            requiredClaims: plan.mcqCanonicalAnswer.requiredClaims.map((claim) => claim.text),
            permittedEvidence: plan.mcqCanonicalAnswer.evidenceReferences,
            language: plan.mcqCanonicalAnswer.language,
          },
        });
      }
      if (writtenPairFailed) {
        if (writtenResult.repaired || rubricResult.repaired) throw new ProviderError("INVALID_OUTPUT");
        writtenResult = await generateWritten(mcqResult.value.prompt, {
          artifactType: "short_written_question",
          outputSchemaVersion: "short-written-question.v2",
          failureCodes,
          invalidArtifact: {
            prompt: assembled.writtenQuestion.prompt,
            explanation: assembled.writtenQuestion.explanation,
          },
          mutableFields: ["prompt", "explanation", "expectedLength"],
          lockedOutputFields: {},
          referenceContext: {
            canonicalAnswer: plan.writtenCanonicalAnswer.canonicalAnswer,
            requiredClaims: plan.writtenCanonicalAnswer.requiredClaims.map((claim) => claim.text),
            permittedEvidence: plan.writtenCanonicalAnswer.evidenceReferences,
            language: plan.writtenCanonicalAnswer.language,
          },
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
          artifactType: "written_rubric",
          outputSchemaVersion: "written-rubric.v2",
          failureCodes,
          invalidArtifact: { criteria: assembled.rubric.criteria },
          mutableFields: ["criterion1Description", "criterion2Description", "criterion3Description"],
          lockedOutputFields: {},
          referenceContext: {
            canonicalAnswer: plan.writtenCanonicalAnswer.canonicalAnswer,
            requiredClaims: plan.writtenCanonicalAnswer.requiredClaims.map((claim) => claim.text),
            permittedEvidence: plan.writtenCanonicalAnswer.evidenceReferences,
            language: plan.writtenCanonicalAnswer.language,
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
