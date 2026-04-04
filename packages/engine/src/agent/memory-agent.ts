import { generateText, streamText, type CoreMessage } from "ai";
import type { LlmConfig } from "../types.js";
import { getProvider } from "../llm/provider.js";
import { createMemoryTools } from "./tools-memory.js";
import { SYSTEM_PROMPT_MEMORY_READONLY, SYSTEM_PROMPT_MEMORY } from "./prompts.js";
import { loadL0 } from "./assembler.js";

interface MemoryAgentOptions {
  rootDir: string;
  llmConfig: LlmConfig;
  systemPrompt?: string;
  abortSignal?: AbortSignal;
  readonly?: boolean;
}

async function prepareAgent(opts: MemoryAgentOptions) {
  const provider = getProvider(opts.llmConfig);
  const tools = createMemoryTools(opts.rootDir, opts.readonly ?? false);
  const l0 = await loadL0(opts.rootDir);

  let base = opts.systemPrompt;
  if (!base) {
    base = opts.readonly ? SYSTEM_PROMPT_MEMORY_READONLY : SYSTEM_PROMPT_MEMORY;
  }
  const system = l0 ? `${base}\n\n当前索引:\n${l0}` : base;

  return {
    model: provider(opts.llmConfig.model),
    system,
    tools,
    abortSignal: opts.abortSignal,
  };
}

export async function runMemoryAgent(
  rootDir: string,
  llmConfig: LlmConfig,
  userMessage: string,
  options?: { abortSignal?: AbortSignal; readonly?: boolean },
): Promise<string> {
  const prepared = await prepareAgent({ 
    rootDir, 
    llmConfig, 
    abortSignal: options?.abortSignal,
    readonly: options?.readonly,
  });

  const result = await generateText({
    ...prepared,
    prompt: userMessage,
    maxSteps: 20,
  });

  return result.text;
}

export async function* conversationalMemoryAgent(
  rootDir: string,
  llmConfig: LlmConfig,
  messages: CoreMessage[],
  options?: { abortSignal?: AbortSignal; readonly?: boolean },
): AsyncGenerator<string, string> {
  const prepared = await prepareAgent({
    rootDir,
    llmConfig,
    systemPrompt: options?.readonly ? SYSTEM_PROMPT_MEMORY_READONLY : SYSTEM_PROMPT_MEMORY,
    abortSignal: options?.abortSignal,
    readonly: options?.readonly,
  });

  const result = streamText({
    ...prepared,
    messages,
    maxSteps: 20,
  });

  let full = "";
  
  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      full += part.textDelta;
      yield part.textDelta;
    } else if (part.type === 'tool-call') {
      const toolPart = part as { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown };
      const toolInfo = `\n[调用工具: ${toolPart.toolName}]\n${JSON.stringify(toolPart.args, null, 2)}\n`;
      full += toolInfo;
      yield toolInfo;
    } else if ((part as { type: string }).type === 'tool-result') {
      const toolResultPart = part as unknown as { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown };
      const resultInfo = `[工具结果: ${toolResultPart.toolName}]\n${JSON.stringify(toolResultPart.result, null, 2)}\n`;
      full += resultInfo;
      yield resultInfo;
    }
  }

  return full;
}
