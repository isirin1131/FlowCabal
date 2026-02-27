import { useState, useCallback } from "react";
import { useWorkspace } from "../hooks/use-workspace.js";
import { statusIcon, statusColor, colors } from "../theme.js";
import { ProgressBar } from "../components/progress-bar.js";

interface DashboardViewProps {
  sidebarFocused: boolean;
  mainFocused: boolean;
  onSelectNode: (nodeId: string) => void;
}

export function DashboardView(props: DashboardViewProps) {
  const { ws } = useWorkspace();
  const dashboard = ws.getDashboard();
  const targets = new Set(dashboard.targets);
  const estimate = ws.estimateCost();

  const cachedCount = dashboard.nodes.filter((n) => n.status === "cached").length;
  const staleCount = dashboard.nodes.filter((n) => n.status === "stale").length;
  const pendingCount = dashboard.nodes.filter((n) => n.status === "pending").length;

  const options = dashboard.nodes.map((node) => ({
    name: `${statusIcon[node.status]} ${targets.has(node.id) ? "★ " : "  "}${node.label}`,
    description: `[${node.status}]`,
    value: node.id,
  }));

  return (
    <>
      {/* Sidebar: Node List */}
      <box
        width="40%"
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Nodes"
        borderColor={props.sidebarFocused ? colors.borderFocused : colors.border}
      >
        <select
          options={options}
          focused={props.sidebarFocused}
          onChange={(_index, option) => {
            if (option?.value) props.onSelectNode(option.value as string);
          }}
        />
      </box>

      {/* Main: Overview */}
      <box
        flexGrow={1}
        flexDirection="column"
        border={true}
        borderStyle="single"
        title="Overview"
        padding={1}
        borderColor={props.mainFocused ? colors.borderFocused : colors.border}
      >
        <text
          content={`Workspace: ${ws.workspaceId.slice(0, 12)}`}
          fg={colors.text}
        />
        <text
          content={`Targets: ${dashboard.targets.length} / Subgraph: ${dashboard.subgraph.length}`}
          fg={colors.text}
        />
        <text
          content={`Est: ~${formatTokens(estimate.inputTokens)} in / ~${formatTokens(estimate.outputTokens)} out`}
          fg={colors.textDim}
        />
        <box height={1} />
        <box flexDirection="row" gap={2}>
          <text content={`● ${cachedCount} cached`} fg={statusColor.cached} />
          <text content={`◐ ${staleCount} stale`} fg={statusColor.stale} />
          <text content={`○ ${pendingCount} pending`} fg={statusColor.pending} />
        </box>
        <box height={1} />
        <ProgressBar current={cachedCount} total={dashboard.nodes.length} />
      </box>
    </>
  );
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}
