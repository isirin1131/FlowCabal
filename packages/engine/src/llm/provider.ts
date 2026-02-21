import type { LlmConfig } from "../types.js";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createMistral } from "@ai-sdk/mistral";
import { createXai } from "@ai-sdk/xai";
import { createCohere } from "@ai-sdk/cohere";

/**
 * Create a Vercel AI SDK provider from LlmConfig.
 * Returns the provider instance — use with provider(model) to get a LanguageModel.
 */
export function getProvider(config: LlmConfig) {
  switch (config.provider) {
    case "openai":
      return createOpenAI({ apiKey: config.apiKey });
    case "openai-compatible":
      return createOpenAI({
        apiKey: config.apiKey,
        baseURL: config.baseURL,
      });
    case "anthropic":
      return createAnthropic({ apiKey: config.apiKey });
    case "google":
      return createGoogleGenerativeAI({ apiKey: config.apiKey });
    case "mistral":
      return createMistral({ apiKey: config.apiKey });
    case "xai":
      return createXai({ apiKey: config.apiKey });
    case "cohere":
      return createCohere({ apiKey: config.apiKey });
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
