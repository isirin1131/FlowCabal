import type {
  NodeDef,
  NodeVersion,
  NodeVersionFile,
  NodeStatus,
  VersionSource,
  ExecutionTrace,
  WorkspacePreferences,
  StateEvent,
} from "../types.js";
import {
  workspaceNodesPath,
  nodeOutputPath,
  workspacePreferencesPath,
} from "../paths.js";
import { NodeDefSchema } from "../schema.js";
import { NodeVersionFileSchema, WorkspacePreferencesSchema } from "../schema.js";
import { resolveBlocks, computePromptHash } from "./resolve.js";
import { extractNodeDeps, computeSubgraph } from "./workflow.js";
import { newId } from "../id.js";
import { readJson, writeJson } from "./cache.js";
import { readdir } from "fs/promises";
import { join, basename } from "path";
import { z } from "zod";

// ── AddVersionOpts ──

export interface AddVersionOpts {
  promptHash: string;
  agentInjects: Record<string, string>;
  output: string;
  source: VersionSource;
  trace?: ExecutionTrace;
}

// ── WorkspaceState interface ──

export interface WorkspaceState {
  readonly rootDir: string;
  readonly workspaceId: string;

  // 同步读（全部从内存）
  getNodes(): NodeDef[];
  getNodeOutput(nodeId: string): string | null;
  getNodeStatus(nodeId: string): NodeStatus;
  getVersions(nodeId: string): NodeVersion[];
  getCurrentVersion(nodeId: string): NodeVersion | null;
  getOutputsMap(): Map<string, string>;
  computeStructuralHash(nodeId: string): string;
  getSubgraph(targets: string[]): string[];
  getPreferences(): WorkspacePreferences;

  // 异步写（内存立即更新 → 磁盘持久化 → emit 事件）
  addVersion(nodeId: string, opts: AddVersionOpts): Promise<NodeVersion>;
  switchVersion(nodeId: string, versionId: string): Promise<void>;
  updateNodes(nodes: NodeDef[]): Promise<void>;
  updatePreferences(prefs: WorkspacePreferences): Promise<void>;

  // 事件
  onChange(listener: (event: StateEvent) => void): () => void;
}

// ── loadState ──

