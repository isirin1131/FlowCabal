import { useWorkspace } from "../hooks/use-workspace.js";
import { useRun } from "../hooks/use-run.js";
import { statusIcon, statusColor, colors } from "../theme.js";
import { ProgressBar } from "../components/progress-bar.js";
import { topoLevels } from "@flowcabal/engine";

interface TodoQueueViewProps {
  sidebarFocused: boolean;
  mainFocused: boolean;
}

export function TodoQueueView(props: TodoQueueViewProps) {
  const { ws } = useWorkspace();
  const run = useRun();

  const targets = ws.getTargets();
  const nodes = ws.getNodes();
  const subgraph = ws.getSubgraph();
  const subNodes = nodes.filter((n) => subgraph.includes(n.id));
  const levels = topoLevels(subNodes);
  const estimate = ws.estimateCost();

  // Sidebar: targets
  const targetOptions = targets.map((id) => {
    const node = nodes.find((n) => n.id === id);
    return {
      name: `★ ${node?.label ?? id}`,
      description: "target",
      value: id,
    };
  });

  const subgraphNonTarget = subgraph.filter((id) => !targets.includes(id));

  return (
    <>
      {/* Sidebar: Targets */}
      <box
        width="40%"
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Targets"
        borderColor={props.sidebarFocused ? colors.borderFocused : colors.border}
      >
        {targetOptions.length > 0 ? (
          <select
            options={targetOptions}
            focused={props.sidebarFocused}
            onChange={() => {}}
          />
        ) : (
          <text content="(无 targets)" fg={colors.textDim} />
        )}
        {subgraphNonTarget.length > 0 && (
          <box flexDirection="column">
            <box height={1} />
            <text content="Subgraph:" fg={colors.textDim} />
            {subgraphNonTarget.map((id) => {
              const node = nodes.find((n) => n.id === id);
              return (
                <text
                  key={id}
                  content={`  ${node?.label ?? id}`}
                  fg={colors.textDim}
                />
              );
            })}
          </box>
        )}
      </box>

      {/* Main: Execution Queue */}
      <box
        flexGrow={1}
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Execution Queue"
        borderColor={props.mainFocused ? colors.borderFocused : colors.border}
      >
        <scrollbox focused={props.mainFocused}>
          <box flexDirection="column" padding={1}>
            {levels.map((levelIds, levelIdx) => (
              <box key={`level-${levelIdx}`} flexDirection="column">
                <text
                  content={`Level ${levelIdx} ${"─".repeat(20)}`}
                  fg={colors.textDim}
                />
                {levelIds.map((nodeId) => {
                  const node = nodes.find((n) => n.id === nodeId);
                  const status = ws.getNodeStatus(nodeId);
                  const isActive = run.activeNodes.has(nodeId);
                  const icon = isActive ? "◌" : statusIcon[status];
                  const fg = isActive ? colors.info : statusColor[status];
                  const statusLabel = isActive
                    ? "generating..."
                    : status === "cached"
                      ? "[cached]"
                      : status === "stale"
                        ? "[stale]"
                        : "[pending]";

                  return (
                    <box key={nodeId} flexDirection="row">
                      <text content="├─ " fg={colors.border} />
                      <text content={`${icon} `} fg={fg} />
                      <text content={node?.label ?? nodeId} fg={colors.text} />
                      <text content={` ${statusLabel}`} fg={colors.textDim} />
                    </box>
                  );
                })}
              </box>
            ))}
            <box height={1} />
            <text
              content={`Est: ~${formatTokens(estimate.inputTokens)} in / ~${formatTokens(estimate.outputTokens)} out`}
              fg={colors.textDim}
            />
            {run.plan && (
              <ProgressBar
                current={run.plan.cachedNodes + (run.summary?.generatedNodes ?? 0)}
                total={run.plan.totalNodes}
              />
            )}
            {run.summary && (
              <text
                content={`完成: ${run.summary.generatedNodes} generated, ${run.summary.cachedNodes} cached, ${run.summary.errorNodes} errors (${(run.summary.durationMs / 1000).toFixed(1)}s)`}
                fg={run.summary.errorNodes > 0 ? colors.error : colors.success}
              />
            )}
            {run.error && (
              <text content={`错误: ${run.error}`} fg={colors.error} />
            )}
          </box>
        </scrollbox>
      </box>
    </>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
