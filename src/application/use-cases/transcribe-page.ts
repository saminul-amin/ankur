import { INGESTION_LIMITS, validateTranscriptionImage } from "../../domain/source/page-extraction";
import { ApplicationError } from "../../shared/errors/application-error";
import type { PageTranscriptionInput, PageTranscriptionPort, PageTranscriptionResult } from "../ports/page-transcription-port";

export class TranscribePage {
  constructor(private readonly transcription: PageTranscriptionPort) {}

  async execute(input: PageTranscriptionInput): Promise<PageTranscriptionResult> {
    if (
      input.materialOrdinal !== 1 ||
      !Number.isInteger(input.pageNumber) ||
      input.pageNumber < 1 ||
      input.pageNumber > INGESTION_LIMITS.maxPages ||
      validateTranscriptionImage(input).length > 0
    ) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }
    const result = await this.transcription.transcribePage(input);
    if (result.pageNumber !== input.pageNumber || result.text.trim().length === 0) {
      throw new ApplicationError("MODEL_OUTPUT_INVALID");
    }
    return result;
  }
}
