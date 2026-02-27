import { useState, useCallback } from "react";
import { useAgentChat, type ToolCallEntry, type ChatMessage } from "../hooks/use-agent-chat.js";
import { colors } from "../theme.js";

interface AgentChatViewProps {
  sidebarFocused: boolean;
  mainFocused: boolean;
  inputFocused: boolean;
  onFocusInput: () => void;
}

export function AgentChatView(props: AgentChatViewProps) {
  const chat = useAgentChat();

  const handleSubmit = useCallback(
    (value: string | unknown) => {
      if (typeof value !== "string") return;
      const trimmed = value.trim();
      if (!trimmed) return;
      chat.send(trimmed);
    },
    [chat],
  );

  // Sidebar: Tool Calls
  const toolOptions = chat.toolCalls.map((tc: ToolCallEntry, i: number) => ({
    name: `${tc.status === "done" ? "✓" : "◐"} ${tc.name}`,
    description: tc.status === "done" ? "完成" : "执行中...",
    value: String(i),
  }));

  return (
    <>
      {/* Sidebar: Tool Call Log */}
      <box
        width="30%"
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Tools"
        borderColor={props.sidebarFocused ? colors.borderFocused : colors.border}
      >
        {toolOptions.length > 0 ? (
          <select
            options={toolOptions}
            focused={props.sidebarFocused}
            onChange={() => {}}
          />
        ) : (
          <text content="(暂无 tool calls)" fg={colors.textDim} />
        )}
      </box>

      {/* Main: Chat Messages + Input */}
      <box
        flexGrow={1}
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Agent Chat"
        borderColor={
          props.mainFocused || props.inputFocused
            ? colors.borderFocused
            : colors.border
        }
      >
        {/* Message History */}
        <scrollbox flexGrow={1} focused={props.mainFocused}>
          <box flexDirection="column" padding={1} gap={1}>
            {chat.messages.map((msg: ChatMessage, i: number) => (
              <box key={`msg-${i}`} flexDirection="column">
                <text fg={msg.role === "user" ? colors.info : colors.accent}>
                  <b>{msg.role === "user" ? "You:" : "Agent:"}</b>
                </text>
                <text content={msg.content} fg={colors.text} />
              </box>
            ))}
            {chat.isStreaming && chat.currentChunk && (
              <box flexDirection="column">
                <text fg={colors.accent}>
                  <b>{"Agent:"}</b>
                </text>
                <text content={chat.currentChunk} fg={colors.text} />
                <text content="▍" fg={colors.primary} />
              </box>
            )}
            {chat.messages.length === 0 && !chat.isStreaming && (
              <text content="输入消息开始对话..." fg={colors.textDim} />
            )}
          </box>
        </scrollbox>

        {/* Input Area */}
        <box height={1} width="100%" backgroundColor={colors.bgHighlight}>
          <text content=" > " fg={colors.primary} />
          <input
            placeholder="输入消息..."
            focused={props.inputFocused}
            onSubmit={handleSubmit}
          />
        </box>
      </box>
    </>
  );
}
