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
  deterministicRubricMarks,
  selectDeterministicDistractors,
} from "../../src/application/services/evidence-first-assessment-builder.js";
import { createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import type { ModelArtifactMetadata } from "../../src/domain/ai/model-artifact.js";
import type { PreparationMap } from "../../src/domain/preparation/preparation-map.js";
import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { evidenceFirstMcqProviderSchema } from "../../src/shared/schemas/evidence-first-question-schemas.js";

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
    const value = this.values.shift();
    return Promise.resolve({
      value: request.schema.parse(value),
      metadata: {
        provider: "gemini_api",
        modelId: request.modelId,
        thinkingLevel: request.thinkingLevel,
        latencyMs: 1,
        providerAttemptCount: 1,
      },
      structuredOutputMode: "native",
      repaired: false,
    });
  }
}

const metadata = (requestId: string): ModelArtifactMetadata => ({
  provider: "gemini_api",
  modelId: "gemma-4-26b-a4b-it",
  task: "assessment_generation",
  promptVersion: "assessment-deterministic-construction.v10",
  schemaVersion: "activity-set.v2",
  thinkingLevel: "minimal",
  requestId,
  createdAt: "2026-07-27T00:00:00.000Z",
  latencyMs: 0,
  repaired: false,
});

function assembled(requestId: string) {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  const plan = createEvidenceFirstAssessmentPlan({
    source,
    preparationMap: map,
    selectedConceptIds: map.concepts.map((concept) => concept.id),
  });
  return assembleEvidenceFirstAssessment({
    source,
    plan,
    mcqProvider: {
      prompt: "Which source-described inputs support the photosynthesis process?",
      misconception1: "The cause and effect are reversed.",
      misconception2: "The essential condition is absent.",
      misconception3: "The final stage occurs first.",
    },
    writtenQuestionProvider: {
      prompt: "How are sunlight, chlorophyll, water, and carbon dioxide connected in the source?",
      expectedLength: "short_paragraph",
    },
    title: "Deterministic construction",
    difficulty: "medium",
    metadata: metadata(requestId),
  });
}

