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
  });
  return result.text;
}

/**
 * Stream text, calling onChunk for each delta.
 * Returns the full accumulated text.
 */
export async function streamGenerate(
  config: LlmConfig,
  system: string,
  prompt: string,
  onChunk?: (chunk: string) => void,
): Promise<string> {
  const provider = getProvider(config);
  const result = streamText({
    model: provider(config.model),
    system,
    prompt,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    topP: config.topP,
    frequencyPenalty: config.frequencyPenalty,
    presencePenalty: config.presencePenalty,
    providerOptions: config.providerOptions,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}
