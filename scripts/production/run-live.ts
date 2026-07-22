import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { calculateConceptPerformance, reconcileAssessmentTotal, weakConcepts } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import { parsePersistedIngestionSession, toPersistedIngestionSession } from "../../src/presentation/persistence/ingestion-session.js";
import {
  activitySetApiSchema,
  preparationMapApiSchema,
  writtenEvaluationApiSchema,
} from "../../src/shared/schemas/api-contracts.js";

const RESULTS_PATH = resolve(process.env["ANKUR_PRODUCTION_RESULTS_PATH"] ?? "evaluation/production/RESULTS.md");
const DEFAULT_BASE_URL = "https://ankur-gamma.vercel.app";
const REQUIRED_RUNS = 3;
const PARTIAL_PARAPHRASE_ANSWER = "খাদ্য বানাতে উদ্ভিদ পানি এবং কার্বন ডাই-অক্সাইডকে উপকরণ হিসেবে ব্যবহার করে।";

interface Phase {
  readonly run: number;
  readonly name: string;
  readonly status: number;
  readonly latencyMs: number;
}

interface FlowResult {
  readonly run: number;
  readonly passed: boolean;
  readonly activityFailures: number;
  readonly writtenFailures: number;
  readonly groundingFailures: number;
  readonly quoteFailures: number;
  readonly reconciliationFailures: number;
  readonly conceptFailures: number;
  readonly sourceOrAnswerLoss: number;
  readonly persistedResult: boolean;
  readonly mcqCorrect: boolean;
  readonly writtenStatus: string;
  readonly awardedMarks: number;
  readonly weakConceptCount: number;
  readonly totalsReconcile: boolean;
}

function recordData(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Reflect.get(value, "ok") !== true) {
    throw new Error("Production returned a non-success envelope.");
  }
  return Reflect.get(value, "data");
}

