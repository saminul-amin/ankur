import { z } from "zod";

import { calculateConceptPerformance, reconcileAssessmentTotal, type ConceptPerformance } from "../../domain/assessments/concept-performance";
import { gradeMcq, validateActivitySet, type ActivitySet, type AssessmentDifficulty, type McqGrade } from "../../domain/assessments/mcq";
import { validateWrittenEvaluation, type WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import { validatePreparationMap, type PreparationMap } from "../../domain/preparation/preparation-map";
import { rehydrateConfirmedSource, type ConfirmedSource } from "../../domain/source/confirmed-source";
import type { ReviewPage } from "../../domain/source/page-extraction";
import { activitySetApiSchema, preparationMapApiSchema, writtenEvaluationApiSchema } from "../../shared/schemas/api-contracts";

export const INGESTION_STORAGE_KEY = "ankur.ingestion-session.v3";
export const TASK03_STORAGE_KEY = "ankur.ingestion-session.v2";
export type PersistedStage = "input" | "review" | "confirmed" | "preparation" | "assessment" | "results";
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
const mcqGradeSchema = z.object({
  status: z.enum(["correct", "incorrect", "unanswered"]), correct: z.boolean(), earnedMarks: z.union([z.literal(0), z.literal(1)]), availableMarks: z.literal(1),
  selectedOptionId: z.enum(["A", "B", "C", "D"]).optional(), correctOptionId: z.enum(["A", "B", "C", "D"]),
}).strict();
const contributionSchema = z.object({ availableMarks: z.number().nonnegative(), earnedMarks: z.number().nonnegative() }).strict();
const conceptPerformanceSchema = z.object({
  conceptId: z.string(), name: z.string(), priority: z.enum(["high", "medium", "low"]), availableMarks: z.number().positive(), earnedMarks: z.number().nonnegative(),
  percentage: z.number().min(0).max(100), questionsAttempted: z.number().int().min(0).max(2), objective: contributionSchema, written: contributionSchema,
  hasCriticalIncorrectClaim: z.boolean(), strength: z.enum(["mastered", "developing", "needs_review", "urgent_priority"]),
}).strict();

export const ingestionSessionEnvelopeSchema = z.object({
  schemaVersion: z.literal(3), stage: z.enum(["input", "review", "confirmed", "preparation", "assessment", "results"]),
  mode: z.enum(["live", "sample"]), sourceKind: z.enum(["text", "pdf", "images"]),
  sourceMetadata: z.object({ name: z.string().max(255), kind: z.enum(["pasted_text", "pdf", "page_images", "sample"]), pageCount: z.number().int().min(0).max(3) }).strict().optional(),
  pages: z.array(persistedPageSchema).max(3), priorityInstruction: z.string().max(1_000), confirmedSource: confirmedSourceSchema.optional(),
  preparationMap: preparationMapApiSchema.optional(),
  assessmentConfiguration: z.object({ title: z.string().min(1).max(160), selectedConceptIds: z.array(z.string()).min(1).max(8), difficulty: z.enum(["easy", "medium", "hard"]) }).strict().optional(),
  activitySet: activitySetApiSchema.optional(), selectedOptionId: z.enum(["A", "B", "C", "D"]).optional(),
  writtenAnswer: z.string().max(3_000).optional(), currentQuestionIndex: z.union([z.literal(0), z.literal(1)]).optional(),
  mcqGrade: mcqGradeSchema.optional(), writtenEvaluation: writtenEvaluationApiSchema.optional(),
  conceptPerformance: z.array(conceptPerformanceSchema).max(8).optional(), writtenOperationId: z.string().max(100).optional(),
  uncertainWrittenFailure: z.boolean().optional(),
}).strict();

export interface AssessmentConfigurationState { readonly title: string; readonly selectedConceptIds: readonly string[]; readonly difficulty: AssessmentDifficulty }
export interface IngestionSessionEnvelope {
  readonly schemaVersion: 3; readonly stage: PersistedStage; readonly mode: PersistedMode; readonly sourceKind: PersistedSourceKind;
  readonly sourceMetadata?: { readonly name: string; readonly kind: "pasted_text" | "pdf" | "page_images" | "sample"; readonly pageCount: number };
  readonly pages: readonly ReviewPage[]; readonly priorityInstruction: string; readonly confirmedSource?: ConfirmedSource; readonly preparationMap?: PreparationMap;
  readonly assessmentConfiguration?: AssessmentConfigurationState; readonly activitySet?: ActivitySet; readonly selectedOptionId?: string; readonly writtenAnswer?: string;
  readonly currentQuestionIndex: 0 | 1; readonly mcqGrade?: McqGrade; readonly writtenEvaluation?: WrittenAnswerEvaluation;
  readonly conceptPerformance?: readonly ConceptPerformance[]; readonly writtenOperationId?: string; readonly uncertainWrittenFailure: boolean;
  readonly recoveredWithoutPreviews: boolean;
}

type PersistInput = Omit<IngestionSessionEnvelope, "schemaVersion" | "recoveredWithoutPreviews" | "currentQuestionIndex" | "uncertainWrittenFailure"> & {
  readonly currentQuestionIndex?: 0 | 1;
  readonly uncertainWrittenFailure?: boolean;
};

export function toPersistedIngestionSession(input: PersistInput): string {
  return JSON.stringify({
    schemaVersion: 3, stage: input.stage, mode: input.mode, sourceKind: input.sourceKind,
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
    const stableStage: PersistedStage = parsed.data.stage === "results" && !resultsValid ? activity === undefined ? map === undefined ? source === undefined ? "review" : "confirmed" : "preparation" : "assessment"
      : parsed.data.stage === "assessment" && activity === undefined ? map === undefined ? source === undefined ? "review" : "confirmed" : "preparation"
        : parsed.data.stage === "preparation" && map === undefined ? source === undefined ? "review" : "confirmed" : parsed.data.stage;
    return {
      schemaVersion: 3, stage: stableStage, mode: parsed.data.mode, sourceKind: parsed.data.sourceKind,
      ...(parsed.data.sourceMetadata === undefined ? {} : { sourceMetadata: parsed.data.sourceMetadata }), pages,
      priorityInstruction: parsed.data.priorityInstruction, ...(source === undefined ? {} : { confirmedSource: source }),
      ...(map === undefined ? {} : { preparationMap: map }), ...(parsed.data.assessmentConfiguration === undefined ? {} : { assessmentConfiguration: parsed.data.assessmentConfiguration }),
      ...(activity === undefined ? {} : { activitySet: activity }), ...(parsed.data.selectedOptionId === undefined ? {} : { selectedOptionId: parsed.data.selectedOptionId }),
      ...(parsed.data.writtenAnswer === undefined ? {} : { writtenAnswer: parsed.data.writtenAnswer }), currentQuestionIndex: parsed.data.currentQuestionIndex ?? 0,
      ...(mcqGrade === undefined ? {} : { mcqGrade }), ...(writtenEvaluation === undefined ? {} : { writtenEvaluation }),
      ...(performance === undefined ? {} : { conceptPerformance: performance }), ...(parsed.data.writtenOperationId === undefined ? {} : { writtenOperationId: parsed.data.writtenOperationId }),
      uncertainWrittenFailure: parsed.data.uncertainWrittenFailure ?? false, recoveredWithoutPreviews: pages.some((page) => page.sourceKind === "pdf" || page.sourceKind === "page_image"),
    };
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
      schemaVersion: 3, stage: map !== undefined ? "preparation" : source !== undefined ? "confirmed" : parsed.data.pages.length > 0 ? "review" : "input",
      mode: parsed.data.mode, sourceKind: parsed.data.sourceKind, ...(parsed.data.sourceMetadata === undefined ? {} : { sourceMetadata: parsed.data.sourceMetadata }),
      pages: pagesFrom(parsed.data.pages), priorityInstruction: parsed.data.priorityInstruction, ...(source === undefined ? {} : { confirmedSource: source }),
      ...(map === undefined ? {} : { preparationMap: map }), currentQuestionIndex: 0, uncertainWrittenFailure: false,
      recoveredWithoutPreviews: parsed.data.pages.some((page) => page.sourceKind === "pdf" || page.sourceKind === "page_image"),
    };
  } catch { return undefined; }
}
