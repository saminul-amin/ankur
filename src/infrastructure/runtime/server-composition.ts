import "server-only";

import { AnalyzeConfirmedSource } from "../../application/use-cases/analyze-confirmed-source";
import { EvaluateWrittenAnswer } from "../../application/use-cases/evaluate-written-answer";
import { GenerateMixedAssessment } from "../../application/use-cases/generate-mixed-assessment";
import { GeneratePersonalizedRevision } from "../../application/use-cases/generate-personalized-revision";
import { TranscribePage } from "../../application/use-cases/transcribe-page";
import { ProviderError } from "../../shared/errors/provider-error";
import { readRuntimeConfig } from "../../shared/config/runtime-config";
import type { RevisionValidationDiagnostic } from "../../application/diagnostics/revision-validation-diagnostic";
import { GemmaLearningContentAdapter } from "../gemma/gemma-learning-content-adapter";
import { GemmaPageTranscriptionAdapter } from "../gemma/gemma-page-transcription-adapter";
import { GemmaRevisionGenerationAdapter } from "../gemma/gemma-revision-generation-adapter";
import { GemmaWrittenEvaluationAdapter } from "../gemma/gemma-written-evaluation-adapter";
import { GoogleGenAiAdapter } from "../gemma/google-genai-adapter";

export function createServerApplication() {
  const config = readRuntimeConfig();
  if (!config.liveAiEnabled) {
    throw new ProviderError("CONFIGURATION_ERROR");
  }
  if (config.apiKey === undefined) {
    throw new ProviderError("CONFIGURATION_ERROR");
  }
  const provider = new GoogleGenAiAdapter(config.apiKey, config.primaryModel);
  const learningContent = new GemmaLearningContentAdapter(provider, config.requestTimeoutMs);
  const pageTranscription = new GemmaPageTranscriptionAdapter(provider, config.requestTimeoutMs);
  const writtenEvaluation = new GemmaWrittenEvaluationAdapter(provider, config.requestTimeoutMs);
  const revisionGeneration = new GemmaRevisionGenerationAdapter(provider, config.requestTimeoutMs);
  const recordRevisionDiagnostic = (diagnostic: RevisionValidationDiagnostic): void => {
    console.warn(JSON.stringify({ event: "ankur.revision_validation_failure", ...diagnostic }));
  };
  return {
    analyzeConfirmedSource: new AnalyzeConfirmedSource(learningContent),
    generateMixedAssessment: new GenerateMixedAssessment(learningContent),
    evaluateWrittenAnswer: new EvaluateWrittenAnswer(writtenEvaluation),
    generatePersonalizedRevision: new GeneratePersonalizedRevision(revisionGeneration, recordRevisionDiagnostic),
    transcribePage: new TranscribePage(pageTranscription),
  };
}
