import { colors } from "../theme.js";

interface FileTreeProps {
  files: string[];
  currentFile: string | null;
  focused: boolean;
  onSelect: (path: string) => void;
}

export function FileTree(props: FileTreeProps) {
  const entries = buildFlatEntries(props.files);

  if (entries.length === 0) {
    return <text content="(空)" fg={colors.textDim} />;
  }

  const options = entries.map((entry) => ({
    name: entry.display,
    description: entry.isDir ? "目录" : "",
    value: entry.path,
  }));

  return (
    <select
      options={options}
      focused={props.focused}
      onChange={(_index, option) => {
        const path = option?.value as string | undefined;
        if (path) props.onSelect(path);
      }}
    />
  );
}

interface FlatEntry {
  path: string;
  display: string;
  isDir: boolean;
}

function buildFlatEntries(files: string[]): FlatEntry[] {
  const entries: FlatEntry[] = [];
  let lastDir = "";

  for (const file of files.sort()) {
    const parts = file.split("/");
    if (parts.length > 1) {
      const dir = parts.slice(0, -1).join("/");
      if (dir !== lastDir) {
        lastDir = dir;
      }
      entries.push({
        path: file,
        display: `  ${parts[parts.length - 1]}`,
        isDir: false,
      });
    } else {
      lastDir = "";
      entries.push({ path: file, display: `  ${file}`, isDir: false });
    }
  }

  return entries;
}
