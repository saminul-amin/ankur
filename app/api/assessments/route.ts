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
      const activitySet = await createServerApplication().generateMixedAssessment.execute({
        source,
        preparationMap: data.preparationMap,
        selectedConceptIds: data.selectedConceptIds,
        title: data.configuration.title,
        difficulty: data.configuration.difficulty,
        requestId,
      });
      return {
        activitySet,
        rejectedCandidateCount: activitySet.artifact.repaired ? 1 : 0,
        warnings: activitySet.warnings,
        artifact: activitySet.artifact,
      };
    },
  });
}
