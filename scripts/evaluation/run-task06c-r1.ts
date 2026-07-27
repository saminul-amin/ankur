import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type {
  GenerativeModelPort,
  GenerationMetadata,
  ProviderHealth,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "../../src/application/ports/generative-model-port";
import { AnalyzeConfirmedSource } from "../../src/application/use-cases/analyze-confirmed-source";
import { EvaluateWrittenAnswer } from "../../src/application/use-cases/evaluate-written-answer";
import { GenerateMixedAssessment } from "../../src/application/use-cases/generate-mixed-assessment";
import { GeneratePersonalizedRevision } from "../../src/application/use-cases/generate-personalized-revision";
import { TranscribePage } from "../../src/application/use-cases/transcribe-page";
import {
  calculateConceptPerformance,
  reconcileAssessmentTotal,
} from "../../src/domain/assessments/concept-performance";
import {
  gradeMcq,
  promptsMateriallyEquivalent,
  validateActivitySet,
  type ActivitySet,
} from "../../src/domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../src/domain/assessments/written-evaluation";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation";
import type { PreparationMap } from "../../src/domain/preparation/preparation-map";
import { compareAssessmentAttempts } from "../../src/domain/revision/improvement-comparison";
import type { RevisionPlan } from "../../src/domain/revision/revision-plan";
import { selectRevisionTargets, validateRevisionPlan } from "../../src/domain/revision/revision-plan";
import {
  createConfirmedSource,
  normalizeSourceText,
  rehydrateEvidenceWindow,
  type ConfirmedSource,
} from "../../src/domain/source/confirmed-source";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter";
import { GemmaPageTranscriptionAdapter } from "../../src/infrastructure/gemma/gemma-page-transcription-adapter";
import { type ProviderValidationDiagnostic } from "../../src/infrastructure/gemma/provider-diagnostics";
import { GemmaRevisionGenerationAdapter } from "../../src/infrastructure/gemma/gemma-revision-generation-adapter";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config";
import { characterErrorRate, normalizeForCharacterErrorRate } from "../../src/shared/evaluation/character-error-rate";
import { computeTask06Metrics } from "../../src/shared/evaluation/task06-metrics";
import {
  adaptiveLoopRecordSchema,
  aggregateMetricsSchema,
  baselineRecordSchema,
  evaluationMaterialSchema,
  extractionRecordSchema,
  generatedQuestionRecordSchema,
  humanQuestionAnnotationSchema,
  humanWrittenAnnotationSchema,
  providerOperationSchema,
  writtenGradingRecordSchema,
  type AdaptiveLoopRecord,
  type BaselineRecord,
  type EvaluationMaterial,
  type ExtractionRecord,
  type GeneratedQuestionRecord,
  type HumanQuestionAnnotation,
  type HumanWrittenAnnotation,
  type ProviderOperation,
  type WrittenGradingRecord,
} from "../../src/shared/evaluation/task06-schemas";
import { ApplicationError } from "../../src/shared/errors/application-error";
import { ProviderError } from "../../src/shared/errors/provider-error";
import {
  parsePersistedIngestionSession,
  toPersistedIngestionSession,
} from "../../src/presentation/persistence/ingestion-session";
import {
  materialText,
  task06cEvaluationCorpus,
  type EvaluationCorpusMaterial,
} from "./corpus";

const iterationValue = process.env["ANKUR_TASK06C_R1_ITERATION"] ?? "1";
if (!/^[1-3]$/u.test(iterationValue)) throw new Error("TASK06C_R1_ITERATION_INVALID");
const ITERATION_ROOT = resolve(`evaluation/task06c-r1/iteration-${iterationValue}`);
const ACTIVE_CORPUS = task06cEvaluationCorpus;
const PRIVATE_ROOT = resolve(ITERATION_ROOT, "records/private");
const PUBLIC_ROOT = resolve(ITERATION_ROOT, "records/public");
const EXPORT_ROOT = resolve(ITERATION_ROOT, "exports");
const ANNOTATION_ROOT = resolve(ITERATION_ROOT, "annotations/private/generated");
const STATE_PATH = resolve(PRIVATE_ROOT, "task06-state.json");
const MANIFEST_PATH = resolve("evaluation/task06c/corpus/public/manifest.json");
const MODEL = "gemma-4-26b-a4b-it" as const;
const ASSESSMENT_RUN_COUNTS = new Map(ACTIVE_CORPUS.map((material, index) => [material.id, index < 3 ? 3 : 2]));
const ANSWER_CASES = [
  ["correct", "partially_correct"],
  ["incorrect", "empty"],
  ["unsupported_claim", "missing_key_concept"],
  ["correct", "partially_correct"],
  ["incorrect", "empty"],
  ["unsupported_claim", "missing_key_concept"],
  ["correct", "partially_correct"],
  ["incorrect", "empty"],
  ["unsupported_claim", "missing_key_concept"],
] as const;

function baselineQuestionCount(materialId: string): number {
  return (ASSESSMENT_RUN_COUNTS.get(materialId) ?? 0) * 2;
}

interface TransportObservation {
  readonly request: TextGenerationRequest | StructuredGenerationRequest<unknown>;
  readonly metadata?: GenerationMetadata;
  readonly repaired: boolean;
}

class ObservedProvider implements GenerativeModelPort {
  readonly observations: TransportObservation[] = [];

  constructor(private readonly delegate: GenerativeModelPort) {}

  healthCheck(): Promise<ProviderHealth> {
    return this.delegate.healthCheck();
  }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    try {
      const result = await this.delegate.generateText(request);
      this.observations.push({ request, metadata: result.metadata, repaired: false });
      return result;
    } catch (error) {
      this.observations.push({ request, repaired: false });
      throw error;
    }
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    try {
      const result = await this.delegate.generateStructured(request);
      this.observations.push({ request, metadata: result.metadata, repaired: result.repaired });
      return result;
    } catch (error) {
      this.observations.push({ request, repaired: false });
      throw error;
    }
  }
}

interface PrivateState {
  readonly schemaVersion: "task06-private-state.v1";
  readonly createdAt: string;
  updatedAt: string;
  readonly sources: Record<string, ConfirmedSource>;
  readonly preparationMaps: Record<string, PreparationMap>;
  readonly activities: Record<string, ActivitySet>;
  readonly writtenEvaluations: Record<string, WrittenAnswerEvaluation>;
  readonly revisions: Record<string, RevisionPlan>;
  readonly transcriptionText: Record<string, { text: string; uncertainSegmentCount: number }>;
  readonly baselineOutput: Record<string, string>;
  readonly answers: Record<string, string>;
  providerOperations: ProviderOperation[];
  adaptiveRecords: AdaptiveLoopRecord[];
}

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolveSleep) => setTimeout(resolveSleep, milliseconds));
}

function newState(): PrivateState {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: "task06-private-state.v1",
    createdAt: timestamp,
    updatedAt: timestamp,
    sources: {},
    preparationMaps: {},
    activities: {},
    writtenEvaluations: {},
    revisions: {},
    transcriptionText: {},
    baselineOutput: {},
    answers: {},
    providerOperations: [],
    adaptiveRecords: [],
  };
}

