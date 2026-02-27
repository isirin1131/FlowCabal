import type { ViewId } from "../theme.js";
import { viewLabels, colors } from "../theme.js";
import type { FocusTarget } from "../hooks/use-focus.js";

interface StatusBarProps {
  activeView: ViewId;
  projectName: string;
  workspaceId: string;
  nodeCount: number;
  focusTarget: FocusTarget;
  runStatus?: string;
}

const modeLabels: Record<FocusTarget, string> = {
  sidebar: "NORMAL",
  main: "NORMAL",
  command: "COMMAND",
  input: "INSERT",
};

export function StatusBar(props: StatusBarProps) {
  const mode = modeLabels[props.focusTarget];
  const viewLabel = viewLabels[props.activeView].toUpperCase();
  const wsShort = props.workspaceId.slice(0, 8);
  const hints = getViewHints(props.activeView);

  return (
    <box
      height={1}
      width="100%"
      flexDirection="row"
      backgroundColor={colors.bgHighlight}
    >
      <text content={` ${mode} `} fg={colors.bg} bg={colors.primary} />
      <text content="│" fg={colors.border} />
      <text content={viewLabel} fg={colors.accent} />
      <text content="│" fg={colors.border} />
      <text content={props.projectName} fg={colors.text} />
      <text content="│" fg={colors.border} />
      <text content={wsShort} fg={colors.textDim} />
      <text content="│" fg={colors.border} />
      <text content={`${props.nodeCount} nodes`} fg={colors.textDim} />
      {props.runStatus ? (
        <>
          <text content="│" fg={colors.border} />
          <text content={props.runStatus} fg={colors.warning} />
        </>
      ) : null}
      <box flexGrow={1} />
      <text content={hints} fg={colors.textDim} />
    </box>
  );
}

function getViewHints(view: ViewId): string {
  switch (view) {
    case "dashboard":
      return " Space:target r:run s:step ";
    case "node-detail":
      return " Enter:switch e:edit ";
    case "memory":
      return " e:edit n:new d:del i:index ";
    case "agent-chat":
      return " Enter:send ";
    case "todo-queue":
      return " r:run s:step ";
  }
}
