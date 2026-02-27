import { createHash } from "crypto";
import type { TextBlock } from "../types.js";

/**
 * Resolve TextBlock array into a single string,
 * substituting refs with upstream node outputs.
 *
 * @param outputs nodeId → 输出文本
 */
export function resolveBlocks(
  blocks: TextBlock[],
  outputs: Map<string, string>,
): string {
  return blocks
    .map((block) => {
      if (block.kind === "literal") return block.content;
      if (block.kind === "ref") {
        const upstream = outputs.get(block.nodeId);
        if (upstream === undefined) {
          throw new Error(`Missing output for referenced node: ${block.nodeId}`);
        }
        return upstream;
      }
      // agent-inject: placeholder, core-runner 负责替换
      return `[AGENT-INJECT: ${block.hint}]`;
    })
    .join("");
}

/**
 * Resolve TextBlock array with full agent-inject substitution.
 *
 * @param outputs nodeId → 输出文本
 * @param agentInjects hint → 注入内容
 */
export function resolveBlocksFull(
  blocks: TextBlock[],
  outputs: Map<string, string>,
  agentInjects: Map<string, string>,
): string {
  return blocks
    .map((block) => {
      if (block.kind === "literal") return block.content;
      if (block.kind === "ref") {
        const upstream = outputs.get(block.nodeId);
        if (upstream === undefined) {
          throw new Error(`Missing output for referenced node: ${block.nodeId}`);
        }
        return upstream;
      }
      // agent-inject: 从 agentInjects map 取值
      const injected = agentInjects.get(block.hint);
      if (injected === undefined) {
        throw new Error(`Missing agent-inject for hint: ${block.hint}`);
      }
      return injected;
    })
    .join("");
}

/**
 * Compute structural prompt hash from resolved system + user text.
 * agent-inject blocks are already replaced by placeholder in resolveBlocks.
 */
export function computePromptHash(system: string, user: string): string {
  return createHash("sha256")
    .update(system + "\n---\n" + user)
    .digest("hex");
}
