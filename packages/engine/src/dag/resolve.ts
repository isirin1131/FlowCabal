import type { TextBlock, NodeOutput } from "../types.js";

/**
 * Resolve TextBlock array into a single string,
 * substituting refs with upstream node outputs.
 */
export function resolveBlocks(
  blocks: TextBlock[],
  outputs: Map<string, NodeOutput>
): string {
  return blocks
    .map((block) => {
      if (block.kind === "literal") return block.content;
      const upstream = outputs.get(block.nodeId);
      if (!upstream) {
        throw new Error(`Missing output for referenced node: ${block.nodeId}`);
      }
      return upstream.text;
    })
    .join("");
}
