import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";

import { computeTask06Metrics } from "../../src/shared/evaluation/task06-metrics";
import {
  adaptiveLoopRecordSchema,
  baselineRecordSchema,
  evaluationMaterialSchema,
  extractionRecordSchema,
  generatedQuestionRecordSchema,
  providerOperationSchema,
  writtenGradingRecordSchema,
} from "../../src/shared/evaluation/task06-schemas";

const EVALUATION_ROOT = resolve("evaluation");
const PUBLIC_RECORD_ROOT = resolve(EVALUATION_ROOT, "records/public");

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

async function json<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = resolve(path, entry.name);
    return entry.isDirectory() ? filesUnder(entryPath) : [entryPath];
  }));
  return nested.flat();
}

async function main(): Promise<void> {
  const manifest = await json<{ materials: unknown[]; goldenDemo: unknown; humanVerificationStatus: string }>(
    resolve(EVALUATION_ROOT, "corpus/public/manifest.json"),
  );
  const materials = manifest.materials.map((item) => evaluationMaterialSchema.parse(item));
  const golden = evaluationMaterialSchema.parse(manifest.goldenDemo);
  const extraction = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "extraction-records.json")))
    .map((item) => extractionRecordSchema.parse(item));
  const questions = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "question-records.json")))
    .map((item) => generatedQuestionRecordSchema.parse(item));
  const written = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "written-grading-records.json")))
    .map((item) => writtenGradingRecordSchema.parse(item));
  const adaptive = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "adaptive-loop-records.json")))
    .map((item) => adaptiveLoopRecordSchema.parse(item));
  const provider = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "provider-operations.json")))
    .map((item) => providerOperationSchema.parse(item));
  const baseline = (await json<unknown[]>(resolve(PUBLIC_RECORD_ROOT, "baseline-records.json")))
    .map((item) => baselineRecordSchema.parse(item));

  if (
    materials.length !== 6 ||
    new Set(materials.map((item) => item.domain)).size !== 3 ||
    new Set(materials.map((item) => item.language)).size !== 3 ||
    new Set(materials.map((item) => item.inputType)).size !== 4 ||
    golden.materialId !== "GOLDEN-DEMO-01"
  ) throw new Error("CORPUS_COVERAGE_INVALID");
  if (questions.length < 30 || written.length < 12 || adaptive.length < 6 || baseline.length !== 6) {
    throw new Error("EVALUATION_SCALE_INVALID");
  }
  if (
    new Set(questions.map((item) => item.recordId)).size !== questions.length ||
    new Set(written.map((item) => item.recordId)).size !== written.length ||
    new Set(provider.map((item) => item.operationId)).size !== provider.length
  ) throw new Error("DUPLICATE_RECORD_ID");

  for (const material of [...materials, golden]) {
    const combined = material.pages.map((page) => page.expectedText).join("\n\n").normalize("NFC");
    if (material.contentHash !== sha256(combined)) throw new Error("PROVENANCE_OR_HASH_INVALID");
  }

  const recomputed = computeTask06Metrics({
    materials,
    extraction,
    questions,
    written,
    adaptive,
    provider,
    baseline,
    questionAnnotations: [],
    writtenAnnotations: [],
    generatedAt: "public-record-verification",
  });
  if (
    recomputed.questions.total !== questions.length ||
    recomputed.written.total !== written.length ||
    recomputed.reliability.totalOperations !== provider.filter((item) => item.finalStatus !== "pending").length ||
    recomputed.humanReviewStatus !== "pending" ||
    manifest.humanVerificationStatus !== "pending"
  ) throw new Error("DENOMINATOR_OR_REVIEW_STATUS_INVALID");

  const ignored = await readFile(resolve(".gitignore"), "utf8");
  for (const required of [
    "/evaluation/corpus/private/",
    "/evaluation/records/private/",
    "/evaluation/annotations/completed-private/",
  ]) {
    if (!ignored.includes(required)) throw new Error("PRIVATE_PATH_NOT_IGNORED");
  }

  const publicFiles = (await filesUnder(EVALUATION_ROOT)).filter((path) =>
    !path.includes(resolve(EVALUATION_ROOT, "records/private")) &&
    !path.includes(resolve(EVALUATION_ROOT, "corpus/private")) &&
    !path.includes(resolve(EVALUATION_ROOT, "annotations/completed-private")) &&
    [".json", ".csv", ".md", ".txt", ".ipynb", ".html"].includes(extname(path)),
  );
  const forbidden = [
    /AIza[0-9A-Za-z_-]{20,}/u,
    /GEMINI_API_KEY\s*[:=]\s*["'][^"']+["']/u,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu,
    /"candidates"\s*:/u,
    /"providerBody"\s*:/u,
    /"hiddenReasoning"\s*:/u,
  ];
  for (const path of publicFiles) {
    const content = await readFile(path, "utf8");
    if (forbidden.some((pattern) => pattern.test(content))) throw new Error("PUBLIC_PRIVACY_SCAN_FAILED");
  }

  process.stdout.write(
    `Evaluation verification PASSED: ${String(materials.length)} materials, ${String(questions.length)} questions, ` +
    `${String(written.length)} written cases, ${String(adaptive.length)} adaptive records, ${String(provider.length)} provider operations.\n`,
  );
}

void main().catch((error: unknown) => {
  const message = error instanceof Error && /^[A-Z0-9_]+$/u.test(error.message)
    ? error.message
    : "EVALUATION_VERIFICATION_FAILED";
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
