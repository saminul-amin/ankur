import "server-only";

import { AnalyzeConfirmedSource } from "../../application/use-cases/analyze-confirmed-source";
import { GenerateOneMcq } from "../../application/use-cases/generate-one-mcq";
import { ProviderError } from "../../shared/errors/provider-error";
import { readRuntimeConfig } from "../../shared/config/runtime-config";
import { GemmaLearningContentAdapter } from "../gemma/gemma-learning-content-adapter";
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
  return {
    analyzeConfirmedSource: new AnalyzeConfirmedSource(learningContent),
    generateOneMcq: new GenerateOneMcq(learningContent),
  };
}
