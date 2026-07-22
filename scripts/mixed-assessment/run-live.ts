import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { WrittenEvaluationPort } from "../../src/application/ports/written-evaluation-port.js";
import type { LearningContentGenerationPort } from "../../src/application/ports/learning-content-port.js";
import type { GenerativeModelPort, StructuredGenerationRequest, StructuredGenerationResult, TextGenerationRequest, TextGenerationResult } from "../../src/application/ports/generative-model-port.js";
import { createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { EvaluateWrittenAnswer } from "../../src/application/use-cases/evaluate-written-answer.js";
import { GenerateMixedAssessment } from "../../src/application/use-cases/generate-mixed-assessment.js";
import { calculateConceptPerformance, reconcileAssessmentTotal } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq, validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow, type ConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter.js";
import { GoogleGenAiAdapter } from "../../src/infrastructure/gemma/google-genai-adapter.js";
import { readRuntimeConfig } from "../../src/shared/config/runtime-config.js";
import { ApplicationError } from "../../src/shared/errors/application-error.js";
import { ProviderError } from "../../src/shared/errors/provider-error.js";

const RESULTS_PATH = resolve("evaluation/mixed-assessment/RESULTS.md");

class PhaseObservingProvider implements GenerativeModelPort {
  constructor(private readonly delegate: GenerativeModelPort) {}
  generateText(request: TextGenerationRequest): Promise<TextGenerationResult> { return this.delegate.generateText(request); }
  healthCheck() { return this.delegate.healthCheck(); }
  async generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    try { return await this.delegate.generateStructured(request); }
    catch (error) {
      process.stderr.write(`PROVIDER_PHASE: ${request.schemaVersion}\n`);
      if (error instanceof ProviderError && error.code === "INVALID_OUTPUT" && error.cause instanceof Error) process.stderr.write(`VALIDATION_DETAIL: ${error.cause.message}\n`);
      throw error;
    }
  }
}

function evidenceWindow(source: ConfirmedSource, segmentIds: ReadonlySet<string>) {
  return rehydrateEvidenceWindow({
    sourceVersionId: source.sourceVersionId,
    language: source.language,
    segments: source.segments.filter((segment) => segmentIds.has(segment.id)),
  });
}

