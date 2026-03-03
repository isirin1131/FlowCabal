import { unlink } from "fs/promises";
import * as p from "@clack/prompts";
import type { TextBlock, NodeDef } from "@flowcabal/engine";

// ── 状态图标 ──

export const STATUS_ICON: Record<string, string> = {
  cached: "✓",
  stale: "~",
  pending: "○",
};

// ── 节点 ID 前缀匹配 ──

export function matchNode(nodes: NodeDef[], prefix: string): NodeDef {
  const matches = nodes.filter((n) => n.id.startsWith(prefix));
  if (matches.length === 0) {
    p.cancel(`没有找到匹配 "${prefix}" 的节点`);
    process.exit(1);
  }
  if (matches.length > 1) {
    p.cancel(`"${prefix}" 匹配多个节点，请提供更长的前缀`);
    process.exit(1);
  }
  return matches[0];
}

// ── Block 格式化 ──

export function formatBlock(block: TextBlock, nodes: NodeDef[]): string {
  switch (block.kind) {
    case "literal": {
      const preview = block.content.length > 80
        ? block.content.slice(0, 80) + "..."
        : block.content;
      return `[literal] ${preview}`;
    }
    case "ref": {
      const upstream = nodes.find((n) => n.id === block.nodeId);
      const label = upstream ? upstream.label : block.nodeId.slice(0, 8);
      return `[ref] → ${label} [${block.nodeId.slice(0, 8)}]`;
    }
    case "agent-inject":
      return `[agent-inject] ${block.hint}`;
  }
}

// ── 临时文件清理 ──

export async function cleanup(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}