async function loadState(): Promise<PrivateState> {
  try {
    return JSON.parse(await readFile(STATE_PATH, "utf8")) as PrivateState;
  } catch (error) {
    if (error instanceof SyntaxError || (typeof error === "object" && error !== null && Reflect.get(error, "code") === "ENOENT")) {
      return newState();
    }
    throw error;
  }
}

async function saveState(state: PrivateState): Promise<void> {
  state.updatedAt = new Date().toISOString();
  await mkdir(PRIVATE_ROOT, { recursive: true });
  await writeFile(STATE_PATH, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

function controlledFailure(error: unknown): string {
  if (error instanceof ProviderError || error instanceof ApplicationError) return error.code;
  return "CONTROLLED_EVALUATION_FAILURE";
}

function operationTypeFor(fallback: ProviderOperation["operationType"]) {
  return fallback;
}

async function observeOperation<T>(input: {
  readonly operationId: string;
  readonly materialId: string;
  readonly operationType: ProviderOperation["operationType"];
  readonly provider: ObservedProvider;
  readonly diagnostics: ProviderValidationDiagnostic[];
  readonly state: PrivateState;
  readonly action: () => Promise<T>;
}): Promise<T> {
  const existing = input.state.providerOperations.find((item) => item.operationId === input.operationId && item.finalStatus === "valid");
  if (existing !== undefined) throw new Error("OPERATION_ALREADY_COMPLETE");
  const controlled = input.state.providerOperations.find((item) => item.operationId === input.operationId && item.finalStatus === "controlled_failure");
  if (controlled !== undefined) {
    if (process.env["ANKUR_TASK06C_R1_PRESERVE_FAILURES"] === "true") {
      throw new Error("PRESERVED_CONTROLLED_FAILURE");
    }
    let attempt = 1;
    while (input.state.providerOperations.some((item) => item.operationId === `${input.operationId}:attempt${String(attempt)}`)) {
      attempt += 1;
    }
    input.state.providerOperations = input.state.providerOperations.map((item) =>
      item === controlled ? { ...item, operationId: `${input.operationId}:attempt${String(attempt)}` } : item,
    );
    await saveState(input.state);
  }
  process.stdout.write(`START ${input.operationId}\n`);
  const transportStart = input.provider.observations.length;
  const diagnosticStart = input.diagnostics.length;
  const startedAt = performance.now();
  let value: T | undefined;
  let failure: unknown;
  try {
    value = await input.action();
  } catch (error) {
    failure = error;
  }
  const observations = input.provider.observations.slice(transportStart);
  const diagnostics = input.diagnostics.slice(diagnosticStart);
  const repairAttempted =
    observations.some((item) => item.repaired || /repair/iu.test(item.request.promptVersion)) ||
    diagnostics.some((item) => item.phase === "repair" || item.repairAttempted === true);
  const metadata = observations.map((item) => item.metadata).filter((item): item is GenerationMetadata => item !== undefined);
  const schemaVersions = [...new Set(observations.map((item) =>
    "schemaVersion" in item.request ? item.request.schemaVersion : "text-output.v1",
  ))];
  const promptVersions = [...new Set(observations.map((item) => item.request.promptVersion))];
  const requests = observations.map((item) => item.request);
  const diagnosticCategories = diagnostics.map((item) => item.category);
  const finalValid = failure === undefined;
  const record = providerOperationSchema.parse({
    schemaVersion: "provider-operation.v1",
    operationId: input.operationId,
    materialId: input.materialId,
    modelId: MODEL,
    operationType: operationTypeFor(input.operationType),
    promptVersion: promptVersions.join("+") || "no-provider-call",
    providerSchemaVersion: schemaVersions.join("+") || "none",
    thinkingLevel: requests.some((item) => item.thinkingLevel === "high") ? "high" : "minimal",
    temperature: requests.length === 0 ? 0 : Math.max(...requests.map((item) => item.temperature)),
    maxOutputTokens: requests.length === 0 ? 0 : Math.max(...requests.map((item) => item.maxOutputTokens)),
    timestamp: new Date().toISOString(),
    latencyMs: Math.round(performance.now() - startedAt),
    inputTokens: metadata.some((item) => item.promptTokenCount !== undefined)
      ? metadata.reduce((sum, item) => sum + (item.promptTokenCount ?? 0), 0)
      : null,
    outputTokens: metadata.some((item) => item.outputTokenCount !== undefined)
      ? metadata.reduce((sum, item) => sum + (item.outputTokenCount ?? 0), 0)
      : null,
    firstPassValid: finalValid && !repairAttempted,
    repairAttempted,
    repairSuccess: finalValid && repairAttempted,
    finalStatus: finalValid ? "valid" : "controlled_failure",
    failureCategory: finalValid ? null : controlledFailure(failure),
    evidenceFailureCount: diagnosticCategories.filter((item) => item === "invalid_evidence").length,
    quoteFailureCount: diagnosticCategories.filter((item) => item === "quote_mismatch").length,
    conceptFailureCount: diagnosticCategories.filter((item) => item === "concept_mismatch").length,
    reconciliationFailureCount: diagnosticCategories.filter((item) => item === "mark_reconciliation_mismatch" || item === "rubric_mismatch").length,
    artifactHash: value === undefined ? null : sha256(JSON.stringify(value)),
  });
  input.state.providerOperations = [
    ...input.state.providerOperations.filter((item) => item.operationId !== input.operationId),
    record,
  ];
  await saveState(input.state);
  process.stdout.write(`${finalValid ? "PASS" : "FAIL"} ${input.operationId} ${String(record.latencyMs)}ms\n`);
  if (failure !== undefined) throw failure instanceof Error ? failure : new Error("CONTROLLED_EVALUATION_FAILURE");
  if (value === undefined) throw new Error("MISSING_OPERATION_VALUE");
  return value;
}

function sourceFor(material: EvaluationCorpusMaterial): ConfirmedSource {
  const method = material.inputType === "pasted_text"
    ? "pasted_text" as const
    : material.inputType === "digital_pdf"
      ? "digital_pdf" as const
      : material.inputType === "page_image"
        ? "page_images" as const
        : "pdf" as const;
  return createConfirmedSource({
    pages: material.pages.map((page) => ({ pageNumber: page.pageNumber, text: page.text })),
    language: material.language,
    method,
    priorityInstruction: material.learnerPriority,
    confirmedAt: "2026-07-23T00:00:00.000Z",
  });
}

function gradingWindow(source: ConfirmedSource, activity: ActivitySet): ConfirmedSource {
  const written = activity.questions[1];
  const ids = new Set([
    ...written.evidence.map((item) => item.segmentId),
    ...written.rubric.flatMap((criterion) => criterion.evidence.map((item) => item.segmentId)),
  ]);
  return rehydrateEvidenceWindow({
    sourceVersionId: source.sourceVersionId,
    language: source.language,
    segments: source.segments
      .filter((segment) => ids.has(segment.id))
      .map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
  });
}

function answerFor(
  material: EvaluationCorpusMaterial,
  activity: ActivitySet,
  answerCase: (typeof ANSWER_CASES)[number][number],
): string {
  const reference = activity.questions[1].referenceAnswer;
  const words = reference.split(/\s+/u);
  const partial = words.slice(0, Math.max(3, Math.ceil(words.length / 2))).join(" ");
  if (answerCase === "correct") return reference;
  if (answerCase === "partially_correct" || answerCase === "missing_key_concept") return partial;
  if (answerCase === "empty") return "";
  if (material.language === "bn") {
    return answerCase === "unsupported_claim"
      ? "উৎসে আলোচিত প্রক্রিয়াটি সব পরিস্থিতিতে শতভাগ সফল—এমন একটি অতিরিক্ত দাবি এখানে যোগ করা হলো।"
      : "উৎসের মূল কারণের বিপরীত একটি ব্যাখ্যা দেওয়া হয়েছে।";
  }
  return answerCase === "unsupported_claim"
    ? "This answer adds a claim that the procedure is guaranteed to work perfectly in every situation."
    : "This answer reverses the main relationship described by the source.";
}

function incorrectOption(activity: ActivitySet): "A" | "B" | "C" | "D" {
  return activity.questions[0].options.find((option) => option.id !== activity.questions[0].correctOptionId)?.id ?? "A";
}

function primaryActivityEntry(state: PrivateState, materialId: string): [string, ActivitySet] | undefined {
  return Object.entries(state.activities)
    .filter(([operationId]) => operationId.startsWith(`assessment:${materialId}:`))
    .toSorted(([left], [right]) => left.localeCompare(right))[0];
}

function materialSelection(): readonly EvaluationCorpusMaterial[] {
  const selected = process.env["ANKUR_EVALUATION_MATERIALS"]?.split(",").map((item) => item.trim()).filter(Boolean);
  if (selected === undefined || selected.length === 0) return ACTIVE_CORPUS;
  const allowed = new Set(selected);
  const materials = ACTIVE_CORPUS.filter((item) => allowed.has(item.id));
  if (materials.length !== allowed.size) throw new Error("UNKNOWN_EVALUATION_MATERIAL");
  return materials;
}

async function extractPdfPage(path: string, pageNumber: number): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const bytes = new Uint8Array(await readFile(resolve(path)));
  const document = await pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
  try {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    return normalizeSourceText(content.items
      .map((item) => "str" in item ? item.str : "")
      .filter(Boolean)
      .join(" "));
  } finally {
    await document.cleanup();
  }
}

async function extractionRecords(state: PrivateState, materials: readonly EvaluationCorpusMaterial[]): Promise<ExtractionRecord[]> {
  const records: ExtractionRecord[] = [];
  for (const material of materials) {
    for (const page of material.pages) {
      let candidate: string | undefined;
      let actualRoute: ExtractionRecord["actualRoute"] = "pending";
      let uncertainSegmentCount = 0;
      let providerOperationId: string | null = null;
      if (page.route === "pasted_text") {
        candidate = page.text;
        actualRoute = "pasted_text";
      } else if (page.route === "embedded_text" && material.fixturePath !== null) {
        candidate = await extractPdfPage(material.fixturePath, page.pageNumber);
        actualRoute = candidate.length >= 80 ? "embedded_text" : "page_transcription";
      } else {
        providerOperationId = `transcription:${material.id}:p${String(page.pageNumber)}`;
        const result = state.transcriptionText[providerOperationId];
        if (result !== undefined) {
          candidate = result.text;
          uncertainSegmentCount = result.uncertainSegmentCount;
          actualRoute = "page_transcription";
        }
      }
      const reference = normalizeForCharacterErrorRate(page.text);
      const normalizedCandidate = candidate === undefined ? undefined : normalizeForCharacterErrorRate(candidate);
      const cer = normalizedCandidate === undefined ? null : characterErrorRate(reference, normalizedCandidate);
      records.push(extractionRecordSchema.parse({
        schemaVersion: "extraction-record.v1",
        recordId: `extraction:${material.id}:p${String(page.pageNumber)}`,
        materialId: material.id,
        pageNumber: page.pageNumber,
        expectedRoute: page.route,
        actualRoute,
        status: candidate === undefined ? "pending" : candidate.length > 0 ? "success" : "failed",
        referenceCharacterCount: Array.from(reference).length,
        candidateCharacterCount: normalizedCandidate === undefined ? 0 : Array.from(normalizedCandidate).length,
        changedCharacterCount: cer === null ? null : Math.round(cer * Array.from(reference).length),
        characterErrorRate: cer,
        uncertainSegmentCount,
        materialCorrectionRequired: cer === null ? null : cer > 0.02,
        candidateTextHash: normalizedCandidate === undefined ? null : sha256(normalizedCandidate),
        providerOperationId,
      }));
    }
  }
  return records;
}

async function runLive(state: PrivateState): Promise<void> {
  if (process.env["ANKUR_TASK06C_R1_LIVE_OPT_IN"] !== "true") throw new Error("TASK06C_R1_LIVE_OPT_IN_REQUIRED");
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) throw new Error("LIVE_AI_CONFIGURATION_REQUIRED");
  const diagnostics: ProviderValidationDiagnostic[] = [];
  const provider = new ObservedProvider(new GoogleGenAiAdapter(
    config.apiKey,
    config.primaryModel,
    undefined,
    (diagnostic) => diagnostics.push(diagnostic),
  ));
  const learning = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const grading = new GemmaWrittenEvaluationAdapter(provider, config.requestTimeoutMs);
  const revision = new GemmaRevisionGenerationAdapter(provider, config.requestTimeoutMs);
  const transcription = new GemmaPageTranscriptionAdapter(provider, config.requestTimeoutMs);

  for (const material of materialSelection()) {
    const source = state.sources[material.id] ?? sourceFor(material);
    state.sources[material.id] = source;
    await saveState(state);

    for (const page of material.pages.filter((item) => item.route === "page_transcription")) {
      const operationId = `transcription:${material.id}:p${String(page.pageNumber)}`;
      if (state.transcriptionText[operationId] !== undefined) continue;
      const fixturePath = material.inputType === "mixed_pdf"
        ? `evaluation/corpus/public/fixtures/${material.id}-page-${String(page.pageNumber)}.png`
        : material.fixturePath;
      if (fixturePath === null) throw new Error("TRANSCRIPTION_FIXTURE_MISSING");
      try {
        const imageBase64 = (await readFile(resolve(fixturePath))).toString("base64");
        const result = await observeOperation({
          operationId,
          materialId: material.id,
          operationType: "page_transcription",
          provider,
          diagnostics,
          state,
          action: () => new TranscribePage(transcription).execute({
            sourceVersionDraftId: `draft-${sha256(material.id).slice(-12)}`,
            materialOrdinal: 1,
            pageNumber: page.pageNumber,
            mimeType: "image/png",
            imageBase64,
            targetLanguage: material.language,
            requestId: operationId,
          }),
        });
        state.transcriptionText[operationId] = {
          text: result.text,
          uncertainSegmentCount: result.uncertainSegments.length,
        };
        await saveState(state);
      } catch {
        continue;
      }
      await sleep(500);
    }

    const earlyBaselineId = `baseline:${material.id}`;
    if (state.baselineOutput[earlyBaselineId] === undefined) {
      try {
        const output = await observeOperation({
          operationId: earlyBaselineId,
          materialId: material.id,
          operationType: "one_prompt_baseline",
          provider,
          diagnostics,
          state,
          action: async () => {
            const result = await provider.generateText({
              task: "text_generation",
              modelId: MODEL,
              promptVersion: "one-prompt-baseline.v1",
              thinkingLevel: "minimal",
              temperature: 0.1,
              maxOutputTokens: 2_400,
              timeoutMs: config.requestTimeoutMs,
              contents: [{
                kind: "text",
                text: `Read this source and create a quiz.\n\nCreate exactly ${String(baselineQuestionCount(material.id))} questions in the source's language. For each, give the question, the answer, and a short exact evidence quotation. Use this plain-text format exactly: Q: ...\\nA: ...\\nEVIDENCE: ...\n\nSOURCE\n${materialText(material)}`,
              }],
            });
            return result.text;
          },
        });
        state.baselineOutput[earlyBaselineId] = output;
        await saveState(state);
      } catch {
        // The sanitized controlled-failure record remains available to aggregation.
      }
      await sleep(500);
    }
    if (process.env["ANKUR_EVALUATION_BASELINE_ONLY"] === "true") continue;

    const analysisId = `analysis:${material.id}`;
    let map = state.preparationMaps[material.id];
    if (map === undefined) {
      try {
        map = await observeOperation({
          operationId: analysisId,
          materialId: material.id,
          operationType: "analysis",
          provider,
          diagnostics,
          state,
          action: () => new AnalyzeConfirmedSource(learning).execute({ source, requestId: analysisId }),
        });
        state.preparationMaps[material.id] = map;
        await saveState(state);
      } catch {
        continue;
      }
      await sleep(500);
    }

    const runCount = ASSESSMENT_RUN_COUNTS.get(material.id) ?? 2;
    for (let run = 1; run <= runCount; run += 1) {
      const operationId = `assessment:${material.id}:r${String(run)}`;
      if (state.activities[operationId] !== undefined) continue;
      try {
        const activity = await observeOperation({
          operationId,
          materialId: material.id,
          operationType: "assessment_generation",
          provider,
          diagnostics,
          state,
          action: () => new GenerateMixedAssessment(learning).execute({
            source,
            preparationMap: map,
            selectedConceptIds: map.concepts.map((concept) => concept.id),
            title: `${material.title} · evaluation ${String(run)}`,
            difficulty: "medium",
            requestId: operationId,
          }),
        });
        state.activities[operationId] = activity;
        await saveState(state);
      } catch {
        continue;
      }
      await sleep(500);
    }

    const primaryActivity = primaryActivityEntry(state, material.id);
    if (primaryActivity === undefined) continue;
    const [, activity] = primaryActivity;
    const materialIndex = ACTIVE_CORPUS.findIndex((item) => item.id === material.id);
    const cases = ANSWER_CASES[materialIndex];
    if (cases === undefined) throw new Error("ANSWER_CASES_MISSING");
    const window = gradingWindow(source, activity);
    for (const answerCase of cases) {
      const operationId = `written:${material.id}:${answerCase}`;
      if (state.writtenEvaluations[operationId] !== undefined) continue;
      const answer = answerFor(material, activity, answerCase);
      state.answers[operationId] = answer;
      try {
        let result: WrittenAnswerEvaluation;
        if (answer.trim().length === 0) {
          result = await new EvaluateWrittenAnswer(grading).execute({
            source: window,
            question: activity.questions[1],
            studentAnswer: answer,
            requestId: operationId,
          });
        } else {
          result = await observeOperation({
            operationId,
            materialId: material.id,
            operationType: "written_grading",
            provider,
            diagnostics,
            state,
            action: () => new EvaluateWrittenAnswer(grading).execute({
              source: window,
              question: activity.questions[1],
              studentAnswer: answer,
              requestId: operationId,
            }),
          });
        }
        state.writtenEvaluations[operationId] = result;
        await saveState(state);
      } catch {
        continue;
      }
      if (answer.trim().length > 0) await sleep(500);
    }

    const originalWritten = state.writtenEvaluations[`written:${material.id}:${cases[1]}`] ??
      state.writtenEvaluations[`written:${material.id}:${cases[0]}`];
    if (originalWritten === undefined) continue;
    const originalMcqGrade = gradeMcq(activity.questions[0], incorrectOption(activity));
    const originalPerformance = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: activity.questions[0],
      mcqGrade: originalMcqGrade,
      writtenQuestion: activity.questions[1],
      writtenEvaluation: originalWritten,
    });
    if (!reconcileAssessmentTotal({ mcqGrade: originalMcqGrade, writtenEvaluation: originalWritten, performance: originalPerformance })) {
      throw new Error("ORIGINAL_MARK_RECONCILIATION_FAILED");
    }
    const revisionId = `revision:${material.id}`;
    let plan = state.revisions[revisionId];
    if (plan === undefined) {
      try {
        plan = await observeOperation({
          operationId: revisionId,
          materialId: material.id,
          operationType: "revision_retry_generation",
          provider,
          diagnostics,
          state,
          action: () => new GeneratePersonalizedRevision(revision).execute({
            source,
            preparationMap: map,
            originalActivity: activity,
            originalResultId: `result-${activity.id}`,
            originalMcqGrade,
            performance: originalPerformance,
            writtenEvaluation: originalWritten,
            requestId: revisionId,
          }),
        });
        state.revisions[revisionId] = plan;
        await saveState(state);
      } catch {
        continue;
      }
      await sleep(500);
    }

    const retryWrittenId = `retry-written:${material.id}:correct`;
    let retryWritten = state.writtenEvaluations[retryWrittenId];
    const retryWindow = gradingWindow(source, plan.retryActivity);
    if (retryWritten === undefined) {
      const answer = plan.retryActivity.questions[1].referenceAnswer;
      state.answers[retryWrittenId] = answer;
      try {
        retryWritten = await observeOperation({
          operationId: retryWrittenId,
          materialId: material.id,
          operationType: "written_grading",
          provider,
          diagnostics,
          state,
          action: () => new EvaluateWrittenAnswer(grading).execute({
            source: retryWindow,
            question: plan.retryActivity.questions[1],
            studentAnswer: answer,
            requestId: retryWrittenId,
          }),
        });
        state.writtenEvaluations[retryWrittenId] = retryWritten;
        await saveState(state);
      } catch {
        continue;
      }
      await sleep(500);
    }
    const retryMcqGrade = gradeMcq(plan.retryActivity.questions[0], plan.retryActivity.questions[0].correctOptionId);
    const retryPerformance = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: plan.retryActivity.questions[0],
      mcqGrade: retryMcqGrade,
      writtenQuestion: plan.retryActivity.questions[1],
      writtenEvaluation: retryWritten,
    });
    const comparison = compareAssessmentAttempts({
      originalMcqGrade,
      originalWrittenEvaluation: originalWritten,
      originalPerformance,
      retryMcqGrade,
      retryWrittenEvaluation: retryWritten,
      retryPerformance,
    });
    const selection = selectRevisionTargets({ preparationMap: map, performance: originalPerformance, writtenEvaluation: originalWritten });
    const revisionFailures = validateRevisionPlan({
      source,
      preparationMap: map,
      originalActivity: activity,
      originalResultId: `result-${activity.id}`,
      expectedSelection: selection,
      writtenEvaluation: originalWritten,
      plan,
    });
    const persisted = toPersistedIngestionSession({
      stage: "adaptive_results",
      mode: "live",
      sourceKind: material.inputType === "pasted_text" ? "text" : material.inputType === "page_image" ? "images" : "pdf",
      pages: [],
      priorityInstruction: material.learnerPriority,
      confirmedSource: source,
      preparationMap: map,
      assessmentConfiguration: {
        title: activity.title,
        selectedConceptIds: map.concepts.map((concept) => concept.id),
        difficulty: "medium",
      },
      activitySet: activity,
      ...(originalMcqGrade.selectedOptionId === undefined ? {} : { selectedOptionId: originalMcqGrade.selectedOptionId }),
      writtenAnswer: state.answers[`written:${material.id}:${cases[1]}`] ?? "",
      currentQuestionIndex: 1,
      mcqGrade: originalMcqGrade,
      writtenEvaluation: originalWritten,
      conceptPerformance: originalPerformance,
      revisionPlan: plan,
      ...(retryMcqGrade.selectedOptionId === undefined ? {} : { retrySelectedOptionId: retryMcqGrade.selectedOptionId }),
      retryWrittenAnswer: state.answers[retryWrittenId] ?? "",
      retryCurrentQuestionIndex: 1,
      retryMcqGrade,
      retryWrittenEvaluation: retryWritten,
      retryConceptPerformance: retryPerformance,
      improvementComparison: comparison,
    });
    const restored = parsePersistedIngestionSession(persisted);
    const allowedConceptIds = new Set(map.concepts.map((concept) => concept.id));
    const fabricated = selection.targetConceptIds.filter((conceptId) => !allowedConceptIds.has(conceptId)).length;
    const adaptive = adaptiveLoopRecordSchema.parse({
      schemaVersion: "adaptive-loop-record.v1",
      recordId: `adaptive:${material.id}`,
      materialId: material.id,
      operationId: revisionId,
      status: revisionFailures.length === 0 && restored?.stage === "adaptive_results" ? "valid" : "controlled_failure",
      failureCategory: revisionFailures.length === 0 && restored?.stage === "adaptive_results"
        ? null
        : "ADAPTIVE_VALIDATION_FAILED",
      revisionMode: plan.retryMode,
      targetConceptIds: plan.targetConceptIds,
      fabricatedWeaknessCount: fabricated,
      revisionGroundingFailures: revisionFailures.filter((item) => item.reason === "UNKNOWN_SEGMENT" || item.reason === "QUOTE_NOT_FOUND").length,
      retryGroundingFailures: validateActivitySet(source, map, plan.retryActivity).filter((item) => item.reason === "UNKNOWN_SEGMENT" || item.reason === "QUOTE_NOT_FOUND").length,
      duplicateFailures: revisionFailures.filter((item) => item.reason === "DUPLICATE_PROMPT").length,
      originalScore: comparison.originalScore,
      retryScore: comparison.retryScore,
      scoreChange: comparison.absoluteChange,
      persistenceRecoveryPassed: restored?.improvementComparison?.absoluteChange === comparison.absoluteChange,
      statePreservationPassed: restored?.writtenAnswer === (state.answers[`written:${material.id}:${cases[1]}`] ?? ""),
    });
    state.adaptiveRecords = [...state.adaptiveRecords.filter((item) => item.recordId !== adaptive.recordId), adaptive];
    await saveState(state);

    const baselineId = `baseline:${material.id}`;
    if (state.baselineOutput[baselineId] === undefined) {
      try {
        const output = await observeOperation({
          operationId: baselineId,
          materialId: material.id,
          operationType: "one_prompt_baseline",
          provider,
          diagnostics,
          state,
          action: async () => {
            const result = await provider.generateText({
              task: "text_generation",
              modelId: MODEL,
              promptVersion: "one-prompt-baseline.v1",
              thinkingLevel: "minimal",
              temperature: 0.1,
              maxOutputTokens: 2_400,
              timeoutMs: config.requestTimeoutMs,
              contents: [{
                kind: "text",
                text: `Read this source and create a quiz.\n\nCreate exactly ${String(baselineQuestionCount(material.id))} questions in the source's language. For each, give the question, the answer, and a short exact evidence quotation. Use this plain-text format exactly: Q: ...\\nA: ...\\nEVIDENCE: ...\n\nSOURCE\n${materialText(material)}`,
              }],
            });
            return result.text;
          },
        });
        state.baselineOutput[baselineId] = output;
        await saveState(state);
      } catch {
        continue;
      }
    }
  }
}

