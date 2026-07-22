import type { ActivitySet } from "../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import { createConfirmedSource, type ConfirmedSource } from "../../domain/source/confirmed-source";

export const SAMPLE_PAGES = [
  { pageNumber: 1, text: "সবুজ উদ্ভিদ নিজের খাদ্য তৈরির জন্য সূর্যালোকের শক্তি গ্রহণ করে। পাতার ক্লোরোফিল এই আলো শোষণ করে এবং প্রক্রিয়াটি শুরু করতে সাহায্য করে।" },
  { pageNumber: 2, text: "উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলা হয় এবং এতে অক্সিজেন নির্গত হয়।" },
  { pageNumber: 3, text: "সালোকসংশ্লেষণ উদ্ভিদের বৃদ্ধি ও জীবজগতের অক্সিজেন সরবরাহে গুরুত্বপূর্ণ ভূমিকা রাখে।" },
] as const;

export const SAMPLE_TEXT = SAMPLE_PAGES.map((page) => page.text).join("\n\n");
export const SAMPLE_PARTIAL_WRITTEN_ANSWER = "সালোকসংশ্লেষণে উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে।";

export function createSampleSource(): ConfirmedSource {
  return createConfirmedSource({
    pages: SAMPLE_PAGES, language: "bn", method: "pasted_text",
    priorityInstruction: "সালোকসংশ্লেষণের উপকরণ ও ফলাফলে গুরুত্ব দিন।",
    confirmedAt: "2026-07-22T00:00:00.000Z",
  });
}

function sampleArtifact(task: ModelArtifactMetadata["task"], schemaVersion: string, thinkingLevel: "minimal" | "high" = "minimal"): ModelArtifactMetadata {
  return {
    provider: "gemini_api", modelId: "gemma-4-26b-a4b-it", task,
    promptVersion: "sample-fixture.v2", schemaVersion, thinkingLevel,
    requestId: "offline-sample-fixture", createdAt: "2026-07-22T00:00:00.000Z", latencyMs: 0, repaired: false,
  };
}

export function createSamplePreparationMap(source: ConfirmedSource): PreparationMap {
  const pageOne = source.segments.find((segment) => segment.pageNumber === 1) ?? source.segments[0];
  const pageTwo = source.segments.find((segment) => segment.pageNumber === 2) ?? source.segments[0];
  const lightEvidence = [{ segmentId: pageOne?.id ?? "", quote: "পাতার ক্লোরোফিল এই আলো শোষণ করে" }];
  const inputEvidence = [{ segmentId: pageTwo?.id ?? "", quote: "পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে" }];
  const outputEvidence = [{ segmentId: pageTwo?.id ?? "", quote: "অক্সিজেন নির্গত হয়" }];
  return {
    schemaVersion: "preparation-map.v1", id: `preparation-${source.sourceVersionId}`, sourceVersionId: source.sourceVersionId,
    title: "সালোকসংশ্লেষণের পরিচয়", language: "bn", domain: "জীববিজ্ঞান",
    topics: [{ id: "topic-photosynthesis", name: "সালোকসংশ্লেষণ", priority: "high", evidence: inputEvidence }],
    concepts: [
      { id: "concept-photosynthesis-inputs", topicId: "topic-photosynthesis", name: "উপকরণ", description: "পানি ও কার্বন ডাই-অক্সাইড খাদ্য তৈরিতে ব্যবহৃত হয়।", priority: "medium", evidence: inputEvidence },
      { id: "concept-photosynthesis-light", topicId: "topic-photosynthesis", name: "আলো ও ক্লোরোফিল", description: "সূর্যালোকের শক্তি ক্লোরোফিল শোষণ করে।", priority: "high", evidence: lightEvidence },
      { id: "concept-photosynthesis-result", topicId: "topic-photosynthesis", name: "ফলাফল", description: "খাদ্য তৈরি হয় এবং অক্সিজেন নির্গত হয়।", priority: "high", evidence: outputEvidence },
    ],
    objectives: [
      { id: "objective-explain-inputs", description: "সালোকসংশ্লেষণের উপকরণ ব্যাখ্যা করা।", conceptIds: ["concept-photosynthesis-inputs"], evidence: inputEvidence },
      { id: "objective-connect-process", description: "আলো, ক্লোরোফিল ও ফলাফলের সংযোগ ব্যাখ্যা করা।", conceptIds: ["concept-photosynthesis-light", "concept-photosynthesis-result"], evidence: [...lightEvidence, ...outputEvidence] },
    ],
    warnings: [], artifact: sampleArtifact("material_analysis", "preparation-map.v1"),
  };
}

