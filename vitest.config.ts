import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    coverage: { reporter: ["text", "html"] },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    // The pdfjs fixture tests parse real PDFs; the default 5s budget makes the
    // release gate flaky when the whole suite starts cold.
    testTimeout: 20_000,
  },
});
