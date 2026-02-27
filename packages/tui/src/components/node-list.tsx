import type { NodeStatus } from "@flowcabal/engine";
import { statusIcon, statusColor, colors } from "../theme.js";

interface NodeListItem {
  id: string;
  label: string;
  status: NodeStatus;
  isTarget: boolean;
}

interface NodeListProps {
  nodes: NodeListItem[];
  focused: boolean;
  onSelect: (nodeId: string) => void;
}

export function NodeList(props: NodeListProps) {
  const options = props.nodes.map((node) => ({
    name: `${statusIcon[node.status]} ${node.isTarget ? "★ " : "  "}${node.label}`,
    description: `[${node.status}]`,
    value: node.id,
  }));

  return (
    <select
      options={options}
      focused={props.focused}
      onChange={(_index, option) => {
        if (option?.value) props.onSelect(option.value as string);
      }}
    />
  );
}
