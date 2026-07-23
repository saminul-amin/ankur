import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, resolve } from "node:path";

import {
  task06cGateResultSchema,
  task06cMaterialSchema,
  task06cMetricsSchema,
} from "../../src/shared/evaluation/task06c-schemas";

const ROOT = resolve("evaluation/task06c");
const PUBLIC_ROOTS = [
  resolve(ROOT, "corpus/public"),
  resolve(ROOT, "exports"),
  resolve(ROOT, "records/public"),
  resolve(ROOT, "notebook"),
  resolve(ROOT, "annotations", "REVIEWER_INSTRUCTIONS.md"),
  resolve(ROOT, "TASK_06C_EVALUATION_REPORT.md"),
];
const PRIVATE_MARKERS = [
  "completed-private",
  "records/private",
  "annotations/private",
  "coordinator-mapping",
  "reviewer-attestation",
  "question-human-evidence",
  "written-human-evidence",
  "GEMINI_API_KEY",
  "AIza",
];

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

async function filesUnder(path: string): Promise<string[]> {
  if (extname(path) !== "") return [path];
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = resolve(path, entry.name);
    return entry.isDirectory() ? filesUnder(child) : Promise.resolve([child]);
  }))).flat();
}

async function main(): Promise<void> {
  const manifest = JSON.parse(
    await readFile(resolve(ROOT, "corpus/public/manifest.json"), "utf8"),
  ) as Record<string, unknown>;
  if (
    manifest["schemaVersion"] !== "task06c-corpus-manifest.v1" ||
    manifest["frozenMaterialCount"] !== 6 ||
    manifest["holdoutMaterialCount"] !== 3
  ) throw new Error("Task 06C corpus cohort counts do not reconcile.");
  const materialsValue = manifest["materials"];
  if (!Array.isArray(materialsValue) || materialsValue.length !== 9) {
    throw new Error("Task 06C requires exactly nine prepared materials.");
  }
  const materials = materialsValue.map((value) => task06cMaterialSchema.parse(value));
  if (
    new Set(materials.map((material) => material.materialId)).size !== 9 ||
    materials.filter((material) => material.cohort === "frozen_task06").length !== 6 ||
    materials.filter((material) => material.cohort === "holdout_task06c").length !== 3
  ) throw new Error("Task 06C material IDs or cohorts are invalid.");
  for (const material of materials) {
    const text = (await readFile(resolve(material.sourceReference), "utf8")).trimEnd();
    if (sha256(text) !== material.sourceHash) {
      throw new Error(`Task 06C source hash mismatch: ${material.materialId}`);
    }
    if (material.cohort === "frozen_task06") {
      const historical = (
        await readFile(resolve(`evaluation/corpus/public/texts/${material.materialId}.txt`), "utf8")
      ).trimEnd();
      if (historical !== text) {
        throw new Error(`Frozen Task 06 material changed in Task 06C: ${material.materialId}`);
      }
    }
  }
  const metrics = task06cMetricsSchema.parse(JSON.parse(
    await readFile(resolve(ROOT, "exports/task06c-metrics.pending.json"), "utf8"),
  ));
  const gates = task06cGateResultSchema.parse(JSON.parse(
    await readFile(resolve(ROOT, "exports/task06c-gate-status.pending.json"), "utf8"),
  ));
  if (
    metrics.materials.holdout !== 3 ||
    metrics.humanReviewStatus !== "pending" ||
    gates.overallStatus !== "pending" ||
    gates.task07Authorized
  ) throw new Error("Pending Task 06C status must not authorize Task 07.");
  const liveMetrics = task06cMetricsSchema.parse(JSON.parse(
    await readFile(resolve(ROOT, "exports/task06c-metrics.live-run.json"), "utf8"),
  ));
  const liveGates = task06cGateResultSchema.parse(JSON.parse(
    await readFile(resolve(ROOT, "exports/task06c-gate-status.live-run.json"), "utf8"),
  ));
  if (
    liveMetrics.logicalOperations !== 45 ||
    liveMetrics.providerAttempts !== 72 ||
    liveMetrics.finalLogicalArtifactValidity.numerator !== 33 ||
    liveMetrics.finalLogicalArtifactValidity.denominator !== 45 ||
    liveMetrics.eligibleWrittenCases !== 7 ||
    liveMetrics.humanReviewStatus !== "pending" ||
    liveGates.overallStatus !== "failed" ||
    liveGates.task07Authorized
  ) throw new Error("Frozen Task 06C live-run metrics or gate status do not reconcile.");
  const publicFiles = (await Promise.all(PUBLIC_ROOTS.map(filesUnder))).flat();
  for (const path of publicFiles) {
    if (![".json", ".md", ".txt", ".ipynb", ".html"].includes(extname(path))) continue;
    const content = await readFile(path, "utf8");
    const normalized = content.replaceAll("\\", "/");
    for (const marker of PRIVATE_MARKERS) {
      if (normalized.includes(marker)) {
        throw new Error(`Public Task 06C artifact contains forbidden marker ${marker}: ${path}`);
      }
    }
  }
  process.stdout.write(
    "Task 06C public verification PASSED: 6 frozen + 3 holdout materials; frozen live-run metrics reconcile; privacy passed; Task 07 remains blocked.\n",
  );
}

await main();