export async function loadState(
  rootDir: string,
  workspaceId: string,
): Promise<WorkspaceState> {
  // ── 加载 nodes ──
  let nodes: NodeDef[] =
    (await readJson(
      workspaceNodesPath(rootDir, workspaceId),
      z.array(NodeDefSchema),
    )) ?? [];
  let nodeMap = new Map(nodes.map((n) => [n.id, n]));

  // ── 加载 preferences ──
  let preferences: WorkspacePreferences =
    (await readJson(
      workspacePreferencesPath(rootDir, workspaceId),
      WorkspacePreferencesSchema,
    )) ?? {};

  // ── 加载全部 version stores ──
  const versionStores = new Map<string, NodeVersionFile>();
  const outputsDir = join(
    rootDir,
    ".flowcabal",
    "runner-cache",
    workspaceId,
    "outputs",
  );
  try {
    const files = await readdir(outputsDir);
    const loads = files
      .filter((f) => f.endsWith(".json"))
      .map(async (f) => {
        const nodeId = basename(f, ".json");
        const store = await readJson(
          nodeOutputPath(rootDir, workspaceId, nodeId),
          NodeVersionFileSchema,
        );
        if (store) versionStores.set(nodeId, store);
      });
    await Promise.all(loads);
  } catch {
    // outputs 目录不存在，正常（新 workspace）
  }

  // ── 依赖关系 ──
  let deps = extractNodeDeps(nodes);
  let reverseDeps = buildReverseDeps(nodes, deps);

  // ── 事件 ──
  const listeners = new Set<(event: StateEvent) => void>();

  function emit(event: StateEvent) {
    for (const fn of listeners) fn(event);
  }

  // ── helpers ──

  function rebuildDeps() {
    deps = extractNodeDeps(nodes);
    reverseDeps = buildReverseDeps(nodes, deps);
  }

  function getCurrentVersionInner(nodeId: string): NodeVersion | null {
    const store = versionStores.get(nodeId);
    if (!store) return null;
    return store.versions.find((v) => v.id === store.currentId) ?? null;
  }

  function getOutputsMapInner(): Map<string, string> {
    const map = new Map<string, string>();
    for (const node of nodes) {
      const current = getCurrentVersionInner(node.id);
      if (current) map.set(node.id, current.output);
    }
    return map;
  }

  function computeAffected(nodeId: string): string[] {
    const affected = [nodeId];
    const visited = new Set<string>([nodeId]);
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      const downstream = reverseDeps.get(current);
      if (!downstream) continue;
      for (const id of downstream) {
        if (!visited.has(id)) {
          visited.add(id);
          affected.push(id);
          queue.push(id);
        }
      }
    }
    return affected;
  }

  // ── state object ──

  const state: WorkspaceState = {
    rootDir,
    workspaceId,

    getNodes() {
      return [...nodes];
    },

    getNodeOutput(nodeId: string): string | null {
      const current = getCurrentVersionInner(nodeId);
      return current?.output ?? null;
    },

    getNodeStatus(nodeId: string): NodeStatus {
      const current = getCurrentVersionInner(nodeId);
      if (!current) return "pending";
      const hash = state.computeStructuralHash(nodeId);
      if (!hash) return "stale";
      return current.promptHash === hash ? "cached" : "stale";
    },

    getVersions(nodeId: string): NodeVersion[] {
      const store = versionStores.get(nodeId);
      return store?.versions ?? [];
    },

    getCurrentVersion(nodeId: string): NodeVersion | null {
      return getCurrentVersionInner(nodeId);
    },

    getOutputsMap(): Map<string, string> {
      return getOutputsMapInner();
    },

    computeStructuralHash(nodeId: string): string {
      const node = nodeMap.get(nodeId);
      if (!node) return "";
      const outputs = getOutputsMapInner();
      try {
        const system = resolveBlocks(node.systemPrompt, outputs);
        const user = resolveBlocks(node.userPrompt, outputs);
        return computePromptHash(system, user);
      } catch {
        return ""; // ref 缺失
      }
    },

    getSubgraph(targets: string[]): string[] {
      return computeSubgraph(nodes, targets);
    },

    getPreferences(): WorkspacePreferences {
      return { ...preferences };
    },

    // ── 异步写 ──

    async addVersion(nodeId: string, opts: AddVersionOpts): Promise<NodeVersion> {
      const store = versionStores.get(nodeId) ?? { versions: [], currentId: "" };

      // 将所有现有版本标记为 non-current
      for (const v of store.versions) {
        v.current = false;
      }

      const version: NodeVersion = {
        id: newId(),
        promptHash: opts.promptHash,
        agentInjects: opts.agentInjects,
        output: opts.output,
        source: opts.source,
        current: true,
        createdAt: new Date().toISOString(),
        trace: opts.trace,
      };

      store.versions.push(version);
      store.currentId = version.id;

      // 内存先更新
      versionStores.set(nodeId, store);

      // 磁盘持久化
      await writeJson(nodeOutputPath(rootDir, workspaceId, nodeId), store);

      // emit
      const affected = computeAffected(nodeId);
      emit({ type: "version:added", nodeId, versionId: version.id, affected });

      return version;
    },

    async switchVersion(nodeId: string, versionId: string): Promise<void> {
      const store = versionStores.get(nodeId);
      if (!store) throw new Error(`节点 "${nodeId}" 没有任何版本`);

      const target = store.versions.find((v) => v.id === versionId);
      if (!target) throw new Error(`版本 "${versionId}" 不存在`);

      for (const v of store.versions) {
        v.current = v.id === versionId;
      }
      store.currentId = versionId;

      // 磁盘持久化
      await writeJson(nodeOutputPath(rootDir, workspaceId, nodeId), store);

      // emit
      const affected = computeAffected(nodeId);
      emit({ type: "version:switched", nodeId, versionId, affected });
    },

    async updateNodes(newNodes: NodeDef[]): Promise<void> {
      nodes = newNodes;
      nodeMap = new Map(nodes.map((n) => [n.id, n]));
      rebuildDeps();

      await writeJson(workspaceNodesPath(rootDir, workspaceId), nodes);

      const affected = nodes.map((n) => n.id);
      emit({ type: "nodes:changed", affected });
    },

    async updatePreferences(prefs: WorkspacePreferences): Promise<void> {
      preferences = prefs;
      await writeJson(
        workspacePreferencesPath(rootDir, workspaceId),
        preferences,
      );
      // preferences:changed 是 per-node 的，这里通知所有有覆盖的节点
      for (const nodeId of Object.keys(prefs.nodeOverrides ?? {})) {
        emit({ type: "preferences:changed", nodeId });
      }
    },

    onChange(listener: (event: StateEvent) => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return state;
}

// ── 构建反向依赖 ──

function buildReverseDeps(
  nodes: NodeDef[],
  deps: Map<string, Set<string>>,
): Map<string, Set<string>> {
  const reverse = new Map<string, Set<string>>();
  for (const node of nodes) {
    reverse.set(node.id, new Set());
  }
  for (const [nodeId, nodeDeps] of deps) {
    for (const depId of nodeDeps) {
      reverse.get(depId)?.add(nodeId);
    }
  }
  return reverse;
}
