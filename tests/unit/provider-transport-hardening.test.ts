import { describe, expect, it } from "vitest";

import type {
  GenerativeModelPort,
  StructuredGenerationRequest,
  StructuredGenerationResult,
  TextGenerationResult,
} from "../../src/application/ports/generative-model-port.js";
import { createSampleActivitySet, createSamplePreparationMap, createSampleSource } from "../../src/application/sample/sample-vertical-slice.js";
import { validateActivitySet } from "../../src/domain/assessments/mcq.js";
import { validateWrittenEvaluation } from "../../src/domain/assessments/written-evaluation.js";
import { rehydrateEvidenceWindow } from "../../src/domain/source/confirmed-source.js";
import { GemmaLearningContentAdapter } from "../../src/infrastructure/gemma/gemma-learning-content-adapter.js";
import { GemmaWrittenEvaluationAdapter } from "../../src/infrastructure/gemma/gemma-written-evaluation-adapter.js";
import { createWrittenEvaluationProviderContract } from "../../src/shared/schemas/written-evaluation-schemas.js";

class QueueProvider implements GenerativeModelPort {
  readonly requests: StructuredGenerationRequest<unknown>[] = [];

  constructor(private readonly values: unknown[]) {}

  generateText(): Promise<TextGenerationResult> {
    throw new Error("Unexpected text request.");
  }

  healthCheck() {
    return Promise.resolve({ configured: true as const, provider: "gemini_api" as const, modelId: "gemma-4-26b-a4b-it" as const });
  }

  generateStructured<T>(request: StructuredGenerationRequest<T>): Promise<StructuredGenerationResult<T>> {
    this.requests.push(request);
    const value = this.values.shift();
    if (value === undefined) throw new Error("Missing queued provider result.");
    const parsed = request.schema.parse(value);
    return Promise.resolve({
      value: parsed,
      metadata: { provider: "gemini_api", modelId: request.modelId, thinkingLevel: request.thinkingLevel, latencyMs: 10 },
      structuredOutputMode: "native",
      repaired: false,
    });
  }
}

