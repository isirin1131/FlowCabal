import { generateText, streamText, type CoreMessage } from "ai";
import type { LlmConfig, RuntimeContext } from "../types.js";
import { getProvider } from "../llm/provider.js";
import { createTools } from "./tools.js";
import { SYSTEM_PROMPT_ANALYZE, SYSTEM_PROMPT_CHAT } from "./prompts.js";
import { loadL0 } from "./assembler.js";

// ── Shared setup ──

interface AgentOptions {
  rootDir: string;
  llmConfig: LlmConfig;
  systemPrompt?: string;
  runtimeCtx?: RuntimeContext;
  maxSteps?: number;
  abortSignal?: AbortSignal;
}

async function prepareAgent(opts: AgentOptions) {
  const provider = getProvider(opts.llmConfig);
  const tools = createTools(opts.rootDir, opts.runtimeCtx);
  const l0 = await loadL0(opts.rootDir);

  const base = opts.systemPrompt ?? SYSTEM_PROMPT_ANALYZE;
  const system = l0 ? `${base}\n\n当前索引:\n${l0}` : base;

  return {
    model: provider(opts.llmConfig.model),
    system,
    tools,
    maxSteps: opts.maxSteps ?? 20,
    abortSignal: opts.abortSignal,
  };
}

// ── Public API ──

/**
 * Run agent for a single task (e.g., analyze a chapter).
 * Agent loops until it stops calling tools.
 */
export async function runAgent(
  rootDir: string,
  llmConfig: LlmConfig,
  userMessage: string,
  systemPrompt?: string,
  runtimeCtx?: RuntimeContext,
  abortSignal?: AbortSignal,
): Promise<string> {
  const prepared = await prepareAgent({
    rootDir, llmConfig, systemPrompt, runtimeCtx, abortSignal,
  });

  const result = await generateText({
    ...prepared,
    prompt: userMessage,
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
  messages: CoreMessage[],
  runtimeCtx?: RuntimeContext,
  abortSignal?: AbortSignal,
): AsyncGenerator<string, string> {
  const prepared = await prepareAgent({
    rootDir, llmConfig,
    systemPrompt: SYSTEM_PROMPT_CHAT,
    runtimeCtx, abortSignal,
  });

  const result = streamText({
    ...prepared,
    messages,
  });

  let full = "";
  for await (const chunk of result.textStream) {
    full += chunk;
    yield chunk;
  }
  return full;
}

// ── Structured Agent Events (for TUI) ──

export type AgentEvent =
  | { type: "text"; chunk: string }
  | { type: "tool-call"; name: string; args: Record<string, unknown> }
  | { type: "tool-result"; name: string; result: unknown };

/**
 * Conversational agent with structured events — yields AgentEvent
 * for text chunks, tool calls, and tool results.
 */
export async function* conversationalAgentEvents(
  rootDir: string,
  llmConfig: LlmConfig,
  messages: CoreMessage[],
  runtimeCtx?: RuntimeContext,
  abortSignal?: AbortSignal,
): AsyncGenerator<AgentEvent, string> {
  const prepared = await prepareAgent({
    rootDir, llmConfig,
    systemPrompt: SYSTEM_PROMPT_CHAT,
    runtimeCtx, abortSignal,
  });

  const result = streamText({
    ...prepared,
    messages,
  });

  let full = "";
  for await (const part of result.fullStream) {
    switch (part.type) {
      case "text-delta":
        full += part.textDelta;
        yield { type: "text", chunk: part.textDelta };
        break;
      case "tool-call":
        yield {
          type: "tool-call",
          name: part.toolName,
          args: part.args as Record<string, unknown>,
        };
        break;
      case "tool-result":
        yield {
          type: "tool-result",
          name: part.toolName,
          result: part.result,
        };
        break;
    }
  }
  return full;
}
