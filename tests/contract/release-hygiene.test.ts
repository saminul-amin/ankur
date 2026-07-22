import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function markdownFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  return (await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.name.endsWith(".md") ? [path] : [];
  }))).flat();
}

describe("public release hygiene", () => {
  it("keeps the root README judge-facing and complete", async () => {
    const readme = await readFile(resolve("README.md"), "utf8");
    for (const section of [
      "The problem", "Current public flow", "How Gemma 4 is used", "Architecture", "Local setup",
      "Evaluation evidence", "Privacy and security", "Limitations", "Team", "Licence and acknowledgements",
    ]) expect(readme).toContain(`## ${section}`);
    expect(readme).toContain("https://ankur-gamma.vercel.app");
    expect(readme).not.toContain("Codex must");
  });

  it("defines provider-free least-privilege CI", async () => {
    const workflow = await readFile(resolve(".github/workflows/ci.yml"), "utf8");
    expect(workflow).toContain("permissions:\n  contents: read");
    expect(workflow).toContain("node-version: 24.12.0");
    for (const command of ["npm ci", "npm run lint", "npm run typecheck", "npm test", "npm run build"]) {
      expect(workflow).toContain(command);
    }
    expect(workflow).not.toMatch(/GEMINI_API_KEY|verify:|benchmark:|vercel/u);
  });

  it("contains no personal email address in judge-facing Markdown", async () => {
    const files = [resolve("README.md"), ...(await markdownFiles(resolve("docs")))];
    for (const file of files) {
      expect(await readFile(file, "utf8")).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu);
    }
  });
});