function parseBaseline(value: string): { parsed: number; transparent: number } {
  const questionCount = (value.match(/^Q:\s+.+$/gmu) ?? []).length;
  const answerCount = (value.match(/^A:\s+.+$/gmu) ?? []).length;
  const evidenceCount = (value.match(/^EVIDENCE:\s+.+$/gmu) ?? []).length;
  return {
    parsed: Math.min(questionCount, answerCount),
    transparent: Math.min(questionCount, answerCount, evidenceCount),
  };
}

function questionRecords(state: PrivateState): GeneratedQuestionRecord[] {
  const records: GeneratedQuestionRecord[] = [];
  for (const material of ACTIVE_CORPUS) {
    const activities: ReadonlyArray<readonly [string, ActivitySet, "original_assessment" | "adaptive_retry"]> = [
      ...Object.entries(state.activities)
        .filter(([id]) => id.startsWith(`assessment:${material.id}:`))
        .toSorted(([left], [right]) => left.localeCompare(right))
        .map(([operationId, activity]) => [operationId, activity, "original_assessment"] as const),
      ...Object.entries(state.revisions)
        .filter(([id]) => id === `revision:${material.id}`)
        .map(([operationId, plan]) => [operationId, plan.retryActivity, "adaptive_retry"] as const),
    ];
    for (const [operationId, activity, questionStage] of activities) {
      for (const [index, question] of activity.questions.entries()) {
        const recordId = `question:${operationId}:q${String(index + 1)}`;
        const prior = records.find((item) =>
          item.materialId === material.id && promptsMateriallyEquivalent(item.questionText, question.prompt),
        );
        records.push(generatedQuestionRecordSchema.parse({
          schemaVersion: "generated-question-record.v1",
          recordId,
          operationId,
          materialId: material.id,
          language: material.language,
          domain: material.domain,
          questionStage,
          questionType: question.type,
          questionOrdinal: records.filter((item) => item.materialId === material.id).length + 1,
          questionHash: sha256(normalizeSourceText(question.prompt)),
          questionText: question.prompt,
          correctOptionId: question.type === "single_mcq" ? question.correctOptionId : null,
          conceptIds: question.conceptIds,
          evidenceSegmentIds: question.evidence.map((item) => item.segmentId),
          deterministicGroundingValid: validateActivitySet(state.sources[material.id] ?? sourceFor(material), state.preparationMaps[material.id] ?? (() => { throw new Error("MAP_MISSING"); })(), activity).length === 0,
          deterministicKeyValid: question.type === "short_written" || question.options.some((option) => option.id === question.correctOptionId),
          duplicateOfRecordId: prior?.recordId ?? null,
          reviewerStatus: "pending",
          acceptedByAdjudication: null,
        }));
      }
    }
  }
  return records;
}

