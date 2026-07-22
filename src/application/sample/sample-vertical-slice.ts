import type { ActivitySet } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import { createConfirmedSource, type ConfirmedSource } from "../../domain/source/confirmed-source";

export const SAMPLE_PAGES = [
  { pageNumber: 1, text: "সবুজ উদ্ভিদ নিজের খাদ্য তৈরির জন্য সূর্যালোকের শক্তি গ্রহণ করে। পাতার ক্লোরোফিল এই আলো শোষণ করে এবং প্রক্রিয়াটি শুরু করতে সাহায্য করে।" },
  { pageNumber: 2, text: "উদ্ভিদ পানি ও কার্বন ডাই-অক্সাইড ব্যবহার করে খাদ্য তৈরি করে। এই প্রক্রিয়াকে সালোকসংশ্লেষণ বলা হয় এবং এতে অক্সিজেন নির্গত হয়।" },
  { pageNumber: 3, text: "সালোকসংশ্লেষণ উদ্ভিদের বৃদ্ধি ও জীবজগতের অক্সিজেন সরবরাহে গুরুত্বপূর্ণ ভূমিকা রাখে।" },
] as const;

export const SAMPLE_TEXT = SAMPLE_PAGES.map((page) => page.text).join("\n\n");

export function createSampleSource(): ConfirmedSource {
  return createConfirmedSource({
    pages: SAMPLE_PAGES,
    language: "bn",
    method: "pasted_text",
    priorityInstruction: "সালোকসংশ্লেষণের উপকরণ ও ফলাফলে গুরুত্ব দিন।",
    confirmedAt: "2026-07-22T00:00:00.000Z",
  });
}

function sampleArtifact(task: "material_analysis" | "assessment_generation", schemaVersion: string) {
  return {
    provider: "gemini_api" as const,
    modelId: "gemma-4-26b-a4b-it" as const,
    task,
    promptVersion: "sample-fixture.v1",
    schemaVersion,
    thinkingLevel: "high" as const,
    requestId: "offline-sample-fixture",
    createdAt: "2026-07-22T00:00:00.000Z",
    latencyMs: 0,
    repaired: false,
  };
}

export function createSamplePreparationMap(source: ConfirmedSource): PreparationMap {
  const evidenceSegment = source.segments.find((segment) => segment.pageNumber === 2) ?? source.segments[0];
  const evidence = [{ segmentId: evidenceSegment?.id ?? "", quote: "সালোকসংশ্লেষণ" }];
  return {
    schemaVersion: "preparation-map.v1",
    id: `preparation-${source.sourceVersionId}`,
    sourceVersionId: source.sourceVersionId,
    title: "সালোকসংশ্লেষণের পরিচয়",
    language: "bn",
    domain: "জীববিজ্ঞান",
    topics: [{ id: "topic-photosynthesis", name: "সালোকসংশ্লেষণ", priority: "high", evidence }],
    concepts: [
      {
        id: "concept-photosynthesis-result",
        topicId: "topic-photosynthesis",
        name: "সালোকসংশ্লেষণের ফলাফল",
        description: "প্রক্রিয়াটিতে খাদ্য তৈরি হয় এবং অক্সিজেন নির্গত হয়।",
        priority: "high",
        evidence,
      },
    ],
    objectives: [
      {
        id: "objective-identify-output",
        description: "সালোকসংশ্লেষণে নির্গত পদার্থ শনাক্ত করা।",
        conceptIds: ["concept-photosynthesis-result"],
        evidence,
      },
    ],
    warnings: [],
    artifact: sampleArtifact("material_analysis", "preparation-map.v1"),
  };
}

export function createSampleActivitySet(
  source: ConfirmedSource,
  preparationMap: PreparationMap,
): ActivitySet {
  const evidenceSegment = source.segments.find((segment) => segment.pageNumber === 2) ?? source.segments[0];
  return {
    schemaVersion: "activity-set.v1",
    id: `activity-${source.sourceVersionId}`,
    sourceVersionId: source.sourceVersionId,
    title: "এক প্রশ্নের দ্রুত অনুশীলন",
    questions: [
      {
        id: "question-001",
        type: "single_mcq",
        prompt: "সালোকসংশ্লেষণের সময় কোন পদার্থটি নির্গত হয়?",
        conceptIds: [preparationMap.concepts[0]?.id ?? "concept-photosynthesis-result"],
        difficulty: "easy",
        marks: 1,
        explanation: "নিশ্চিত উৎসে বলা হয়েছে যে সালোকসংশ্লেষণের সময় অক্সিজেন নির্গত হয়।",
        options: [
          { id: "A", text: "নাইট্রোজেন" },
          { id: "B", text: "অক্সিজেন" },
          { id: "C", text: "হাইড্রোজেন" },
          { id: "D", text: "মিথেন" },
        ],
        correctOptionId: "B",
        evidence: [{ segmentId: evidenceSegment?.id ?? "", quote: "অক্সিজেন নির্গত হয়" }],
      },
    ],
    warnings: [],
    artifact: sampleArtifact("assessment_generation", "activity-set.v1"),
  };
}
