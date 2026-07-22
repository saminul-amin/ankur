import { readFile, readdir } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        return sourceFiles(path);
      }
      return extname(path) === ".ts" ? [path] : [];
    }),
  );
  return files.flat();
}

describe("server-only provider isolation", () => {
  it("keeps the Google SDK import inside the Gemma infrastructure adapter", async () => {
    const sourceRoot = resolve("src");
    const offenders: string[] = [];
    for (const file of await sourceFiles(sourceRoot)) {
      const contents = await readFile(file, "utf8");
      if (
        contents.includes("@google/genai") &&
        relative(sourceRoot, file).replaceAll("\\", "/") !==
          "infrastructure/gemma/google-genai-adapter.ts"
      ) {
        offenders.push(relative(sourceRoot, file));
      }
    }
    expect(offenders).toEqual([]);
  });

  it("does not define a browser-public provider key", async () => {
    const files = [resolve(".env.example"), ...(await sourceFiles(resolve("src")))];
    for (const file of files) {
      const contents = await readFile(file, "utf8");
      expect(contents).not.toContain("NEXT_PUBLIC_GEMINI_API_KEY");
    }
  });
});
