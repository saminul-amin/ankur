import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { calculateConceptPerformance, reconcileAssessmentTotal } from "../../src/domain/assessments/concept-performance.js";
import { createEmptyWrittenEvaluation, validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { compareAssessmentAttempts } from "../../src/domain/revision/improvement-comparison.js";
import { selectRevisionTargets, validateRevisionPlan } from "../../src/domain/revision/revision-plan.js";
import { parsePersistedIngestionSession, toPersistedIngestionSession } from "../../src/presentation/persistence/ingestion-session.js";
import { activitySetApiSchema, preparationMapApiSchema, revisionPlanApiSchema, writtenEvaluationApiSchema } from "../../src/shared/schemas/api-contracts.js";

const RESULTS_PATH = resolve(process.env["ANKUR_PRODUCTION_ADAPTIVE_RESULTS_PATH"] ?? "evaluation/production-adaptive/RESULTS.md");
const DEFAULT_BASE_URL = "https://ankur-gamma.vercel.app";

interface Phase { readonly name: string; readonly status: number; readonly latencyMs: number }

function dataOf(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Reflect.get(value, "ok") !== true) throw new Error("Production returned a non-success envelope.");
  return Reflect.get(value, "data");
}

async function requestJson(phases: Phase[], baseUrl: string, name: string, path: string, init?: RequestInit): Promise<unknown> {
  const started = performance.now();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-ankur-session-id", "production-adaptive-verifier");
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(200_000) });
  phases.push({ name, status: response.status, latencyMs: Math.round(performance.now() - started) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(`Production phase ${name} returned HTTP ${String(response.status)}.`);
  return dataOf(value);
}

function counts(failures: readonly { readonly reason: string; readonly path: string }[]) {
  return {
    grounding: failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED").length,
    quotes: failures.filter((failure) => failure.reason === "QUOTE_NOT_FOUND").length,
    concepts: failures.filter((failure) => failure.reason === "UNKNOWN_CONCEPT").length,
    reconciliation: failures.filter((failure) => failure.path.includes("rubric") || failure.path.includes("criterion") || failure.path.includes("awardedMarks")).length,
    duplicates: failures.filter((failure) => failure.reason === "DUPLICATE_PROMPT").length,
  };
}

async function main() {
  if (process.env["ANKUR_PRODUCTION_ADAPTIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit production-adaptive opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const expectedBuildId = process.env["ANKUR_EXPECTED_BUILD_ID"]?.trim().slice(0, 12);
  if (expectedBuildId === undefined || !/^[a-f0-9]{12}$/u.test(expectedBuildId)) {
    process.stderr.write("CONFIGURATION_ERROR: expected release build ID is required.\n");
    process.exitCode = 1;
    return;
  }
  const baseUrl = (process.env["ANKUR_PRODUCTION_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/u, "");
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" || url.hostname !== "ankur-gamma.vercel.app") {
    process.stderr.write("CONFIGURATION_ERROR: verifier only permits the canonical HTTPS production origin.\n");
    process.exitCode = 1;
    return;
  }
  const phases: Phase[] = [];
  let buildId = "unavailable";
  let passed: boolean;
  let summary = {
    revisionItems: 0, originalScore: 0, retryScore: 0, grounding: 0, quotes: 0, concepts: 0,
    reconciliation: 0, duplicates: 0, stateLoss: 1, persisted: false, retryStatus: "unavailable", retryMarks: 0,
  };
  try {
    const homeStarted = performance.now();
    const home = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(30_000) });
    phases.push({ name: "home", status: home.status, latencyMs: Math.round(performance.now() - homeStarted) });
    if (!home.ok) throw new Error("Production home is unavailable.");
    const health = await requestJson(phases, baseUrl, "health", "/api/health");
    buildId = String(Reflect.get(health as object, "buildId") ?? "unavailable");
    const runtime = await requestJson(phases, baseUrl, "runtime", "/api/runtime-status");
    if (
      buildId !== expectedBuildId || Reflect.get(runtime as object, "buildId") !== expectedBuildId ||
      Reflect.get(runtime as object, "liveAiEnabled") !== true || Reflect.get(runtime as object, "providerConfigured") !== true ||
      Reflect.get(runtime as object, "primaryModel") !== "gemma-4-26b-a4b-it"
    ) throw new Error("Production runtime or build ID does not match the release candidate.");

    const source = createSampleSource();
    const segments = source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text }));
    const map = preparationMapApiSchema.parse(await requestJson(phases, baseUrl, "analysis", "/api/analyses", {
      method: "POST", body: JSON.stringify({ sourceVersionId: source.sourceVersionId, language: source.language, segments }),
    }));
    const assessmentData = await requestJson(phases, baseUrl, "assessment", "/api/assessments", {
      method: "POST",
      body: JSON.stringify({ sourceVersionId: source.sourceVersionId, preparationMap: map, selectedConceptIds: map.concepts.map((concept) => concept.id), configuration: { title: "Production adaptive verification", language: source.language, mcqCount: 1, shortWrittenCount: 1, difficulty: "medium" }, segments }),
    });
    const originalActivity = activitySetApiSchema.parse(Reflect.get(assessmentData as object, "activitySet"));
    const wrongOption = originalActivity.questions[0].options.find((option) => option.id !== originalActivity.questions[0].correctOptionId);
    if (wrongOption === undefined) throw new Error("No deterministic incorrect option exists.");
    const originalMcqGrade = gradeMcq(originalActivity.questions[0], wrongOption.id);
    const originalWrittenEvaluation = createEmptyWrittenEvaluation({ question: originalActivity.questions[1], requestId: "production-adaptive-empty" });
    const originalPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: originalActivity.questions[0], mcqGrade: originalMcqGrade, writtenQuestion: originalActivity.questions[1], writtenEvaluation: originalWrittenEvaluation });
    const revisionData = await requestJson(phases, baseUrl, "revision", "/api/revisions", {
      method: "POST",
      body: JSON.stringify({
        operationId: "production-adaptive-revision", sourceVersionId: source.sourceVersionId, preparationMap: map,
        originalActivity, originalResultId: `result-${originalActivity.id}`, originalMcqGrade,
        originalWrittenEvaluation, conceptPerformance: originalPerformance, language: source.language, segments,
      }),
    });
    const plan = revisionPlanApiSchema.parse(Reflect.get(revisionData as object, "revisionPlan"));
    const selection = selectRevisionTargets({ preparationMap: map, performance: originalPerformance, writtenEvaluation: originalWrittenEvaluation });
    const activityFailures = validateActivitySet(source, map, originalActivity);
    const revisionFailures = validateRevisionPlan({ source, preparationMap: map, originalActivity, originalResultId: `result-${originalActivity.id}`, expectedSelection: selection, writtenEvaluation: originalWrittenEvaluation, plan });
    const retryMcqGrade = gradeMcq(plan.retryActivity.questions[0], plan.retryActivity.questions[0].correctOptionId);
    const retryQuestion = plan.retryActivity.questions[1];
    const allowedIds = new Set([...retryQuestion.evidence, ...retryQuestion.rubric.flatMap((criterion) => criterion.evidence)].map((reference) => reference.segmentId));
    const evidenceSegments = segments.filter((segment) => allowedIds.has(segment.id));
    const retryWrittenEvaluation = writtenEvaluationApiSchema.parse(await requestJson(phases, baseUrl, "retry-written", "/api/written-evaluations", {
      method: "POST",
      body: JSON.stringify({ operationId: "production-adaptive-retry", sourceVersionId: source.sourceVersionId, question: retryQuestion, studentAnswer: retryQuestion.referenceAnswer, evidenceSegments }),
    }));
    const writtenFailures = validateWrittenEvaluation(source, retryQuestion, retryWrittenEvaluation);
    const retryPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: plan.retryActivity.questions[0], mcqGrade: retryMcqGrade, writtenQuestion: retryQuestion, writtenEvaluation: retryWrittenEvaluation });
    const totalsReconcile = reconcileAssessmentTotal({ mcqGrade: retryMcqGrade, writtenEvaluation: retryWrittenEvaluation, performance: retryPerformance });
    const comparison = compareAssessmentAttempts({ originalMcqGrade, originalWrittenEvaluation, originalPerformance, retryMcqGrade, retryWrittenEvaluation, retryPerformance });
    const serialized = toPersistedIngestionSession({
      stage: "adaptive_results", mode: "live", sourceKind: "text", pages: [], priorityInstruction: "", confirmedSource: source,
      preparationMap: map, activitySet: originalActivity, assessmentConfiguration: { title: originalActivity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
      selectedOptionId: wrongOption.id, writtenAnswer: "", mcqGrade: originalMcqGrade, writtenEvaluation: originalWrittenEvaluation, conceptPerformance: originalPerformance,
      revisionPlan: plan, revisionOperationId: "production-adaptive-revision", retrySelectedOptionId: plan.retryActivity.questions[0].correctOptionId,
      retryWrittenAnswer: retryQuestion.referenceAnswer, retryCurrentQuestionIndex: 1, retryMcqGrade, retryWrittenEvaluation, retryConceptPerformance: retryPerformance,
      retryWrittenOperationId: "production-adaptive-retry", improvementComparison: comparison,
    });
    const restored = parsePersistedIngestionSession(serialized);
    const persisted = restored?.stage === "adaptive_results" && restored.improvementComparison?.retryScore === comparison.retryScore;
    const stateLoss = restored?.confirmedSource?.sourceVersionId === source.sourceVersionId && restored.retryWrittenAnswer === retryQuestion.referenceAnswer ? 0 : 1;
    const failures = counts([...activityFailures, ...revisionFailures, ...writtenFailures]);
    const mapConceptIds = new Set(map.concepts.map((concept) => concept.id));
    const conceptFailures = failures.concepts + plan.targetConceptIds.filter((id) => !mapConceptIds.has(id)).length + retryPerformance.filter((item) => !mapConceptIds.has(item.conceptId)).length;
    summary = {
      revisionItems: plan.items.length, originalScore: comparison.originalScore, retryScore: comparison.retryScore,
      grounding: failures.grounding, quotes: failures.quotes, concepts: conceptFailures,
      reconciliation: failures.reconciliation + (totalsReconcile ? 0 : 1), duplicates: failures.duplicates,
      stateLoss, persisted, retryStatus: retryWrittenEvaluation.status, retryMarks: retryWrittenEvaluation.awardedMarks,
    };
    passed = activityFailures.length === 0 && revisionFailures.length === 0 && writtenFailures.length === 0
      && summary.grounding === 0 && summary.quotes === 0 && summary.concepts === 0 && summary.reconciliation === 0 && summary.duplicates === 0
      && stateLoss === 0 && persisted && retryMcqGrade.correct && retryWrittenEvaluation.awardedMarks === 5
      && comparison.retryScore > comparison.originalScore;
  } catch {
    passed = false;
  }
  const report = `# Task 05 Production Adaptive-Flow Verification

- Gate check: **${passed ? "PASSED" : "BLOCKED"}**
- Production origin: ${baseUrl}
- Build ID: ${buildId}
- Expected build ID: ${expectedBuildId}
- Revision items: ${String(summary.revisionItems)}
- Original score: ${String(summary.originalScore)}/6
- Retry score: ${String(summary.retryScore)}/6
- Retry written result: ${String(summary.retryMarks)}/5, ${summary.retryStatus}
- Grounding failures: ${String(summary.grounding)}
- Quote failures: ${String(summary.quotes)}
- Concept-reference failures: ${String(summary.concepts)}
- Mark-reconciliation failures: ${String(summary.reconciliation)}
- Duplicate retry failures: ${String(summary.duplicates)}
- Source or answer loss: ${String(summary.stateLoss)}
- Persistence recovery: ${summary.persisted ? "passed" : "failed"}

## Safe phase metadata

| Phase | HTTP | Wall latency (ms) |
|---|---:|---:|
${phases.map((phase) => `| ${phase.name} | ${String(phase.status)} | ${String(phase.latencyMs)} |`).join("\n")}

No credential, raw source, prompt, provider body, question, reference answer, learner answer, or feedback is stored in this report.
`;
  await mkdir(dirname(RESULTS_PATH), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Production adaptive verification ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

void main();
