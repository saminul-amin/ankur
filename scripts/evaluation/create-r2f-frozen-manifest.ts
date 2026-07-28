import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname, relative, resolve } from "node:path";

const ROOTS = [
  "evaluation/corpus/public",
  "evaluation/exports",
  "evaluation/notebook",
  "evaluation/records/public",
  "evaluation/reports",
  "evaluation/task06c",
  "evaluation/task06c-r1",
  "evaluation/task06c-r2",
  "evaluation/task06c-r2e",
] as const;

async function filesUnder(path: string): Promise<string[]> {
  const entries = await readdir(path, { withFileTypes: true });
  return (await Promise.all(entries.map((entry) => {
    const child = resolve(path, entry.name);
    if (entry.isDirectory()) {
      if (child.replaceAll("\\", "/").includes("/private/")) return Promise.resolve([]);
      return filesUnder(child);
    }
    return Promise.resolve([child]);
  }))).flat();
}

const files = (await Promise.all(ROOTS.map((root) => filesUnder(resolve(root))))).flat()
  .filter((path) => [".json", ".csv", ".md", ".txt", ".ipynb", ".html"].includes(extname(path)))
  .toSorted();
const records = await Promise.all(files.map(async (path) => ({
  path: relative(process.cwd(), path).replaceAll("\\", "/"),
  sha256: createHash("sha256").update(await readFile(path)).digest("hex"),
})));
const output = resolve("evaluation/task06c-r2f/frozen-evidence-hashes.json");
await mkdir(resolve("evaluation/task06c-r2f"), { recursive: true });
await writeFile(output, `${JSON.stringify({
  schemaVersion: "task06c-r2f-frozen-evidence-hashes.v1",
  frozenAtCommit: "01bbfbdac5baa7bee2b94cfa84d91f4ea5954eaa",
  records,
}, null, 2)}\n`, "utf8");
process.stdout.write(`Task 06C-R2F frozen historical manifest created: ${String(records.length)} files.\n`);
