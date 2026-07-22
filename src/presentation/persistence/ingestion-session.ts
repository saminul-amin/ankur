import { z } from "zod";

import { calculateConceptPerformance, reconcileAssessmentTotal, type ConceptPerformance } from "../../domain/assessments/concept-performance";
import { gradeMcq, validateActivitySet, type ActivitySet, type AssessmentDifficulty, type McqGrade } from "../../domain/assessments/mcq";
import { validateWrittenEvaluation, type WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import { validatePreparationMap, type PreparationMap } from "../../domain/preparation/preparation-map";
import { compareAssessmentAttempts, type ImprovementComparison } from "../../domain/revision/improvement-comparison";
import { selectRevisionTargets, validateRevisionPlan, type RevisionPlan } from "../../domain/revision/revision-plan";
import { rehydrateConfirmedSource, type ConfirmedSource } from "../../domain/source/confirmed-source";
import type { ReviewPage } from "../../domain/source/page-extraction";
import {
  activitySetApiSchema,
  conceptPerformanceApiSchema,
  improvementComparisonApiSchema,
  mcqGradeApiSchema,
  preparationMapApiSchema,
  revisionPlanApiSchema,
  writtenEvaluationApiSchema,
} from "../../shared/schemas/api-contracts";

export const INGESTION_STORAGE_KEY = "ankur.ingestion-session.v4";
export const TASK04_STORAGE_KEY = "ankur.ingestion-session.v3";
export const TASK03_STORAGE_KEY = "ankur.ingestion-session.v2";
export type PersistedStage = "input" | "review" | "confirmed" | "preparation" | "assessment" | "results" | "revision" | "retry" | "adaptive_results";
export type PersistedMode = "live" | "sample";
export type PersistedSourceKind = "text" | "pdf" | "images";

const persistedPageSchema = z.object({
  id: z.string().min(1), pageNumber: z.number().int().min(1).max(3), sourceKind: z.enum(["pdf", "page_image", "pasted_text", "sample"]),
  method: z.enum(["embedded_text", "gemma_ocr", "manual_text"]), text: z.string().max(25_000), rawExtraction: z.string().max(25_000).optional(),
  uncertainSegments: z.array(z.object({ text: z.string().min(1).max(500), reason: z.string().min(1).max(240) }).strict()).max(20),
  warnings: z.array(z.string().max(240)).max(20), included: z.boolean(), status: z.enum(["ready", "error"]), error: z.string().max(500).optional(),
}).strict();
const confirmedSourceSchema = z.object({
  sourceVersionId: z.string(), language: z.enum(["bn", "en", "mixed"]), method: z.enum(["pasted_text", "digital_pdf", "pdf", "page_images"]),
  priorityInstruction: z.string().max(1_000).optional(), segments: z.array(z.object({ id: z.string(), pageNumber: z.number().int().min(1).max(3), text: z.string() }).strict()),
}).strict();
export const ingestionSessionEnvelopeSchema = z.object({
  schemaVersion: z.literal(4), stage: z.enum(["input", "review", "confirmed", "preparation", "assessment", "results", "revision", "retry", "adaptive_results"]),
  mode: z.enum(["live", "sample"]), sourceKind: z.enum(["text", "pdf", "images"]),
  sourceMetadata: z.object({ name: z.string().max(255), kind: z.enum(["pasted_text", "pdf", "page_images", "sample"]), pageCount: z.number().int().min(0).max(3) }).strict().optional(),
  pages: z.array(persistedPageSchema).max(3), priorityInstruction: z.string().max(1_000), confirmedSource: confirmedSourceSchema.optional(),
  preparationMap: preparationMapApiSchema.optional(),
  assessmentConfiguration: z.object({ title: z.string().min(1).max(160), selectedConceptIds: z.array(z.string()).min(1).max(8), difficulty: z.enum(["easy", "medium", "hard"]) }).strict().optional(),
  activitySet: activitySetApiSchema.optional(), selectedOptionId: z.enum(["A", "B", "C", "D"]).optional(),
  writtenAnswer: z.string().max(3_000).optional(), currentQuestionIndex: z.union([z.literal(0), z.literal(1)]).optional(),
  mcqGrade: mcqGradeApiSchema.optional(), writtenEvaluation: writtenEvaluationApiSchema.optional(),
  conceptPerformance: z.array(conceptPerformanceApiSchema).max(8).optional(), writtenOperationId: z.string().max(100).optional(),
  uncertainWrittenFailure: z.boolean().optional(),
  revisionPlan: revisionPlanApiSchema.optional(), revisionOperationId: z.string().max(100).optional(), uncertainRevisionFailure: z.boolean().optional(),
  retrySelectedOptionId: z.enum(["A", "B", "C", "D"]).optional(), retryWrittenAnswer: z.string().max(3_000).optional(),
  retryCurrentQuestionIndex: z.union([z.literal(0), z.literal(1)]).optional(), retryMcqGrade: mcqGradeApiSchema.optional(),
  retryWrittenEvaluation: writtenEvaluationApiSchema.optional(), retryConceptPerformance: z.array(conceptPerformanceApiSchema).max(8).optional(),
  retryWrittenOperationId: z.string().max(100).optional(), uncertainRetryFailure: z.boolean().optional(),
  improvementComparison: improvementComparisonApiSchema.optional(),
}).strict();

const task04SessionEnvelopeSchema = ingestionSessionEnvelopeSchema.omit({
  revisionPlan: true,
  revisionOperationId: true,
  uncertainRevisionFailure: true,
  retrySelectedOptionId: true,
  retryWrittenAnswer: true,
  retryCurrentQuestionIndex: true,
  retryMcqGrade: true,
  retryWrittenEvaluation: true,
  retryConceptPerformance: true,
  retryWrittenOperationId: true,
  uncertainRetryFailure: true,
  improvementComparison: true,
}).extend({
  schemaVersion: z.literal(3),
  stage: z.enum(["input", "review", "confirmed", "preparation", "assessment", "results"]),
}).strict();

export interface AssessmentConfigurationState { readonly title: string; readonly selectedConceptIds: readonly string[]; readonly difficulty: AssessmentDifficulty }
export interface IngestionSessionEnvelope {
  readonly schemaVersion: 4; readonly stage: PersistedStage; readonly mode: PersistedMode; readonly sourceKind: PersistedSourceKind;
  readonly sourceMetadata?: { readonly name: string; readonly kind: "pasted_text" | "pdf" | "page_images" | "sample"; readonly pageCount: number };
  readonly pages: readonly ReviewPage[]; readonly priorityInstruction: string; readonly confirmedSource?: ConfirmedSource; readonly preparationMap?: PreparationMap;
  readonly assessmentConfiguration?: AssessmentConfigurationState; readonly activitySet?: ActivitySet; readonly selectedOptionId?: string; readonly writtenAnswer?: string;
  readonly currentQuestionIndex: 0 | 1; readonly mcqGrade?: McqGrade; readonly writtenEvaluation?: WrittenAnswerEvaluation;
  readonly conceptPerformance?: readonly ConceptPerformance[]; readonly writtenOperationId?: string; readonly uncertainWrittenFailure: boolean;
  readonly revisionPlan?: RevisionPlan; readonly revisionOperationId?: string; readonly uncertainRevisionFailure: boolean;
  readonly retrySelectedOptionId?: string; readonly retryWrittenAnswer: string; readonly retryCurrentQuestionIndex: 0 | 1;
  readonly retryMcqGrade?: McqGrade; readonly retryWrittenEvaluation?: WrittenAnswerEvaluation;
  readonly retryConceptPerformance?: readonly ConceptPerformance[]; readonly retryWrittenOperationId?: string;
  readonly uncertainRetryFailure: boolean; readonly improvementComparison?: ImprovementComparison;
  readonly recoveredWithoutPreviews: boolean;
}

type PersistInput = Omit<IngestionSessionEnvelope, "schemaVersion" | "recoveredWithoutPreviews" | "currentQuestionIndex" | "uncertainWrittenFailure" | "uncertainRevisionFailure" | "retryWrittenAnswer" | "retryCurrentQuestionIndex" | "uncertainRetryFailure"> & {
  readonly currentQuestionIndex?: 0 | 1;
  readonly uncertainWrittenFailure?: boolean;
  readonly uncertainRevisionFailure?: boolean;
  readonly retryWrittenAnswer?: string;
  readonly retryCurrentQuestionIndex?: 0 | 1;
  readonly uncertainRetryFailure?: boolean;
};

export function toPersistedIngestionSession(input: PersistInput): string {
  return JSON.stringify({
    schemaVersion: 4, stage: input.stage, mode: input.mode, sourceKind: input.sourceKind,
    ...(input.sourceMetadata === undefined ? {} : { sourceMetadata: input.sourceMetadata }),
    pages: input.pages.map((page) => ({
      id: page.id, pageNumber: page.pageNumber, sourceKind: page.sourceKind, method: page.method, text: page.text,
      ...(page.rawExtraction === undefined ? {} : { rawExtraction: page.rawExtraction }), uncertainSegments: page.uncertainSegments, warnings: page.warnings,
      included: page.included, status: page.status === "processing" ? "error" : page.status,
      ...(page.status === "processing" ? { error: "The page image is no longer available after refresh. Re-select the source to retry transcription." } : page.error === undefined ? {} : { error: page.error }),
    })),
    priorityInstruction: input.priorityInstruction,
    ...(input.confirmedSource === undefined ? {} : { confirmedSource: {
      sourceVersionId: input.confirmedSource.sourceVersionId, language: input.confirmedSource.language, method: input.confirmedSource.method,
      ...(input.confirmedSource.priorityInstruction === undefined ? {} : { priorityInstruction: input.confirmedSource.priorityInstruction }),
      segments: input.confirmedSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
    } }),
    ...(input.preparationMap === undefined ? {} : { preparationMap: input.preparationMap }),
    ...(input.assessmentConfiguration === undefined ? {} : { assessmentConfiguration: input.assessmentConfiguration }),
    ...(input.activitySet === undefined ? {} : { activitySet: input.activitySet }),
    ...(input.selectedOptionId === undefined || input.selectedOptionId === "" ? {} : { selectedOptionId: input.selectedOptionId }),
    ...(input.writtenAnswer === undefined ? {} : { writtenAnswer: input.writtenAnswer }), currentQuestionIndex: input.currentQuestionIndex ?? 0,
    ...(input.mcqGrade === undefined ? {} : { mcqGrade: input.mcqGrade }), ...(input.writtenEvaluation === undefined ? {} : { writtenEvaluation: input.writtenEvaluation }),
    ...(input.conceptPerformance === undefined ? {} : { conceptPerformance: input.conceptPerformance }),
    ...(input.writtenOperationId === undefined ? {} : { writtenOperationId: input.writtenOperationId }),
    uncertainWrittenFailure: input.uncertainWrittenFailure ?? false,
    ...(input.revisionPlan === undefined ? {} : { revisionPlan: input.revisionPlan }),
    ...(input.revisionOperationId === undefined ? {} : { revisionOperationId: input.revisionOperationId }),
    uncertainRevisionFailure: input.uncertainRevisionFailure ?? false,
    ...(input.retrySelectedOptionId === undefined || input.retrySelectedOptionId === "" ? {} : { retrySelectedOptionId: input.retrySelectedOptionId }),
    retryWrittenAnswer: input.retryWrittenAnswer ?? "", retryCurrentQuestionIndex: input.retryCurrentQuestionIndex ?? 0,
    ...(input.retryMcqGrade === undefined ? {} : { retryMcqGrade: input.retryMcqGrade }),
    ...(input.retryWrittenEvaluation === undefined ? {} : { retryWrittenEvaluation: input.retryWrittenEvaluation }),
    ...(input.retryConceptPerformance === undefined ? {} : { retryConceptPerformance: input.retryConceptPerformance }),
    ...(input.retryWrittenOperationId === undefined ? {} : { retryWrittenOperationId: input.retryWrittenOperationId }),
    uncertainRetryFailure: input.uncertainRetryFailure ?? false,
    ...(input.improvementComparison === undefined ? {} : { improvementComparison: input.improvementComparison }),
  });
}

function pagesFrom(data: z.infer<typeof ingestionSessionEnvelopeSchema>["pages"]): ReviewPage[] {
  return data.map((page) => ({
    id: page.id, pageNumber: page.pageNumber, sourceKind: page.sourceKind, method: page.method, text: page.text,
    ...(page.rawExtraction === undefined ? {} : { rawExtraction: page.rawExtraction }), uncertainSegments: page.uncertainSegments,
    included: page.included, status: page.status, previewAvailable: false, warnings: page.warnings,
    ...(page.error === undefined ? {} : { error: page.error }),
  }));
}

function sourceFrom(data: z.infer<typeof confirmedSourceSchema> | undefined): ConfirmedSource | undefined {
  return data === undefined ? undefined : rehydrateConfirmedSource({
    sourceVersionId: data.sourceVersionId, language: data.language, method: data.method, segments: data.segments,
    ...(data.priorityInstruction === undefined ? {} : { priorityInstruction: data.priorityInstruction }),
  });
}

export function parsePersistedIngestionSession(raw: string): IngestionSessionEnvelope | undefined {
  try {
    const parsed = ingestionSessionEnvelopeSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return undefined;
    const pages = pagesFrom(parsed.data.pages);
    const source = sourceFrom(parsed.data.confirmedSource);
    let map = parsed.data.preparationMap;
    let activity = parsed.data.activitySet;
    let writtenEvaluation = parsed.data.writtenEvaluation;
    const parsedGrade = parsed.data.mcqGrade;
    let mcqGrade: McqGrade | undefined;
    let performance: readonly ConceptPerformance[] | undefined;
    let revisionPlan = parsed.data.revisionPlan;
    let retryWrittenEvaluation = parsed.data.retryWrittenEvaluation;
    let retryMcqGrade: McqGrade | undefined;
    let retryPerformance: readonly ConceptPerformance[] | undefined;
    let improvementComparison: ImprovementComparison | undefined;
    if (source === undefined || (map !== undefined && validatePreparationMap(source, map).length > 0)) { map = undefined; activity = undefined; }
    if (source === undefined || map === undefined || (activity !== undefined && validateActivitySet(source, map, activity).length > 0)) activity = undefined;
    if (source === undefined || activity === undefined || (writtenEvaluation !== undefined && validateWrittenEvaluation(source, activity.questions[1], writtenEvaluation).length > 0)) writtenEvaluation = undefined;
    if (activity !== undefined && parsedGrade !== undefined) {
      mcqGrade = gradeMcq(activity.questions[0], parsed.data.selectedOptionId);
    }
    if (map !== undefined && activity !== undefined && mcqGrade !== undefined && writtenEvaluation !== undefined) {
      const calculated = calculateConceptPerformance({
        concepts: map.concepts,
        mcqQuestion: activity.questions[0],
        mcqGrade,
        writtenQuestion: activity.questions[1],
        writtenEvaluation,
      });
      if (reconcileAssessmentTotal({ mcqGrade, writtenEvaluation, performance: calculated })) performance = calculated;
    }
    const resultsValid = activity !== undefined && mcqGrade !== undefined && writtenEvaluation !== undefined && performance !== undefined;
    if (source === undefined || map === undefined || activity === undefined || writtenEvaluation === undefined || performance === undefined || !resultsValid) {
      revisionPlan = undefined;
    } else if (revisionPlan !== undefined) {
      const selection = selectRevisionTargets({ preparationMap: map, performance, writtenEvaluation });
      const failures = validateRevisionPlan({
        source,
        preparationMap: map,
        originalActivity: activity,
        originalResultId: `result-${activity.id}`,
        expectedSelection: selection,
        writtenEvaluation,
        plan: revisionPlan,
      });
      if (failures.length > 0) revisionPlan = undefined;
    }
    if (source === undefined || revisionPlan === undefined || (retryWrittenEvaluation !== undefined && validateWrittenEvaluation(source, revisionPlan.retryActivity.questions[1], retryWrittenEvaluation).length > 0)) {
      retryWrittenEvaluation = undefined;
    }
    if (revisionPlan !== undefined && parsed.data.retryMcqGrade !== undefined) {
      retryMcqGrade = gradeMcq(revisionPlan.retryActivity.questions[0], parsed.data.retrySelectedOptionId);
    }
    if (map !== undefined && revisionPlan !== undefined && retryMcqGrade !== undefined && retryWrittenEvaluation !== undefined) {
      const calculated = calculateConceptPerformance({
        concepts: map.concepts,
        mcqQuestion: revisionPlan.retryActivity.questions[0],
        mcqGrade: retryMcqGrade,
        writtenQuestion: revisionPlan.retryActivity.questions[1],
        writtenEvaluation: retryWrittenEvaluation,
      });
      if (reconcileAssessmentTotal({ mcqGrade: retryMcqGrade, writtenEvaluation: retryWrittenEvaluation, performance: calculated })) {
        retryPerformance = calculated;
      }
    }
    if (
      mcqGrade !== undefined && writtenEvaluation !== undefined && performance !== undefined &&
      retryMcqGrade !== undefined && retryWrittenEvaluation !== undefined && retryPerformance !== undefined &&
      parsed.data.improvementComparison !== undefined
    ) {
      const calculated = compareAssessmentAttempts({
        originalMcqGrade: mcqGrade,
        originalWrittenEvaluation: writtenEvaluation,
        originalPerformance: performance,
        retryMcqGrade,
        retryWrittenEvaluation,
        retryPerformance,
      });
      if (JSON.stringify(calculated) === JSON.stringify(parsed.data.improvementComparison)) improvementComparison = calculated;
    }
    let stableStage: PersistedStage = parsed.data.stage;
    const fallback: PersistedStage = activity === undefined ? map === undefined ? source === undefined ? "review" : "confirmed" : "preparation" : "assessment";
    if (stableStage === "results" && !resultsValid) stableStage = fallback;
    if ((stableStage === "revision" || stableStage === "retry" || stableStage === "adaptive_results") && !resultsValid) stableStage = fallback;
    else if ((stableStage === "revision" || stableStage === "retry" || stableStage === "adaptive_results") && revisionPlan === undefined) stableStage = "results";
    else if (stableStage === "adaptive_results" && improvementComparison === undefined) stableStage = "retry";
    if (stableStage === "assessment" && activity === undefined) stableStage = fallback;
    if (stableStage === "preparation" && map === undefined) stableStage = source === undefined ? "review" : "confirmed";
    return {
      schemaVersion: 4, stage: stableStage, mode: parsed.data.mode, sourceKind: parsed.data.sourceKind,
      ...(parsed.data.sourceMetadata === undefined ? {} : { sourceMetadata: parsed.data.sourceMetadata }), pages,
      priorityInstruction: parsed.data.priorityInstruction, ...(source === undefined ? {} : { confirmedSource: source }),
      ...(map === undefined ? {} : { preparationMap: map }), ...(parsed.data.assessmentConfiguration === undefined ? {} : { assessmentConfiguration: parsed.data.assessmentConfiguration }),
      ...(activity === undefined ? {} : { activitySet: activity }), ...(parsed.data.selectedOptionId === undefined ? {} : { selectedOptionId: parsed.data.selectedOptionId }),
      ...(parsed.data.writtenAnswer === undefined ? {} : { writtenAnswer: parsed.data.writtenAnswer }), currentQuestionIndex: parsed.data.currentQuestionIndex ?? 0,
      ...(mcqGrade === undefined ? {} : { mcqGrade }), ...(writtenEvaluation === undefined ? {} : { writtenEvaluation }),
      ...(performance === undefined ? {} : { conceptPerformance: performance }), ...(parsed.data.writtenOperationId === undefined ? {} : { writtenOperationId: parsed.data.writtenOperationId }),
      uncertainWrittenFailure: parsed.data.uncertainWrittenFailure ?? false,
      ...(revisionPlan === undefined ? {} : { revisionPlan }), ...(parsed.data.revisionOperationId === undefined ? {} : { revisionOperationId: parsed.data.revisionOperationId }),
      uncertainRevisionFailure: parsed.data.uncertainRevisionFailure ?? false,
      ...(parsed.data.retrySelectedOptionId === undefined ? {} : { retrySelectedOptionId: parsed.data.retrySelectedOptionId }),
      retryWrittenAnswer: parsed.data.retryWrittenAnswer ?? "", retryCurrentQuestionIndex: parsed.data.retryCurrentQuestionIndex ?? 0,
      ...(retryMcqGrade === undefined ? {} : { retryMcqGrade }), ...(retryWrittenEvaluation === undefined ? {} : { retryWrittenEvaluation }),
      ...(retryPerformance === undefined ? {} : { retryConceptPerformance: retryPerformance }),
      ...(parsed.data.retryWrittenOperationId === undefined ? {} : { retryWrittenOperationId: parsed.data.retryWrittenOperationId }),
      uncertainRetryFailure: parsed.data.uncertainRetryFailure ?? false,
      ...(improvementComparison === undefined ? {} : { improvementComparison }),
      recoveredWithoutPreviews: pages.some((page) => page.sourceKind === "pdf" || page.sourceKind === "page_image"),
    };
  } catch { return undefined; }
}

export function migrateTask04Session(raw: string): IngestionSessionEnvelope | undefined {
  try {
    const parsed = task04SessionEnvelopeSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return undefined;
    return parsePersistedIngestionSession(JSON.stringify({
      ...parsed.data,
      schemaVersion: 4,
      uncertainRevisionFailure: false,
      retryWrittenAnswer: "",
      retryCurrentQuestionIndex: 0,
      uncertainRetryFailure: false,
    }));
  } catch { return undefined; }
}

const legacySchema = z.object({
  schemaVersion: z.literal(2), stage: z.string(), mode: z.enum(["live", "sample"]), sourceKind: z.enum(["text", "pdf", "images"]),
  sourceMetadata: z.object({ name: z.string(), kind: z.enum(["pasted_text", "pdf", "page_images", "sample"]), pageCount: z.number().int() }).strict().optional(),
  pages: z.array(persistedPageSchema).max(3), priorityInstruction: z.string().max(1_000), confirmedSource: confirmedSourceSchema.optional(), preparationMap: preparationMapApiSchema.optional(),
}).loose();

export function migrateTask03Session(raw: string): IngestionSessionEnvelope | undefined {
  try {
    const parsed = legacySchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return undefined;
    const source = sourceFrom(parsed.data.confirmedSource);
    const map = source !== undefined && parsed.data.preparationMap !== undefined && validatePreparationMap(source, parsed.data.preparationMap).length === 0 ? parsed.data.preparationMap : undefined;
    return {
      schemaVersion: 4, stage: map !== undefined ? "preparation" : source !== undefined ? "confirmed" : parsed.data.pages.length > 0 ? "review" : "input",
      mode: parsed.data.mode, sourceKind: parsed.data.sourceKind, ...(parsed.data.sourceMetadata === undefined ? {} : { sourceMetadata: parsed.data.sourceMetadata }),
      pages: pagesFrom(parsed.data.pages), priorityInstruction: parsed.data.priorityInstruction, ...(source === undefined ? {} : { confirmedSource: source }),
      ...(map === undefined ? {} : { preparationMap: map }), currentQuestionIndex: 0, uncertainWrittenFailure: false,
      uncertainRevisionFailure: false, retryWrittenAnswer: "", retryCurrentQuestionIndex: 0, uncertainRetryFailure: false,
      recoveredWithoutPreviews: parsed.data.pages.some((page) => page.sourceKind === "pdf" || page.sourceKind === "page_image"),
    };
  } catch { return undefined; }
}
