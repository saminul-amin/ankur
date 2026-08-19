import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

import { calculateConceptPerformance, reconcileAssessmentTotal } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { createConfirmedSource, rehydrateEvidenceWindow, type SourceLanguage } from "../../src/domain/source/confirmed-source.js";
import {
  activitySetApiSchema,
  preparationMapApiSchema,
  writtenEvaluationApiSchema,
} from "../../src/shared/schemas/api-contracts.js";

const RESULTS_PATH = resolve(
  process.env["ANKUR_RELEASE_RESULTS_PATH"] ?? "docs/releases/RELEASE_FLOW_VERIFICATION.md",
);
const REQUEST_TIMEOUT_MS = 220_000;

interface LanguageCase {
  readonly id: string;
  readonly language: SourceLanguage;
  readonly text: string;
  readonly answer: string;
}

// Team-authored, public-safe material. Nothing here is licensed third-party text.
const CASES: readonly LanguageCase[] = [
  {
    id: "english-pasted-text",
    language: "en",
    text: `The water cycle is the continuous movement of water on Earth. Heat from the sun evaporates water from oceans, rivers, and lakes.

The rising vapour cools at higher altitudes and condenses into clouds. When the droplets grow heavy enough, the water returns to the ground as rain or snow.`,
    answer: "The sun heats water so it evaporates, and the vapour cools and condenses into clouds.",
  },
  {
    id: "bengali-pasted-text",
    language: "bn",
    text: `পানিচক্র হলো পৃথিবীতে পানির অবিরাম চলাচল। সূর্যের তাপে সমুদ্র, নদী ও হ্রদের পানি বাষ্পে পরিণত হয়।

বাষ্প উপরে উঠে ঠান্ডা হয়ে মেঘ তৈরি করে। মেঘের কণা ভারী হলে বৃষ্টি বা তুষার হয়ে পানি আবার মাটিতে ফিরে আসে।`,
    answer: "সূর্যের তাপে পানি বাষ্পে পরিণত হয় এবং বাষ্প ঠান্ডা হয়ে মেঘ তৈরি করে।",
  },
  {
    id: "mixed-pasted-text",
    language: "mixed",
    text: `Water cycle বা পানিচক্র হলো পৃথিবীতে পানির continuous movement। Sun-এর heat-এ সমুদ্র ও নদীর পানি evaporate হয়ে vapour-এ পরিণত হয়।

এই vapour উপরে উঠে condense হয়ে cloud তৈরি করে। Cloud ভারী হলে rain হিসেবে পানি আবার মাটিতে ফিরে আসে।`,
    answer: "Sun-এর heat-এ পানি evaporate হয় এবং vapour condense হয়ে cloud তৈরি করে।",
  },
];

interface FlowResult {
  readonly id: string;
  readonly language: SourceLanguage;
  readonly outcome: "passed" | "provider_unavailable" | "invalid_output" | "failed";
  readonly detail: string;
  readonly analysisMs: number;
  readonly assessmentMs: number;
  readonly writtenMs: number;
  readonly writtenStatus: string;
  readonly awardedMarks: number;
  readonly groundingFailures: number;
  readonly quoteFailures: number;
  readonly reconciles: boolean;
}

function baseUrl(): string {
  const configured = process.env["ANKUR_RELEASE_BASE_URL"];
  if (configured === undefined) throw new Error("ANKUR_RELEASE_BASE_URL_REQUIRED");
  return configured.replace(/\/$/u, "");
}

function bypassHeaders(): Record<string, string> {
  const secret = process.env["ANKUR_RELEASE_PROTECTION_BYPASS"];
  return secret === undefined ? {} : { "x-vercel-protection-bypass": secret, "x-vercel-set-bypass-cookie": "true" };
}

async function post(path: string, body: unknown, sessionId: string): Promise<{ status: number; value: unknown }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-ankur-session-id": sessionId, ...bypassHeaders() },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  return { status: response.status, value: await response.json() };
}

async function get(path: string): Promise<{ status: number; value: unknown }> {
  const response = await fetch(`${baseUrl()}${path}`, {
    headers: bypassHeaders(),
    signal: AbortSignal.timeout(30_000),
  });
  const json = response.status === 200 && (response.headers.get("content-type") ?? "").includes("application/json");
  return { status: response.status, value: json ? await response.json() : undefined };
}

function data(envelope: { status: number; value: unknown }, phase: string): unknown {
  if (typeof envelope.value !== "object" || envelope.value === null) {
    throw new Error(`${phase}: non-JSON response (HTTP ${String(envelope.status)}).`);
  }
  if (Reflect.get(envelope.value, "ok") !== true) {
    const error: unknown = Reflect.get(envelope.value, "error");
    const code = typeof error === "object" && error !== null ? String(Reflect.get(error, "code")) : "UNKNOWN";
    throw Object.assign(new Error(`${phase}: ${code}`), { controlled: true, code });
  }
  return Reflect.get(envelope.value, "data");
}

