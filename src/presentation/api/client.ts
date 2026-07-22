import { z } from "zod";

import type { ActivitySet } from "../../domain/assessments/mcq";
import type { PreparationMap } from "../../domain/preparation/preparation-map";
import {
  activitySetApiSchema,
  analysisRequestSchema,
  assessmentRequestSchema,
  preparationMapApiSchema,
} from "../../shared/schemas/api-contracts";

const failureSchema = z
  .object({
    ok: z.literal(false),
    requestId: z.string(),
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        retryable: z.boolean(),
      })
      .strict(),
  })
  .strict();

const analysisSuccessSchema = z
  .object({ ok: z.literal(true), requestId: z.string(), data: preparationMapApiSchema })
  .strict();

const assessmentSuccessSchema = z
  .object({
    ok: z.literal(true),
    requestId: z.string(),
    data: z
      .object({
        activitySet: activitySetApiSchema,
        rejectedCandidateCount: z.number().int().nonnegative(),
        warnings: z.array(z.string()),
        artifact: activitySetApiSchema.shape.artifact,
      })
      .strict(),
  })
  .strict();

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

async function postJson(path: string, sessionId: string, body: unknown): Promise<unknown> {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-ankur-session-id": sessionId,
    },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json();
  const failure = failureSchema.safeParse(payload);
  if (failure.success) {
    throw new ApiClientError(failure.data.error.message, failure.data.error.retryable);
  }
  return payload;
}

export async function requestPreparationMap(
  input: z.input<typeof analysisRequestSchema>,
  sessionId: string,
): Promise<PreparationMap> {
  const validatedInput = analysisRequestSchema.parse(input);
  const payload = await postJson("/api/analyses", sessionId, validatedInput);
  const parsed = analysisSuccessSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError("The analysis response did not satisfy its contract.", false);
  }
  return parsed.data.data;
}

export async function requestOneMcq(
  input: {
    readonly sourceVersionId: string;
    readonly preparationMap: PreparationMap;
    readonly selectedConceptIds: readonly string[];
    readonly configuration: {
      readonly language: "bn" | "en" | "mixed";
      readonly mcqCount: 1;
      readonly shortWrittenCount: 0;
      readonly difficulty: "easy" | "medium" | "hard" | "mixed";
    };
    readonly segments: ReadonlyArray<{
      readonly id: string;
      readonly pageNumber: number;
      readonly text: string;
    }>;
  },
  sessionId: string,
): Promise<ActivitySet> {
  const validatedInput = assessmentRequestSchema.parse(input);
  const payload = await postJson("/api/assessments", sessionId, validatedInput);
  const parsed = assessmentSuccessSchema.safeParse(payload);
  if (!parsed.success) {
    throw new ApiClientError("The assessment response did not satisfy its contract.", false);
  }
  return parsed.data.data.activitySet;
}
