import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

import type {
  GenerativeModelPort,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationResult,
} from "../../src/application/ports/generative-model-port.js";
import {
  assembleEvidenceFirstAssessment,
  createEvidenceFirstAssessmentPlan,
  DISTRACTOR_SALVAGE_VERSION,
  selectDeterministicDistractors,
} from "../../src/application/services/evidence-first-assessment-builder.js";
import { createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import type { ModelArtifactMetadata } from "../../src/domain/ai/model-artifact.js";
import { semanticTextSimilarity } from "../../src/domain/assessments/evidence-first-validation.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import type { ProviderValidationDiagnostic } from "../../src/infrastructure/gemma/provider-diagnostics.js";

class QueueProvider implements GenerativeModelPort {
  readonly requests: StructuredGenerationRequest<unknown>[] = [];
  constructor(private readonly values: unknown[]) {}
  generateText(): Promise<TextGenerationResult> {
    throw new Error("Unexpected text generation.");
  }
  healthCheck() {
    return Promise.resolve({
      configured: true as const,
      provider: "gemini_api" as const,
      modelId: "gemma-4-26b-a4b-it" as const,
    });
  }
  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    this.requests.push(request);
    return Promise.resolve({
      value: request.schema.parse(this.values.shift()),
      metadata: {
        provider: "gemini_api",
        modelId: request.modelId,
        thinkingLevel: request.thinkingLevel,
        latencyMs: 1,
        promptTokenCount: 10,
        outputTokenCount: 5,
        finishReason: "STOP",
        providerAttemptCount: 1,
      },
      structuredOutputMode: "native",
      repaired: false,
    });
  }
}

const metadata: ModelArtifactMetadata = {
  provider: "gemini_api",
  modelId: "gemma-4-26b-a4b-it",
  task: "assessment_generation",
  promptVersion: "assessment-deterministic-construction.v10",
  schemaVersion: "activity-set.v2",
  thinkingLevel: "minimal",
  requestId: "r2f-regression",
  createdAt: "2026-07-28T00:00:00.000Z",
  latencyMs: 0,
  repaired: false,
};

function fixture() {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const plan = createEvidenceFirstAssessmentPlan({
    source,
    preparationMap: map,
    selectedConceptIds: map.concepts.map((concept) => concept.id),
  });
  return { source, map, plan };
}

function englishCanonical() {
  const { plan } = fixture();
  return {
    ...plan.mcqCanonicalAnswer,
    language: "en" as const,
  };
}

