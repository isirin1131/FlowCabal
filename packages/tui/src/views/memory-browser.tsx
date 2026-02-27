import { useState, useCallback, useRef } from "react";
import { useMemory } from "../hooks/use-memory.js";
import { FileTree } from "../components/file-tree.js";
import { colors } from "../theme.js";

interface MemoryBrowserViewProps {
  sidebarFocused: boolean;
  mainFocused: boolean;
}

export function MemoryBrowserView(props: MemoryBrowserViewProps) {
  const memory = useMemory();
  const [editBuffer, setEditBuffer] = useState("");

  const handleSelectFile = useCallback(
    (path: string) => {
      memory.openFile(path);
    },
    [memory],
  );

  return (
    <>
      {/* Sidebar: File Tree */}
      <box
        width="35%"
        flexDirection="column"
        border={true}
        borderStyle="single"
        title={`Memory (${memory.files.length})`}
        borderColor={props.sidebarFocused ? colors.borderFocused : colors.border}
      >
        <FileTree
          files={memory.files}
          currentFile={memory.currentFile}
          focused={props.sidebarFocused}
          onSelect={handleSelectFile}
        />
      </box>

      {/* Main: File Content */}
      <box
        flexGrow={1}
        flexDirection="column"
        border={true}
        borderStyle="single"
        title={memory.currentFile ?? "选择文件"}
        borderColor={props.mainFocused ? colors.borderFocused : colors.border}
      >
        {memory.isLoading ? (
          <text content="加载中..." fg={colors.textDim} />
        ) : !memory.currentFile ? (
          <box padding={1}>
            <text content="← 选择一个文件查看" fg={colors.textDim} />
          </box>
        ) : memory.isEditing ? (
          <box flexDirection="column" flexGrow={1}>
            <textarea
              initialValue={memory.currentContent}
              focused={props.mainFocused}
            />
            <box height={1} flexDirection="row">
              <text content=" Ctrl+S:保存 Esc:取消 " fg={colors.textDim} />
            </box>
          </box>
        ) : (
          <scrollbox focused={props.mainFocused}>
            <box padding={1}>
              <text content={memory.currentContent || "(空文件)"} fg={colors.text} />
            </box>
          </scrollbox>
        )}
      </box>
    </>
  );
}
