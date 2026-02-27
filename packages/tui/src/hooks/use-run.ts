import { useState, useCallback, useRef, useEffect } from "react";
import type {
  RunHandle,
  RunEvent,
  RunSummary,
  ExecutionPlan,
  RunMode,
} from "@flowcabal/engine";
import { useWorkspace } from "./use-workspace.js";

export type RunStatus = "idle" | "running" | "paused" | "done" | "error" | "aborted";

export interface RunState {
  status: RunStatus;
  plan: ExecutionPlan | null;
  activeNodes: Set<string>;
  streamingChunks: Map<string, string>;
  summary: RunSummary | null;
  error: string | null;
  currentLevel: number;
}

export function useRun() {
  const { ws } = useWorkspace();
  const handleRef = useRef<RunHandle | null>(null);
  const controllerRef = useRef<AbortController | null>(null);

  const [state, setState] = useState<RunState>({
    status: "idle",
    plan: null,
    activeNodes: new Set(),
    streamingChunks: new Map(),
    summary: null,
    error: null,
    currentLevel: 0,
  });

  const processEvent = useCallback((event: RunEvent) => {
    setState((prev: RunState) => {
      switch (event.type) {
        case "run:planned":
          return { ...prev, plan: event.plan };

        case "run:start":
          return { ...prev, status: "running" as const, summary: null, error: null };

        case "run:done":
          return {
            ...prev,
            status: "done" as const,
            summary: event.summary,
            activeNodes: new Set<string>(),
          };

        case "run:error":
          return { ...prev, status: "error" as const, error: event.error };

        case "run:aborted":
          return { ...prev, status: "aborted" as const, activeNodes: new Set<string>() };

        case "level:start": {
          const active = new Set(event.nodeIds);
          return { ...prev, currentLevel: event.level, activeNodes: active };
        }

        case "level:done":
          return { ...prev, activeNodes: new Set<string>() };

        case "level:paused":
          return { ...prev, status: "paused" as const, activeNodes: new Set<string>() };

        case "node:start": {
          const active = new Set(prev.activeNodes);
          active.add(event.nodeId);
          return { ...prev, activeNodes: active };
        }

        case "node:generating": {
          const chunks = new Map(prev.streamingChunks);
          const existing = chunks.get(event.nodeId) ?? "";
          chunks.set(event.nodeId, existing + event.chunk);
          return { ...prev, streamingChunks: chunks };
        }

        case "node:done": {
          const active = new Set(prev.activeNodes);
          active.delete(event.nodeId);
          const chunks = new Map(prev.streamingChunks);
          chunks.delete(event.nodeId);
          return { ...prev, activeNodes: active, streamingChunks: chunks };
        }

        case "node:error": {
          const active = new Set(prev.activeNodes);
          active.delete(event.nodeId);
          return { ...prev, activeNodes: active };
        }

        default:
          return prev;
      }
    });
  }, []);

  const start = useCallback(
    (mode: RunMode) => {
      if (state.status === "running") return;

      const controller = new AbortController();
      controllerRef.current = controller;

      setState({
        status: "idle",
        plan: null,
        activeNodes: new Set(),
        streamingChunks: new Map(),
        summary: null,
        error: null,
        currentLevel: 0,
      });

      const handle = ws.startRun({ mode, signal: controller.signal });
      handleRef.current = handle;
      handle.subscribe(processEvent);
    },
    [ws, state.status, processEvent],
  );

  const step = useCallback(() => {
    if (state.status === "paused" && handleRef.current) {
      handleRef.current.advance();
    } else if (state.status === "idle" || state.status === "done") {
      start("step");
    }
  }, [state.status, start]);

  const abort = useCallback(() => {
    controllerRef.current?.abort();
    handleRef.current = null;
    controllerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  return {
    ...state,
    start,
    step,
    abort,
  };
}
