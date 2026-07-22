import { INGESTION_LIMITS, validateTranscriptionImage } from "../../../src/domain/source/page-extraction";
import { createServerApplication } from "../../../src/infrastructure/runtime/server-composition";
import { handleAiRoute } from "../../../src/presentation/api/ai-route";
import { ApplicationError } from "../../../src/shared/errors/application-error";
import { transcriptionRequestSchema } from "../../../src/shared/schemas/api-contracts";

export const runtime = "nodejs";
export const maxDuration = 120;

export function POST(request: Request) {
  return handleAiRoute({
    request,
    schema: transcriptionRequestSchema,
    maxBodyBytes: 4_300_000,
    execute: async (data, requestId) => {
      const failures = validateTranscriptionImage(data);
      if (failures.includes("UNSUPPORTED_MEDIA")) throw new ApplicationError("UNSUPPORTED_MEDIA");
      if (failures.includes("IMAGE_TOO_LARGE")) throw new ApplicationError("PAYLOAD_TOO_LARGE");
      if (failures.length > 0) throw new ApplicationError("MODEL_OUTPUT_INVALID");
      if (data.imageBase64.length > Math.ceil(INGESTION_LIMITS.maxTranscriptionImageBytes * 4 / 3) + 4) {
        throw new ApplicationError("PAYLOAD_TOO_LARGE");
      }
      return createServerApplication().transcribePage.execute({
        sourceVersionDraftId: data.sourceVersionDraftId,
        materialOrdinal: data.materialOrdinal,
        pageNumber: data.pageNumber,
        mimeType: data.mimeType,
        imageBase64: data.imageBase64,
        targetLanguage: data.targetLanguage,
        ...(data.optionalRawExtraction === undefined ? {} : { optionalRawExtraction: data.optionalRawExtraction }),
        requestId,
      });
    },
  });
}
