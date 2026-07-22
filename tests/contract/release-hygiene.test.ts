import { access, readFile, readdir } from "node:fs/promises";
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

  it("documents the locked manual gate and keeps hosted CI deferred", async () => {
    const readme = await readFile(resolve("README.md"), "utf8");
    await expect(access(resolve(".github/workflows/ci.yml"))).rejects.toThrow();
    for (const command of ["npm ci", "npm run lint", "npm run typecheck", "npm test", "npm run build"]) {
      expect(readme).toContain(command);
    }
    for (const command of ["npm run test:e2e", "npm audit --audit-level=moderate", "git diff --check"]) {
      expect(readme).toContain(command);
    }
    expect(readme).toContain("local, GitHub, and production build IDs match");
    expect(readme).not.toMatch(/billing[- ]lock|credit card|payment method/iu);
  });

  it("contains no personal email address in judge-facing Markdown", async () => {
    const files = [resolve("README.md"), ...(await markdownFiles(resolve("docs")))];
    for (const file of files) {
      expect(await readFile(file, "utf8")).not.toMatch(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/iu);
    }
  });
});
