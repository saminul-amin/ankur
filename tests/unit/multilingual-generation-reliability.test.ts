import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { GenerateContentResponse, GoogleGenAI } from "@google/genai";

import {
  assembleEvidenceFirstAssessment,
  createEvidenceFirstAssessmentPlan,
  PROMPT_SALVAGE_VERSION,
  salvageQuestionPrompt,
} from "../../src/application/services/evidence-first-assessment-builder.js";
import { createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import type { ModelArtifactMetadata } from "../../src/domain/ai/model-artifact.js";
import { validateLanguageQuality } from "../../src/domain/assessments/evidence-first-validation.js";
import {
  extractStructuredJsonCandidate,
  GoogleGenAiAdapter,
} from "../../src/infrastructure/gemma/google-genai-adapter.js";
import {
  preparationMapProviderJsonSchema,
  preparationMapProviderSchema,
  preparationMapProviderTransportSchema,
} from "../../src/shared/schemas/learning-content-schemas.js";
import {
  collapseRepeatedSegments,
  REPETITION_COLLAPSE_VERSION,
} from "../../src/shared/text/collapse-repetition.js";
import { pageTranscriptionProviderJsonSchema, pageTranscriptionProviderSchema } from "../../src/shared/schemas/transcription-schemas.js";

const metadata: ModelArtifactMetadata = {
  provider: "gemini_api",
  modelId: "gemma-4-26b-a4b-it",
  task: "assessment_generation",
  promptVersion: "assessment-deterministic-construction.v10",
  schemaVersion: "activity-set.v2",
  thinkingLevel: "minimal",
  requestId: "multilingual-reliability",
  createdAt: "2026-08-19T00:00:00.000Z",
  latencyMs: 0,
  repaired: false,
};

function fixture() {
  const source = createSampleSource();
  const map = createSamplePreparationMap(source);
  return {
    source,
    map,
    plan: createEvidenceFirstAssessmentPlan({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
    }),
  };
}

describe("deterministic question-prompt salvage", () => {
  it("is versioned so evaluation evidence can reference the exact behaviour", () => {
    expect(PROMPT_SALVAGE_VERSION).toBe("deterministic-question-prompt-salvage.v1");
  });

  it("completes a Bengali question that the provider left without terminal punctuation", () => {
    const provider = "সালোকসংশ্লেষণ প্রক্রিয়ায় উদ্ভিদ কী ব্যবহার করে";
    expect(validateLanguageQuality(provider, { kind: "question", sourceLanguage: "bn" })
      .some((failure) => failure.code === "LANG_TRUNCATED_SENTENCE")).toBe(true);
    const salvaged = salvageQuestionPrompt(provider);
    expect(salvaged).toBe("সালোকসংশ্লেষণ প্রক্রিয়ায় উদ্ভিদ কী ব্যবহার করে?");
    expect(validateLanguageQuality(salvaged, { kind: "question", sourceLanguage: "bn" })).toEqual([]);
  });

  it("collapses an adjacent duplicated token without rewriting meaning", () => {
    const provider = "Which process process converts light energy into chemical energy?";
    expect(validateLanguageQuality(provider, { kind: "question", sourceLanguage: "en" })
      .some((failure) => failure.code === "LANG_REPEATED_TOKEN")).toBe(true);
    const salvaged = salvageQuestionPrompt(provider);
    expect(salvaged).toBe("Which process converts light energy into chemical energy?");
    expect(validateLanguageQuality(salvaged, { kind: "question", sourceLanguage: "en" })).toEqual([]);
  });

  it("drops a literally repeated clause and doubled punctuation", () => {
    const salvaged = salvageQuestionPrompt(
      "What does the source describe, what does the source describe??",
    );
    expect(salvaged).toBe("What does the source describe?");
    expect(validateLanguageQuality(salvaged, { kind: "question", sourceLanguage: "en" })).toEqual([]);
  });

  it("removes a dangling connector left at the end of a mixed-language prompt", () => {
    const salvaged = salvageQuestionPrompt("Water cycle বা পানিচক্র বলতে কী বোঝায়,");
    expect(salvaged).toBe("Water cycle বা পানিচক্র বলতে কী বোঝায়?");
    expect(validateLanguageQuality(salvaged, { kind: "question", sourceLanguage: "mixed" })).toEqual([]);
  });

  it("leaves an already valid prompt byte-identical and is idempotent", () => {
    const valid = "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে?";
    expect(salvageQuestionPrompt(valid)).toBe(valid);
    expect(salvageQuestionPrompt(salvageQuestionPrompt(valid))).toBe(valid);
  });

  it("assembles a valid assessment from mechanically defective provider wording", () => {
    const { source, plan } = fixture();
    const artifacts = assembleEvidenceFirstAssessment({
      source,
      plan,
      mcqProvider: {
        prompt: "উদ্ভিদ কী কী ব্যবহার করে খাদ্য তৈরি করে",
        misconception1: "নাইট্রোজেন দিয়ে খাদ্য তৈরি হয়।",
        misconception2: "মিথেন দিয়ে খাদ্য তৈরি হয়।",
        misconception3: "শিকড় সূর্যালোক তৈরি করে।",
      },
      writtenQuestionProvider: {
        prompt: "উদ্ভিদ কী ব্যবহার করে খাদ্য তৈরি করে এবং সূর্যালোকের শক্তি কীভাবে গ্রহণ করে,",
        expectedLength: "short_paragraph",
      },
      title: "Salvage",
      difficulty: "medium",
      metadata,
    });
    expect(artifacts.failures).toEqual([]);
    expect(artifacts.mcq.prompt.endsWith("?")).toBe(true);
    expect(artifacts.writtenQuestion.prompt.endsWith("?")).toBe(true);
    expect(artifacts.mcq.prompt).not.toContain("কী কী");
  });
});

describe("provider JSON-schema length contract", () => {
  it("gives the analysis transport the same bounds its Zod contract enforces", () => {
    const properties = preparationMapProviderJsonSchema.properties;
    expect(properties.title).toMatchObject({ maxLength: 160 });
    expect(properties.domain).toMatchObject({ maxLength: 120 });
    expect(properties.conceptDescription).toMatchObject({ maxLength: 500 });
    expect(properties.objectiveDescription).toMatchObject({ maxLength: 300 });
    expect(properties.warnings.items).toMatchObject({ maxLength: 240 });
    expect(preparationMapProviderSchema.safeParse({
      title: "x".repeat(161),
      language: "bn",
      domain: "civics",
      topicName: "topic",
      topicPriority: "high",
      conceptName: "concept",
      conceptDescription: "description",
      conceptPriority: "high",
      objectiveDescription: "objective",
      evidenceIndex: 1,
      warnings: [],
    }).success).toBe(false);
  });

  it("gives the transcription transport the same bounds its Zod contract enforces", () => {
    const properties = pageTranscriptionProviderJsonSchema.properties;
    expect(properties.text).toMatchObject({ maxLength: 25_000 });
    expect(properties.uncertainSegments.items.properties.text).toMatchObject({ maxLength: 500 });
    expect(properties.warnings.items).toMatchObject({ maxLength: 240 });
    expect(pageTranscriptionProviderSchema.safeParse({
      pageNumber: 1,
      detectedLanguage: "bn",
      text: "",
      uncertainSegments: [],
      warnings: [],
    }).success).toBe(false);
  });
});

describe("structured JSON recovery and truncation retry", () => {
  it("recovers a fenced object without accepting truncated output", () => {
    expect(extractStructuredJsonCandidate("```json\n{\"prompt\":\"ok\"}\n```")).toBe("{\"prompt\":\"ok\"}");
    expect(extractStructuredJsonCandidate("Here is the object: {\"prompt\":\"ok\"} Thanks.")).toBe("{\"prompt\":\"ok\"}");
    expect(extractStructuredJsonCandidate("{\"prompt\":\"a } b\"}x")).toBe("{\"prompt\":\"a } b\"}");
    expect(extractStructuredJsonCandidate("{\"prompt\":\"truncated")).toBeUndefined();
    expect(extractStructuredJsonCandidate("{\"prompt\":\"ok\"}")).toBeUndefined();
  });

  it("accepts a fenced first-pass response without spending a repair call", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({
        text: "```json\n{\"prompt\":\"grounded\"}\n```",
        candidates: [{ finishReason: "STOP" }],
      } as GenerateContentResponse);
    const adapter = new GoogleGenAiAdapter("unit-test-key", "gemma-4-26b-a4b-it", { generateContent });
    const result = await adapter.generateStructured({
      task: "structured_generation", modelId: "gemma-4-26b-a4b-it", promptVersion: "fence.v1",
      schemaVersion: "fence.v1", thinkingLevel: "minimal", temperature: 0.1, maxOutputTokens: 800,
      timeoutMs: 10_000, contents: [{ kind: "text", text: "task" }], outputMode: "native",
      jsonSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
      schema: z.object({ prompt: z.string().min(1) }).strict(), maxSchemaRepairs: 1,
    });
    expect(result).toMatchObject({ value: { prompt: "grounded" }, repaired: false });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("retries the original task instead of echoing a cut-off repetition loop", async () => {
    const generateContent = vi.fn<GoogleGenAI["models"]["generateContent"]>()
      .mockResolvedValueOnce({
        text: "{\"prompt\":\"loop-loop-loop-loop-loop",
        candidates: [{ finishReason: "MAX_TOKENS" }],
      } as GenerateContentResponse)
      .mockResolvedValueOnce({ text: JSON.stringify({ prompt: "concise" }) } as GenerateContentResponse);
    const adapter = new GoogleGenAiAdapter("unit-test-key", "gemma-4-26b-a4b-it", { generateContent });
    const result = await adapter.generateStructured({
      task: "structured_generation", modelId: "gemma-4-26b-a4b-it", promptVersion: "loop.v1",
      schemaVersion: "loop.v1", thinkingLevel: "high", temperature: 0.1, maxOutputTokens: 1_800,
      timeoutMs: 10_000, contents: [{ kind: "text", text: "ORIGINAL ANALYSIS TASK" }], outputMode: "native",
      jsonSchema: { type: "object", properties: { prompt: { type: "string" } }, required: ["prompt"] },
      schema: z.object({ prompt: z.string().min(1) }).strict(), maxSchemaRepairs: 1,
    });
    expect(result).toMatchObject({ value: { prompt: "concise" }, repaired: true });
    const retry = generateContent.mock.calls[1]?.[0];
    expect(JSON.stringify(retry)).toContain("ORIGINAL ANALYSIS TASK");
    expect(JSON.stringify(retry)).not.toContain("loop-loop-loop");
    expect(retry?.config).toMatchObject({ temperature: 0.35, maxOutputTokens: 2_700 });
  });
});

describe("deterministic repetition collapse", () => {
  it("is versioned so evaluation evidence can reference the exact behaviour", () => {
    expect(REPETITION_COLLAPSE_VERSION).toBe("deterministic-repetition-collapse.v1");
  });

  it("collapses hyphen-joined and space-joined degenerate loops", () => {
    expect(collapseRepeatedSegments("Earthquake-related safety-related safety-related safety-related notes"))
      .toBe("Earthquake-related safety-related notes");
    expect(collapseRepeatedSegments("প্রক্রিয়া-প্রক্রিয়া-প্রক্রিয়া-প্রয়োগ")).toBe("প্রক্রিয়া-প্রয়োগ");
    expect(collapseRepeatedSegments("সমুদ্রের সমুদ্রের পানি")).toBe("সমুদ্রের পানি");
  });

  it("leaves legitimate text unchanged and is idempotent", () => {
    const text = "Water cycle বা পানিচক্র হলো পৃথিবীতে পানির continuous movement।";
    expect(collapseRepeatedSegments(text)).toBe(text);
    expect(collapseRepeatedSegments(collapseRepeatedSegments(text))).toBe(text);
    expect(collapseRepeatedSegments("had had a a plan")).toBe("had a a plan");
  });

  it("recovers an analysis object whose only defect is a bounded repetition loop", () => {
    const looping = {
      title: `Earthquake ${"safety-related ".repeat(30)}guide`,
      language: "bn",
      domain: "Disaster Management",
      topicName: "ভূমিকম্প",
      topicPriority: "high",
      conceptName: "প্রস্তুতি",
      conceptDescription: "শ্রেণিকক্ষে নিরাপদ আশ্রয় নেওয়ার ধাপ।",
      conceptPriority: "high",
      objectiveDescription: "ভূমিকম্পের সময় করণীয় ব্যাখ্যা করা।",
      evidenceIndex: 1,
      warnings: [],
    };
    expect(preparationMapProviderSchema.safeParse(looping).success).toBe(false);
    const recovered = preparationMapProviderTransportSchema.safeParse(looping);
    expect(recovered.success).toBe(true);
    expect(recovered.success && recovered.data.title).toBe("Earthquake safety-related guide");
  });
});
