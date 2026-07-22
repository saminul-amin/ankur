import type { ModelArtifactMetadata } from "../../domain/ai/model-artifact";
import type { SourceLanguage } from "../../domain/source/confirmed-source";
import type { UncertainSegment } from "../../domain/source/page-extraction";

export interface PageTranscriptionInput {
  readonly sourceVersionDraftId: string;
  readonly materialOrdinal: number;
  readonly pageNumber: number;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly imageBase64: string;
  readonly optionalRawExtraction?: string;
  readonly targetLanguage: SourceLanguage;
  readonly requestId: string;
}

export interface PageTranscriptionResult {
  readonly pageNumber: number;
  readonly detectedLanguage: SourceLanguage;
  readonly text: string;
  readonly uncertainSegments: readonly UncertainSegment[];
  readonly warnings: readonly string[];
  readonly artifact: ModelArtifactMetadata;
}

export interface PageTranscriptionPort {
  transcribePage(input: PageTranscriptionInput): Promise<PageTranscriptionResult>;
}
