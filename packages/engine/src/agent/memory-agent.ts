import { generateText, streamText, type CoreMessage, type LanguageModelUsage } from "ai";
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

export type MemoryStreamChunk =
  | { type: 'text-delta'; text: string }
  | { type: 'reasoning'; text: string }
  | { type: 'tool-call'; toolCallId: string; toolName: string; args: unknown }
  | { type: 'tool-call-delta'; toolCallId: string; text: string }
  | { type: 'tool-result'; toolCallId: string; toolName: string; result: unknown; isError?: boolean }
  | { type: 'step-finish'; finishReason: string }
  | { type: 'finish'; usage: LanguageModelUsage }
  | { type: 'error'; error: string }

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

export async function* conversationalMemoryAgentStream(
  rootDir: string,
  llmConfig: LlmConfig,
  messages: CoreMessage[],
  options?: { abortSignal?: AbortSignal; readonly?: boolean },
): AsyncGenerator<MemoryStreamChunk, void, unknown> {
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

  for await (const part of result.fullStream) {
    if (part.type === 'text-delta') {
      yield { type: 'text-delta', text: part.textDelta };
    } else if (part.type === 'reasoning') {
      yield { type: 'reasoning', text: part.textDelta };
    } else if (part.type === 'tool-call') {
      yield { type: 'tool-call', toolCallId: part.toolCallId, toolName: part.toolName, args: part.args };
    } else if (part.type === 'tool-call-delta') {
      yield { type: 'tool-call-delta', toolCallId: part.toolCallId, text: part.argsTextDelta };
    } else if ((part as { type: string }).type === 'tool-result') {
      const r = part as unknown as { toolCallId: string; toolName: string; result: unknown; isError?: boolean };
      yield { type: 'tool-result', toolCallId: r.toolCallId, toolName: r.toolName, result: r.result, isError: r.isError };
    } else if (part.type === 'step-finish') {
      yield { type: 'step-finish', finishReason: part.finishReason };
    } else if (part.type === 'finish') {
      yield { type: 'finish', usage: part.usage };
    } else if (part.type === 'error') {
      yield { type: 'error', error: String(part.error) };
    }
  }
}
