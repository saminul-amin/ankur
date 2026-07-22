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
import type { EvidenceValidationFailure } from "../../src/domain/grounding/evidence.js";
import { validateActivitySet, type ActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import type {
  ProviderFailureCategory,
  ProviderValidationDiagnostic,
} from "../../src/infrastructure/gemma/provider-diagnostics.js";
import { parsePersistedIngestionSession, toPersistedIngestionSession } from "../../src/presentation/persistence/ingestion-session.js";
import { ApplicationError } from "../../src/shared/errors/application-error.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";

const RESULTS_PATH = resolve("evaluation/provider-reliability/RESULTS.md");
const EXPECTED_PROVIDER_OPERATIONS = 9;
const COMPLETE_CORRECT_ANSWER = "সালোকসংশ্লেষণে উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড গ্রহণ করে। পাতার ক্লোরোফিল সূর্যের আলো শোষণ করে প্রক্রিয়াটি চালায়। এতে উদ্ভিদের খাদ্য তৈরি হয় এবং অক্সিজেন বাইরে যায়।";
const PARTIAL_PARAPHRASE_ANSWER = "খাদ্য বানাতে উদ্ভিদ পানি এবং কার্বন ডাই-অক্সাইডকে উপকরণ হিসেবে ব্যবহার করে।";

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

interface SafeDiagnostic extends ProviderValidationDiagnostic {
  readonly operation: string;
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
  readonly quoteFailures: number;
  readonly reconciliationFailures: number;
  readonly conceptFailures: number;
  readonly diagnostics: readonly SafeDiagnostic[];
}

class ObservingProvider implements GenerativeModelPort {
  readonly records: TransportRecord[] = [];
  attempts = 0;

  constructor(private readonly delegate: GenerativeModelPort) {}

  generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    return this.delegate.generateText(request);
  }

  healthCheck() {
    return this.delegate.healthCheck();
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    this.attempts += 1;
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

function categoryForProviderError(error: ProviderError): ProviderFailureCategory {
  switch (error.code) {
    case "REQUEST_REJECTED": return "provider_request_rejected";
    case "TIMEOUT": return "timeout";
    case "RATE_LIMITED": return "rate_limited";
    case "UNAVAILABLE": return "unavailable_or_network";
    default: return "unknown_controlled_failure";
  }
}

function controlledFailureDiagnostic(input: {
  readonly error: unknown;
  readonly operation: string;
  readonly modelId: "gemma-4-26b-a4b-it";
  readonly promptVersion: string;
  readonly schemaVersion: string;
}): SafeDiagnostic {
  const category = input.error instanceof ProviderError
    ? categoryForProviderError(input.error)
    : input.error instanceof ApplicationError && input.error.code === "EVIDENCE_INVALID"
      ? "invalid_evidence"
      : "unknown_controlled_failure";
  const code = input.error instanceof ProviderError || input.error instanceof ApplicationError
    ? input.error.code
    : "CONTROLLED_FAILURE";
  return {
    operation: input.operation,
    modelId: input.modelId,
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    phase: "repair",
    category,
    code,
    fieldPath: "$",
    expected: "final-valid controlled operation",
  };
}

function categoryForValidation(failure: EvidenceValidationFailure): ProviderFailureCategory {
  if (failure.reason === "QUOTE_NOT_FOUND") return "quote_mismatch";
  if (failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED") return "invalid_evidence";
  if (failure.reason === "UNKNOWN_CONCEPT") return "concept_mismatch";
  if (failure.path.includes("rubric")) return "rubric_mismatch";
  if (failure.path.includes("criterion") || failure.path === "awardedMarks" || failure.path === "status") return "mark_reconciliation_mismatch";
  return "transport_schema_mismatch";
}

function diagnosticsForValidation(input: {
  readonly failures: readonly EvidenceValidationFailure[];
  readonly operation: string;
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly phase: "first_pass" | "repair";
}): SafeDiagnostic[] {
  return input.failures.map((failure) => ({
    operation: input.operation,
    modelId: "gemma-4-26b-a4b-it",
    promptVersion: input.promptVersion,
    schemaVersion: input.schemaVersion,
    phase: input.phase,
    category: categoryForValidation(failure),
    code: failure.reason,
    fieldPath: failure.path,
    expected: failure.reason === "QUOTE_NOT_FOUND"
      ? "normalized quote in cited segment"
      : failure.reason === "UNKNOWN_CONCEPT"
        ? "allowed preparation-map concept"
        : failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED"
          ? "allowed confirmed-source evidence"
          : "domain-valid reconciled artifact",
  }));
}

function operation(input: {
  readonly label: string;
  readonly finalSuccess: boolean;
  readonly applicationCalls: number;
  readonly wallStartedAt: number;
  readonly transportAttempts: number;
  readonly transport: readonly TransportRecord[];
  readonly diagnostics: readonly SafeDiagnostic[];
  readonly validationFailures?: readonly EvidenceValidationFailure[];
}): OperationRecord {
  const validationFailures = input.validationFailures ?? [];
  return {
    label: input.label,
    finalSuccess: input.finalSuccess,
    firstPass: input.finalSuccess && input.applicationCalls === 1 && input.transport.every((record) => !record.repaired),
    wallLatencyMs: Math.round(performance.now() - input.wallStartedAt),
    transportCalls: input.transportAttempts,
    promptTokens: total(input.transport, "promptTokens"),
    outputTokens: total(input.transport, "outputTokens"),
    networkRetries: total(input.transport, "networkRetries"),
    groundingFailures: validationFailures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED").length,
    quoteFailures: validationFailures.filter((failure) => failure.reason === "QUOTE_NOT_FOUND").length,
    reconciliationFailures: validationFailures.filter((failure) => failure.path.includes("criterion") || failure.path === "awardedMarks" || failure.path === "status" || failure.path.includes("rubric")).length,
    conceptFailures: validationFailures.filter((failure) => failure.reason === "UNKNOWN_CONCEPT").length,
    diagnostics: input.diagnostics,
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
  const validationDiagnostics: ProviderValidationDiagnostic[] = [];
  const provider = new ObservingProvider(new GoogleGenAiAdapter(
    config.apiKey,
    config.primaryModel,
    undefined,
    (diagnostic) => validationDiagnostics.push(diagnostic),
  ));
  const contentAdapter = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const writtenAdapter = new GemmaWrittenEvaluationAdapter(provider, config.requestTimeoutMs);
  const operations: OperationRecord[] = [];
  let emptyChecks = 0;
  let emptyProviderCalls = 0;
  let statePreservationChecks = 0;

  for (let iteration = 1; iteration <= 3; iteration += 1) {
    const assessmentLabel = `assessment-${String(iteration)}`;
    const assessmentTransportStart = provider.records.length;
    const assessmentAttemptStart = provider.attempts;
    const assessmentDiagnosticStart = validationDiagnostics.length;
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
      const diagnostics = [
        ...validationDiagnostics.slice(assessmentDiagnosticStart).map((diagnostic) => ({ ...diagnostic, operation: assessmentLabel })),
        ...diagnosticsForValidation({ failures, operation: assessmentLabel, promptVersion: "assessment.v4", schemaVersion: "activity-set.v2", phase: assessmentCalls === 1 ? "first_pass" : "repair" }),
      ];
      operations.push(operation({
        label: assessmentLabel,
        finalSuccess: failures.length === 0,
        applicationCalls: assessmentCalls,
        wallStartedAt: assessmentStartedAt,
        transportAttempts: provider.attempts - assessmentAttemptStart,
        transport: provider.records.slice(assessmentTransportStart),
        diagnostics,
        validationFailures: failures,
      }));
    } catch (error) {
      const diagnostics = validationDiagnostics.slice(assessmentDiagnosticStart).map((diagnostic) => ({ ...diagnostic, operation: assessmentLabel }));
      if (diagnostics.length === 0) diagnostics.push(controlledFailureDiagnostic({
        error, operation: assessmentLabel, modelId: config.primaryModel, promptVersion: "assessment.v4", schemaVersion: "activity-set.v2",
      }));
      operations.push(operation({
        label: assessmentLabel,
        finalSuccess: false,
        applicationCalls: assessmentCalls,
        wallStartedAt: assessmentStartedAt,
        transportAttempts: provider.attempts - assessmentAttemptStart,
        transport: provider.records.slice(assessmentTransportStart),
        diagnostics,
      }));
      continue;
    }

    const window = gradingSource(source, activity);
    const question = activity.questions[1];
    const partialAnswer = PARTIAL_PARAPHRASE_ANSWER;

    const persisted = toPersistedIngestionSession({
      stage: "assessment", mode: "live", sourceKind: "text", pages: [], priorityInstruction: "",
      confirmedSource: source, preparationMap: map,
      assessmentConfiguration: { title: activity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
      activitySet: activity, selectedOptionId: activity.questions[0].correctOptionId, writtenAnswer: partialAnswer, currentQuestionIndex: 1,
    });
    let controlledFailureObserved = false;
    try {
      await new EvaluateWrittenAnswer({
        evaluateWrittenAnswer: () => Promise.reject(new ProviderError("TIMEOUT")),
      }).execute({ source: window, question, studentAnswer: partialAnswer, requestId: crypto.randomUUID() });
    } catch (error) {
      controlledFailureObserved = error instanceof ProviderError && error.code === "TIMEOUT";
    }
    const restored = parsePersistedIngestionSession(persisted);
    statePreservationChecks += controlledFailureObserved && restored?.activitySet?.id === activity.id && restored.writtenAnswer === partialAnswer && restored.confirmedSource?.sourceVersionId === source.sourceVersionId ? 1 : 0;

    for (const answerKind of ["correct", "partial"] as const) {
      const label = `${answerKind}-${String(iteration)}`;
      const answer = answerKind === "correct" ? COMPLETE_CORRECT_ANSWER : partialAnswer;
      const transportStart = provider.records.length;
      const attemptStart = provider.attempts;
      const diagnosticStart = validationDiagnostics.length;
      const wallStartedAt = performance.now();
      let applicationCalls = 0;
      const observedWritten: WrittenEvaluationPort = {
        evaluateWrittenAnswer: (input) => {
          applicationCalls += 1;
          return writtenAdapter.evaluateWrittenAnswer(input);
        },
      };
      try {
        const result = await new EvaluateWrittenAnswer(observedWritten).execute({ source: window, question, studentAnswer: answer, requestId: crypto.randomUUID() });
        const validationFailures = validateWrittenEvaluation(window, question, result);
        const expectedStatus = answerKind === "correct"
          ? result.status === "correct" && result.awardedMarks === 5
          : result.status === "partially_correct" && result.awardedMarks > 0 && result.awardedMarks < 5;
        const failures: EvidenceValidationFailure[] = expectedStatus
          ? validationFailures
          : [...validationFailures, { path: "awardedMarks", reason: "INVARIANT_VIOLATION" }];
        const diagnostics = [
          ...validationDiagnostics.slice(diagnosticStart).map((diagnostic) => ({ ...diagnostic, operation: label })),
          ...diagnosticsForValidation({ failures, operation: label, promptVersion: "written-evaluation.v5", schemaVersion: "written-evaluation.v1", phase: applicationCalls === 1 ? "first_pass" : "repair" }),
        ];
        operations.push(operation({
          label, finalSuccess: failures.length === 0 && expectedStatus, applicationCalls, wallStartedAt,
          transportAttempts: provider.attempts - attemptStart, transport: provider.records.slice(transportStart), diagnostics, validationFailures: failures,
        }));
      } catch (error) {
        const diagnostics = validationDiagnostics.slice(diagnosticStart).map((diagnostic) => ({ ...diagnostic, operation: label }));
        if (diagnostics.length === 0) diagnostics.push(controlledFailureDiagnostic({
          error, operation: label, modelId: config.primaryModel, promptVersion: "written-evaluation.v5", schemaVersion: "written-evaluation.v1",
        }));
        operations.push(operation({
          label, finalSuccess: false, applicationCalls, wallStartedAt,
          transportAttempts: provider.attempts - attemptStart, transport: provider.records.slice(transportStart), diagnostics,
        }));
      }
    }

    const emptyCallsBefore = provider.attempts;
    const empty = await new EvaluateWrittenAnswer(writtenAdapter).execute({ source: window, question, studentAnswer: "  \n ", requestId: crypto.randomUUID() });
    emptyChecks += empty.status === "not_answered" && empty.awardedMarks === 0 ? 1 : 0;
    emptyProviderCalls += provider.attempts - emptyCallsBefore;
  }

  const firstPassCount = operations.filter((record) => record.firstPass).length;
  const finalSuccessCount = operations.filter((record) => record.finalSuccess).length;
  const repairedValidCount = operations.filter((record) => record.finalSuccess && !record.firstPass).length;
  const groundingFailures = operations.reduce((sum, record) => sum + record.groundingFailures, 0);
  const quoteFailures = operations.reduce((sum, record) => sum + record.quoteFailures, 0);
  const reconciliationFailures = operations.reduce((sum, record) => sum + record.reconciliationFailures, 0);
  const conceptFailures = operations.reduce((sum, record) => sum + record.conceptFailures, 0);
  const firstPassRate = operations.length === 0 ? 0 : (firstPassCount / operations.length) * 100;
  const finalSuccessRate = operations.length === 0 ? 0 : (finalSuccessCount / operations.length) * 100;
  const passed = operations.length === EXPECTED_PROVIDER_OPERATIONS
    && finalSuccessCount === EXPECTED_PROVIDER_OPERATIONS
    && groundingFailures === 0
    && quoteFailures === 0
    && reconciliationFailures === 0
    && conceptFailures === 0
    && emptyChecks === 3
    && emptyProviderCalls === 0
    && statePreservationChecks === 3;
  const latencies = operations.map((record) => record.wallLatencyMs);
  const allDiagnostics = operations.flatMap((record) => record.diagnostics);
  const report = `# Task 04B.2 Provider Reliability Benchmark

- Gate: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Fixture: team-authored repository photosynthesis source
- Correct-answer fixture: team-authored complete paraphrase, not the generated reference text
- Partial-answer fixture: team-authored incomplete paraphrase, not source or generated-reference text
- Model: \`${config.primaryModel}\`
- Assessment thinking: \`minimal\` first pass; \`high\` only for bounded application repair
- Written-grading thinking: \`high\`
- Non-empty structural schema-repair thinking: \`minimal\`
- Assessment prompt/schema: \`assessment.v5\`; \`assessment-mcq.v5\`, \`assessment-written-question.v5\`, and \`assessment-written-rubric.v5\`
- Written prompt/schema: \`written-evaluation.v5\`; \`written-evaluation-transport.v5\`
- Provider operations completed: ${String(operations.length)}/${String(EXPECTED_PROVIDER_OPERATIONS)}
- First-pass validated: ${String(firstPassCount)}/${String(operations.length)} (${firstPassRate.toFixed(1)}%) — optimization metric only
- Repaired-valid operations: ${String(repairedValidCount)}
- Repair rate: ${(100 - firstPassRate).toFixed(1)}%
- Final validated success: ${String(finalSuccessCount)}/${String(operations.length)} (${finalSuccessRate.toFixed(1)}%)
- Grounding failures: ${String(groundingFailures)}
- Quote failures: ${String(quoteFailures)}
- Criterion/mark reconciliation failures: ${String(reconciliationFailures)}
- Concept failures: ${String(conceptFailures)}
- Deterministic empty-answer checks: ${String(emptyChecks)}/3
- Provider calls caused by empty answers: ${String(emptyProviderCalls)}
- Controlled state-preservation checks: ${String(statePreservationChecks)}/3
- Median operation latency: ${String(median(latencies))} ms
- Maximum operation latency: ${String(Math.max(0, ...latencies))} ms
- Prompt tokens reported: ${String(total(provider.records, "promptTokens"))}
- Output tokens reported: ${String(total(provider.records, "outputTokens"))}
- Network retries: ${String(total(provider.records, "networkRetries"))}

## Per-operation metadata

| Operation | Final | First pass | Wall latency (ms) | Transport calls | Prompt tokens | Output tokens | Network retries |
|---|---:|---:|---:|---:|---:|---:|---:|
${operations.map((record) => `| ${record.label} | ${record.finalSuccess ? "yes" : "no"} | ${record.firstPass ? "yes" : "no"} | ${String(record.wallLatencyMs)} | ${String(record.transportCalls)} | ${String(record.promptTokens)} | ${String(record.outputTokens)} | ${String(record.networkRetries)} |`).join("\n")}

## Sanitized failure taxonomy

${allDiagnostics.length === 0 ? "No schema or controlled-operation failures were observed." : `| Operation | Phase | Category | Code | Field path | Expected | Model | Prompt | Schema |\n|---|---|---|---|---|---|---|---|---|\n${allDiagnostics.map((item) => `| ${item.operation} | ${item.phase} | ${item.category} | ${item.code} | \`${item.fieldPath}\` | ${item.expected} | \`${item.modelId}\` | \`${item.promptVersion}\` | \`${item.schemaVersion}\` |`).join("\n")}`}

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
