import { generateText, streamText } from "ai";

type Provider = ReturnType<typeof import("@ai-sdk/openai").createOpenAI> |
  ReturnType<typeof import("@ai-sdk/anthropic").createAnthropic> |
  ReturnType<typeof import("@ai-sdk/google").createGoogleGenerativeAI>;

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
    model: (provider as any)(model),
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
    model: (provider as any)(model),
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
