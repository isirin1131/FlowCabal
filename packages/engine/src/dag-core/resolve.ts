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
