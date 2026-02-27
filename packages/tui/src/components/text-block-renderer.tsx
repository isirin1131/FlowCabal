import type { TextBlock } from "@flowcabal/engine";
import { colors } from "../theme.js";

interface TextBlockRendererProps {
  blocks: TextBlock[];
  outputs?: Map<string, string>;
}

export function TextBlockRenderer(props: TextBlockRendererProps) {
  return (
    <box flexDirection="column">
      {props.blocks.map((block, i) => {
        switch (block.kind) {
          case "literal":
            return (
              <text
                key={`lit-${i}`}
                content={block.content}
                fg={colors.literal}
              />
            );
          case "ref": {
            const output = props.outputs?.get(block.nodeId);
            const preview = output
              ? output.slice(0, 100) + (output.length > 100 ? "..." : "")
              : "待生成";
            return (
              <box key={`ref-${i}`} flexDirection="column">
                <text content={`[ref: ${block.nodeId}]`} fg={colors.ref}>
                  <b>{`[ref: ${block.nodeId}]`}</b>
                </text>
                <text content={`  → ${preview}`} fg={colors.textDim} />
              </box>
            );
          }
          case "agent-inject":
            return (
              <box key={`inject-${i}`} flexDirection="column">
                <text content={`[agent-inject: ${block.hint}]`} fg={colors.agentInject}>
                  <b>{`[agent-inject: ${block.hint}]`}</b>
                </text>
                <text
                  content="  → Agent 将根据 memory 注入上下文"
                  fg={colors.textDim}
                />
              </box>
            );
        }
      })}
    </box>
  );
}