export function createSampleActivitySet(source: ConfirmedSource, preparationMap: PreparationMap): ActivitySet {
  const pageOne = source.segments.find((segment) => segment.pageNumber === 1) ?? source.segments[0];
  const pageTwo = source.segments.find((segment) => segment.pageNumber === 2) ?? source.segments[0];
  const artifact = sampleArtifact("assessment_generation", "activity-set.v2");
  return {
    schemaVersion: "activity-set.v2", id: `activity-${source.sourceVersionId}`, sourceVersionId: source.sourceVersionId,
    title: "সালোকসংশ্লেষণ · ফোকাস মূল্যায়ন",
    questions: [
      {
        id: "question-001", type: "single_mcq", sourceVersionId: source.sourceVersionId,
        prompt: "সালোকসংশ্লেষণের সময় কোন পদার্থটি নির্গত হয়?", conceptIds: ["concept-photosynthesis-result"],
        difficulty: "medium", marks: 1, explanation: "নিশ্চিত উৎসে বলা হয়েছে যে সালোকসংশ্লেষণের সময় অক্সিজেন নির্গত হয়।",
        options: [{ id: "A", text: "নাইট্রোজেন" }, { id: "B", text: "অক্সিজেন" }, { id: "C", text: "হাইড্রোজেন" }, { id: "D", text: "মিথেন" }],
        correctOptionId: "B", evidence: [{ segmentId: pageTwo?.id ?? "", quote: "অক্সিজেন নির্গত হয়" }], artifact,
      },
      {
        id: "question-002", type: "short_written", sourceVersionId: source.sourceVersionId,
        prompt: "উৎসের ভিত্তিতে সালোকসংশ্লেষণের উপকরণ, আলো ও ক্লোরোফিলের ভূমিকা, এবং ফলাফল সংক্ষেপে ব্যাখ্যা করো।",
        conceptIds: preparationMap.concepts.map((concept) => concept.id), difficulty: "medium", marks: 5,
        explanation: "পূর্ণ উত্তরে উপকরণ, শক্তি গ্রহণে ক্লোরোফিলের ভূমিকা এবং খাদ্য ও অক্সিজেন—দুই ফলাফল থাকতে হবে।",
        expectedLength: "short_paragraph",
        referenceAnswer: "উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে। পাতার ক্লোরোফিল সূর্যালোক শোষণ করে প্রক্রিয়াটি শুরু করতে সাহায্য করে। এতে খাদ্য তৈরি হয় এবং অক্সিজেন নির্গত হয়।",
        requiredConceptIds: preparationMap.concepts.map((concept) => concept.id),
        evidence: [{ segmentId: pageOne?.id ?? "", quote: "পাতার ক্লোরোফিল এই আলো শোষণ করে" }, { segmentId: pageTwo?.id ?? "", quote: "পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে" }],
        rubric: [
          { id: "criterion-inputs", description: "পানি ও কার্বন ডাই-অক্সাইড—দুই উপকরণ উল্লেখ করে।", maximumMarks: 2, requiredConceptIds: ["concept-photosynthesis-inputs"], evidence: [{ segmentId: pageTwo?.id ?? "", quote: "পানি ও কার্বন ডাই-অক্সাইড" }] },
          { id: "criterion-light", description: "সূর্যালোক গ্রহণে ক্লোরোফিলের ভূমিকা ব্যাখ্যা করে।", maximumMarks: 2, requiredConceptIds: ["concept-photosynthesis-light"], evidence: [{ segmentId: pageOne?.id ?? "", quote: "পাতার ক্লোরোফিল এই আলো শোষণ করে" }] },
          { id: "criterion-result", description: "খাদ্য তৈরি ও অক্সিজেন নির্গমনের ফলাফল উল্লেখ করে।", maximumMarks: 1, requiredConceptIds: ["concept-photosynthesis-result"], evidence: [{ segmentId: pageTwo?.id ?? "", quote: "খাদ্য তৈরি করে" }] },
        ],
        artifact,
      },
    ],
    warnings: [], artifact,
  };
}

export function createSampleWrittenEvaluation(activitySet: ActivitySet): WrittenAnswerEvaluation {
  const question = activitySet.questions[1];
  return {
    schemaVersion: "written-evaluation.v1", questionId: question.id, sourceVersionId: question.sourceVersionId,
    awardedMarks: 2, maximumMarks: 5, status: "partially_correct",
    criterionResults: [
      { criterionId: "criterion-inputs", awardedMarks: 2, maximumMarks: 2, state: "met", reason: "পানি ও কার্বন ডাই-অক্সাইড—দুই উপকরণই সঠিকভাবে উল্লেখ করা হয়েছে।" },
      { criterionId: "criterion-light", awardedMarks: 0, maximumMarks: 2, state: "not_met", reason: "সূর্যালোক ও ক্লোরোফিলের ভূমিকা অনুপস্থিত।" },
      { criterionId: "criterion-result", awardedMarks: 0, maximumMarks: 1, state: "not_met", reason: "অক্সিজেন নির্গমনের ফলাফল উল্লেখ করা হয়নি।" },
    ],
    coveredConceptIds: ["concept-photosynthesis-inputs"],
    missingConceptIds: ["concept-photosynthesis-light", "concept-photosynthesis-result"],
    incorrectClaims: [], unsupportedClaims: [],
    feedback: "উপকরণ সঠিক। এবার ক্লোরোফিল কীভাবে আলো গ্রহণ করে এবং অক্সিজেন নির্গত হয়—এই দুই অংশ যোগ করো।",
    evidence: question.evidence,
    recommendedRevisionConceptIds: ["concept-photosynthesis-light", "concept-photosynthesis-result"],
    artifact: sampleArtifact("written_evaluation", "written-evaluation.v1", "high"),
  };
}
