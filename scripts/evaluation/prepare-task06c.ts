import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  evaluationCorpus,
  materialText,
  task06cEvaluationCorpus,
  task06cHoldoutCorpus,
} from "./corpus";
import {
  task06cGateResultSchema,
  task06cMaterialSchema,
  task06cMetricsSchema,
} from "../../src/shared/evaluation/task06c-schemas";
import { evaluateTask06cGates } from "../../src/shared/evaluation/task06c-metrics";
import { evaluationMaterialSchema } from "../../src/shared/evaluation/task06-schemas";

const ROOT = resolve("evaluation/task06c");
const CORPUS_ROOT = resolve(ROOT, "corpus/public");
const TEXT_ROOT = resolve(CORPUS_ROOT, "texts");
const EXPORT_ROOT = resolve(ROOT, "exports");
const ANNOTATION_ROOT = resolve(ROOT, "annotations");
const GENERATED_AT = "2026-07-24T00:00:00.000Z";

function sha256(value: string): string {
  return `sha256:${createHash("sha256").update(value, "utf8").digest("hex")}`;
}

function publicMaterial(material: (typeof task06cEvaluationCorpus)[number]) {
  const cohort = task06cHoldoutCorpus.some((candidate) => candidate.id === material.id)
    ? "holdout_task06c" as const
    : "frozen_task06" as const;
  return task06cMaterialSchema.parse({
    schemaVersion: "task06c-material.v1",
    materialId: material.id,
    cohort,
    title: material.title,
    domain: material.domain,
    language: material.language,
    inputType: material.inputType,
    licence: material.licence,
    provenance: material.provenance,
    publicSafe: material.publicSafe,
    sourceHash: sha256(materialText(material)),
    sourceReference: `evaluation/task06c/corpus/public/texts/${material.id}.txt`,
  });
}

function runnerMaterial(material: (typeof task06cEvaluationCorpus)[number]) {
  return evaluationMaterialSchema.parse({
    schemaVersion: "evaluation-material.v1",
    materialId: material.id,
    title: material.title,
    domain: material.domain,
    language: material.language,
    inputType: material.inputType,
    pageCount: material.pages.length,
    fixturePath: material.fixturePath,
    licence: material.licence,
    provenance: material.provenance,
    sourceUrl: null,
    redistributionAllowed: true,
    publicSafe: material.publicSafe,
    contentHash: sha256(materialText(material)),
    learnerPriorityHash: sha256(material.learnerPriority),
    manualVerificationStatus: "pending",
    reviewerNotes: "Task 06C fresh independent source verification is pending.",
    createdAt: material.createdAt,
    updatedAt: material.updatedAt,
    pages: material.pages.map((page) => ({
      pageNumber: page.pageNumber,
      route: page.route,
      expectedText: page.text,
      confirmedText: page.text,
      expectedTextHash: sha256(page.text),
      confirmedTextHash: sha256(page.text),
    })),
  });
}

async function main(): Promise<void> {
  await Promise.all([
    mkdir(TEXT_ROOT, { recursive: true }),
    mkdir(EXPORT_ROOT, { recursive: true }),
    mkdir(ANNOTATION_ROOT, { recursive: true }),
  ]);
  const materials = task06cEvaluationCorpus.map(publicMaterial);
  await Promise.all(task06cEvaluationCorpus.map((material) =>
    writeFile(
      resolve(TEXT_ROOT, `${material.id}.txt`),
      `${materialText(material)}\n`,
      "utf8",
    ),
  ));
  await writeFile(
    resolve(CORPUS_ROOT, "manifest.json"),
    `${JSON.stringify({
      schemaVersion: "task06c-corpus-manifest.v1",
      generatedAt: GENERATED_AT,
      historicalTask06CorpusPath: "evaluation/corpus/public/manifest.json",
      frozenMaterialCount: evaluationCorpus.length,
      holdoutMaterialCount: task06cHoldoutCorpus.length,
      materials,
      evaluationMaterials: task06cEvaluationCorpus.map(runnerMaterial),
    }, null, 2)}\n`,
    "utf8",
  );
  const pendingRatio = {
    numerator: 0,
    denominator: 0,
    percentage: null,
    status: "pending_human_review" as const,
  };
  const metrics = task06cMetricsSchema.parse({
    schemaVersion: "task06c-metrics.v1",
    generatedAt: GENERATED_AT,
    historicalTask06MetricsPath: "evaluation/exports/task06-closure-metrics.json",
    materials: {
      frozen: evaluationCorpus.length,
      holdout: task06cHoldoutCorpus.length,
      total: task06cEvaluationCorpus.length,
    },
    logicalOperations: 0,
    providerAttempts: 0,
    answerKeyCorrectness: pendingRatio,
    answerKeyGrounding: pendingRatio,
    overallHumanAcceptance: pendingRatio,
    ankurHumanAcceptance: pendingRatio,
    baselineHumanAcceptance: pendingRatio,
    questionRubricAlignment: pendingRatio,
    eligibleWrittenCases: 0,
    writtenWithinOneMark: pendingRatio,
    finalLogicalArtifactValidity: pendingRatio,
    acceptedCrossMaterialEvidenceDefects: 0,
    invalidRubricCasesIncludedInGradingMetrics: 0,
    notebookRestartRunAll: "pending",
    publicPrivacyScan: "pending",
    humanReviewStatus: "pending",
  });
  const gates = task06cGateResultSchema.parse(evaluateTask06cGates(metrics));
  await writeFile(
    resolve(EXPORT_ROOT, "task06c-metrics.pending.json"),
    `${JSON.stringify(metrics, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(EXPORT_ROOT, "task06c-gate-status.pending.json"),
    `${JSON.stringify(gates, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    resolve(ANNOTATION_ROOT, "REVIEWER_INSTRUCTIONS.md"),
    `# Task 06C independent review\n\n` +
      `Task 06 historical labels must not be reused. R1 and R2 receive separately shuffled packets with neutral IDs and no pipeline labels during review. Pass A covers question quality before Pass B reveals source-scoped evidence and objective keys. Reviewers declare authorship conflicts and work independently. Only disagreement fields proceed to adjudication.\n\n` +
      `Human judgments must remain blank until entered by the assigned reviewer. Private packets, reviewer identities, notes, attestations, and the coordinator mapping remain under the Git-ignored private annotation path.\n`,
    "utf8",
  );
  process.stdout.write(
    `Prepared Task 06C corpus: ${String(evaluationCorpus.length)} frozen + ${String(task06cHoldoutCorpus.length)} holdout materials. Human metrics remain pending.\n`,
  );
}

await main();
