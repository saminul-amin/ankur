import { z } from "zod";

import { gradeMcq, validateActivitySet, type ActivitySet } from "../../domain/assessments/mcq";
import { validatePreparationMap, type PreparationMap } from "../../domain/preparation/preparation-map";
import { rehydrateConfirmedSource, type ConfirmedSource } from "../../domain/source/confirmed-source";
import type { ReviewPage } from "../../domain/source/page-extraction";
import { activitySetApiSchema, preparationMapApiSchema } from "../../shared/schemas/api-contracts";

export const INGESTION_STORAGE_KEY = "ankur.ingestion-session.v2";

export type PersistedStage = "input" | "review" | "confirmed" | "preparation" | "assessment" | "results";
export type PersistedMode = "live" | "sample";
export type PersistedSourceKind = "text" | "pdf" | "images";

const persistedPageSchema = z.object({
  id: z.string().min(1),
  pageNumber: z.number().int().min(1).max(3),
  sourceKind: z.enum(["pdf", "page_image", "pasted_text", "sample"]),
  method: z.enum(["embedded_text", "gemma_ocr", "manual_text"]),
  text: z.string().max(25_000),
  rawExtraction: z.string().max(25_000).optional(),
  uncertainSegments: z.array(z.object({ text: z.string().min(1).max(500), reason: z.string().min(1).max(240) }).strict()).max(20),
  warnings: z.array(z.string().max(240)).max(20),
  included: z.boolean(),
  status: z.enum(["ready", "error"]),
  error: z.string().max(500).optional(),
}).strict();

const confirmedSourceSchema = z.object({
  sourceVersionId: z.string(),
  language: z.enum(["bn", "en", "mixed"]),
  method: z.enum(["pasted_text", "digital_pdf", "pdf", "page_images"]),
  priorityInstruction: z.string().max(1_000).optional(),
  segments: z.array(z.object({ id: z.string(), pageNumber: z.number().int().min(1).max(3), text: z.string() }).strict()),
}).loose();

export const ingestionSessionEnvelopeSchema = z.object({
  schemaVersion: z.literal(2),
  stage: z.enum(["input", "review", "confirmed", "preparation", "assessment", "results"]),
  mode: z.enum(["live", "sample"]),
  sourceKind: z.enum(["text", "pdf", "images"]),
  sourceMetadata: z.object({ name: z.string().max(255), kind: z.enum(["pasted_text", "pdf", "page_images", "sample"]), pageCount: z.number().int().min(0).max(3) }).strict().optional(),
  pages: z.array(persistedPageSchema).max(3),
  priorityInstruction: z.string().max(1_000),
  confirmedSource: confirmedSourceSchema.optional(),
  preparationMap: preparationMapApiSchema.optional(),
  activitySet: activitySetApiSchema.optional(),
  selectedOptionId: z.string().optional(),
}).strict();

export interface IngestionSessionEnvelope {
  readonly schemaVersion: 2;
  readonly stage: PersistedStage;
  readonly mode: PersistedMode;
  readonly sourceKind: PersistedSourceKind;
  readonly sourceMetadata?: { readonly name: string; readonly kind: "pasted_text" | "pdf" | "page_images" | "sample"; readonly pageCount: number };
  readonly pages: readonly ReviewPage[];
  readonly priorityInstruction: string;
  readonly confirmedSource?: ConfirmedSource;
  readonly preparationMap?: PreparationMap;
  readonly activitySet?: ActivitySet;
  readonly selectedOptionId?: string;
  readonly recoveredWithoutPreviews: boolean;
}

