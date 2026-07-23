import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";

import { z } from "zod";

import { task06ClosureMetricsSchema } from "../../src/shared/evaluation/task06-closure";

const closureManifestSchema = z.object({
  schemaVersion: z.literal("task06-closure-manifest.v1"),
  files: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[0-9a-f]{64}$/u),
    sizeBytes: z.number().int().nonnegative(),
  }).strict()).min(1),
}).strict();

async function main(): Promise<void> {
  const path = resolve("evaluation/exports/task06-closure-metrics.json");
  task06ClosureMetricsSchema.parse(JSON.parse(await readFile(path, "utf8")) as unknown);

  const manifest = closureManifestSchema.parse(JSON.parse(
    await readFile(resolve("evaluation/exports/task06-closure-manifest.json"), "utf8"),
  ) as unknown);
  for (const entry of manifest.files) {
    const bytes = await readFile(resolve(entry.path));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== entry.sha256 || bytes.byteLength !== entry.sizeBytes) {
      throw new Error("CLOSURE_MANIFEST_HASH_MISMATCH");
    }
  }

  const required = [
    "evaluation/exports/question-pipeline-comparison.csv",
    "evaluation/exports/reviewer-agreement.csv",
    "evaluation/exports/reliability-reclassification.json",
    "evaluation/exports/reliability-by-operation.csv",
    "evaluation/exports/written-evaluation-validity.csv",
    "evaluation/exports/question-error-analysis-v2.csv",
    "evaluation/reports/TASK_06_FINAL_CLOSURE_REPORT.md",
    "SSOT_UPDATE_v1.3.0_TASK06_CLOSED.md",
  ];
  for (const item of required) await stat(resolve(item));

  const publicText = await Promise.all(required.map(async (item) => readFile(resolve(item), "utf8")));
  const forbidden = [
    /AIza[0-9A-Za-z_-]{20,}/u,
    /GEMINI_API_KEY\s*[:=]\s*["'][^"']+["']/u,
    /hiddenReasoning/u,
  ];
  if (publicText.some((content) => forbidden.some((pattern) => pattern.test(content)))) {
    throw new Error("CLOSURE_PUBLIC_PRIVACY_SCAN_FAILED");
  }
  const notebookText = await Promise.all([
    readFile(resolve("evaluation/notebook/ankur_task06_evaluation.ipynb"), "utf8"),
    readFile(resolve("evaluation/notebook/ankur_task06_evaluation.html"), "utf8"),
  ]);
  const notebookForbidden = [
    /completed-private/iu,
    /question-human-evidence\.json/iu,
    /written-human-evidence\.json/iu,
    /GEMINI_API_KEY/u,
    /\.env\.local/u,
  ];
  if (
    notebookText.some((content) =>
      notebookForbidden.some((pattern) => pattern.test(content))
    )
  ) {
    throw new Error("CLOSURE_NOTEBOOK_PRIVATE_REFERENCE");
  }

  process.stdout.write("Task 06 public closure verification PASSED.\n");
}

void main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : "CLOSURE_PUBLIC_VERIFICATION_FAILED"}\n`);
  process.exitCode = 1;
});
