import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, resolve } from "node:path";

const roots = [
  "evaluation/corpus/public",
  "evaluation/exports",
  "evaluation/notebook",
  "evaluation/records/public",
  "evaluation/reports",
  "evaluation/task06c",
  "evaluation/task06c-r1",
];

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const child = join(path, entry.name);
    if (entry.isDirectory()) files.push(...await filesUnder(child));
    else if (entry.isFile()) files.push(child);
  }
  return files;
}

const records: Array<{ path: string; sha256: string }> = [];
for (const root of roots) {
  for (const path of await filesUnder(resolve(root))) {
    const normalized = relative(process.cwd(), path).replaceAll("\\", "/");
    if (normalized.includes("/private/")) continue;
    records.push({
      path: normalized,
      sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
    });
  }
}
records.sort((left, right) => left.path.localeCompare(right.path));
await mkdir(resolve("evaluation/task06c-r2"), { recursive: true });
await writeFile(
  resolve("evaluation/task06c-r2/frozen-evidence-hashes.json"),
  `${JSON.stringify({ schemaVersion: "task06c-r2-frozen-hashes.v1", records }, null, 2)}\n`,
  "utf8",
);
