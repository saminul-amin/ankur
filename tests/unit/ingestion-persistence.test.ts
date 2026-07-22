import { describe, expect, it } from "vitest";

import { createConfirmedSource } from "../../src/domain/source/confirmed-source.js";
import {
  createSampleActivitySet,
  createSamplePreparationMap,
  createSampleRevisionPlan,
  createSampleRetryWrittenEvaluation,
  createSampleSource,
  createSampleWrittenEvaluation,
} from "../../src/application/sample/sample-vertical-slice.js";
import { calculateConceptPerformance } from "../../src/domain/assessments/concept-performance.js";
import { gradeMcq } from "../../src/domain/assessments/mcq.js";
import { compareAssessmentAttempts } from "../../src/domain/revision/improvement-comparison.js";
import type { ReviewPage } from "../../src/domain/source/page-extraction.js";
import {
  parsePersistedIngestionSession,
  migrateTask03Session,
  migrateTask04Session,
  toPersistedIngestionSession,
} from "../../src/presentation/persistence/ingestion-session.js";

const page: ReviewPage = {
  id: "page-002", pageNumber: 2, sourceKind: "pdf", method: "gemma_ocr", text: "Reviewed Bengali page text.",
  uncertainSegments: [{ text: "Bengali", reason: "check glyph" }], warnings: ["draft"], included: true,
  status: "ready", previewUrl: "data:image/jpeg;base64,preview", previewAvailable: true,
  transcriptionImage: { mimeType: "image/jpeg", base64Data: "secret-page-payload" },
};

