export interface ModelArtifactMetadata {
  readonly provider: "gemini_api";
  readonly modelId: "gemma-4-26b-a4b-it" | "gemma-4-31b-it";
  readonly task: "material_analysis" | "assessment_generation";
  readonly promptVersion: string;
  readonly schemaVersion: string;
  readonly thinkingLevel: "minimal" | "high";
  readonly requestId: string;
  readonly createdAt: string;
  readonly latencyMs: number;
  readonly repaired: boolean;
}
