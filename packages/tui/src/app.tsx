import { useState, useCallback } from "react";
import { createCliRenderer, type CliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { openWorkspace } from "@flowcabal/engine";
import type { Workspace, LlmConfigsFile } from "@flowcabal/engine";

import { findProjectRoot, loadLlmConfigs, loadConfig, listWorkspaces } from "./config.js";
import {
  WorkspaceContext,
  useWorkspaceRevision,
  type WorkspaceContextValue,
} from "./hooks/use-workspace.js";
import { useFocus } from "./hooks/use-focus.js";
import { useKeybindings } from "./hooks/use-keybindings.js";
import { type ViewId, viewKeys, viewLabels, colors } from "./theme.js";
import { StatusBar } from "./components/status-bar.js";
import { DashboardView } from "./views/dashboard.js";
import { NodeDetailView } from "./views/node-detail.js";
import { MemoryBrowserView } from "./views/memory-browser.js";
import { AgentChatView } from "./views/agent-chat.js";
import { TodoQueueView } from "./views/todo-queue.js";
import { CommandInput } from "./components/command-input.js";

// ── App Root ──

interface AppProps {
  ws: Workspace;
  rootDir: string;
  projectName: string;
  llmConfigs: LlmConfigsFile;
  renderer: CliRenderer;
}

function App(props: AppProps) {
  const { ws, rootDir, projectName, llmConfigs, renderer } = props;
  const revision = useWorkspaceRevision(ws);
  const [activeView, setActiveView] = useState<ViewId>("dashboard");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const focus = useFocus("sidebar");

  const ctxValue: WorkspaceContextValue = {
    ws,
    rootDir,
    llmConfigs,
    revision,
  };

  const handleQuit = useCallback(() => {
    renderer.destroy();
    process.exit(0);
  }, [renderer]);

  const handleCommand = useCallback(
    (cmd: string) => {
      const trimmed = cmd.trim();
      if (trimmed === "q" || trimmed === "quit") {
        handleQuit();
        return;
      }
      focus.goBack();
    },
    [handleQuit, focus],
  );

  const handleSelectNode = useCallback(
    (nodeId: string) => {
      setSelectedNodeId(nodeId);
      setActiveView("node-detail");
    },
    [],
  );

  useKeybindings({
    activeView,
    setActiveView,
    focusCurrent: focus.current,
    focusSidebar: focus.focusSidebar,
    focusMain: focus.focusMain,
    focusCommand: focus.focusCommand,
    goBack: focus.goBack,
    onQuit: handleQuit,
  });

  const dashboard = ws.getDashboard();

  return (
    <WorkspaceContext.Provider value={ctxValue}>
      <box flexDirection="column" width="100%" height="100%">
        {/* Tab Bar */}
        <box height={1} width="100%" flexDirection="row" backgroundColor={colors.bg}>
          {viewKeys.map((key, i) => {
            const isActive = activeView === key;
            const label = ` ${i + 1}:${viewLabels[key]} `;
            return isActive ? (
              <text key={key} fg={colors.primary}>
                <b>{label}</b>
              </text>
            ) : (
              <text key={key} content={label} fg={colors.textDim} />
            );
          })}
          <box flexGrow={1} />
        </box>

        {/* Main Content */}
        <box flexDirection="row" flexGrow={1}>
          {activeView === "dashboard" && (
            <DashboardView
              sidebarFocused={focus.current === "sidebar"}
              mainFocused={focus.current === "main"}
              onSelectNode={handleSelectNode}
            />
          )}
          {activeView === "node-detail" && (
            <NodeDetailView
              nodeId={selectedNodeId}
              sidebarFocused={focus.current === "sidebar"}
              mainFocused={focus.current === "main"}
            />
          )}
          {activeView === "memory" && (
            <MemoryBrowserView
              sidebarFocused={focus.current === "sidebar"}
              mainFocused={focus.current === "main"}
            />
          )}
          {activeView === "agent-chat" && (
            <AgentChatView
              sidebarFocused={focus.current === "sidebar"}
              mainFocused={focus.current === "main"}
              inputFocused={focus.current === "input"}
              onFocusInput={focus.focusInput}
            />
          )}
          {activeView === "todo-queue" && (
            <TodoQueueView
              sidebarFocused={focus.current === "sidebar"}
              mainFocused={focus.current === "main"}
            />
          )}
        </box>

        {/* Command Input Overlay */}
        {focus.current === "command" && (
          <CommandInput onSubmit={handleCommand} onCancel={focus.goBack} />
        )}

        {/* Status Bar */}
        <StatusBar
          activeView={activeView}
          projectName={projectName}
          workspaceId={ws.workspaceId}
          nodeCount={dashboard.nodes.length}
          focusTarget={focus.current}
        />
      </box>
    </WorkspaceContext.Provider>
  );
}

// ── Launch TUI ──

export async function launchTui(workspaceId?: string): Promise<void> {
  // 1. Find project root
  const rootDir = findProjectRoot();
  if (!rootDir) {
    console.error("找不到 flowcabal.json，请先运行 flowcabal init");
    process.exit(1);
  }

  // 2. Load config
  const projectConfig = await loadConfig(rootDir);
  const llmConfigs = await loadLlmConfigs();

  // 3. Resolve workspace
  let wsId = workspaceId;
  if (!wsId) {
    const workspaces = await listWorkspaces(rootDir);
    if (workspaces.length === 0) {
      console.error("没有 workspace。请先创建 workflow 并实例化 workspace。");
      process.exit(1);
    } else if (workspaces.length === 1) {
      wsId = workspaces[0].id;
    } else {
      console.log(`发现 ${workspaces.length} 个 workspace，使用第一个: ${workspaces[0].id}`);
      wsId = workspaces[0].id;
    }
  }

  // 4. Open workspace
  const ws = await openWorkspace(rootDir, wsId, llmConfigs);

  // 5. Create renderer
  const renderer = await createCliRenderer({
    exitOnCtrlC: false,
    useAlternateScreen: true,
  });

  // 6. Render
  const root = createRoot(renderer);
  root.render(
    <App
      ws={ws}
      rootDir={rootDir}
      projectName={projectConfig.name}
      llmConfigs={llmConfigs}
      renderer={renderer}
    />,
  );
}