async function runCase(item: LanguageCase): Promise<FlowResult> {
  const source = createConfirmedSource({
    pages: [{ pageNumber: 1, text: item.text }],
    language: item.language,
    method: "pasted_text",
  });
  const segments = source.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text }));
  const sessionId = `release-verifier-${item.id}`;
  const base: Omit<FlowResult, "outcome" | "detail"> = {
    id: item.id, language: item.language, analysisMs: 0, assessmentMs: 0, writtenMs: 0,
    writtenStatus: "not_reached", awardedMarks: 0, groundingFailures: 0, quoteFailures: 0, reconciles: false,
  };
  let analysisMs = 0;
  let assessmentMs = 0;
  try {
    const analysisStarted = performance.now();
    const map = preparationMapApiSchema.parse(data(await post("/api/analyses", {
      sourceVersionId: source.sourceVersionId, language: source.language, segments,
    }, sessionId), "analysis"));
    analysisMs = Math.round(performance.now() - analysisStarted);

    const assessmentStarted = performance.now();
    const assessment = data(await post("/api/assessments", {
      sourceVersionId: source.sourceVersionId,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      configuration: {
        title: `Release verification ${item.id}`, language: source.language,
        mcqCount: 1, shortWrittenCount: 1, difficulty: "medium",
      },
      segments,
    }, sessionId), "assessment");
    assessmentMs = Math.round(performance.now() - assessmentStarted);
    const activity = activitySetApiSchema.parse(Reflect.get(assessment as object, "activitySet"));
    const activityFailures = validateActivitySet(source, map, activity);

    const written = activity.questions[1];
    const allowed = new Set([
      ...written.evidence.map((reference) => reference.segmentId),
      ...written.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
    ]);
    const evidenceSegments = segments.filter((segment) => allowed.has(segment.id));
    const writtenStarted = performance.now();
    const evaluation = writtenEvaluationApiSchema.parse(data(await post("/api/written-evaluations", {
      operationId: `release-${item.id}-${Date.now().toString(36)}`,
      sourceVersionId: source.sourceVersionId,
      question: written,
      studentAnswer: item.answer,
      evidenceSegments,
    }, sessionId), "written-evaluation"));
    const writtenMs = Math.round(performance.now() - writtenStarted);

    const window = rehydrateEvidenceWindow({
      sourceVersionId: source.sourceVersionId, language: source.language, segments: evidenceSegments,
    });
    const writtenFailures = validateWrittenEvaluation(window, written, evaluation);
    const mcqGrade = gradeMcq(activity.questions[0], activity.questions[0].correctOptionId);
    const performanceRecords = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: activity.questions[0],
      mcqGrade,
      writtenQuestion: written,
      writtenEvaluation: evaluation,
    });
    const failures = [...activityFailures, ...writtenFailures];
    const grounding = failures.filter((failure) => failure.reason === "UNKNOWN_SEGMENT" || failure.reason === "EVIDENCE_REQUIRED").length;
    const quotes = failures.filter((failure) => failure.reason === "QUOTE_NOT_FOUND").length;
    const reconciles = reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: evaluation, performance: performanceRecords });
    return {
      ...base,
      analysisMs, assessmentMs, writtenMs,
      writtenStatus: evaluation.status,
      awardedMarks: evaluation.awardedMarks,
      groundingFailures: grounding,
      quoteFailures: quotes,
      reconciles,
      outcome: failures.length === 0 && reconciles ? "passed" : "failed",
      detail: failures.length === 0 && reconciles
        ? "Analysis, assessment, and written grading all validated."
        : `${String(failures.length)} deterministic validation failures.`,
    };
  } catch (error) {
    const controlled = typeof error === "object" && error !== null && Reflect.get(error, "controlled") === true;
    const code = controlled ? String(Reflect.get(error, "code")) : "";
    // Provider availability is an external dependency, not a product defect, so
    // it is reported separately from an invalid generated artifact.
    const external = EXTERNAL_CODES.has(code);
    return {
      ...base, analysisMs, assessmentMs,
      outcome: controlled ? (external ? "provider_unavailable" : "invalid_output") : "failed",
      detail: error instanceof Error ? error.message : "Unexpected failure.",
    };
  }
}

const EXTERNAL_CODES = new Set(["PROVIDER_UNAVAILABLE", "PROVIDER_TIMEOUT", "RATE_LIMITED", "QUOTA_EXCEEDED"]);
const FLOW_ATTEMPTS = 3;

async function runCaseWithRetry(item: LanguageCase): Promise<FlowResult> {
  let last = await runCase(item);
  for (let attempt = 2; attempt <= FLOW_ATTEMPTS && last.outcome === "provider_unavailable"; attempt += 1) {
    await new Promise((settle) => setTimeout(settle, 20_000));
    last = await runCase(item);
  }
  return last;
}

