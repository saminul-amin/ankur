import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import {
  activitySetApiSchema,
  preparationMapApiSchema,
  writtenEvaluationApiSchema,
} from "../../src/shared/schemas/api-contracts.js";

const RESULTS_PATH = resolve("evaluation/production/RESULTS.md");
const DEFAULT_BASE_URL = "https://ankur-gamma.vercel.app";

interface Phase {
  readonly name: string;
  readonly status: number;
  readonly latencyMs: number;
}

function recordData(value: unknown): unknown {
  if (typeof value !== "object" || value === null || Reflect.get(value, "ok") !== true) {
    throw new Error("Production returned a non-success envelope.");
  }
  return Reflect.get(value, "data");
}

async function requestJson(phases: Phase[], baseUrl: string, name: string, path: string, init?: RequestInit): Promise<unknown> {
  const started = performance.now();
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers,
    signal: AbortSignal.timeout(200_000),
  });
  phases.push({ name, status: response.status, latencyMs: Math.round(performance.now() - started) });
  const value: unknown = await response.json();
  if (!response.ok) throw new Error(`Production phase ${name} returned HTTP ${String(response.status)}.`);
  return recordData(value);
}

async function writeReport(input: {
  readonly passed: boolean;
  readonly baseUrl: string;
  readonly buildId: string;
  readonly phases: readonly Phase[];
  readonly activityFailures: number;
  readonly writtenFailures: number;
  readonly emptyFailures: number;
  readonly emptyBypassedProvider: boolean;
}): Promise<void> {
  const report = `# Task 04B Production Verification

- Gate check: **${input.passed ? "PASSED" : "BLOCKED"}**
- Production origin: \`${input.baseUrl}\`
- Build ID: \`${input.buildId}\`
- Home/health: ${input.phases.some((phase) => phase.name === "health" && phase.status === 200) ? "passed" : "failed"}
- Runtime ready: ${input.phases.some((phase) => phase.name === "runtime" && phase.status === 200) ? "checked" : "failed"}
- Live source analysis: ${input.phases.some((phase) => phase.name === "analysis" && phase.status === 200) ? "passed" : "failed"}
- Live mixed assessment: ${input.phases.some((phase) => phase.name === "assessment" && phase.status === 200) ? "passed" : "failed"}
- Live non-empty written evaluation: ${input.phases.some((phase) => phase.name === "written" && phase.status === 200) ? "passed" : "failed"}
- Empty-answer deterministic bypass: ${input.emptyBypassedProvider ? "passed" : "failed"}
- Activity grounding/invariant failures: ${String(input.activityFailures)}
- Written grounding/reconciliation failures: ${String(input.writtenFailures)}
- Empty-evaluation validation failures: ${String(input.emptyFailures)}

## Safe phase metadata

| Phase | HTTP | Wall latency (ms) |
|---|---:|---:|
${input.phases.map((phase) => `| ${phase.name} | ${String(phase.status)} | ${String(phase.latencyMs)} |`).join("\n")}

No credential, raw prompt, provider response body, source text, reference answer, or student answer is stored in this report.
`;
  await mkdir(resolve("evaluation/production"), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
}

async function main(): Promise<void> {
  if (process.env["ANKUR_PRODUCTION_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit production-live opt-in is required.\n");
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
  let buildId = "unavailable";
  let activityFailures = 0;
  let writtenFailures = 0;
  let emptyFailures = 0;
  let emptyBypassedProvider = false;
  let passed: boolean;
  try {
    const homeStarted = performance.now();
    const home = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(30_000) });
    phases.push({ name: "home", status: home.status, latencyMs: Math.round(performance.now() - homeStarted) });
    if (!home.ok) throw new Error("Production home is unavailable.");

    const health = await requestJson(phases, baseUrl, "health", "/api/health");
    buildId = String(Reflect.get(health as object, "buildId") ?? "unavailable");
    const runtime = await requestJson(phases, baseUrl, "runtime", "/api/runtime-status");
    if (Reflect.get(runtime as object, "liveAiEnabled") !== true || Reflect.get(runtime as object, "primaryModel") !== "gemma-4-26b-a4b-it") {
      throw new Error("Production live AI is not ready on the approved model.");
    }

    const source = createSampleSource();
    const segments = source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text }));
    const map = preparationMapApiSchema.parse(await requestJson(phases, baseUrl, "analysis", "/api/analyses", {
      method: "POST",
      body: JSON.stringify({ sourceVersionId: source.sourceVersionId, language: source.language, segments }),
    }));
    const assessmentData = await requestJson(phases, baseUrl, "assessment", "/api/assessments", {
      method: "POST",
      body: JSON.stringify({
        sourceVersionId: source.sourceVersionId,
        preparationMap: map,
        selectedConceptIds: map.concepts.map((concept) => concept.id),
        configuration: { title: "Production release verification", language: source.language, mcqCount: 1, shortWrittenCount: 1, difficulty: "medium" },
        segments,
      }),
    });
    const activity = activitySetApiSchema.parse(Reflect.get(assessmentData as object, "activitySet"));
    activityFailures = validateActivitySet(source, map, activity).length;
    const question = activity.questions[1];
    const allowedIds = new Set([
      ...question.evidence.map((reference) => reference.segmentId),
      ...question.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
    ]);
    const evidenceSegments = segments.filter((segment) => allowedIds.has(segment.id));
    const window = rehydrateEvidenceWindow({ sourceVersionId: source.sourceVersionId, language: source.language, segments: evidenceSegments });
    const operationBase = `production-${Date.now().toString(36)}`;
    const written = writtenEvaluationApiSchema.parse(await requestJson(phases, baseUrl, "written", "/api/written-evaluations", {
      method: "POST",
      body: JSON.stringify({ operationId: `${operationBase}-written`, sourceVersionId: source.sourceVersionId, question, studentAnswer: question.referenceAnswer, evidenceSegments }),
    }));
    writtenFailures = validateWrittenEvaluation(window, question, written).length;
    const empty = writtenEvaluationApiSchema.parse(await requestJson(phases, baseUrl, "empty", "/api/written-evaluations", {
      method: "POST",
      body: JSON.stringify({ operationId: `${operationBase}-empty`, sourceVersionId: source.sourceVersionId, question, studentAnswer: "  \n ", evidenceSegments }),
    }));
    emptyFailures = validateWrittenEvaluation(window, question, empty).length;
    emptyBypassedProvider = empty.status === "not_answered" && empty.awardedMarks === 0 && empty.artifact.latencyMs === 0 && empty.artifact.promptVersion === "deterministic-empty.v1";
    passed = activityFailures === 0 && writtenFailures === 0 && emptyFailures === 0 && written.status === "correct" && written.awardedMarks === 5 && emptyBypassedProvider;
  } catch {
    passed = false;
  }

  await writeReport({ passed, baseUrl, buildId, phases, activityFailures, writtenFailures, emptyFailures, emptyBypassedProvider });
  process.stdout.write(`Production live verification ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

void main();
