import { generateText, streamText } from "ai";
import type { LlmConfig } from "../types.js";
import { getProvider } from "./provider.js";

/**
 * Generate text (non-streaming).
 */
export async function generate(
  config: LlmConfig,
  system: string,
  prompt: string,
  abortSignal?: AbortSignal,
): Promise<string> {
  const provider = getProvider(config);
  const result = await generateText({
    model: provider(config.model),
    system,
    prompt,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    providerOptions: config.providerOptions,
    abortSignal,
  });
  return result.text;
}

/**
 * Create a stream without consuming it.
 * Caller iterates stream.textStream directly (e.g., executor yields chunks as events).
 */
export function createStream(
  config: LlmConfig,
  system: string,
  prompt: string,
  abortSignal?: AbortSignal,
) {
  const provider = getProvider(config);
  return streamText({
    model: provider(config.model),
    system,
    prompt,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    providerOptions: config.providerOptions,
    abortSignal,
  });
}
