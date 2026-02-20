import { generateText, streamText, type CoreMessage } from "ai";
import type { LlmConfig } from "../types.js";
import { getProvider } from "../llm/provider.js";
import { createTools } from "./tools.js";
import { loadL0 } from "../context/assembler.js";
import {
  SYSTEM_PROMPT_ANALYZE,
  SYSTEM_PROMPT_CHAT,
} from "./prompts.js";

/**
 * Run agent for a single task (e.g., analyze a chapter).
 * Agent loops until it stops calling tools.
 */
export async function runAgent(
  rootDir: string,
  llmConfig: LlmConfig,
  userMessage: string,
  systemPrompt?: string,
  onStream?: (chunk: string) => void
): Promise<string> {
  const provider = getProvider(llmConfig);
  const tools = createTools(rootDir);
  const l0 = await loadL0(rootDir);

  const system = [systemPrompt ?? SYSTEM_PROMPT_ANALYZE, l0 ? `\n\n当前索引:\n${l0}` : ""].join("");

  const result = await generateText({
    model: (provider as any)(llmConfig.model),
    system,
    prompt: userMessage,
    tools,
    maxSteps: 20,
  });

  return result.text;
}

/**
 * Conversational agent — maintains message history,
 * yields streaming text for the latest response.
 */
export async function* conversationalAgent(
  rootDir: string,
  llmConfig: LlmConfig,
  messages: CoreMessage[]
): AsyncGenerator<string, string> {
  const provider = getProvider(llmConfig);
  const tools = createTools(rootDir);
  const l0 = await loadL0(rootDir);

  const system = [SYSTEM_PROMPT_CHAT, l0 ? `\n\n当前索引:\n${l0}` : ""].join("");

  const result = streamText({
    model: (provider as any)(llmConfig.model),
    system,
    messages,
    tools,
    maxSteps: 20,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
    yield chunk;
  }
  return full;
}
