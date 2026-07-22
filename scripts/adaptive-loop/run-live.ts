import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import type {
  GenerativeModelPort,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationRequest,
  TextGenerationResult,
} from "../../src/application/ports/generative-model-port.js";
import { createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { AnalyzeConfirmedSource } from "../../src/application/use-cases/analyze-confirmed-source.js";
import { EvaluateWrittenAnswer } from "../../src/application/use-cases/evaluate-written-answer.js";
import { GenerateMixedAssessment } from "../../src/application/use-cases/generate-mixed-assessment.js";
import { GeneratePersonalizedRevision } from "../../src/application/use-cases/generate-personalized-revision.js";
import { calculateConceptPerformance, reconcileAssessmentTotal } from "../../src/domain/assessments/concept-performance.js";
import { createEmptyWrittenEvaluation, validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { compareAssessmentAttempts } from "../../src/domain/revision/improvement-comparison.js";
import { selectRevisionTargets, validateRevisionPlan } from "../../src/domain/revision/revision-plan.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GemmaRevisionGenerationAdapter } from "../../src/infrastructure/gemma/gemma-revision-generation-adapter.js";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";
import { ApplicationError } from "../../src/shared/errors/application-error.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";
import { parsePersistedIngestionSession, toPersistedIngestionSession } from "../../src/presentation/persistence/ingestion-session.js";
import type { RevisionValidationDiagnostic } from "../../src/application/diagnostics/revision-validation-diagnostic.js";

const RESULTS_PATH = resolve(process.env["ANKUR_ADAPTIVE_RESULTS_PATH"] ?? "evaluation/adaptive-loop/RESULTS.md");

interface SafeProviderStats {
  calls: number;
  latencyMs: number;
  promptTokens: number;
  outputTokens: number;
  networkRetries: number;
  repairedStructuredCalls: number;
}

class ObservedProvider implements GenerativeModelPort {
  readonly stats: SafeProviderStats = { calls: 0, latencyMs: 0, promptTokens: 0, outputTokens: 0, networkRetries: 0, repairedStructuredCalls: 0 };
  constructor(private readonly inner: GenerativeModelPort) {}

  healthCheck() { return this.inner.healthCheck(); }

  async generateText(request: TextGenerationRequest): Promise<TextGenerationResult> {
    const result = await this.inner.generateText(request);
    this.record(result.metadata);
    return result;
  }

  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    const result = await this.inner.generateStructured(request);
    this.record(result.metadata);
    if (result.repaired) this.stats.repairedStructuredCalls += 1;
    return result;
  }

  private record(metadata: StructuredGenerationResult<unknown>["metadata"]) {
    this.stats.calls += 1;
    this.stats.latencyMs += metadata.latencyMs;
    this.stats.promptTokens += metadata.promptTokenCount ?? 0;
    this.stats.outputTokens += metadata.outputTokenCount ?? 0;
    this.stats.networkRetries += metadata.networkRetryCount ?? 0;
  }
}

function failureCounts(failures: readonly { readonly reason: string; readonly path: string }[]) {
  return {
    grounding: failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED").length,
    quotes: failures.filter((failure) => failure.reason === "QUOTE_NOT_FOUND").length,
    concepts: failures.filter((failure) => failure.reason === "UNKNOWN_CONCEPT").length,
    reconciliation: failures.filter((failure) => failure.path.includes("rubric") || failure.path.includes("criterion") || failure.path.includes("awardedMarks")).length,
    duplicates: failures.filter((failure) => failure.reason === "DUPLICATE_PROMPT").length,
  };
}

async function main() {
  if (process.env["ANKUR_ADAPTIVE_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit adaptive-live opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    process.stderr.write("CONFIGURATION_ERROR: live Gemma 4 runtime is not available.\n");
    process.exitCode = 1;
    return;
  }
  const startedAt = new Date().toISOString();
  const observed = new ObservedProvider(new GoogleGenAiAdapter(config.apiKey, config.primaryModel));
  const learningAdapter = new GemmaLearningContentAdapter(observed, config.requestTimeoutMs);
  const writtenAdapter = new GemmaWrittenEvaluationAdapter(observed, config.requestTimeoutMs);
  const revisionAdapter = new GemmaRevisionGenerationAdapter(observed, config.requestTimeoutMs);
  const generateAssessment = new GenerateMixedAssessment(learningAdapter);
  const analyzeSource = new AnalyzeConfirmedSource(learningAdapter);
  const evaluateWritten = new EvaluateWrittenAnswer(writtenAdapter);
  const revisionDiagnostics: RevisionValidationDiagnostic[] = [];
  const generateRevision = new GeneratePersonalizedRevision(revisionAdapter, (diagnostic) => {
    revisionDiagnostics.push(diagnostic);
    process.stderr.write(`REVISION_VALIDATION_DIAGNOSTIC ${JSON.stringify(diagnostic)}\n`);
  });
  const source = createSampleSource();
  const map = await analyzeSource.execute({ source, requestId: "adaptive-analysis" });
  const originalActivity = await generateAssessment.execute({
    source,
    preparationMap: map,
    selectedConceptIds: map.concepts.map((concept) => concept.id),
    title: "Adaptive loop live verification",
    difficulty: "medium",
    requestId: "adaptive-original",
  });
  const wrongOption = originalActivity.questions[0].options.find((option) => option.id !== originalActivity.questions[0].correctOptionId);
  if (wrongOption === undefined) throw new Error("No deterministic incorrect option exists.");
  const originalMcqGrade = gradeMcq(originalActivity.questions[0], wrongOption.id);
  const originalWrittenEvaluation = createEmptyWrittenEvaluation({ question: originalActivity.questions[1], requestId: "adaptive-original-empty" });
  const originalPerformance = calculateConceptPerformance({
    concepts: map.concepts,
    mcqQuestion: originalActivity.questions[0],
    mcqGrade: originalMcqGrade,
    writtenQuestion: originalActivity.questions[1],
    writtenEvaluation: originalWrittenEvaluation,
  });
  const plan = await generateRevision.execute({
    source,
    preparationMap: map,
    originalActivity,
    originalResultId: `result-${originalActivity.id}`,
    originalMcqGrade,
    performance: originalPerformance,
    writtenEvaluation: originalWrittenEvaluation,
    requestId: "adaptive-revision",
  });
  const selection = selectRevisionTargets({ preparationMap: map, performance: originalPerformance, writtenEvaluation: originalWrittenEvaluation });
  const activityFailures = validateActivitySet(source, map, originalActivity);
  const planFailures = validateRevisionPlan({
    source,
    preparationMap: map,
    originalActivity,
    originalResultId: `result-${originalActivity.id}`,
    expectedSelection: selection,
    writtenEvaluation: originalWrittenEvaluation,
    plan,
  });
  const retryMcqGrade = gradeMcq(plan.retryActivity.questions[0], plan.retryActivity.questions[0].correctOptionId);
  const retryWrittenEvaluation = await evaluateWritten.execute({
    source: {
      ...source,
      segments: source.segments.filter((segment) => new Set([
        ...plan.retryActivity.questions[1].evidence.map((reference) => reference.segmentId),
        ...plan.retryActivity.questions[1].rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
      ]).has(segment.id)),
    },
    question: plan.retryActivity.questions[1],
    studentAnswer: plan.retryActivity.questions[1].referenceAnswer,
    requestId: "adaptive-retry-written",
  });
  const retryWrittenFailures = validateWrittenEvaluation(source, plan.retryActivity.questions[1], retryWrittenEvaluation);
  const retryPerformance = calculateConceptPerformance({
    concepts: map.concepts,
    mcqQuestion: plan.retryActivity.questions[0],
    mcqGrade: retryMcqGrade,
    writtenQuestion: plan.retryActivity.questions[1],
    writtenEvaluation: retryWrittenEvaluation,
  });
  const retryTotalsReconcile = reconcileAssessmentTotal({ mcqGrade: retryMcqGrade, writtenEvaluation: retryWrittenEvaluation, performance: retryPerformance });
  const comparison = compareAssessmentAttempts({
    originalMcqGrade,
    originalWrittenEvaluation,
    originalPerformance,
    retryMcqGrade,
    retryWrittenEvaluation,
    retryPerformance,
  });
  const serialized = toPersistedIngestionSession({
    stage: "adaptive_results", mode: "live", sourceKind: "text", pages: [], priorityInstruction: "",
    confirmedSource: source, preparationMap: map, activitySet: originalActivity,
    assessmentConfiguration: { title: originalActivity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
    selectedOptionId: wrongOption.id, writtenAnswer: "", mcqGrade: originalMcqGrade, writtenEvaluation: originalWrittenEvaluation,
    conceptPerformance: originalPerformance, revisionPlan: plan, revisionOperationId: "adaptive-revision",
    retrySelectedOptionId: plan.retryActivity.questions[0].correctOptionId,
    retryWrittenAnswer: plan.retryActivity.questions[1].referenceAnswer, retryCurrentQuestionIndex: 1,
    retryMcqGrade, retryWrittenEvaluation, retryConceptPerformance: retryPerformance,
    retryWrittenOperationId: "adaptive-retry-written", improvementComparison: comparison,
  });
  const restored = parsePersistedIngestionSession(serialized);
  const persisted = restored?.stage === "adaptive_results" && restored.improvementComparison?.retryScore === comparison.retryScore;
  const stateLoss = restored?.confirmedSource?.sourceVersionId === source.sourceVersionId && restored.retryWrittenAnswer === plan.retryActivity.questions[1].referenceAnswer ? 0 : 1;
  const counts = failureCounts([...activityFailures, ...planFailures, ...retryWrittenFailures]);
  const conceptIds = new Set(map.concepts.map((concept) => concept.id));
  const conceptReferenceFailures = counts.concepts + plan.targetConceptIds.filter((id) => !conceptIds.has(id)).length + retryPerformance.filter((item) => !conceptIds.has(item.conceptId)).length;
  const permittedEvidenceIds = [...new Set(plan.items.flatMap((item) => item.evidence.map((reference) => reference.segmentId)))];
  const permittedEvidenceCharacters = source.segments
    .filter((segment) => permittedEvidenceIds.includes(segment.id))
    .reduce((sum, segment) => sum + segment.text.length, 0);
  const applicationRepairUsed = revisionDiagnostics.some((diagnostic) => diagnostic.phase === "first_pass");
  const passed = activityFailures.length === 0 && planFailures.length === 0 && retryWrittenFailures.length === 0
    && counts.grounding === 0 && counts.quotes === 0 && counts.reconciliation === 0 && counts.duplicates === 0
    && conceptReferenceFailures === 0 && retryTotalsReconcile && retryMcqGrade.correct
    && retryWrittenEvaluation.awardedMarks === 5 && comparison.retryScore > comparison.originalScore
    && persisted && stateLoss === 0;
  const report = `# Task 05 Live Adaptive-Loop Verification

- Gate check: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Model: ${config.primaryModel}
- Revision mode: ${plan.retryMode}
- Revision targets: ${String(plan.targetConceptIds.length)}
- Revision items: ${String(plan.items.length)}
- Retry composition: ${String(plan.retryActivity.questions[0].marks)}-mark MCQ + ${String(plan.retryActivity.questions[1].marks)}-mark written
- Original score: ${String(comparison.originalScore)}/6
- Retry score: ${String(comparison.retryScore)}/6
- Absolute change: ${comparison.absoluteChange > 0 ? "+" : ""}${String(comparison.absoluteChange)}
- Grounding failures: ${String(counts.grounding)}
- Quote failures: ${String(counts.quotes)}
- Concept-reference failures: ${String(conceptReferenceFailures)}
- Mark-reconciliation failures: ${String(counts.reconciliation + (retryTotalsReconcile ? 0 : 1))}
- Duplicate retry failures: ${String(counts.duplicates)}
- Persistence recovery: ${persisted ? "passed" : "failed"}
- Source or answer loss: ${String(stateLoss)}
- Provider calls observed: ${String(observed.stats.calls)}
- Provider latency sum: ${String(observed.stats.latencyMs)} ms
- Prompt tokens reported: ${String(observed.stats.promptTokens)}
- Output tokens reported: ${String(observed.stats.outputTokens)}
- Network retries: ${String(observed.stats.networkRetries)}
- Provider schema repairs: ${String(observed.stats.repairedStructuredCalls)}
- Application-level revision repair used: ${applicationRepairUsed ? "yes" : "no"}
- Final revision artifact repaired: ${plan.artifact.repaired ? "yes" : "no"}

## Safe revision operation metadata

- Build ID: ${process.env["ANKUR_BUILD_ID"]?.slice(0, 12) ?? "local-working-tree"}
- Source version ID: ${source.sourceVersionId}
- Revision prompt version: ${plan.artifact.promptVersion}
- Revision schema version: ${plan.schemaVersion}
- Thinking level: ${plan.artifact.thinkingLevel}
- Output-token budgets: memory cue 650; retry MCQ 900; retry written 900; retry rubric 900
- Target concept IDs: ${plan.targetConceptIds.join(", ")}
- Permitted evidence segment IDs: ${permittedEvidenceIds.join(", ")}
- Permitted evidence segments: ${String(permittedEvidenceIds.length)}
- Permitted evidence characters: ${String(permittedEvidenceCharacters)}
- Provider configured: yes
- Repair context: original prompts supplied as exclusion data; invalid repair component bounded to its shallow scalar transport
- Provider timeout: ${String(config.requestTimeoutMs)} ms
- Revision route maximum duration: 180000 ms

## Sanitized revision validation diagnostics

| Stage | Code | Field | Expected | Targets | Evidence segments | Evidence characters | Response characters | Latency (ms) | Repair attempted |
|---|---|---|---|---:|---:|---:|---:|---:|---|
${revisionDiagnostics.length === 0 ? "| - | - | - | - | 0 | 0 | 0 | 0 | 0 | no |" : revisionDiagnostics.map((diagnostic) => `| ${diagnostic.phase} | ${diagnostic.validationCode} | ${diagnostic.fieldPath} | ${diagnostic.expected} | ${String(diagnostic.targetConceptCount)} | ${String(diagnostic.permittedEvidenceSegmentCount)} | ${String(diagnostic.permittedEvidenceCharacterCount)} | ${String(diagnostic.responseCharacterCount)} | ${String(diagnostic.latencyMs)} | ${diagnostic.repairAttempted ? "yes" : "no"} |`).join("\n")}

No credential, raw source, prompt, provider body, generated question, reference answer, learner answer, or feedback is stored in this report.
`;
  if (report.includes(config.apiKey)) throw new Error("Refusing to write a report containing the provider credential.");
  await mkdir(dirname(RESULTS_PATH), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Live adaptive loop ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof ProviderError) process.stderr.write(`${error.code}: ${error.message}\n`);
  else if (error instanceof ApplicationError) process.stderr.write(`${error.code}: ${error.message}\n`);
  else process.stderr.write("INTERNAL_ERROR: adaptive-loop verification failed safely.\n");
  process.exitCode = 1;
}
