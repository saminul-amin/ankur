import { rehydrateConfirmedSource } from "../../../src/domain/source/confirmed-source";
import { createServerApplication } from "../../../src/infrastructure/runtime/server-composition";
import { handleAiRoute } from "../../../src/presentation/api/ai-route";
import { revisionRequestSchema } from "../../../src/shared/schemas/api-contracts";

export const runtime = "nodejs";
export const maxDuration = 180;

export function POST(request: Request) {
  return handleAiRoute({
    request,
    schema: revisionRequestSchema,
    maxBodyBytes: 180_000,
    execute: async (data, requestId) => {
      const source = rehydrateConfirmedSource({
        sourceVersionId: data.sourceVersionId,
        language: data.language,
        segments: data.segments,
      });
      const originalMcqGrade = data.originalMcqGrade.selectedOptionId === undefined
        ? {
            status: data.originalMcqGrade.status,
            correct: data.originalMcqGrade.correct,
            earnedMarks: data.originalMcqGrade.earnedMarks,
            availableMarks: data.originalMcqGrade.availableMarks,
            correctOptionId: data.originalMcqGrade.correctOptionId,
          }
        : { ...data.originalMcqGrade, selectedOptionId: data.originalMcqGrade.selectedOptionId };
      const revisionPlan = await createServerApplication().generatePersonalizedRevision.execute({
        source,
        preparationMap: data.preparationMap,
        originalActivity: data.originalActivity,
        originalResultId: data.originalResultId,
        originalMcqGrade,
        performance: data.conceptPerformance,
        writtenEvaluation: data.originalWrittenEvaluation,
        requestId: data.operationId || requestId,
      });
      return { revisionPlan, warnings: revisionPlan.warnings, artifact: revisionPlan.artifact };
    },
  });
}
