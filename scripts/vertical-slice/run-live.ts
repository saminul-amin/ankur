import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { AnalyzeConfirmedSource } from "../../src/application/use-cases/analyze-confirmed-source.js";
import { GenerateOneMcq } from "../../src/application/use-cases/generate-one-mcq.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validatePreparationMap } from "../../src/domain/preparation/preparation-map.js";
import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";

const RESULTS_PATH = resolve("evaluation/vertical-slice/RESULTS.md");

async function main(): Promise<void> {
  if (process.env["ANKUR_PROVIDER_SPIKE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit provider opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    process.stderr.write("CONFIGURATION_ERROR: live AI must be explicitly enabled and configured.\n");
    process.exitCode = 1;
    return;
  }

  const source = createConfirmedSource({
    pages: [
      {
        pageNumber: 1,
        text: "উদ্ভিদ সূর্যালোকের শক্তি ব্যবহার করে পানি ও কার্বন ডাই-অক্সাইড থেকে খাদ্য তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলা হয় এবং এতে অক্সিজেন নির্গত হয়।",
      },
    ],
    language: "bn",
    method: "pasted_text",
    priorityInstruction: "সালোকসংশ্লেষণের উপকরণ ও ফলাফলে গুরুত্ব দিন।",
  });
  const provider = new GoogleGenAiAdapter(config.apiKey, config.primaryModel);
  const content = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const analyze = new AnalyzeConfirmedSource(content);
  const generate = new GenerateOneMcq(content);
  const startedAt = new Date().toISOString();
  const map = await analyze.execute({ source, requestId: crypto.randomUUID() });
  const activity = await generate.execute({
    source,
    preparationMap: map,
    selectedConceptIds: map.concepts.map((concept) => concept.id),
    requestId: crypto.randomUUID(),
  });
  const question = activity.questions[0];
  const grade = gradeMcq(question, question.correctOptionId);
  const mapFailures = validatePreparationMap(source, map);
  const activityFailures = validateActivitySet(source, map, activity);
  const passed = mapFailures.length === 0 && activityFailures.length === 0 && grade.correct;

  const report = `# Task 02 Live Vertical-Slice Verification

- Gate check: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Model: \`${config.primaryModel}\`
- Source segments: ${String(source.segments.length)}
- Preparation topics: ${String(map.topics.length)}
- Preparation concepts: ${String(map.concepts.length)}
- Questions: ${String(activity.questions.length)}
- Preparation evidence failures: ${String(mapFailures.length)}
- Assessment evidence failures: ${String(activityFailures.length)}
- Deterministic correct-answer grade: ${grade.correct ? "passed" : "failed"}
- Analysis latency: ${String(map.artifact.latencyMs)} ms
- Assessment latency: ${String(activity.artifact.latencyMs)} ms
- Schema repair used: ${map.artifact.repaired || activity.artifact.repaired ? "yes" : "no"}

No credential, raw prompt, provider error body, or full source text is stored in this report.
`;
  if (report.includes(config.apiKey)) {
    throw new Error("Refusing to write a report containing the provider credential.");
  }
  await mkdir(resolve("evaluation/vertical-slice"), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Live vertical slice ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof ProviderError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
  } else {
    process.stderr.write("INTERNAL_ERROR: live verification failed safely.\n");
  }
  process.exitCode = 1;
}
