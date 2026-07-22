export interface ModelArtifactMetadata {
  readonly provider: "gemini_api";
  readonly modelId: "gemma-4-26b-a4b-it" | "gemma-4-31b-it";
  readonly task: "page_transcription" | "material_analysis" | "assessment_generation" | "written_evaluation";
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly thinkingLevel: "minimal" | "high";
  readonly requestId: string;
  readonly createdAt: string;
  readonly latencyMs: number;
  readonly repaired: boolean;
}