describe("provider transport hardening", () => {
  it("keeps grounding IDs out of provider output and deterministically assembles the five-mark rubric", async () => {
    const source = createSampleSource();
    const map = createSamplePreparationMap(source);
    const provider = new QueueProvider([
      {
        prompt: "সালোকসংশ্লেষণে কোন পদার্থ নির্গত হয়?",
        explanation: "উৎসে অক্সিজেন নির্গমনের কথা বলা হয়েছে।",
        optionA: "পানি",
        optionB: "কার্বন ডাই-অক্সাইড",
        optionC: "ক্লোরোফিল",
        optionD: "অক্সিজেন",
        correctOptionId: "D",
      },
      {
        prompt: "সালোকসংশ্লেষণের উপকরণ, আলোর ভূমিকা এবং ফলাফল ব্যাখ্যা কর।",
        explanation: "উত্তরে প্রক্রিয়াটির তিনটি দিক যুক্ত করতে হবে।",
        expectedLength: "short_paragraph",
      },
      {
        criterion1Description: "উপকরণ উল্লেখ করে।",
        criterion2Description: "আলো ও ক্লোরোফিলের ভূমিকা ব্যাখ্যা করে।",
        criterion3Description: "ফলাফল উল্লেখ করে।",
      },
    ]);
    const activity = await new GemmaLearningContentAdapter(provider).generateMixedAssessment({
      source,
      preparationMap: map,
      selectedConceptIds: map.concepts.map((concept) => concept.id),
      title: "সালোকসংশ্লেষণ · ফোকাস মূল্যায়ন",
      difficulty: "medium",
      requestId: "transport-assessment",
    });

    expect(activity.questions[1].rubric.map((criterion) => criterion.maximumMarks)).toEqual([2, 2, 1]);
    for (const [index, concept] of map.concepts.entries()) {
      expect(activity.questions[1].rubric[index]?.description).toContain(concept.description);
    }
    expect(activity.questions[1].requiredConceptIds).toEqual(map.concepts.map((concept) => concept.id));
    expect(activity.questions[1].referenceAnswer).toBe(map.concepts.map((concept) => concept.description).join(" "));
    expect(validateActivitySet(source, map, activity)).toEqual([]);
    expect(provider.requests.map((request) => request.schemaVersion)).toEqual([
      "assessment-mcq.v5",
      "assessment-written-question.v5",
      "assessment-written-rubric.v5",
    ]);
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain("conceptId");
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain("evidenceSegmentId");
    expect(JSON.stringify(provider.requests[1]?.jsonSchema)).not.toContain("RequiredConceptId");
    expect(JSON.stringify(provider.requests[1]?.jsonSchema)).not.toContain("EvidenceSegmentId");
    expect(JSON.stringify(provider.requests[1]?.jsonSchema)).not.toContain("criterion1MaximumMarks");
    expect(JSON.stringify(provider.requests[2]?.jsonSchema)).not.toContain("criterion1MaximumMarks");
    expect(JSON.stringify(provider.requests[0]?.contents[0])).toContain("concept-photosynthesis-inputs");
    expect(provider.requests[1]?.contents[0]).toMatchObject({ kind: "text" });
    expect(JSON.stringify(provider.requests[1]?.contents[0])).toContain("সালোকসংশ্লেষণে কোন পদার্থ নির্গত হয়");
  });

  it("derives totals, states, status, and concept partitions from criterion awards", async () => {
    const fullSource = createSampleSource();
    const activity = createSampleActivitySet(fullSource, createSamplePreparationMap(fullSource));
    const question = activity.questions[1];
    const allowed = new Set([...question.evidence, ...question.rubric.flatMap((criterion) => criterion.evidence)].map((reference) => reference.segmentId));
    const source = rehydrateEvidenceWindow({
      sourceVersionId: fullSource.sourceVersionId,
      language: fullSource.language,
      segments: fullSource.segments.filter((segment) => allowed.has(segment.id)),
    });
    const provider = new QueueProvider([{
      criterion1Judgment: "met",
      criterion1Reason: "The first criterion is fully supported.",
      criterion2Judgment: "partial",
      criterion2Reason: "The second criterion is only partly explained.",
      criterion3Judgment: "not_met",
      criterion3Reason: "The final required outcome is missing.",
    }]);
    const result = await new GemmaWrittenEvaluationAdapter(provider).evaluateWrittenAnswer({
      source,
      question,
      studentAnswer: "A partial but non-empty answer.",
      requestId: "transport-written",
    });

    expect(result.awardedMarks).toBe(3);
    expect(result.status).toBe("partially_correct");
    expect(result.criterionResults.map((criterion) => criterion.state)).toEqual(["met", "partial", "not_met"]);
    expect(new Set([...result.coveredConceptIds, ...result.missingConceptIds])).toEqual(new Set(question.requiredConceptIds));
    expect(result.recommendedRevisionConceptIds).toEqual(result.missingConceptIds);
    expect(validateWrittenEvaluation(source, question, result)).toEqual([]);
    expect(provider.requests[0]?.schemaVersion).toBe("written-evaluation-transport.v5");
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain('"status"');
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain("AwardedMarks");
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain("feedback");
    expect(JSON.stringify(provider.requests[0]?.jsonSchema)).not.toContain("Claim");
    expect(provider.requests[0]?.jsonSchema).toMatchObject({
      properties: {
        criterion1Reason: { minLength: 1, maxLength: 400 },
      },
    });
  });

  it("deterministically reconciles an exact reference answer to full marks", async () => {
    const fullSource = createSampleSource();
    const activity = createSampleActivitySet(fullSource, createSamplePreparationMap(fullSource));
    const question = activity.questions[1];
    const allowed = new Set([...question.evidence, ...question.rubric.flatMap((criterion) => criterion.evidence)].map((reference) => reference.segmentId));
    const source = rehydrateEvidenceWindow({
      sourceVersionId: fullSource.sourceVersionId,
      language: fullSource.language,
      segments: fullSource.segments.filter((segment) => allowed.has(segment.id)),
    });
    const provider = new QueueProvider([{
      criterion1Judgment: "not_met",
      criterion1Reason: "Provider under-awarded criterion one.",
      criterion2Judgment: "not_met",
      criterion2Reason: "Provider under-awarded criterion two.",
      criterion3Judgment: "not_met",
      criterion3Reason: "Provider under-awarded criterion three.",
    }]);

    const result = await new GemmaWrittenEvaluationAdapter(provider).evaluateWrittenAnswer({
      source,
      question,
      studentAnswer: `  ${question.referenceAnswer}  `,
      requestId: "transport-written-exact-reference",
    });

    expect(result.awardedMarks).toBe(5);
    expect(result.status).toBe("correct");
    expect(result.criterionResults.map((criterion) => criterion.state)).toEqual(["met", "met", "met"]);
    expect(result.incorrectClaims).toEqual([]);
    expect(result.unsupportedClaims).toEqual([]);
    expect(validateWrittenEvaluation(source, question, result)).toEqual([]);
  });

  it("rejects numeric marks because only semantic judgments cross the transport", () => {
    const contract = createWrittenEvaluationProviderContract({
      criterionMaximumMarks: [2, 2, 1],
    });
    const candidate = {
      criterion1AwardedMarks: 2,
      criterion1Reason: "Reason",
      criterion2Judgment: "met",
      criterion2Reason: "Reason",
      criterion3Judgment: "met",
      criterion3Reason: "Reason",
      incorrectClaim: "",
      unsupportedClaim: "",
      feedback: "Feedback",
    };
    expect(contract.schema.safeParse(candidate).success).toBe(false);
  });
});