describe("ingestion persistence envelope", () => {
  it("restores validated review text and choices without persisting raw page images", () => {
    const source = createConfirmedSource({ pages: [{ pageNumber: 2, text: page.text }], language: "en", method: "pdf" });
    const raw = toPersistedIngestionSession({
      stage: "confirmed", mode: "live", sourceKind: "pdf",
      sourceMetadata: { name: "lesson.pdf", kind: "pdf", pageCount: 1 },
      pages: [page], priorityInstruction: "Focus on terms", confirmedSource: source,
    });
    expect(raw).not.toContain("secret-page-payload");
    expect(raw).not.toContain("data:image");
    const restored = parsePersistedIngestionSession(raw);
    expect(restored?.pages[0]).toMatchObject({ pageNumber: 2, included: true, text: page.text, previewAvailable: false });
    expect(restored?.confirmedSource?.sourceVersionId).toBe(source.sourceVersionId);
    expect(restored?.recoveredWithoutPreviews).toBe(true);
  });

  it("rejects corrupted or unversioned state", () => {
    expect(parsePersistedIngestionSession("not-json")).toBeUndefined();
    expect(parsePersistedIngestionSession(JSON.stringify({ schemaVersion: 1, pages: [] }))).toBeUndefined();
  });

  it("restores a validated mixed result and recomputes deterministic grading artifacts", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const activity = createSampleActivitySet(sampleSource, map);
    const mcqGrade = gradeMcq(activity.questions[0], "B");
    const writtenEvaluation = createSampleWrittenEvaluation(activity);
    const conceptPerformance = calculateConceptPerformance({
      concepts: map.concepts,
      mcqQuestion: activity.questions[0],
      mcqGrade,
      writtenQuestion: activity.questions[1],
      writtenEvaluation,
    });
    const raw = toPersistedIngestionSession({
      stage: "results",
      mode: "sample",
      sourceKind: "text",
      pages: [],
      priorityInstruction: "",
      confirmedSource: sampleSource,
      preparationMap: map,
      assessmentConfiguration: { title: activity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
      activitySet: activity,
      selectedOptionId: "B",
      writtenAnswer: "A partial answer",
      mcqGrade,
      writtenEvaluation,
      conceptPerformance: conceptPerformance.map((item) => ({ ...item, earnedMarks: 999 })),
      writtenOperationId: "written-operation-001",
    });
    const restored = parsePersistedIngestionSession(raw);
    expect(restored?.stage).toBe("results");
    expect(restored?.mcqGrade).toMatchObject({ status: "correct", earnedMarks: 1 });
    expect(restored?.conceptPerformance?.reduce((sum, item) => sum + item.earnedMarks, 0)).toBe(3);
  });

  it("invalidates assessment and result artifacts when their source version is stale", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const activity = createSampleActivitySet(sampleSource, map);
    const raw = toPersistedIngestionSession({
      stage: "assessment", mode: "sample", sourceKind: "text", pages: [], priorityInstruction: "",
      confirmedSource: sampleSource, preparationMap: map, activitySet: activity,
    });
    const data = JSON.parse(raw) as { activitySet: { sourceVersionId: string } };
    data.activitySet.sourceVersionId = "source-deadbeef";
    const restored = parsePersistedIngestionSession(JSON.stringify(data));
    expect(restored?.stage).toBe("preparation");
    expect(restored?.activitySet).toBeUndefined();
    expect(restored?.writtenEvaluation).toBeUndefined();
  });

  it("migrates a Task 03 envelope while dropping its stale one-question assessment", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const raw = JSON.stringify({
      schemaVersion: 2, stage: "assessment", mode: "sample", sourceKind: "text", pages: [], priorityInstruction: "",
      confirmedSource: {
        sourceVersionId: sampleSource.sourceVersionId, language: sampleSource.language, method: sampleSource.method,
        segments: sampleSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
      },
      preparationMap: map,
      activitySet: { schemaVersion: "activity-set.v1", questions: [] },
    });
    const restored = migrateTask03Session(raw);
    expect(restored?.stage).toBe("preparation");
    expect(restored?.preparationMap).toEqual(map);
    expect(restored?.activitySet).toBeUndefined();
  });

  it("restores a complete adaptive result and recomputes retry grading and comparison", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const activity = createSampleActivitySet(sampleSource, map);
    const mcqGrade = gradeMcq(activity.questions[0], "B");
    const writtenEvaluation = createSampleWrittenEvaluation(activity);
    const conceptPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: activity.questions[0], mcqGrade, writtenQuestion: activity.questions[1], writtenEvaluation });
    const revisionPlan = createSampleRevisionPlan({ source: sampleSource, preparationMap: map, originalActivity: activity, originalResultId: `result-${activity.id}`, performance: conceptPerformance, writtenEvaluation });
    const retryMcqGrade = gradeMcq(revisionPlan.retryActivity.questions[0], "A");
    const retryWrittenEvaluation = createSampleRetryWrittenEvaluation(revisionPlan.retryActivity);
    const retryConceptPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: revisionPlan.retryActivity.questions[0], mcqGrade: retryMcqGrade, writtenQuestion: revisionPlan.retryActivity.questions[1], writtenEvaluation: retryWrittenEvaluation });
    const improvementComparison = compareAssessmentAttempts({ originalMcqGrade: mcqGrade, originalWrittenEvaluation: writtenEvaluation, originalPerformance: conceptPerformance, retryMcqGrade, retryWrittenEvaluation, retryPerformance: retryConceptPerformance });
    const raw = toPersistedIngestionSession({
      stage: "adaptive_results", mode: "sample", sourceKind: "text", pages: [], priorityInstruction: "",
      confirmedSource: sampleSource, preparationMap: map, activitySet: activity,
      assessmentConfiguration: { title: activity.title, selectedConceptIds: map.concepts.map((concept) => concept.id), difficulty: "medium" },
      selectedOptionId: "B", writtenAnswer: "Original partial answer", mcqGrade, writtenEvaluation, conceptPerformance,
      revisionPlan, revisionOperationId: "revision-operation-001", retrySelectedOptionId: "A",
      retryWrittenAnswer: "Complete retry answer", retryCurrentQuestionIndex: 1, retryMcqGrade, retryWrittenEvaluation,
      retryConceptPerformance, retryWrittenOperationId: "retry-operation-001", improvementComparison,
    });
    const restored = parsePersistedIngestionSession(raw);
    expect(restored?.stage).toBe("adaptive_results");
    expect(restored?.revisionPlan?.targetConceptIds).toEqual(revisionPlan.targetConceptIds);
    expect(restored?.retryMcqGrade?.status).toBe("correct");
    expect(restored?.improvementComparison).toEqual(improvementComparison);
    expect(restored?.writtenAnswer).toBe("Original partial answer");
    expect(restored?.retryWrittenAnswer).toBe("Complete retry answer");
  });

  it("drops corrupted adaptive artifacts while preserving the immutable original result", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const activity = createSampleActivitySet(sampleSource, map);
    const mcqGrade = gradeMcq(activity.questions[0], "B");
    const writtenEvaluation = createSampleWrittenEvaluation(activity);
    const conceptPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: activity.questions[0], mcqGrade, writtenQuestion: activity.questions[1], writtenEvaluation });
    const revisionPlan = createSampleRevisionPlan({ source: sampleSource, preparationMap: map, originalActivity: activity, originalResultId: `result-${activity.id}`, performance: conceptPerformance, writtenEvaluation });
    const raw = toPersistedIngestionSession({
      stage: "revision", mode: "sample", sourceKind: "text", pages: [], priorityInstruction: "", confirmedSource: sampleSource,
      preparationMap: map, activitySet: activity, selectedOptionId: "B", writtenAnswer: "partial", mcqGrade, writtenEvaluation, conceptPerformance, revisionPlan,
    });
    const data = JSON.parse(raw) as { revisionPlan: { items: Array<{ importantFact: string }> } };
    const first = data.revisionPlan.items[0];
    if (first !== undefined) first.importantFact = "unsupported external fact";
    const restored = parsePersistedIngestionSession(JSON.stringify(data));
    expect(restored?.stage).toBe("results");
    expect(restored?.revisionPlan).toBeUndefined();
    expect(restored?.writtenEvaluation).toEqual(writtenEvaluation);
    expect(restored?.conceptPerformance).toBeDefined();
  });

  it("migrates a valid Task 04 result without inventing adaptive artifacts", () => {
    const sampleSource = createSampleSource();
    const map = createSamplePreparationMap(sampleSource);
    const activity = createSampleActivitySet(sampleSource, map);
    const mcqGrade = gradeMcq(activity.questions[0], "B");
    const writtenEvaluation = createSampleWrittenEvaluation(activity);
    const conceptPerformance = calculateConceptPerformance({ concepts: map.concepts, mcqQuestion: activity.questions[0], mcqGrade, writtenQuestion: activity.questions[1], writtenEvaluation });
    const data = JSON.parse(toPersistedIngestionSession({
      stage: "results", mode: "sample", sourceKind: "text", pages: [], priorityInstruction: "", confirmedSource: sampleSource,
      preparationMap: map, activitySet: activity, selectedOptionId: "B", writtenAnswer: "partial", mcqGrade, writtenEvaluation, conceptPerformance,
    })) as Record<string, unknown>;
    data["schemaVersion"] = 3;
    data["uncertainRevisionFailure"] = undefined;
    data["retryWrittenAnswer"] = undefined;
    data["retryCurrentQuestionIndex"] = undefined;
    data["uncertainRetryFailure"] = undefined;
    const restored = migrateTask04Session(JSON.stringify(data));
    expect(restored?.schemaVersion).toBe(4);
    expect(restored?.stage).toBe("results");
    expect(restored?.revisionPlan).toBeUndefined();
  });
});