function writtenRecords(state: PrivateState, questions: readonly GeneratedQuestionRecord[]): WrittenGradingRecord[] {
  const records: WrittenGradingRecord[] = [];
  for (const material of ACTIVE_CORPUS) {
    const materialIndex = ACTIVE_CORPUS.findIndex((item) => item.id === material.id);
    const cases = ANSWER_CASES[materialIndex];
    const primaryActivity = primaryActivityEntry(state, material.id);
    const activity = primaryActivity?.[1];
    const activityOperationId = primaryActivity?.[0];
    const source = state.sources[material.id];
    if (cases === undefined || activity === undefined || activityOperationId === undefined || source === undefined) continue;
    const question = questions.find((item) => item.recordId === `question:${activityOperationId}:q2`);
    if (question === undefined) continue;
    for (const answerCase of cases) {
      const operationId = `written:${material.id}:${answerCase}`;
      const evaluation = state.writtenEvaluations[operationId];
      const answer = state.answers[operationId] ?? "";
      const providerCalled = answer.trim().length > 0;
      const window = evaluation === undefined ? undefined : gradingWindow(source, activity);
      records.push(writtenGradingRecordSchema.parse({
        schemaVersion: "written-grading-record.v1",
        recordId: `written-record:${material.id}:${answerCase}`,
        operationId: providerCalled ? operationId : null,
        materialId: material.id,
        questionRecordId: question.recordId,
        answerCase,
        answerText: answer,
        answerHash: sha256(answer),
        providerCalled,
        awardedMarks: evaluation?.awardedMarks ?? null,
        status: evaluation?.status ?? "pending",
        groundingValid: evaluation === undefined || window === undefined ? null : validateWrittenEvaluation(window, activity.questions[1], evaluation)
          .every((item) => item.reason !== "UNKNOWN_SEGMENT" && item.reason !== "QUOTE_NOT_FOUND"),
        reconciliationValid: evaluation === undefined
          ? null
          : evaluation.criterionResults.reduce((sum, item) => sum + item.awardedMarks, 0) === evaluation.awardedMarks,
        reviewerStatus: "pending",
        adjudicatedMark: null,
        adjudicatedStatus: null,
      }));
    }
    const plan = state.revisions[`revision:${material.id}`];
    if (plan !== undefined) {
      const retryOperationId = `retry-written:${material.id}:correct`;
      const retryEvaluation = state.writtenEvaluations[retryOperationId];
      const retryAnswer = state.answers[retryOperationId] ?? "";
      const retryQuestion = questions.find((item) => item.recordId === `question:revision:${material.id}:q2`);
      if (retryQuestion !== undefined) {
        const retryWindow = retryEvaluation === undefined ? undefined : gradingWindow(source, plan.retryActivity);
        records.push(writtenGradingRecordSchema.parse({
          schemaVersion: "written-grading-record.v1",
          recordId: `written-record:${material.id}:retry-correct`,
          operationId: retryOperationId,
          materialId: material.id,
          questionRecordId: retryQuestion.recordId,
          answerCase: "correct",
          answerText: retryAnswer,
          answerHash: sha256(retryAnswer),
          providerCalled: true,
          awardedMarks: retryEvaluation?.awardedMarks ?? null,
          status: retryEvaluation?.status ?? "pending",
          groundingValid: retryEvaluation === undefined || retryWindow === undefined
            ? null
            : validateWrittenEvaluation(retryWindow, plan.retryActivity.questions[1], retryEvaluation)
              .every((item) => item.reason !== "UNKNOWN_SEGMENT" && item.reason !== "QUOTE_NOT_FOUND"),
          reconciliationValid: retryEvaluation === undefined
            ? null
            : retryEvaluation.criterionResults.reduce((sum, item) => sum + item.awardedMarks, 0) === retryEvaluation.awardedMarks,
          reviewerStatus: "pending",
          adjudicatedMark: null,
          adjudicatedStatus: null,
        }));
      }
    }
  }
  return records;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : typeof value === "string" ? value : JSON.stringify(value);
  return `"${text.replaceAll("\"", "\"\"")}"`;
}

