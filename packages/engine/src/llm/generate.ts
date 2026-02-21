import { generateText, streamText } from "ai";

// All @ai-sdk/* providers share the same callable pattern: provider(model) → LanguageModel
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Provider = (model: string) => any;

/**
 * Generate text (non-streaming).
 */
export async function generate(
  provider: Provider,
  model: string,
  system: string,
  prompt: string,
  parameters?: { temperature?: number; maxTokens?: number }
): Promise<string> {
  const result = await generateText({
    model: provider(model),
    system,
    prompt,
    temperature: parameters?.temperature,
    maxTokens: parameters?.maxTokens,
  });
  return result.text;
}

/**
 * Stream text, calling onChunk for each delta.
 * Returns the full accumulated text.
 */
export async function streamGenerate(
  provider: Provider,
  model: string,
  system: string,
  prompt: string,
  parameters?: { temperature?: number; maxTokens?: number },
  onChunk?: (chunk: string) => void
): Promise<string> {
  const result = streamText({
    model: provider(model),
    system,
    prompt,
    temperature: parameters?.temperature,
    maxTokens: parameters?.maxTokens,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
    onChunk?.(chunk);
  }
  return full;
}
