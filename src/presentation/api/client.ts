import { z } from "zod";

import type { ActivitySet, ShortWrittenQuestion } from "../../domain/assessments/mcq";
import type { WrittenAnswerEvaluation } from "../../domain/assessments/written-evaluation";
import type { ConceptPerformance } from "../../domain/assessments/concept-performance";
import type { McqGrade } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import type { RevisionPlan } from "../../domain/revision/revision-plan";
import {
  activitySetApiSchema, analysisRequestSchema, assessmentRequestSchema, preparationMapApiSchema,
  transcriptionRequestSchema, transcriptionResultApiSchema, writtenEvaluationApiSchema, writtenEvaluationRequestSchema,
  revisionPlanApiSchema, revisionRequestSchema,
} from "../../shared/schemas/api-contracts";

const failureSchema = z.object({
  ok: z.literal(false), requestId: z.string(), error: z.object({ code: z.string(), message: z.string(), retryable: z.boolean() }).strict(),
}).strict();
const analysisSuccessSchema = z.object({ ok: z.literal(true), requestId: z.string(), data: preparationMapApiSchema }).strict();
const assessmentSuccessSchema = z.object({
  ok: z.literal(true), requestId: z.string(),
  data: z.object({ activitySet: activitySetApiSchema, rejectedCandidateCount: z.number().int().nonnegative(), warnings: z.array(z.string()), artifact: activitySetApiSchema.shape.artifact }).strict(),
}).strict();
const writtenSuccessSchema = z.object({ ok: z.literal(true), requestId: z.string(), data: writtenEvaluationApiSchema }).strict();
const revisionSuccessSchema = z.object({
  ok: z.literal(true), requestId: z.string(),
  data: z.object({ revisionPlan: revisionPlanApiSchema, warnings: z.array(z.string()), artifact: revisionPlanApiSchema.shape.artifact }).strict(),
}).strict();

export class ApiClientError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); this.name = "ApiClientError"; }
}

async function postJson(path: string, sessionId: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json", "x-ankur-session-id": sessionId }, body: JSON.stringify(body) });
  const payload: unknown = await response.json();
  const failure = failureSchema.safeParse(payload);
  if (failure.success) throw new ApiClientError(failure.data.error.message, failure.data.error.retryable);
  return payload;
}

export async function requestPreparationMap(input: z.input<typeof analysisRequestSchema>, sessionId: string): Promise<PreparationMap> {
  const payload = await postJson("/api/analyses", sessionId, analysisRequestSchema.parse(input));
  const parsed = analysisSuccessSchema.safeParse(payload);
  if (!parsed.success) throw new ApiClientError("The analysis response did not satisfy its contract.", false);
  return parsed.data.data;
}

export async function requestMixedAssessment(input: {
  readonly sourceVersionId: string;
  readonly preparationMap: PreparationMap;
  readonly selectedConceptIds: readonly string[];
  readonly configuration: { readonly title: string; readonly language: "bn" | "en" | "mixed"; readonly mcqCount: 1; readonly shortWrittenCount: 1; readonly difficulty: "easy" | "medium" | "hard" };
  readonly segments: ReadonlyArray<{ readonly id: string; readonly pageNumber: number; readonly text: string }>;
}, sessionId: string): Promise<ActivitySet> {
  const payload = await postJson("/api/assessments", sessionId, assessmentRequestSchema.parse(input));
  const parsed = assessmentSuccessSchema.safeParse(payload);
  if (!parsed.success) throw new ApiClientError("The assessment response did not satisfy its contract.", false);
  return parsed.data.data.activitySet;
}

export async function requestWrittenEvaluation(input: {
  readonly operationId: string;
  readonly sourceVersionId: string;
  readonly question: ShortWrittenQuestion;
  readonly studentAnswer: string;
  readonly evidenceSegments: ReadonlyArray<{ readonly id: string; readonly pageNumber: number; readonly text: string }>;
}, sessionId: string): Promise<WrittenAnswerEvaluation> {
  const payload = await postJson("/api/written-evaluations", sessionId, writtenEvaluationRequestSchema.parse(input));
  const parsed = writtenSuccessSchema.safeParse(payload);
  if (!parsed.success) throw new ApiClientError("The written grading response did not satisfy its contract.", false);
  return parsed.data.data;
}

export async function requestPageTranscription(input: z.input<typeof transcriptionRequestSchema>, sessionId: string) {
  const payload = await postJson("/api/transcriptions", sessionId, transcriptionRequestSchema.parse(input));
  const parsed = z.object({ ok: z.literal(true), requestId: z.string(), data: transcriptionResultApiSchema }).strict().safeParse(payload);
  if (!parsed.success) throw new ApiClientError("The transcription response did not satisfy its contract.", false);
  return parsed.data.data;
}

export async function requestPersonalizedRevision(input: {
  readonly operationId: string;
  readonly sourceVersionId: string;
  readonly preparationMap: PreparationMap;
  readonly originalActivity: ActivitySet;
  readonly originalResultId: string;
  readonly originalMcqGrade: McqGrade;
  readonly originalWrittenEvaluation: WrittenAnswerEvaluation;
  readonly conceptPerformance: readonly ConceptPerformance[];
  readonly language: "bn" | "en" | "mixed";
  readonly segments: ReadonlyArray<{ readonly id: string; readonly pageNumber: number; readonly text: string }>;
}, sessionId: string): Promise<RevisionPlan> {
  const payload = await postJson("/api/revisions", sessionId, revisionRequestSchema.parse(input));
  const parsed = revisionSuccessSchema.safeParse(payload);
  if (!parsed.success) throw new ApiClientError("The revision response did not satisfy its contract.", false);
  return parsed.data.data.revisionPlan;
}