async function main(): Promise<void> {
  if (process.env["ANKUR_MIXED_ASSESSMENT_LIVE_OPT_IN"] !== "true") {
    process.stderr.write("CONFIGURATION_ERROR: explicit mixed-assessment provider opt-in is required.\n");
    process.exitCode = 1;
    return;
  }
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled || config.apiKey === undefined) {
    process.stderr.write("CONFIGURATION_ERROR: live AI must be explicitly enabled and configured.\n");
    process.exitCode = 1;
    return;
  }

  const source = createSampleSource();
  const provider = new PhaseObservingProvider(new GoogleGenAiAdapter(config.apiKey, config.primaryModel));
  const content = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const observedCandidates: Awaited<ReturnType<LearningContentGenerationPort["generateMixedAssessment"]>>[] = [];
  const observedContent: LearningContentGenerationPort = {
    generatePreparationMap: (input) => content.generatePreparationMap(input),
    generateMixedAssessment: async (input) => {
      const candidate = await content.generateMixedAssessment(input);
      observedCandidates.push(candidate);
      return candidate;
    },
  };
  const writtenAdapter = new GemmaWrittenEvaluationAdapter(provider, config.requestTimeoutMs);
  let writtenProviderCalls = 0;
  const countedWrittenPort: WrittenEvaluationPort = {
    evaluateWrittenAnswer: async (input) => {
      writtenProviderCalls += 1;
      return writtenAdapter.evaluateWrittenAnswer(input);
    },
  };
  const startedAt = new Date().toISOString();
  const map = createSamplePreparationMap(source);
  let activity: Awaited<ReturnType<LearningContentGenerationPort["generateMixedAssessment"]>>;
  try {
    activity = await new GenerateMixedAssessment(observedContent).execute({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      title: "সালোকসংশ্লেষণ · মিশ্র মূল্যায়ন",
      difficulty: "medium",
      requestId: crypto.randomUUID(),
    });
  } catch (error) {
    const safeFailures = observedCandidates.flatMap((candidate) => validateActivitySet(source, map, candidate).map(({ path, reason }) => ({ path, reason })));
    process.stderr.write(`VALIDATION_SUMMARY: ${JSON.stringify(safeFailures)}\n`);
    throw error;
  }
  const written = activity.questions[1];
  const allowedIds = new Set([
    ...written.evidence.map((reference) => reference.segmentId),
    ...written.rubric.flatMap((criterion) => criterion.evidence.map((reference) => reference.segmentId)),
  ]);
  const gradingSource = evidenceWindow(source, allowedIds);
  const evaluate = new EvaluateWrittenAnswer(countedWrittenPort);

  const correct = await evaluate.execute({
    source: gradingSource,
    question: written,
    studentAnswer: written.referenceAnswer,
    requestId: crypto.randomUUID(),
  });
  const referenceTokens = written.referenceAnswer.trim().split(/\s+/u);
  const partialAnswer = referenceTokens.slice(0, Math.max(3, Math.ceil(referenceTokens.length * 0.45))).join(" ");
  const partial = await evaluate.execute({
    source: gradingSource,
    question: written,
    studentAnswer: partialAnswer,
    requestId: crypto.randomUUID(),
  });
  const callsBeforeEmpty = writtenProviderCalls;
  const empty = await evaluate.execute({
    source: gradingSource,
    question: written,
    studentAnswer: "  \n ",
    requestId: crypto.randomUUID(),
  });
  const emptyBypassedProvider = callsBeforeEmpty === writtenProviderCalls;

  const mcqGrade = gradeMcq(activity.questions[0], activity.questions[0].correctOptionId);
  const partialPerformance = calculateConceptPerformance({
    concepts: map.concepts,
    mcqQuestion: activity.questions[0],
    mcqGrade,
    writtenQuestion: written,
    writtenEvaluation: partial,
  });
  const activityFailures = validateActivitySet(source, map, activity);
  const correctFailures = validateWrittenEvaluation(gradingSource, written, correct);
  const partialFailures = validateWrittenEvaluation(gradingSource, written, partial);
  const emptyFailures = validateWrittenEvaluation(gradingSource, written, empty);
  const rubricTotal = written.rubric.reduce((sum, criterion) => sum + criterion.maximumMarks, 0);
  const passed = activityFailures.length === 0
    && correctFailures.length === 0
    && partialFailures.length === 0
    && emptyFailures.length === 0
    && written.rubric.length >= 2
    && written.rubric.length <= 4
    && rubricTotal === 5
    && correct.status === "correct"
    && correct.awardedMarks === 5
    && partial.status === "partially_correct"
    && partial.awardedMarks > 0
    && partial.awardedMarks < 5
    && empty.status === "not_answered"
    && empty.awardedMarks === 0
    && emptyBypassedProvider
    && reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: partial, performance: partialPerformance });

  const report = `# Task 04 Live Mixed-Assessment Verification

- Gate check: **${passed ? "PASSED" : "BLOCKED"}**
- Started: ${startedAt}
- Completed: ${new Date().toISOString()}
- Model: \`${config.primaryModel}\`
- Candidate-generation thinking: \`${activity.artifact.thinkingLevel}\`
- Written-grading thinking: \`${correct.artifact.thinkingLevel}\`
- Structured-output mode: \`native\`
- Preparation map: deterministic, validated repository fixture
- Composition: ${String(activity.questions.length)} questions; MCQ ${String(activity.questions[0].marks)} mark; written ${String(written.marks)} marks
- Rubric criteria: ${String(written.rubric.length)}
- Rubric maximum total: ${String(rubricTotal)}
- Activity grounding/invariant failures: ${String(activityFailures.length)}
- Correct-answer validation failures: ${String(correctFailures.length)}
- Partial-answer validation failures: ${String(partialFailures.length)}
- Empty-answer validation failures: ${String(emptyFailures.length)}
- Correct-answer result: ${String(correct.awardedMarks)}/5, \`${correct.status}\`
- Partial-answer result: ${String(partial.awardedMarks)}/5, \`${partial.status}\`
- Empty-answer result: ${String(empty.awardedMarks)}/5, \`${empty.status}\`
- Empty answer provider bypass: ${emptyBypassedProvider ? "passed" : "failed"}
- Written provider calls: ${String(writtenProviderCalls)}
- Assessment latency: ${String(activity.artifact.latencyMs)} ms
- Correct grading latency: ${String(correct.artifact.latencyMs)} ms
- Partial grading latency: ${String(partial.artifact.latencyMs)} ms
- Assessment repair used: ${activity.artifact.repaired ? "yes" : "no"}
- Correct grading repair used: ${correct.artifact.repaired ? "yes" : "no"}
- Partial grading repair used: ${partial.artifact.repaired ? "yes" : "no"}
- Criterion and total reconciliation: ${reconcileAssessmentTotal({ mcqGrade, writtenEvaluation: partial, performance: partialPerformance }) ? "passed" : "failed"}

No credential, raw prompt, provider response body, source text, reference answer, or student answer is stored in this report.
`;
  if (report.includes(config.apiKey)) throw new Error("Refusing to write a report containing the provider credential.");
  await mkdir(resolve("evaluation/mixed-assessment"), { recursive: true });
  await writeFile(RESULTS_PATH, report, "utf8");
  process.stdout.write(`Live mixed assessment ${passed ? "PASSED" : "BLOCKED"}. Results: ${RESULTS_PATH}\n`);
  if (!passed) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  if (error instanceof ProviderError) process.stderr.write(`${error.code}: ${error.message}\n`);
  else if (error instanceof ApplicationError) process.stderr.write(`${error.code}: ${error.message}\n`);
  else process.stderr.write("INTERNAL_ERROR: live mixed-assessment verification failed safely.\n");
  process.exitCode = 1;
}
