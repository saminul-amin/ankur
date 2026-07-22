import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { TranscribePage } from "../../src/application/use-cases/transcribe-page.js";
import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import { validateTranscriptionImage } from "../../src/domain/source/page-extraction.js";
import { GemmaPageTranscriptionAdapter } from "../../src/infrastructure/gemma/gemma-page-transcription-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";

const RESULTS_PATH = resolve("evaluation/ingestion/RESULTS.md");
const FIXTURE_PATH = resolve("evaluation/provider-spike/fixtures/bengali-page.png");

async function main(): Promise<void> {
  if (process.env["ANKUR_INGESTION_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit ingestion-provider opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    process.stderr.write("CONFIGURATION_ERROR: live AI must be explicitly enabled and configured.\n");
    process.exitCode = 1;
    return;
  }
  const image = await readFile(FIXTURE_PATH);
  const imageBase64 = image.toString("base64");
  const imageFailures = validateTranscriptionImage({ mimeType: "image/png", imageBase64 });
  if (imageFailures.length > 0) throw new Error("Fixture failed the image transport contract.");

  const provider = new GoogleGenAiAdapter(config.apiKey, config.primaryModel);
  const useCase = new TranscribePage(new GemmaPageTranscriptionAdapter(provider, config.requestTimeoutMs));
  const startedAt = new Date().toISOString();
  const result = await useCase.execute({
    sourceVersionDraftId: "live-ingestion-fixture",
    materialOrdinal: 1,
    pageNumber: 1,
    mimeType: "image/png",
    imageBase64,
    targetLanguage: "bn",
    requestId: crypto.randomUUID(),
  });
  const confirmed = createConfirmedSource({
    pages: [{ pageNumber: result.pageNumber, text: result.text }],
    language: result.detectedLanguage,
    method: "page_images",
  });
  const passed = result.text.trim().length > 0
    && result.pageNumber === 1
    && result.artifact.modelId === "gemma-4-26b-a4b-it"
    && result.artifact.thinkingLevel === "minimal"
    && confirmed.segments.length > 0;
  const report = `# Task 03 Live Ingestion Verification

- Gate check: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Fixture: \`evaluation/provider-spike/fixtures/bengali-page.png\`
- Model: \`${result.artifact.modelId}\`
- Thinking: \`${result.artifact.thinkingLevel}\`
- Native structured response validated: yes
- Schema repair used: ${result.artifact.repaired ? "yes" : "no"}
- Detected language: \`${result.detectedLanguage}\`
- Transcribed characters: ${String(Array.from(result.text).length)}
- Uncertain segments: ${String(result.uncertainSegments.length)}
- Warnings: ${String(result.warnings.length)}
- Deterministic confirmed segments: ${String(confirmed.segments.length)}
- Source version created: ${confirmed.sourceVersionId.startsWith("source-") ? "yes" : "no"}

The verifier sent one repository-owned Bengali page image. It did not load the reference transcription. No credential, provider body, raw prompt, image bytes, or full source text is stored in this report.
`;
  if (report.includes(config.apiKey)) throw new Error("Refusing to write a report containing the provider credential.");
  await mkdir(resolve("evaluation/ingestion"), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Live ingestion ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof ProviderError) process.stderr.write(`${error.code}: ${error.message}\n`);
  else process.stderr.write("INTERNAL_ERROR: live ingestion verification failed safely.\n");
  process.exitCode = 1;
}
