import { rehydrateConfirmedSource } from "../../../src/domain/source/confirmed-source";
import { createServerApplication } from "../../../src/infrastructure/runtime/server-composition";
import { handleAiRoute } from "../../../src/presentation/api/ai-route";
import { assessmentRequestSchema } from "../../../src/shared/schemas/api-contracts";

export const runtime = "nodejs";
export const maxDuration = 120;

export function POST(request: Request) {
  return handleAiRoute({
    request,
    schema: assessmentRequestSchema,
    execute: async (data, requestId) => {
      const source = rehydrateConfirmedSource({
        sourceVersionId: data.sourceVersionId,
        language: data.configuration.language,
        segments: data.segments,
      });
      const activitySet = await createServerApplication().generateOneMcq.execute({
        source,
        preparationMap: data.preparationMap,
        selectedConceptIds: data.selectedConceptIds,
        requestId,
      });
      return {
        activitySet,
        rejectedCandidateCount: 0,
        warnings: activitySet.warnings,
        artifact: activitySet.artifact,
      };
    },
  });
}
