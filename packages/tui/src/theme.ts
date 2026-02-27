import type { NodeStatus } from "@flowcabal/engine";

// ── 颜色常量 ──

export const colors = {
  // 主色调
  primary: "#7aa2f7",    // 蓝
  secondary: "#9ece6a",  // 绿
  accent: "#bb9af7",     // 紫

  // 状态色
  success: "#9ece6a",
  warning: "#e0af68",
  error: "#f7768e",
  info: "#7dcfff",

  // 文本色
  text: "#c0caf5",
  textDim: "#565f89",
  textBright: "#ffffff",

  // TextBlock 类型着色
  literal: "#c0caf5",
  ref: "#7aa2f7",
  agentInject: "#bb9af7",

  // 背景色
  bg: "#1a1b26",
  bgHighlight: "#292e42",
  bgSelected: "#33467c",

  // 边框
  border: "#3b4261",
  borderFocused: "#7aa2f7",
} as const;

// ── 节点状态图标 ──

export const statusIcon: Record<NodeStatus, string> = {
  cached: "●",
  stale: "◐",
  pending: "○",
};

export const statusColor: Record<NodeStatus, string> = {
  cached: colors.success,
  stale: colors.warning,
  pending: colors.textDim,
};

// ── 视图标签 ──

export type ViewId = "dashboard" | "node-detail" | "memory" | "agent-chat" | "todo-queue";

export const viewLabels: Record<ViewId, string> = {
  dashboard: "Dashboard",
  "node-detail": "Node",
  memory: "Memory",
  "agent-chat": "Chat",
  "todo-queue": "Queue",
};

export const viewKeys: ViewId[] = [
  "dashboard",
  "node-detail",
  "memory",
  "agent-chat",
  "todo-queue",
];