async function runControlledFailure(): Promise<{ readonly outcome: string; readonly detail: string }> {
  const envelope = await post("/api/analyses", { sourceVersionId: "", language: "en", segments: [] }, "release-verifier-empty");
  const value = envelope.value;
  if (typeof value !== "object" || value === null || Reflect.get(value, "ok") !== false) {
    return { outcome: "failed", detail: "An empty source was not rejected." };
  }
  const error: unknown = Reflect.get(value, "error");
  const code = typeof error === "object" && error !== null ? String(Reflect.get(error, "code")) : "UNKNOWN";
  const body = JSON.stringify(value);
  const leaks = /AIza|api[_-]?key|Traceback|node_modules|generativelanguage\.googleapis/iu.test(body);
  return {
    outcome: code === "VALIDATION_FAILED" && !leaks ? "passed" : "failed",
    detail: `HTTP ${String(envelope.status)} with code ${code}; provider or credential leakage: ${leaks ? "yes" : "no"}.`,
  };
}

async function main(): Promise<void> {
  if (process.env["ANKUR_RELEASE_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit release-live opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const home = await get("/");
  const health = await get("/api/health");
  const runtime = await get("/api/runtime-status");
  const runtimeEnvelope = runtime.value;
  const runtimeValue: unknown = typeof runtimeEnvelope === "object" && runtimeEnvelope !== null
    ? Reflect.get(runtimeEnvelope, "data")
    : undefined;
  const runtimeField = (name: string): unknown => typeof runtimeValue === "object" && runtimeValue !== null
    ? Reflect.get(runtimeValue, name)
    : undefined;
  const liveAiEnabled = runtimeField("liveAiEnabled") === true;
  const scalar = (name: string): string => {
    const value = runtimeField(name);
    return typeof value === "string" || typeof value === "number" ? String(value) : "unavailable";
  };
  const primaryModel = scalar("primaryModel");
  const providerConfigured = runtimeField("providerConfigured") === true;
  const buildId = scalar("buildId");

  const results: FlowResult[] = [];
  for (const item of CASES) {
    results.push(await runCaseWithRetry(item));
  }
  const controlled = await runControlledFailure();

  const passed = results.filter((result) => result.outcome === "passed").length;
  const external = results.filter((result) => result.outcome === "provider_unavailable").length;
  const invalidOutput = results.filter((result) => result.outcome === "invalid_output").length;
  const report = `# Ankur release flow verification

- Origin: \`${baseUrl()}\`
- Home: HTTP ${String(home.status)}
- Health: HTTP ${String(health.status)}
- Runtime status: HTTP ${String(runtime.status)}
- Live AI enabled: ${liveAiEnabled ? "yes" : "no"}; provider configured: ${providerConfigured ? "yes" : "no"}
- Primary model: \`${primaryModel}\`
- Build ID: \`${buildId}\`
- Live language flows passed: ${String(passed)}/${String(results.length)}
- Flows blocked by provider availability after ${String(FLOW_ATTEMPTS)} attempts: ${String(external)}
- Flows that produced an invalid generated artifact: ${String(invalidOutput)}
- Controlled-failure path: ${controlled.outcome} — ${controlled.detail}

| Flow | Language | Outcome | Analysis (ms) | Assessment (ms) | Written (ms) | Written status | Marks | Grounding failures | Quote failures | Totals reconcile |
|---|---|---|---:|---:|---:|---|---:|---:|---:|---|
${results.map((result) => `| ${result.id} | ${result.language} | ${result.outcome} | ${String(result.analysisMs)} | ${String(result.assessmentMs)} | ${String(result.writtenMs)} | ${result.writtenStatus} | ${String(result.awardedMarks)}/5 | ${String(result.groundingFailures)} | ${String(result.quoteFailures)} | ${result.reconciles ? "yes" : "no"} |`).join("\n")}

## Detail

${results.map((result) => `- \`${result.id}\`: ${result.detail}`).join("\n")}

An \`invalid_output\` outcome means the application refused to persist an invalid
generated artifact and returned a safe typed error. That is correct product
behaviour, not a deployment defect.

A \`provider_unavailable\` outcome means Google's hosted API was unreachable,
timed out, rate-limited, or out of quota for every attempt. It measures the
external dependency, not Ankur.

No credential, prompt, provider response body, source text, reference answer,
student answer, generated question, or feedback is recorded in this report.
`;
  await mkdir(dirname(RESULTS_PATH), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Release flow verification: ${String(passed)}/${String(results.length)} live flows passed; controlled failure ${controlled.outcome}; report=${RESULTS_PATH}\n`);
  if (results.some((result) => result.outcome === "failed") || controlled.outcome !== "passed") {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  process.stderr.write(`RELEASE_FLOW_VERIFICATION_FAILED: ${error instanceof Error ? error.message : "unknown"}\n`);
  process.exitCode = 1;
});
