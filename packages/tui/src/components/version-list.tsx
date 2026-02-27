import type { NodeVersion } from "@flowcabal/engine";
import { colors } from "../theme.js";

interface VersionListProps {
  versions: NodeVersion[];
  currentId: string | null;
  focused: boolean;
  onSelect: (versionId: string) => void;
}

export function VersionList(props: VersionListProps) {
  const options = props.versions.map((v) => {
    const isCurrent = v.id === props.currentId;
    const sourceLabel =
      v.source.kind === "generated"
        ? "gen"
        : v.source.kind === "human-edit"
          ? "edit"
          : "chat";
    return {
      name: `${isCurrent ? "▸ " : "  "}v${v.id.slice(0, 6)} ${sourceLabel}${isCurrent ? " current" : ""}`,
      description: v.createdAt.slice(0, 10),
      value: v.id,
    };
  });

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
