import { useState, useCallback, useRef } from "react";
import type { CoreMessage } from "ai";
import { conversationalAgentEvents } from "@flowcabal/engine";
import { useWorkspace } from "./use-workspace.js";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ToolCallEntry {
  name: string;
  args: Record<string, unknown>;
  result?: unknown;
  status: "pending" | "done";
}

export function useAgentChat() {
  const { ws, rootDir, llmConfigs } = useWorkspace();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentChunk, setCurrentChunk] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (isStreaming) return;

      const userMsg: ChatMessage = { role: "user", content: text };
      setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
      setIsStreaming(true);
      setCurrentChunk("");
      setToolCalls([]);

      const controller = new AbortController();
      controllerRef.current = controller;

      const defaultConfig = llmConfigs["default"];
      if (!defaultConfig) {
        setMessages((prev: ChatMessage[]) => [
          ...prev,
          { role: "assistant" as const, content: "错误: 找不到 default LLM 配置" },
        ]);
        setIsStreaming(false);
        return;
      }

      const coreMessages: CoreMessage[] = [
        ...messages.map((m: ChatMessage) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
        { role: "user" as const, content: text },
      ];

      const runtimeCtx = ws.createRuntimeContext();

      try {
        const gen = conversationalAgentEvents(
          rootDir,
          defaultConfig,
          coreMessages,
          runtimeCtx,
          controller.signal,
        );

        let full = "";
        for await (const event of gen) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case "text":
              full += event.chunk;
              setCurrentChunk(full);
              break;
            case "tool-call":
              setToolCalls((prev: ToolCallEntry[]) => [
                ...prev,
                { name: event.name, args: event.args, status: "pending" as const },
              ]);
              break;
            case "tool-result":
              setToolCalls((prev: ToolCallEntry[]) =>
                prev.map((tc: ToolCallEntry) =>
                  tc.name === event.name && tc.status === "pending"
                    ? { ...tc, result: event.result, status: "done" as const }
                    : tc,
                ),
              );
              break;
          }
        }

        setMessages((prev: ChatMessage[]) => [
          ...prev,
          { role: "assistant" as const, content: full },
        ]);
      } catch (err) {
        if (!controller.signal.aborted) {
          setMessages((prev: ChatMessage[]) => [
            ...prev,
            {
              role: "assistant" as const,
              content: `错误: ${err instanceof Error ? err.message : String(err)}`,
            },
          ]);
        }
      } finally {
        setIsStreaming(false);
        setCurrentChunk("");
        controllerRef.current = null;
      }
    },
    [isStreaming, messages, ws, rootDir, llmConfigs],
  );

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    messages,
    toolCalls,
    isStreaming,
    currentChunk,
    send,
    abort,
  };
}
