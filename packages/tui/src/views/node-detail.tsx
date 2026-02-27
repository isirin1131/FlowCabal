import { useState, useCallback } from "react";
import { useWorkspace } from "../hooks/use-workspace.js";
import { useRun } from "../hooks/use-run.js";
import { TextBlockRenderer } from "../components/text-block-renderer.js";
import { VersionList } from "../components/version-list.js";
import { StreamingOutput } from "../components/streaming-output.js";
import { colors } from "../theme.js";

interface NodeDetailViewProps {
  nodeId: string | null;
  sidebarFocused: boolean;
  mainFocused: boolean;
}

export function NodeDetailView(props: NodeDetailViewProps) {
  const { ws } = useWorkspace();
  const run = useRun();
  const nodes = ws.getNodes();

  const [selectedId] = useState<string | null>(
    props.nodeId ?? (nodes.length > 0 ? nodes[0].id : null),
  );

  const nodeId = selectedId;
  const node = nodeId ? nodes.find((n) => n.id === nodeId) : null;

  const versions = nodeId ? ws.getVersions(nodeId) : [];
  const currentVersion = nodeId ? ws.getCurrentVersion(nodeId) : null;
  const preview = nodeId ? ws.previewNode(nodeId) : null;
  const status = nodeId ? ws.getNodeStatus(nodeId) : "pending";

  const streamingChunk = nodeId ? run.streamingChunks.get(nodeId) : undefined;
  const isStreaming = nodeId ? run.activeNodes.has(nodeId) : false;

  const handlePickVersion = useCallback(
    async (versionId: string) => {
      if (!nodeId) return;
      await ws.pickVersion(nodeId, versionId);
    },
    [ws, nodeId],
  );

  if (!node) {
    return (
      <box flexGrow={1} justifyContent="center" alignItems="center">
        <text content="选择一个节点查看详情" fg={colors.textDim} />
      </box>
    );
  }

  return (
    <>
      {/* Sidebar: Version List */}
      <box
        width="30%"
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Versions"
        borderColor={props.sidebarFocused ? colors.borderFocused : colors.border}
      >
        {versions.length > 0 ? (
          <VersionList
            versions={versions}
            currentId={currentVersion?.id ?? null}
            focused={props.sidebarFocused}
            onSelect={handlePickVersion}
          />
        ) : (
          <text content="暂无版本" fg={colors.textDim} />
        )}
      </box>

      {/* Main: Node Detail */}
      <box
        flexGrow={1}
        flexDirection="column"
        border={true}
        borderStyle="single"
        title={`${node.label} [${status}]`}
        borderColor={props.mainFocused ? colors.borderFocused : colors.border}
      >
        <scrollbox focused={props.mainFocused}>
          <box flexDirection="column" padding={1} gap={1}>
            {/* System Prompt */}
            {node.systemPrompt.length > 0 && (
              <box flexDirection="column">
                <text content="[System Prompt]" fg={colors.accent}>
                  <b>{"[System Prompt]"}</b>
                </text>
                <TextBlockRenderer blocks={node.systemPrompt} />
              </box>
            )}

            {/* User Prompt */}
            {node.userPrompt.length > 0 && (
              <box flexDirection="column">
                <text content="[User Prompt]" fg={colors.accent}>
                  <b>{"[User Prompt]"}</b>
                </text>
                <TextBlockRenderer blocks={node.userPrompt} />
              </box>
            )}

            {/* Unresolved refs */}
            {preview && preview.unresolvedRefs.length > 0 && (
              <text
                content={`⚠ 未解析的引用: ${preview.unresolvedRefs.join(", ")}`}
                fg={colors.warning}
              />
            )}

            {/* Separator */}
            <text content="─── Output ───" fg={colors.border} />

            {/* Output */}
            {isStreaming || streamingChunk ? (
              <StreamingOutput
                content={streamingChunk ?? ""}
                streaming={isStreaming}
              />
            ) : currentVersion ? (
              <StreamingOutput content={currentVersion.output} />
            ) : (
              <text content="(尚未生成)" fg={colors.textDim} />
            )}

            {/* Trace info */}
            {currentVersion?.trace && (
              <box flexDirection="column">
                <text content="─── Trace ───" fg={colors.border} />
                <text
                  content={`Model: ${currentVersion.trace.model} | In: ${currentVersion.trace.inputTokens} | Out: ${currentVersion.trace.outputTokens} | ${(currentVersion.trace.durationMs / 1000).toFixed(1)}s`}
                  fg={colors.textDim}
                />
              </box>
            )}
          </box>
        </scrollbox>
      </box>
    </>
  );
}