describe("Task 06C-R2F narrow assessment correction", () => {
  it("rejects Unicode, punctuation, and whitespace-equivalent distractors", () => {
    const selected = selectDeterministicDistractors({
      canonicalAnswer: englishCanonical(),
      candidates: [
        "Caf\u00e9 relation is reversed.",
        "  Cafe\u0301 relation is reversed!!! ",
        "Caf\u00e9   relation is reversed.",
      ],
    });
    expect(selected.filter((item) => item.normalize("NFC").includes("Café"))).toHaveLength(1);
    expect(selected).toHaveLength(3);
  });

  it("rejects semantically near-equivalent candidates", () => {
    expect(semanticTextSimilarity(
      "The process occurs without its essential condition.",
      "The process occurs without its essential required condition.",
    )).toBeGreaterThanOrEqual(0.82);
    const selected = selectDeterministicDistractors({
      canonicalAnswer: englishCanonical(),
      candidates: [
        "The process occurs without its essential condition.",
        "The process occurs without its essential required condition.",
        "A neighboring concept is substituted.",
      ],
    });
    expect(selected.filter((item) => item.includes("essential"))).toHaveLength(1);
  });

  it("rejects placeholders and malformed language before assembly", () => {
    const selected = selectDeterministicDistractors({
      canonicalAnswer: englishCanonical(),
      candidates: ["optionD", "Why the is?", "A coherent neighboring concept is substituted."],
    });
    expect(selected).not.toContain("optionD");
    expect(selected).not.toContain("Why the is?");
    expect(selected).toHaveLength(3);
  });

  it("uses the same deterministic salvage result for the same semantic input", () => {
    const input = {
      canonicalAnswer: englishCanonical(),
      candidates: ["Duplicate.", "Duplicate!!!", "optionD"],
    };
    expect(selectDeterministicDistractors(input)).toEqual(selectDeterministicDistractors(input));
    expect(DISTRACTOR_SALVAGE_VERSION).toBe("deterministic-distractor-salvage.v2");
  });

  it("preserves application-owned option identity, ordering, grounding, and rubric marks", () => {
    const { source, plan } = fixture();
    const artifacts = assembleEvidenceFirstAssessment({
      source,
      plan,
      mcqProvider: {
        prompt: "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে?",
        misconception1: "optionD",
        misconception2: "একটি ভুল সম্পর্ক উল্লেখ করা হয়েছে।",
        misconception3: "একটি ভুল সম্পর্ক উল্লেখ করা হয়েছে!!!",
      },
      writtenQuestionProvider: {
        prompt: "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে এবং সূর্যালোক কীভাবে কাজে লাগে?",
        expectedLength: "short_paragraph",
      },
      title: "R2F",
      difficulty: "medium",
      metadata,
    });
    expect(artifacts.mcq.options).toHaveLength(4);
    expect(artifacts.mcq.options.find((option) => option.id === artifacts.mcq.correctOptionId)?.role).toBe("correct");
    expect(artifacts.mcq.evidenceReferences).toEqual(plan.mcqCanonicalAnswer.evidenceReferences);
    expect(artifacts.rubric.criteria.reduce((sum, criterion) => sum + criterion.maximumMarks, 0)).toBe(5);
  });

  it("emits sanitized first-pass and regeneration semantic diagnostics", async () => {
    const { source, map } = fixture();
    const validWrittenPrompt =
      "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে এবং সূর্যালোকের শক্তি কীভাবে গ্রহণ করে?";
    const misconceptions = {
      misconception1: "নাইট্রোজেন দিয়ে খাদ্য তৈরি হয়।",
      misconception2: "মিথেন দিয়ে খাদ্য তৈরি হয়।",
      misconception3: "শিকড় সূর্যালোক তৈরি করে।",
    };
    const provider = new QueueProvider([
      { prompt: "Which unrelated answer is correct?", ...misconceptions },
      { prompt: validWrittenPrompt, expectedLength: "short_paragraph" },
      { prompt: "Still unrelated?", ...misconceptions },
    ]);
    const diagnostics: ProviderValidationDiagnostic[] = [];
    await expect(new GemmaLearningContentAdapter(
      provider,
      90_000,
      (diagnostic) => diagnostics.push(diagnostic),
    ).generateMixedAssessment({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      title: "R2F diagnostics",
      difficulty: "medium",
      requestId: "r2f-diagnostics",
    })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(diagnostics.some((item) => item.phase === "first_pass")).toBe(true);
    expect(diagnostics.some((item) => item.phase === "repair")).toBe(true);
    expect(diagnostics.some((item) => item.code === "QUESTION_CANONICAL_ANSWER_MISMATCH")).toBe(true);
    expect(diagnostics.every((item) => !JSON.stringify(item).includes("Which unrelated answer"))).toBe(true);
  });

  it("wires sanitized semantic diagnostics into the R2F evaluation export", async () => {
    const runner = await readFile("scripts/evaluation/run-task06c-r2f.ts", "utf8");
    expect(runner).toContain("(diagnostic) => diagnostics.push(diagnostic)");
    expect(runner).toContain('["semantic-diagnostics.json"');
    expect(runner).not.toContain("rawProviderBody");
  });

  it("keeps all historical Task 06 through R2E public evidence byte-identical", async () => {
    const manifest = JSON.parse(await readFile(
      "evaluation/task06c-r2f/frozen-evidence-hashes.json",
      "utf8",
    )) as { records: Array<{ path: string; sha256: string }> };
    expect(manifest.records.length).toBeGreaterThan(140);
    for (const record of manifest.records) {
      const hash = createHash("sha256").update(await readFile(record.path)).digest("hex");
      expect(hash, record.path).toBe(record.sha256);
    }
  });
});