function toCsv(rows: readonly Record<string, unknown>[], headers: readonly string[]): string {
  return `${headers.map(csvCell).join(",")}\n${rows.map((row) => headers.map((header) => csvCell(row[header])).join(",")).join("\n")}\n`;
}

async function readManifest(): Promise<EvaluationMaterial[]> {
  const value = JSON.parse(await readFile(MANIFEST_PATH, "utf8")) as {
    materials?: unknown[];
    evaluationMaterials?: unknown[];
  };
  return (value.evaluationMaterials ?? [])
    .map((item) => evaluationMaterialSchema.parse(item));
}

function fixedReliabilityOperations(state: PrivateState): ProviderOperation[] {
  const specifications: Array<{
    operationId: string;
    materialId: string;
    operationType: ProviderOperation["operationType"];
    artifactPresent: boolean;
  }> = [];
  for (const [index, material] of ACTIVE_CORPUS.entries()) {
    specifications.push({
      operationId: `analysis:${material.id}`,
      materialId: material.id,
      operationType: "analysis",
      artifactPresent: state.preparationMaps[material.id] !== undefined,
    });
    const runs = ASSESSMENT_RUN_COUNTS.get(material.id) ?? 0;
    for (let run = 1; run <= runs; run += 1) {
      const operationId = `assessment:${material.id}:r${String(run)}`;
      specifications.push({
        operationId,
        materialId: material.id,
        operationType: "assessment_generation",
        artifactPresent: state.activities[operationId] !== undefined,
      });
    }
    if (index < 6) {
      for (const answerCase of ANSWER_CASES[index] ?? []) {
        const operationId = `written:${material.id}:${answerCase}`;
        specifications.push({
          operationId,
          materialId: material.id,
          operationType: "written_grading",
          artifactPresent: state.writtenEvaluations[operationId] !== undefined,
        });
      }
    }
    if (index < 3) {
      const operationId = `revision:${material.id}`;
      specifications.push({
        operationId,
        materialId: material.id,
        operationType: "revision_retry_generation",
        artifactPresent: state.revisions[operationId] !== undefined,
      });
    }
  }
  if (specifications.length !== 45) throw new Error("R1_LOGICAL_OPERATION_PLAN_INVALID");
  const byId = new Map(state.providerOperations.map((item) => [item.operationId, item]));
  return specifications.map((specification) => {
    const recorded = byId.get(specification.operationId);
    if (recorded !== undefined) return recorded;
    return providerOperationSchema.parse({
      schemaVersion: "provider-operation.v1",
      operationId: specification.operationId,
      materialId: specification.materialId,
      modelId: MODEL,
      operationType: specification.operationType,
      promptVersion: specification.artifactPresent ? "deterministic-no-provider.v1" : "dependency-unavailable.v1",
      providerSchemaVersion: "none",
      thinkingLevel: "minimal",
      temperature: 0,
      maxOutputTokens: 1,
      timestamp: state.updatedAt,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      firstPassValid: specification.artifactPresent,
      repairAttempted: false,
      repairSuccess: false,
      finalStatus: specification.artifactPresent ? "valid" : "controlled_failure",
      failureCategory: specification.artifactPresent ? null : "DEPENDENCY_UNAVAILABLE",
      evidenceFailureCount: 0,
      quoteFailureCount: 0,
      conceptFailureCount: 0,
      reconciliationFailureCount: 0,
      artifactHash: null,
    });
  });
}

