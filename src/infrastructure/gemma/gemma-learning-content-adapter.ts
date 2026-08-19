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
  evidenceFirstMcqProviderTransportSchema,
  evidenceFirstWrittenQuestionProviderJsonSchema,
  evidenceFirstWrittenQuestionProviderTransportSchema,
} from "../../shared/schemas/evidence-first-question-schemas";
import {
  preparationMapProviderJsonSchema,
  preparationMapProviderTransportSchema,
} from "../../shared/schemas/learning-content-schemas";
import {
  buildAnalysisPrompt,
  buildEvidenceFirstAssessmentPrompt,
  LEARNING_PROMPT_VERSIONS,
} from "./learning-content-prompts";
import type {
  ProviderDiagnosticObserver,
  ProviderFailureCategory,
} from "./provider-diagnostics";
import type { ArtifactValidationFailure } from "../../domain/assessments/evidence-first-validation";

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
  constructor(
    private readonly model: GenerativeModelPort,
    private readonly timeoutMs = 90_000,
    private readonly semanticDiagnosticObserver?: ProviderDiagnosticObserver,
  ) {}

  private recordSemanticFailures(
    failures: readonly ArtifactValidationFailure[],
    phase: "first_pass" | "repair",
    promptVersion: string,
  ): void {
    for (const failure of failures) {
      let category: ProviderFailureCategory = "transport_schema_mismatch";
      if (/EVIDENCE|GROUND/u.test(failure.code)) category = "invalid_evidence";
      else if (/QUOTE/u.test(failure.code)) category = "quote_mismatch";
      else if (/RUBRIC/u.test(failure.code)) category = "rubric_mismatch";
      else if (/CONCEPT/u.test(failure.code)) category = "concept_mismatch";
      this.semanticDiagnosticObserver?.({
        modelId: PRIMARY_MODEL,
        promptVersion,
        schemaVersion: "assessment-semantic-validation.v3",
        phase,
        category,
        code: failure.code,
        fieldPath: failure.path,
        expected: failure.expected ?? "deterministically valid assessment semantic field",
        repairAttempted: phase === "repair",
      });
    }
  }

  async generatePreparationMap(
    input: Parameters<LearningContentGenerationPort["generatePreparationMap"]>[0],
  ): Promise<PreparationMap> {
    const promptVersion = LEARNING_PROMPT_VERSIONS.analysis;
    // Analysis only picks one numbered evidence choice and writes short labels.
    // Extended thinking added no measured grounding benefit and reproducibly
    // drove Bengali and mixed sources into degenerate repetition loops that
    // exhausted the output budget; the application still validates grounding.
    const thinkingLevel = "minimal";
    const result = await this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "analysis-semantic.v2",
      thinkingLevel,
      temperature: 0.1,
      // A valid analysis object needs roughly 200 output tokens. A tight budget
      // keeps a degenerate repetition loop cheap and detects it in seconds
      // instead of spending the whole request timeout on it.
      maxOutputTokens: 1_200,
      timeoutMs: this.timeoutMs,
      contents: [{ kind: "text", text: buildAnalysisPrompt(input) }],
      outputMode: "native",
      jsonSchema: preparationMapProviderJsonSchema,
      schema: preparationMapProviderTransportSchema,
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
      schemaVersion: "mcq-semantic.v3",
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
      schema: evidenceFirstMcqProviderTransportSchema,
      maxSchemaRepairs: repair === undefined ? 1 : 0,
    });
    const generateWritten = (
      priorMcqPrompt: string,
      repair?: RepairPromptContext,
    ) => this.model.generateStructured({
      task: "structured_generation",
      modelId: PRIMARY_MODEL,
      promptVersion,
      schemaVersion: "written-question-semantic.v3",
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
      schema: evidenceFirstWrittenQuestionProviderTransportSchema,
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
    let assembled = assembleEvidenceFirstAssessment({
      source: input.source,
      plan,
      mcqProvider: mcqResult.value,
      writtenQuestionProvider: writtenResult.value,
      title: input.title,
      difficulty: input.difficulty,
      metadata: placeholderMetadata,
    });

    let semanticRepairAttempted = false;
    if (assembled.failures.length > 0) {
      this.recordSemanticFailures(assembled.failures, "first_pass", promptVersion);
      semanticRepairAttempted = true;
      const failureCodes = [...new Set(assembled.failures.map((failure) => failure.code))];
      const mcqFailed = assembled.failures.some((failure) =>
        failure.path.startsWith("mcq."),
      );
      const writtenPairFailed = assembled.failures.some((failure) =>
        failure.path.startsWith("writtenQuestion.") || failure.path.startsWith("rubric."),
      );
      if (mcqFailed) {
        if (mcqResult.repaired) throw new ProviderError("INVALID_OUTPUT");
        mcqResult = await generateMcq({
          artifactType: "single_mcq",
          outputSchemaVersion: "mcq-semantic.v3",
          failureCodes,
          invalidArtifact: {
            prompt: assembled.mcq.prompt,
            misconceptionCandidates: assembled.mcq.options
              .filter((option) => option.role === "distractor")
              .map((option) => option.text),
          },
          mutableFields: ["prompt", "misconception1", "misconception2", "misconception3"],
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
        if (writtenResult.repaired) throw new ProviderError("INVALID_OUTPUT");
        writtenResult = await generateWritten(mcqResult.value.prompt, {
          artifactType: "short_written_question",
          outputSchemaVersion: "written-question-semantic.v3",
          failureCodes,
          invalidArtifact: {
            prompt: assembled.writtenQuestion.prompt,
          },
          mutableFields: ["prompt", "expectedLength"],
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
        title: input.title,
        difficulty: input.difficulty,
        metadata: placeholderMetadata,
      });
      if (assembled.failures.length > 0) {
        this.recordSemanticFailures(assembled.failures, "repair", promptVersion);
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
        0,
      repaired:
        semanticRepairAttempted ||
        mcqResult.repaired ||
        writtenResult.repaired ||
        input.repair !== undefined,
    };
    return assembleEvidenceFirstAssessment({
      source: input.source,
      plan,
      mcqProvider: mcqResult.value,
      writtenQuestionProvider: writtenResult.value,
      title: input.title,
      difficulty: input.difficulty,
      metadata,
    }).activitySet;
  }
}
