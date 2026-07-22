import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { LearningContentGenerationPort } from "../../src/application/ports/learning-content-port.js";
import type {
  GenerativeModelPort,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "../../src/application/ports/generative-model-port.js";
import type { WrittenEvaluationPort } from "../../src/application/ports/written-evaluation-port.js";
import { createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { EvaluateWrittenAnswer } from "../../src/application/use-cases/evaluate-written-answer.js";
import { GenerateMixedAssessment } from "../../src/application/use-cases/generate-mixed-assessment.js";
import { validateActivitySet, type ActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";

const RESULTS_PATH = resolve("evaluation/provider-reliability/RESULTS.md");
const EXPECTED_PROVIDER_OPERATIONS = 9;

interface TransportRecord {
  readonly schemaVersion: string;
  readonly promptVersion: string;
  readonly thinkingLevel: "minimal" | "high";
  readonly latencyMs: number;
  readonly repaired: boolean;
  readonly promptTokens?: number;
  readonly outputTokens?: number;
  readonly networkRetries: number;
}

interface OperationRecord {
  readonly label: string;
  readonly finalSuccess: boolean;
  readonly firstPass: boolean;
  readonly wallLatencyMs: number;
  readonly transportCalls: number;
  readonly promptTokens: number;
  readonly outputTokens: number;
  readonly networkRetries: number;
  readonly groundingFailures: number;
  readonly reconciliationFailures: number;
}

class ObservingProvider implements GenerativeModelPort {
  readonly records: TransportRecord[] = [];

  constructor(private readonly delegate: GenerativeModelPort) {}

  generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return this.delegate.generateText(request);
  }

  healthCheck() {
    return this.delegate.healthCheck();
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    const result = await this.delegate.generateStructured(request);
    this.records.push({
      schemaVersion: request.schemaVersion,
      promptVersion: request.promptVersion,
      thinkingLevel: request.thinkingLevel,
      latencyMs: result.metadata.latencyMs,
      repaired: result.repaired,
      ...(result.metadata.promptTokenCount === undefined ? {} : { promptTokens: result.metadata.promptTokenCount }),
      ...(result.metadata.outputTokenCount === undefined ? {} : { outputTokens: result.metadata.outputTokenCount }),
      networkRetries: result.metadata.networkRetryCount ?? 0,
    });
    return result;
  }
}

function total(records: readonly TransportRecord[], field: "promptTokens" | "outputTokens" | "networkRetries"): number {
  return records.reduce((sum, record) => sum + (record[field] ?? 0), 0);
}

function operation(input: {
  readonly label: string;
  readonly finalSuccess: boolean;
  readonly applicationCalls: number;
  readonly wallStartedAt: number;
  readonly transport: readonly TransportRecord[];
  readonly groundingFailures?: number;
  readonly reconciliationFailures?: number;
}): OperationRecord {
  return {
    label: input.label,
    finalSuccess: input.finalSuccess,
    firstPass: input.finalSuccess && input.applicationCalls === 1 && input.transport.every((record) => !record.repaired),
    wallLatencyMs: Math.round(performance.now() - input.wallStartedAt),
    transportCalls: input.transport.length,
    promptTokens: total(input.transport, "promptTokens"),
    outputTokens: total(input.transport, "outputTokens"),
    networkRetries: total(input.transport, "networkRetries"),
    groundingFailures: input.groundingFailures ?? 0,
    reconciliationFailures: input.reconciliationFailures ?? 0,
  };
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  const value = sorted[middle];
  if (value === undefined) return 0;
  if (sorted.length % 2 === 1) return value;
  return Math.round(((sorted[middle - 1] ?? value) + value) / 2);
}

function gradingSource(source: ReturnType<typeof createSampleSource>, activity: ActivitySet) {
  const question = activity.questions[1];
  const ids = new Set([
    ...question.evidence.map((reference) => reference.segmentId),
    ...question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
  ]);
  return rehydrateEvidenceWindow({
    sourceVersionId: source.sourceVersionId,
    language: source.language,
    segments: source.segments.filter((segment) => ids.has(segment.id)),
  });
}

async function main(): Promise<void> {
  if (process.env["ANKUR_PROVIDER_RELIABILITY_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit provider-reliability opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    process.stderr.write("CONFIGURATION_ERROR: live AI must be explicitly enabled and configured.\n");
    process.exitCode = 1;
    return;
  }

  const startedAt = new Date().toISOString();
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const provider = new ObservingProvider(new GoogleGenAiAdapter(config.apiKey, config.primaryModel));
  const contentAdapter = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const writtenAdapter = new GemmaWrittenEvaluationAdapter(provider, config.requestTimeoutMs);
  const operations: OperationRecord[] = [];
  let emptyChecks = 0;
  let emptyProviderCalls = 0;

  for (let iteration = 1; iteration <= 3; iteration += 1) {
    const assessmentTransportStart = provider.records.length;
    const assessmentStartedAt = performance.now();
    let assessmentCalls = 0;
    const content: LearningContentGenerationPort = {
      generatePreparationMap: (input) => contentAdapter.generatePreparationMap(input),
      generateMixedAssessment: (input) => {
        assessmentCalls += 1;
        return contentAdapter.generateMixedAssessment(input);
      },
    };
    let activity: ActivitySet | undefined;
    try {
      activity = await new GenerateMixedAssessment(content).execute({
        source,
        preparationMap: map,
        selectedConceptIds: map.concepts.map((concept) => concept.id),
        title: "সালোকসংশ্লেষণ · নির্ভরযোগ্যতা মূল্যায়ন",
        difficulty: "medium",
        requestId: crypto.randomUUID(),
      });
      const failures = validateActivitySet(source, map, activity);
      operations.push(operation({
        label: `assessment-${String(iteration)}`,
        finalSuccess: failures.length === 0,
        applicationCalls: assessmentCalls,
        wallStartedAt: assessmentStartedAt,
        transport: provider.records.slice(assessmentTransportStart),
        groundingFailures: failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "QUOTE_NOT_FOUND" || failure.reason === "EVIDENCE_REQUIRED").length,
        reconciliationFailures: failures.filter((failure) => failure.path.includes("rubric")).length,
      }));
    } catch {
      operations.push(operation({
        label: `assessment-${String(iteration)}`,
        finalSuccess: false,
        applicationCalls: assessmentCalls,
        wallStartedAt: assessmentStartedAt,
        transport: provider.records.slice(assessmentTransportStart),
      }));
      continue;
    }

    const window = gradingSource(source, activity);
    for (const answerKind of ["correct", "partial"] as const) {
      const question = activity.questions[1];
      const answer = answerKind === "correct"
        ? question.referenceAnswer
        : question.referenceAnswer.trim().split(/\s+/u).slice(0, Math.max(3, Math.ceil(question.referenceAnswer.trim().split(/\s+/u).length * 0.45))).join(" ");
      const transportStart = provider.records.length;
      const wallStartedAt = performance.now();
      let applicationCalls = 0;
      const observedWritten: WrittenEvaluationPort = {
        evaluateWrittenAnswer: (input) => {
          applicationCalls += 1;
          return writtenAdapter.evaluateWrittenAnswer(input);
        },
      };
      try {
        const result = await new EvaluateWrittenAnswer(observedWritten).execute({
          source: window,
          question,
          studentAnswer: answer,
          requestId: crypto.randomUUID(),
        });
        const failures = validateWrittenEvaluation(window, question, result);
        const expectedStatus = answerKind === "correct"
          ? result.status === "correct" && result.awardedMarks === 5
          : result.status === "partially_correct" && result.awardedMarks > 0 && result.awardedMarks < 5;
        operations.push(operation({
          label: `${answerKind}-${String(iteration)}`,
          finalSuccess: failures.length === 0 && expectedStatus,
          applicationCalls,
          wallStartedAt,
          transport: provider.records.slice(transportStart),
          groundingFailures: failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "QUOTE_NOT_FOUND" || failure.reason === "EVIDENCE_REQUIRED").length,
          reconciliationFailures: failures.filter((failure) => failure.path.includes("criterion") || failure.path === "awardedMarks" || failure.path === "status").length,
        }));
      } catch {
        operations.push(operation({
          label: `${answerKind}-${String(iteration)}`,
          finalSuccess: false,
          applicationCalls,
          wallStartedAt,
          transport: provider.records.slice(transportStart),
        }));
      }
    }

    const emptyCallsBefore = provider.records.length;
    const empty = await new EvaluateWrittenAnswer(writtenAdapter).execute({
      source: window,
      question: activity.questions[1],
      studentAnswer: "  \n ",
      requestId: crypto.randomUUID(),
    });
    emptyChecks += empty.status === "not_answered" && empty.awardedMarks === 0 ? 1 : 0;
    emptyProviderCalls += provider.records.length - emptyCallsBefore;
  }

  const firstPassCount = operations.filter((record) => record.firstPass).length;
  const finalSuccessCount = operations.filter((record) => record.finalSuccess).length;
  const groundingFailures = operations.reduce((sum, record) => sum + record.groundingFailures, 0);
  const reconciliationFailures = operations.reduce((sum, record) => sum + record.reconciliationFailures, 0);
  const firstPassRate = operations.length === 0 ? 0 : (firstPassCount / operations.length) * 100;
  const finalSuccessRate = operations.length === 0 ? 0 : (finalSuccessCount / operations.length) * 100;
  const passed = operations.length === EXPECTED_PROVIDER_OPERATIONS
    && finalSuccessCount === EXPECTED_PROVIDER_OPERATIONS
    && firstPassRate >= 80
    && groundingFailures === 0
    && reconciliationFailures === 0
    && emptyChecks === 3
    && emptyProviderCalls === 0;
  const latencies = operations.map((record) => record.wallLatencyMs);
  const report = `# Task 04B Provider Reliability Benchmark

- Gate: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Fixture: team-authored repository photosynthesis source
- Model: \`${config.primaryModel}\`
- Assessment thinking: \`minimal\` first pass; \`high\` only for bounded application repair
- Written-grading thinking: \`high\`
- Assessment prompt/schema: \`assessment.v3\`; \`assessment-mcq.v3\` and \`assessment-written.v3\`
- Written prompt/schema: \`written-evaluation.v3\`; \`written-evaluation-transport.v3\`
- Provider operations completed: ${String(operations.length)}/${String(EXPECTED_PROVIDER_OPERATIONS)}
- First-pass validated: ${String(firstPassCount)}/${String(operations.length)} (${firstPassRate.toFixed(1)}%)
- Repair rate: ${(100 - firstPassRate).toFixed(1)}%
- Final validated success: ${String(finalSuccessCount)}/${String(operations.length)} (${finalSuccessRate.toFixed(1)}%)
- Grounding failures: ${String(groundingFailures)}
- Criterion-reconciliation failures: ${String(reconciliationFailures)}
- Deterministic empty-answer checks: ${String(emptyChecks)}/3
- Provider calls caused by empty answers: ${String(emptyProviderCalls)}
- Median operation latency: ${String(median(latencies))} ms
- Maximum operation latency: ${String(Math.max(0, ...latencies))} ms
- Prompt tokens reported: ${String(total(provider.records, "promptTokens"))}
- Output tokens reported: ${String(total(provider.records, "outputTokens"))}
- Network retries: ${String(total(provider.records, "networkRetries"))}

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
${operations.map((record) => `| ${record.label} | ${record.finalSuccess ? "yes" : "no"} | ${record.firstPass ? "yes" : "no"} | ${String(record.wallLatencyMs)} | ${String(record.transportCalls)} | ${String(record.promptTokens)} | ${String(record.outputTokens)} | ${String(record.networkRetries)} |`).join("\n")}

The report stores no credential, raw source, prompt, model response, reference answer, or student answer.
`;
  if (report.includes(config.apiKey)) throw new Error("Refusing to write a report containing the provider credential.");
  await mkdir(resolve("evaluation/provider-reliability"), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Provider reliability benchmark ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

void main().catch(() => {
  process.stderr.write("INTERNAL_ERROR: provider reliability benchmark failed safely.\n");
  process.exitCode = 1;
});
