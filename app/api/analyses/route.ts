import { rehydrateConfirmedSource } from "../../../src/domain/source/confirmed-source";
import { createServerApplication } from "../../../src/infrastructure/runtime/server-composition";
import { handleAiRoute } from "../../../src/presentation/api/ai-route";
import { analysisRequestSchema } from "../../../src/shared/schemas/api-contracts";

export const runtime = "nodejs";
export const maxDuration = 180;

export function POST(request: Request) {
  return handleAiRoute({
    request,
    schema: analysisRequestSchema,
    execute: async (data, requestId) => {
      const rehydrated = rehydrateConfirmedSource({
        sourceVersionId: data.sourceVersionId,
        language: data.language,
        segments: data.segments,
      });
      const source = Object.freeze({
        ...rehydrated,
        ...(data.priorityInstruction === undefined
          ? {}
          : { priorityInstruction: data.priorityInstruction }),
      });
      return createServerApplication().analyzeConfirmedSource.execute({ source, requestId });
    },
  });
}
