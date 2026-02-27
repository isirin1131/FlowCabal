import { useState, useCallback, useEffect, createContext, useContext } from "react";
import type { Workspace, LlmConfigsFile, StateEvent } from "@flowcabal/engine";

export interface WorkspaceContextValue {
  ws: Workspace;
  rootDir: string;
  llmConfigs: LlmConfigsFile;
  revision: number;
}

export const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function useWorkspace(): WorkspaceContextValue {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}

export function useWorkspaceRevision(ws: Workspace): number {
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const unsub = ws.onChange((_event: StateEvent) => {
      setRevision((r: number) => r + 1);
    });
    return unsub;
  }, [ws]);

  return revision;
}
