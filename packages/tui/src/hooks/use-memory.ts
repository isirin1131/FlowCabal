import { useState, useEffect, useCallback } from "react";
import {
  listMemoryFiles,
  readMemoryFile,
  writeMemoryFile,
  deleteMemoryFile,
  generateMemoryIndex,
} from "@flowcabal/engine";
import { useWorkspace } from "./use-workspace.js";

export interface MemoryState {
  files: string[];
  currentFile: string | null;
  currentContent: string;
  isLoading: boolean;
  isEditing: boolean;
}

export function useMemory() {
  const { rootDir } = useWorkspace();
  const [state, setState] = useState<MemoryState>({
    files: [],
    currentFile: null,
    currentContent: "",
    isLoading: false,
    isEditing: false,
  });

  const refresh = useCallback(async () => {
    setState((s: MemoryState) => ({ ...s, isLoading: true }));
    const files = await listMemoryFiles(rootDir);
    setState((s: MemoryState) => ({ ...s, files, isLoading: false }));
  }, [rootDir]);

  const openFile = useCallback(
    async (path: string) => {
      setState((s: MemoryState) => ({ ...s, isLoading: true }));
      const entry = await readMemoryFile(rootDir, path);
      setState((s: MemoryState) => ({
        ...s,
        currentFile: path,
        currentContent: entry?.content ?? "",
        isLoading: false,
        isEditing: false,
      }));
    },
    [rootDir],
  );

  const saveFile = useCallback(
    async (path: string, content: string) => {
      await writeMemoryFile(rootDir, path, content);
      setState((s: MemoryState) => ({
        ...s,
        currentContent: content,
        isEditing: false,
      }));
      await refresh();
    },
    [rootDir, refresh],
  );

  const removeFile = useCallback(
    async (path: string) => {
      await deleteMemoryFile(rootDir, path);
      setState((s: MemoryState) => ({
        ...s,
        currentFile: null,
        currentContent: "",
      }));
      await refresh();
    },
    [rootDir, refresh],
  );

  const reindex = useCallback(async () => {
    setState((s: MemoryState) => ({ ...s, isLoading: true }));
    await generateMemoryIndex(rootDir);
    setState((s: MemoryState) => ({ ...s, isLoading: false }));
    await refresh();
  }, [rootDir, refresh]);

  const startEditing = useCallback(() => {
    setState((s: MemoryState) => ({ ...s, isEditing: true }));
  }, []);

  const cancelEditing = useCallback(() => {
    setState((s: MemoryState) => ({ ...s, isEditing: false }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    refresh,
    openFile,
    saveFile,
    removeFile,
    reindex,
    startEditing,
    cancelEditing,
  };
}