describe("Task 06C-R2 deterministic assessment construction", () => {
  it("filters duplicate and punctuation-equivalent distractor candidates", () => {
    const artifact = assembled("distractor-filter");
    const selected = selectDeterministicDistractors({
      canonicalAnswer: artifact.plan.mcqCanonicalAnswer,
      candidates: ["Wrong relation.", " Wrong relation!!! ", "Wrong relation."],
    });
    expect(new Set(selected.map((value) => value.toLocaleLowerCase().replace(/\p{P}/gu, "").trim())).size).toBe(3);
  });

  it("rejects canonical-equivalent and evidence-supported candidates", () => {
    const artifact = assembled("canonical-filter");
    const selected = selectDeterministicDistractors({
      canonicalAnswer: artifact.plan.mcqCanonicalAnswer,
      candidates: [
        artifact.plan.mcqCanonicalAnswer.canonicalAnswer,
        artifact.plan.mcqCanonicalAnswer.requiredClaims[0]?.text ?? "",
        "A separate misconception.",
      ],
    });
    expect(selected).not.toContain(artifact.plan.mcqCanonicalAnswer.canonicalAnswer);
  });

  it("fails when no candidate or deterministic misconception remains valid", () => {
    const artifact = assembled("no-distractors");
    const fallbacks = [
      "The source-described cause and effect are reversed.",
      "The process occurs without its essential condition.",
      "The final stage occurs before the first stage.",
    ];
    const claimTemplate = artifact.plan.mcqCanonicalAnswer.requiredClaims[0];
    if (claimTemplate === undefined) throw new Error("The test requires a canonical claim.");
    const canonical = {
      ...artifact.plan.mcqCanonicalAnswer,
      language: "en" as const,
      canonicalAnswer: fallbacks.join(" "),
      requiredClaims: fallbacks.map((text, index) => ({
        ...claimTemplate,
        id: `claim-block-${String(index + 1)}`,
        text,
      })),
    };
    expect(() => selectDeterministicDistractors({
      canonicalAnswer: canonical,
      candidates: fallbacks,
    })).toThrow("No valid deterministic distractor set remained.");
  });

  it("orders options deterministically and assigns the correct identity in application code", () => {
    const first = assembled("stable-seed");
    const second = assembled("stable-seed");
    const other = assembled("different-seed");
    expect(second.mcq.options).toEqual(first.mcq.options);
    expect(second.mcq.correctOptionId).toBe(first.mcq.correctOptionId);
    expect(first.mcq.options.find((option) => option.id === first.mcq.correctOptionId)?.role).toBe("correct");
    expect(other.mcq.options.map((option) => option.text)).not.toEqual(first.mcq.options.map((option) => option.text));
  });

  it("allocates exactly five integer marks across two to five claims", () => {
    for (const count of [2, 3, 4, 5]) {
      const marks = deterministicRubricMarks(count);
      expect(marks).toHaveLength(count);
      expect(marks.reduce((sum, mark) => sum + mark, 0)).toBe(5);
      expect(marks.every(Number.isInteger)).toBe(true);
    }
  });

  it("constructs a valid written evidence window when indexed analysis returns one concept", () => {
    const source = createConfirmedSource({
      pages: [
        { pageNumber: 1, text: "Photosynthesis uses sunlight, water, and carbon dioxide to make glucose." },
        { pageNumber: 2, text: "Chlorophyll absorbs light energy, and oxygen is released." },
      ],
      language: "en",
      method: "pasted_text",
      priorityInstruction: "",
      confirmedAt: "2026-07-29T00:00:00.000Z",
    });
    const first = source.segments[0];
    if (first === undefined) throw new Error("The release regression requires source evidence.");
    const evidence = [{ segmentId: first.id }];
    const map: PreparationMap = {
      schemaVersion: "preparation-map.v1",
      id: `preparation-${source.sourceVersionId}`,
      sourceVersionId: source.sourceVersionId,
      title: "Photosynthesis",
      language: "en",
      domain: "Science",
      topics: [{
        id: "topic-primary",
        name: "Photosynthesis",
        priority: "high",
        evidence,
      }],
      concepts: [{
        id: "concept-primary",
        topicId: "topic-primary",
        name: "Photosynthesis",
        description: "Plants use light energy to produce food.",
        priority: "high",
        evidence,
      }],
      objectives: [{
        id: "objective-primary",
        description: "Explain photosynthesis.",
        conceptIds: ["concept-primary"],
        evidence,
      }],
      warnings: [],
      artifact: {
        ...metadata("single-concept-analysis"),
        task: "material_analysis",
        schemaVersion: "preparation-map.v1",
      },
    };
    const plan = createEvidenceFirstAssessmentPlan({
      source,
      preparationMap: map,
      selectedConceptIds: ["concept-primary"],
    });
    expect(plan.writtenCanonicalAnswer.requiredClaims).toHaveLength(2);
    expect(plan.writtenCanonicalAnswer.evidenceReferences.map((reference) => reference.segmentId))
      .toEqual(source.segments.map((segment) => segment.id));
    expect(deterministicRubricMarks(plan.writtenCanonicalAnswer.requiredClaims.length))
      .toEqual([3, 2]);
  });

  it("rejects model attempts to emit application-owned internal IDs", () => {
    expect(evidenceFirstMcqProviderSchema.safeParse({
      prompt: "Which relationship is described?",
      misconception1: "First misconception.",
      misconception2: "Second misconception.",
      misconception3: "Third misconception.",
      questionId: "invented-question",
      segmentId: "M01-P001-S999",
      correctOptionId: "A",
    }).success).toBe(false);
  });

  it("regenerates one complete small semantic artifact and reruns validation", async () => {
    const source = createSampleSource();
    const map = createSamplePreparationMap(source);
    const validPrompt = "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে?";
    const validWrittenPrompt =
      "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে এবং সূর্যালোকের শক্তি কীভাবে গ্রহণ করে?";
    const misconceptions = {
      misconception1: "নাইট্রোজেন দিয়ে খাদ্য তৈরি হয়।",
      misconception2: "মিথেন দিয়ে খাদ্য তৈরি হয়।",
      misconception3: "শিকড় সূর্যালোক তৈরি করে।",
    };
    const provider = new QueueProvider([
      { prompt: "Which unrelated answer is correct?", ...misconceptions },
      {
        prompt: validWrittenPrompt,
        expectedLength: "short_paragraph",
      },
      { prompt: validPrompt, ...misconceptions },
    ]);
    const result = await new GemmaLearningContentAdapter(provider).generateMixedAssessment({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      title: "Regeneration",
      difficulty: "medium",
      requestId: "small-regeneration",
    });
    expect(result.questions[0].prompt).toBe(validPrompt);
    expect(provider.requests.map((request) => request.maxSchemaRepairs)).toEqual([1, 1, 0]);
    expect(provider.requests[2]?.promptVersion).toBe("assessment-deterministic-construction.v10");
  });

  it("returns a controlled provider failure after one invalid small-artifact regeneration", async () => {
    const source = createSampleSource();
    const map = createSamplePreparationMap(source);
    const misconceptions = {
      misconception1: "The source-described relationship is reversed.",
      misconception2: "The process has no essential condition.",
      misconception3: "The final stage occurs first.",
    };
    const provider = new QueueProvider([
      { prompt: "Unrelated first prompt?", ...misconceptions },
      { prompt: "Unrelated written prompt?", expectedLength: "short_paragraph" },
      { prompt: "Still unrelated?", ...misconceptions },
      { prompt: "Still unrelated written?", expectedLength: "short_paragraph" },
    ]);
    await expect(new GemmaLearningContentAdapter(provider).generateMixedAssessment({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      title: "Controlled failure",
      difficulty: "medium",
      requestId: "failed-small-regeneration",
    })).rejects.toMatchObject({ code: "INVALID_OUTPUT" });
    expect(provider.requests).toHaveLength(4);
    expect(provider.requests.slice(2).every((request) => request.maxSchemaRepairs === 0)).toBe(true);
  });

  it("keeps every frozen public historical artifact byte-identical", async () => {
    const manifest = JSON.parse(await readFile(
      "evaluation/task06c-r2/frozen-evidence-hashes.json",
      "utf8",
    )) as { records: Array<{ path: string; sha256: string }> };
    expect(manifest.records.length).toBeGreaterThan(70);
    for (const record of manifest.records) {
      const actual = createHash("sha256").update(await readFile(record.path)).digest("hex");
      expect(actual, record.path).toBe(record.sha256);
    }
  });
});
