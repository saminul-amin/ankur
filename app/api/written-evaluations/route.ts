import { rehydrateEvidenceWindow } from "../../../src/domain/source/confirmed-source";
import { createServerApplication } from "../../../src/infrastructure/runtime/server-composition";
import { handleAiRoute } from "../../../src/presentation/api/ai-route";
import { writtenEvaluationRequestSchema } from "../../../src/shared/schemas/api-contracts";

export const runtime = "nodejs";
export const maxDuration = 120;

export function POST(request: Request) {
  return handleAiRoute({
    request,
    schema: writtenEvaluationRequestSchema,
    maxBodyBytes: 120_000,
    execute: async (data, requestId) => {
      const source = rehydrateEvidenceWindow({
        sourceVersionId: data.sourceVersionId,
        language: "mixed",
        segments: data.evidenceSegments,
      });
      return createServerApplication().evaluateWrittenAnswer.execute({
        source,
        question: data.question,
        studentAnswer: data.studentAnswer,
        requestId: data.operationId || requestId,
      });
    },
  });
}