async function exportPublic(state: PrivateState): Promise<void> {
  const materials = await readManifest();
  const extraction = await extractionRecords(state, ACTIVE_CORPUS);
  const questions = questionRecords(state);
  const written = writtenRecords(state, questions);
  const providerAttempts = state.providerOperations
    .map((item) => {
      const inferredRepair = item.finalStatus === "controlled_failure" &&
        (item.failureCategory === "INVALID_OUTPUT" || item.failureCategory === "EVIDENCE_INVALID");
      return providerOperationSchema.parse({
        ...item,
        repairAttempted: item.repairAttempted || inferredRepair,
        repairSuccess: item.repairSuccess && !inferredRepair,
      });
    })
    .toSorted((left, right) => left.operationId.localeCompare(right.operationId));
  const provider = fixedReliabilityOperations({ ...state, providerOperations: providerAttempts })
    .toSorted((left, right) => left.operationId.localeCompare(right.operationId));
  const completedAdaptive = state.adaptiveRecords.toSorted((left, right) => left.recordId.localeCompare(right.recordId));
  const adaptiveByMaterial = new Map(completedAdaptive.map((item) => [item.materialId, item]));
  const adaptive: AdaptiveLoopRecord[] = ACTIVE_CORPUS.map((material) => {
    const completed = adaptiveByMaterial.get(material.id);
    if (completed !== undefined) return adaptiveLoopRecordSchema.parse({
      ...completed,
      failureCategory: completed.failureCategory ?? null,
    });
    const plan = state.revisions[`revision:${material.id}`];
    const relatedFailures = state.providerOperations.filter((item) =>
      item.materialId === material.id &&
      item.finalStatus === "controlled_failure" &&
      (
        item.operationType === "analysis" ||
        item.operationType === "revision_retry_generation" ||
        item.operationType === "written_grading"
      ),
    );
    const lastFailure = relatedFailures.at(-1);
    const failed = lastFailure !== undefined || plan !== undefined;
    return adaptiveLoopRecordSchema.parse({
      schemaVersion: "adaptive-loop-record.v1",
      recordId: `adaptive:${material.id}`,
      materialId: material.id,
      operationId: lastFailure?.operationId ?? (plan === undefined ? null : `revision:${material.id}`),
      status: failed ? "controlled_failure" : "pending",
      failureCategory: lastFailure?.failureCategory ?? (plan === undefined ? null : "RETRY_EVALUATION_INCOMPLETE"),
      revisionMode: plan?.retryMode ?? null,
      targetConceptIds: plan?.targetConceptIds ?? [],
      fabricatedWeaknessCount: 0,
      revisionGroundingFailures: 0,
      retryGroundingFailures: 0,
      duplicateFailures: 0,
      originalScore: null,
      retryScore: null,
      scoreChange: null,
      persistenceRecoveryPassed: null,
      statePreservationPassed: null,
    });
  });
  const baseline: BaselineRecord[] = ACTIVE_CORPUS.map((material) => {
    const operationId = `baseline:${material.id}`;
    const output = state.baselineOutput[operationId];
    const parsed = output === undefined ? { parsed: 0, transparent: 0 } : parseBaseline(output);
    return baselineRecordSchema.parse({
      schemaVersion: "baseline-record.v1",
      recordId: `baseline-record:${material.id}`,
      operationId: output === undefined ? null : operationId,
      materialId: material.id,
      requestedQuestionCount: baselineQuestionCount(material.id),
      parsedQuestionCount: parsed.parsed,
      parseSuccess: parsed.parsed === baselineQuestionCount(material.id),
      evidenceTransparencyCount: parsed.transparent,
      outputHash: output === undefined ? null : sha256(output),
      reviewerStatus: "pending",
    });
  });
  const questionAnnotations: HumanQuestionAnnotation[] = questions.flatMap((question) =>
    (["R1", "R2", "ADJ"] as const).map((reviewerId) => humanQuestionAnnotationSchema.parse({
      schemaVersion: "human-question-annotation.v1",
      questionRecordId: question.recordId,
      reviewerId,
      sourceGrounded: null,
      correctAnswerKey: null,
      answerableFromEvidence: null,
      clear: null,
      ambiguous: null,
      fairDifficulty: null,
      duplicate: null,
      languageQuality: null,
      explanationUseful: null,
      accept: null,
      disagreementReason: "",
      completedAt: null,
    })),
  );
  const writtenAnnotations: HumanWrittenAnnotation[] = written.flatMap((record) =>
    (["R1", "R2", "ADJ"] as const).map((reviewerId) => humanWrittenAnnotationSchema.parse({
      schemaVersion: "human-written-annotation.v1",
      writtenRecordId: record.recordId,
      reviewerId,
      mark: null,
      status: null,
      coveredConceptIds: [],
      missingConceptIds: [],
      incorrectOrUnsupportedClaims: [],
      feedbackUsefulness: null,
      disagreementReason: "",
      completedAt: null,
    })),
  );
  const metrics = aggregateMetricsSchema.parse(computeTask06Metrics({
    materials,
    extraction,
    questions,
    written,
    adaptive,
    provider,
    baseline,
    questionAnnotations,
    writtenAnnotations,
    generatedAt: state.updatedAt,
  }));
  await Promise.all([mkdir(PUBLIC_ROOT, { recursive: true }), mkdir(EXPORT_ROOT, { recursive: true }), mkdir(ANNOTATION_ROOT, { recursive: true })]);
  const files: Array<[string, unknown]> = [
    ["materials.json", materials],
    ["extraction-records.json", extraction],
    ["question-records.json", questions],
    ["written-grading-records.json", written],
    ["adaptive-loop-records.json", adaptive],
    ["provider-operations.json", provider],
    ["provider-attempts.json", providerAttempts],
    ["baseline-records.json", baseline],
  ];
  await Promise.all(files.map(([name, value]) => writeFile(resolve(PUBLIC_ROOT, name), `${JSON.stringify(value, null, 2)}\n`, "utf8")));
  await writeFile(resolve(EXPORT_ROOT, "aggregate-metrics.json"), `${JSON.stringify(metrics, null, 2)}\n`, "utf8");
  await writeFile(resolve(ANNOTATION_ROOT, "question-annotations.csv"), toCsv(
    questionAnnotations,
    Object.keys(questionAnnotations[0] ?? humanQuestionAnnotationSchema.parse({
      schemaVersion: "human-question-annotation.v1", questionRecordId: "placeholder", reviewerId: "R1",
      sourceGrounded: null, correctAnswerKey: null, answerableFromEvidence: null, clear: null, ambiguous: null,
      fairDifficulty: null, duplicate: null, languageQuality: null, explanationUseful: null, accept: null,
      disagreementReason: "", completedAt: null,
    })),
  ), "utf8");
  await writeFile(resolve(ANNOTATION_ROOT, "written-annotations.csv"), toCsv(
    writtenAnnotations,
    Object.keys(writtenAnnotations[0] ?? humanWrittenAnnotationSchema.parse({
      schemaVersion: "human-written-annotation.v1", writtenRecordId: "placeholder", reviewerId: "R1", mark: null, status: null,
      coveredConceptIds: [], missingConceptIds: [], incorrectOrUnsupportedClaims: [], feedbackUsefulness: null,
      disagreementReason: "", completedAt: null,
    })),
  ), "utf8");
  const metricRows: Array<Record<string, unknown>> = [];
  const addRatio = (metric: string, value: { count: number; denominator: number; percentage: number | null; status: string }) => {
    metricRows.push({ metric, ...value });
  };
  addRatio("extraction.page_success", metrics.extraction.pageSuccess);
  addRatio("extraction.routing_accuracy", metrics.extraction.routingAccuracy);
  addRatio("extraction.material_correction_pages", metrics.extraction.materialCorrectionPages);
  addRatio("questions.deterministic_grounding", metrics.questions.deterministicGrounding);
  addRatio("questions.deterministic_key_validity", metrics.questions.deterministicKeyValidity);
  addRatio("questions.duplicates", metrics.questions.duplicates);
  addRatio("questions.human_accepted", metrics.questions.humanAccepted);
  addRatio("questions.human_grounded_accepted", metrics.questions.humanGroundedAccepted);
  addRatio("questions.human_correct_keys", metrics.questions.humanCorrectKeys);
  addRatio("questions.human_ambiguous", metrics.questions.humanAmbiguous);
  addRatio("written.exact_agreement", metrics.written.exactAgreement);
  addRatio("written.within_one_mark", metrics.written.withinOneMark);
  addRatio("written.status_agreement", metrics.written.statusAgreement);
  addRatio("reliability.first_pass_valid", metrics.reliability.firstPassValid);
  addRatio("reliability.final_valid", metrics.reliability.finalValid);
  addRatio("reliability.repair_rate", metrics.reliability.repairRate);
  addRatio("reliability.repair_success", metrics.reliability.repairSuccess);
  addRatio("adaptive.valid", metrics.adaptive.valid);
  addRatio("baseline.parse_success", metrics.baseline.parseSuccess);
  addRatio("baseline.evidence_transparency", metrics.baseline.evidenceTransparency);
  await writeFile(
    resolve(EXPORT_ROOT, "aggregate-tables.csv"),
    toCsv(metricRows, ["metric", "count", "denominator", "percentage", "status"]),
    "utf8",
  );
  await writeFile(
    resolve(EXPORT_ROOT, "error-analysis.csv"),
    toCsv(
      provider
        .filter((item) => item.finalStatus === "controlled_failure")
        .map((item) => ({
          operationId: item.operationId,
          materialId: item.materialId,
          operationType: item.operationType,
          failureCategory: item.failureCategory,
          repairAttempted: item.repairAttempted,
          latencyMs: item.latencyMs,
          publicImpact: item.operationType === "analysis" ? "dependent structured path unavailable" : "operation rejected atomically",
        })),
      ["operationId", "materialId", "operationType", "failureCategory", "repairAttempted", "latencyMs", "publicImpact"],
    ),
    "utf8",
  );
  await writeFile(
    resolve(EXPORT_ROOT, "baseline-comparison.csv"),
    toCsv([
      {
        system: "Ankur structured pipeline",
        materials: new Set(questions.map((item) => item.materialId)).size,
        generatedQuestions: questions.length,
        parseOrSchemaValid: questions.filter((item) => item.deterministicGroundingValid).length,
        evidenceTransparent: questions.filter((item) => item.evidenceSegmentIds.length > 0).length,
        humanAcceptance: "pending",
      },
      {
        system: "One-prompt Gemma 4 baseline",
        materials: baseline.filter((item) => item.operationId !== null).length,
        generatedQuestions: baseline.reduce((sum, item) => sum + item.parsedQuestionCount, 0),
        parseOrSchemaValid: baseline.filter((item) => item.parseSuccess).reduce((sum, item) => sum + item.parsedQuestionCount, 0),
        evidenceTransparent: baseline.reduce((sum, item) => sum + item.evidenceTransparencyCount, 0),
        humanAcceptance: "pending",
      },
    ], ["system", "materials", "generatedQuestions", "parseOrSchemaValid", "evidenceTransparent", "humanAcceptance"]),
    "utf8",
  );
  process.stdout.write(`Public export: ${String(questions.length)} questions, ${String(written.length)} written cases, ${String(adaptive.length)} adaptive records.\n`);
}