export function toPersistedIngestionSession(input: Omit<IngestionSessionEnvelope, "schemaVersion" | "recoveredWithoutPreviews">): string {
  return JSON.stringify({
    schemaVersion: 2,
    stage: input.stage,
    mode: input.mode,
    sourceKind: input.sourceKind,
    ...(input.sourceMetadata === undefined ? {} : { sourceMetadata: input.sourceMetadata }),
    pages: input.pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      sourceKind: page.sourceKind,
      method: page.method,
      text: page.text,
      ...(page.rawExtraction === undefined ? {} : { rawExtraction: page.rawExtraction }),
      uncertainSegments: page.uncertainSegments,
      warnings: page.warnings,
      included: page.included,
      status: page.status === "processing" ? "error" : page.status,
      ...(page.status === "processing"
        ? { error: "The page image is no longer available after refresh. Re-select the source to retry transcription." }
        : page.error === undefined ? {} : { error: page.error }),
    })),
    priorityInstruction: input.priorityInstruction,
    ...(input.confirmedSource === undefined ? {} : { confirmedSource: {
      sourceVersionId: input.confirmedSource.sourceVersionId,
      language: input.confirmedSource.language,
      method: input.confirmedSource.method,
      ...(input.confirmedSource.priorityInstruction === undefined ? {} : { priorityInstruction: input.confirmedSource.priorityInstruction }),
      segments: input.confirmedSource.segments.map(({ id, pageNumber, text }) => ({ id, pageNumber, text })),
    } }),
    ...(input.preparationMap === undefined ? {} : { preparationMap: input.preparationMap }),
    ...(input.activitySet === undefined ? {} : { activitySet: input.activitySet }),
    ...(input.selectedOptionId === undefined ? {} : { selectedOptionId: input.selectedOptionId }),
  });
}

export function parsePersistedIngestionSession(raw: string): IngestionSessionEnvelope | undefined {
  try {
    const parsed = ingestionSessionEnvelopeSchema.safeParse(JSON.parse(raw) as unknown);
    if (!parsed.success) return undefined;
    const pages: ReviewPage[] = parsed.data.pages.map((page) => ({
      id: page.id,
      pageNumber: page.pageNumber,
      sourceKind: page.sourceKind,
      method: page.method,
      text: page.text,
      ...(page.rawExtraction === undefined ? {} : { rawExtraction: page.rawExtraction }),
      uncertainSegments: page.uncertainSegments,
      included: page.included,
      status: page.status,
      previewAvailable: false,
      warnings: page.warnings,
      ...(page.error === undefined ? {} : { error: page.error }),
    }));
    const source = parsed.data.confirmedSource === undefined ? undefined : rehydrateConfirmedSource({
      sourceVersionId: parsed.data.confirmedSource.sourceVersionId,
      language: parsed.data.confirmedSource.language,
      method: parsed.data.confirmedSource.method,
      segments: parsed.data.confirmedSource.segments,
      ...(parsed.data.confirmedSource.priorityInstruction === undefined ? {} : { priorityInstruction: parsed.data.confirmedSource.priorityInstruction }),
    });
    let map = parsed.data.preparationMap;
    let activity = parsed.data.activitySet;
    if (source === undefined || (map !== undefined && validatePreparationMap(source, map).length > 0)) {
      map = undefined;
      activity = undefined;
    }
    if (source === undefined || map === undefined || (activity !== undefined && validateActivitySet(source, map, activity).length > 0)) {
      activity = undefined;
    }
    const stableStage: PersistedStage = parsed.data.stage === "results" && activity === undefined
      ? source === undefined ? "review" : map === undefined ? "confirmed" : "preparation"
      : parsed.data.stage === "assessment" && activity === undefined
        ? source === undefined ? "review" : map === undefined ? "confirmed" : "preparation"
        : parsed.data.stage === "preparation" && map === undefined
          ? source === undefined ? "review" : "confirmed"
          : parsed.data.stage;
    return {
      schemaVersion: 2,
      stage: stableStage,
      mode: parsed.data.mode,
      sourceKind: parsed.data.sourceKind,
      ...(parsed.data.sourceMetadata === undefined ? {} : { sourceMetadata: parsed.data.sourceMetadata }),
      pages,
      priorityInstruction: parsed.data.priorityInstruction,
      ...(source === undefined ? {} : { confirmedSource: source }),
      ...(map === undefined ? {} : { preparationMap: map }),
      ...(activity === undefined ? {} : { activitySet: activity }),
      ...(parsed.data.selectedOptionId === undefined ? {} : { selectedOptionId: parsed.data.selectedOptionId }),
      recoveredWithoutPreviews: pages.length > 0,
    };
  } catch {
    return undefined;
  }
}

export function recoveredGrade(session: IngestionSessionEnvelope) {
  const question = session.activitySet?.questions[0];
  return session.stage === "results" && question !== undefined && session.selectedOptionId !== undefined
    ? gradeMcq(question, session.selectedOptionId)
    : undefined;
}