async function requestJson(
  phases: Phase[],
  baseUrl: string,
  run: number,
  name: string,
  path: string,
  init?: RequestInit,
): Promise<unknown> {
  const started = performance.now();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  headers.set("x-ankur-session-id", `production-release-verifier-${String(run)}`);
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers, signal: AbortSignal.timeout(200_000) });
  phases.push({ run, name, status: response.status, latencyMs: Math.round(performance.now() - started) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(`Production phase ${name} returned HTTP ${String(response.status)}.`);
  return recordData(value);
}

function failureCounts(failures: readonly { readonly reason: string; readonly path: string }[]) {
  return {
    grounding: failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED").length,
    quotes: failures.filter((failure) => failure.reason === "QUOTE_NOT_FOUND").length,
    reconciliation: failures.filter((failure) => failure.path.includes("criterion") || failure.path.includes("rubric") || failure.path === "awardedMarks" || failure.path === "status").length,
    concepts: failures.filter((failure) => failure.reason === "UNKNOWN_CONCEPT").length,
  };
}

async function writeReport(input: {
  readonly passed: boolean;
  readonly baseUrl: string;
  readonly buildId: string;
  readonly expectedBuildId: string;
  readonly phases: readonly Phase[];
  readonly flows: readonly FlowResult[];
}): Promise<void> {
  const report = `# Task 04B.2 Production Golden-Flow Verification

- Gate check: **${input.passed ? "PASSED" : "BLOCKED"}**
- Production origin: \`${input.baseUrl}\`
- Build ID: \`${input.buildId}\`
- Expected release build ID: \`${input.expectedBuildId}\`
- Consecutive golden flows: ${String(input.flows.filter((flow) => flow.passed).length)}/${String(REQUIRED_RUNS)}
- Required model/runtime: checked before live operations
- Source confirmation: deterministic team-authored confirmed source in every run
- MCQ grading: deterministic correct selection in every run
- Written answer: partial source-grounded answer in every run
- Result persistence: ${input.flows.every((flow) => flow.persistedResult) ? "passed" : "failed"}
- Source or answer loss: ${String(input.flows.reduce((sum, flow) => sum + flow.sourceOrAnswerLoss, 0))}
- Grounding failures: ${String(input.flows.reduce((sum, flow) => sum + flow.groundingFailures, 0))}
- Quote failures: ${String(input.flows.reduce((sum, flow) => sum + flow.quoteFailures, 0))}
- Mark reconciliation failures: ${String(input.flows.reduce((sum, flow) => sum + flow.reconciliationFailures, 0))}
- Concept failures: ${String(input.flows.reduce((sum, flow) => sum + flow.conceptFailures, 0))}

## Per-flow validation

| Run | Passed | MCQ | Written status | Written marks | Weak concepts | Totals | Grounding | Quotes | Concepts | Persisted |
|---:|---:|---:|---|---:|---:|---:|---:|---:|---:|---:|
${input.flows.map((flow) => `| ${String(flow.run)} | ${flow.passed ? "yes" : "no"} | ${flow.mcqCorrect ? "correct" : "failed"} | ${flow.writtenStatus} | ${String(flow.awardedMarks)}/5 | ${String(flow.weakConceptCount)} | ${flow.totalsReconcile ? "yes" : "no"} | ${String(flow.groundingFailures)} | ${String(flow.quoteFailures)} | ${String(flow.conceptFailures)} | ${flow.persistedResult ? "yes" : "no"} |`).join("\n")}

## Safe phase metadata

| Run | Phase | HTTP | Wall latency (ms) |
|---:|---|---:|---:|
${input.phases.map((phase) => `| ${String(phase.run)} | ${phase.name} | ${String(phase.status)} | ${String(phase.latencyMs)} |`).join("\n")}

No credential, raw prompt, provider response body, source text, reference answer, student answer, generated question, or feedback is stored in this report.
`;
  await mkdir(dirname(RESULTS_PATH), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
}

async function main(): Promise<void> {
  if (process.env["ANKUR_PRODUCTION_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit production-live opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const expectedBuildId = process.env["ANKUR_EXPECTED_BUILD_ID"]?.trim().slice(0, 12);
  if (expectedBuildId === undefined || !/^[a-f0-9]{12}$/u.test(expectedBuildId)) {
    process.stderr.write("CONFIGURATION_ERROR: expected release commit build ID is required.\n");
    process.exitCode = 1;
    return;
  }
  const baseUrl = (process.env["ANKUR_PRODUCTION_BASE_URL"] ?? DEFAULT_BASE_URL).replace(/\/$/u, "");
  const parsedUrl = new URL(baseUrl);
  if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "ankur-gamma.vercel.app") {
    process.stderr.write("CONFIGURATION_ERROR: production verifier only permits the canonical HTTPS origin.\n");
    process.exitCode = 1;
    return;
  }

  const phases: Phase[] = [];
  const flows: FlowResult[] = [];
  let buildId = "unavailable";
  let passed: boolean;
  try {
    const homeStarted = performance.now();
    const home = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(30_000) });
    phases.push({ run: 0, name: "home", status: home.status, latencyMs: Math.round(performance.now() - homeStarted) });
    if (!home.ok) throw new Error("Production home is unavailable.");

    const health = await requestJson(phases, baseUrl, 0, "health", "/api/health");
    buildId = String(Reflect.get(health as object, "buildId") ?? "unavailable");
    const runtime = await requestJson(phases, baseUrl, 0, "runtime", "/api/runtime-status");
    if (
      buildId !== expectedBuildId ||
      Reflect.get(runtime as object, "buildId") !== expectedBuildId ||
      Reflect.get(runtime as object, "liveAiEnabled") !== true ||
      Reflect.get(runtime as object, "providerConfigured") !== true ||
      Reflect.get(runtime as object, "primaryModel") !== "gemma-4-26b-a4b-it"
    ) throw new Error("Production runtime or build ID does not match the release candidate.");

    for (let run = 1; run <= REQUIRED_RUNS; run += 1) {
      const source = createSampleSource();
      const segments = source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text }));
      const map = preparationMapApiSchema.parse(await requestJson(phases, baseUrl, run, "analysis", "/api/analyses", {
        method: "POST",
        body: JSON.stringify({ sourceVersionId: source.sourceVersionId, language: source.language, segments }),
      }));
      const assessmentData = await requestJson(phases, baseUrl, run, "assessment", "/api/assessments", {
        method: "POST",
        body: JSON.stringify({
          sourceVersionId: source.sourceVersionId,
          preparationMap: map,
          selectedConceptIds: map.concepts.map((concept) => concept.id),
          configuration: { title: `Production release verification ${String(run)}`, language: source.language, mcqCount: 1, shortWrittenCount: 1, difficulty: "medium" },
          segments,
        }),
      });
      const activity = activitySetApiSchema.parse(Reflect.get(assessmentData as object, "activitySet"));
      const activityValidation = validateActivitySet(source, map, activity);
      const question = activity.questions[1];
      const allowedIds = new Set([
        ...question.evidence.map((reference) => reference.segmentId),
        ...question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
      ]);
      const evidenceSegments = segments.filter((segment) => allowedIds.has(segment.id));
      const window = rehydrateEvidenceWindow({ sourceVersionId: source.sourceVersionId, language: source.language, segments: evidenceSegments });
      const partialAnswer = PARTIAL_PARAPHRASE_ANSWER;
      const written = writtenEvaluationApiSchema.parse(await requestJson(phases, baseUrl, run, "written-partial", "/api/written-evaluations", {
        method: "POST",
        body: JSON.stringify({
          operationId: `production-${String(run)}-${Date.now().toString(36)}`,
          sourceVersionId: source.sourceVersionId,
          question,
          studentAnswer: partialAnswer,
          evidenceSegments,
        }),
      }));
      const writtenValidation = validateWrittenEvaluation(window, question, written);
      const mcqGrade = gradeMcq(activity.questions[0], activity.questions[0].correctOptionId);
      const conceptPerformance = calculateConceptPerformance({
        concepts: map.concepts,
        mcqQuestion: activity.questions[0],
        mcqGrade,
        writtenQuestion: question,
        writtenEvaluation: written,
      });
      const totalsReconcile = reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: written, performance: conceptPerformance });
      const conceptIds = new Set(map.concepts.map((concept) => concept.id));
      const conceptFailures = conceptPerformance.filter((item) => !conceptIds.has(item.conceptId)).length;
      const weakConceptCount = weakConcepts(conceptPerformance).length;
      const serialized = toPersistedIngestionSession({
        stage: "results", mode: "live", sourceKind: "text", pages: [], priorityInstruction: "",
        confirmedSource: source, preparationMap: map,
        assessmentConfiguration: { title: activity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
        activitySet: activity, selectedOptionId: activity.questions[0].correctOptionId, writtenAnswer: partialAnswer, currentQuestionIndex: 1,
        mcqGrade, writtenEvaluation: written, conceptPerformance,
        writtenOperationId: `verified-${String(run)}`, uncertainWrittenFailure: false,
      });
      const restored = parsePersistedIngestionSession(serialized);
      const persistedResult = restored?.stage === "results" && restored.writtenEvaluation?.questionId === question.id && restored.conceptPerformance !== undefined;
      const sourceOrAnswerLoss = restored?.confirmedSource?.sourceVersionId === source.sourceVersionId && restored.writtenAnswer === partialAnswer ? 0 : 1;
      const combinedValidation = [...activityValidation, ...writtenValidation];
      const counts = failureCounts(combinedValidation);
      const reconciliationFailures = counts.reconciliation + (totalsReconcile ? 0 : 1);
      const flowPassed = activityValidation.length === 0
        && writtenValidation.length === 0
        && written.status === "partially_correct"
        && written.awardedMarks > 0
        && written.awardedMarks < 5
        && mcqGrade.status === "correct"
        && weakConceptCount > 0
        && counts.grounding === 0
        && counts.quotes === 0
        && reconciliationFailures === 0
        && counts.concepts + conceptFailures === 0
        && sourceOrAnswerLoss === 0
        && persistedResult;
      flows.push({
        run, passed: flowPassed, activityFailures: activityValidation.length, writtenFailures: writtenValidation.length,
        groundingFailures: counts.grounding, quoteFailures: counts.quotes, reconciliationFailures,
        conceptFailures: counts.concepts + conceptFailures, sourceOrAnswerLoss, persistedResult,
        mcqCorrect: mcqGrade.status === "correct", writtenStatus: written.status, awardedMarks: written.awardedMarks,
        weakConceptCount, totalsReconcile,
      });
      if (!flowPassed) break;
    }
    passed = flows.length === REQUIRED_RUNS && flows.every((flow) => flow.passed);
  } catch {
    passed = false;
  }

  await writeReport({ passed, baseUrl, buildId, expectedBuildId, phases, flows });
  process.stdout.write(`Production live verification ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

void main();