async function validateDryRun(): Promise<void> {
  const materials = await readManifest();
  if (materials.length !== 9) throw new Error("CORPUS_SIZE_INVALID");
  if (new Set(materials.map((item) => item.domain)).size !== 3) throw new Error("DOMAIN_COVERAGE_INVALID");
  if (new Set(materials.map((item) => item.language)).size !== 3) throw new Error("LANGUAGE_COVERAGE_INVALID");
  if (new Set(materials.map((item) => item.inputType)).size < 4) throw new Error("INPUT_COVERAGE_INVALID");
  const plannedQuestions = [...ASSESSMENT_RUN_COUNTS.values()].reduce((sum, runs) => sum + runs * 2, 0);
  if (plannedQuestions < 30) {
    throw new Error("QUESTION_PLAN_INVALID");
  }
  process.stdout.write(`Task 06C-R1 evaluation dry-run PASSED: 9 materials (6 frozen + 3 holdout), 3 domains, 3 languages, 4 input types, ${String(plannedQuestions)} planned Ankur questions.\n`);
}

async function main(): Promise<void> {
  const modeArgument = process.argv.find((item) => item.startsWith("--mode="))?.slice("--mode=".length);
  const mode = process.env["ANKUR_EVALUATION_MODE"] ?? modeArgument ?? "dry-run";
  if (!["dry-run", "selected-material", "resume", "aggregate", "public-export"].includes(mode)) {
    throw new Error("UNKNOWN_EVALUATION_MODE");
  }
  const state = await loadState();
  if (mode === "dry-run") {
    await validateDryRun();
    return;
  }
  if (mode === "selected-material" || mode === "resume") {
    await runLive(state);
    await exportPublic(state);
    return;
  }
  await exportPublic(state);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error && /^[A-Z0-9_:.-]+$/u.test(error.message)
    ? error.message
    : "EVALUATION_RUNNER_FAILED";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
