import type {
  LlmConfigsFile,
  NodeDef,
  NodeStatus,
  NodeVersion,
  NodeOverride,
  TextBlock,
  PromptPreview,
  TokenEstimate,
  WorkspaceDashboard,
  RuntimeContext,
  RunHandle,
  RunMode,
  WorkspacePreferences,
  StateEvent,
} from "../types.js";
import { loadState, type WorkspaceState } from "./state.js";
import { resolveBlocks, computePromptHash } from "./resolve.js";
import { estimateTokens } from "./budget.js";
import {
  topoLevels,
  computeSubgraph,
  validateWorkflow,
} from "./workflow.js";
import { startRun as startRunInternal } from "./run.js";

// ── Workspace 接口 ──

export interface Workspace {
  readonly rootDir: string;
  readonly workspaceId: string;

  // Targets（同步，非持久化）
  setTargets(nodeIds: string[]): void;
  getTargets(): string[];
  getSubgraph(): string[];

  // 查询（全部同步，从内存读）
  getNodes(): NodeDef[];
  getNodeStatus(nodeId: string): NodeStatus;
  previewNode(nodeId: string): PromptPreview;
  getVersions(nodeId: string): NodeVersion[];
  getCurrentVersion(nodeId: string): NodeVersion | null;
  estimateCost(): TokenEstimate;
  getDashboard(): WorkspaceDashboard;

  // Mutation（async，磁盘持久化）
  setNodeOutput(nodeId: string, text: string): Promise<void>;
  pickVersion(nodeId: string, versionId: string): Promise<void>;

  // 节点管理
  addNode(node: NodeDef): Promise<void>;
  removeNode(nodeId: string): Promise<void>;

  // Prompt 结构化编辑
  addBlock(nodeId: string, prompt: "system" | "user", index: number, block: TextBlock): Promise<void>;
  removeBlock(nodeId: string, prompt: "system" | "user", index: number): Promise<void>;
  moveBlock(nodeId: string, prompt: "system" | "user", from: number, to: number): Promise<void>;

  // 节点级参数
  setNodeOverride(nodeId: string, override: NodeOverride): Promise<void>;

  // 执行
  startRun(opts: { mode: RunMode; signal?: AbortSignal }): RunHandle;

  // 事件 + Agent
  onChange(listener: (event: StateEvent) => void): () => void;
  createRuntimeContext(): RuntimeContext;
}

// ── openWorkspace ──

export async function openWorkspace(
  rootDir: string,
  workspaceId: string,
  llmConfigs: LlmConfigsFile,
): Promise<Workspace> {
  const state = await loadState(rootDir, workspaceId);
  const nodes = state.getNodes();

  // 校验
  validateWorkflow({ id: workspaceId, name: "", nodes });

  // 内部状态（非持久化）
  let targets: string[] = nodes.map((n) => n.id);

  function getNode(nodeId: string): NodeDef {
    const node = state.getNodes().find((n) => n.id === nodeId);
    if (!node) throw new Error(`节点 "${nodeId}" 不存在`);
    return node;
  }

  function getBlockArray(nodeId: string, prompt: "system" | "user"): TextBlock[] {
    const node = getNode(nodeId);
    return prompt === "system" ? node.systemPrompt : node.userPrompt;
  }

  const ws: Workspace = {
    rootDir,
    workspaceId,

    // ── Targets ──

    setTargets(nodeIds: string[]) {
      const currentNodes = state.getNodes();
      const nodeIds_set = new Set(currentNodes.map((n) => n.id));
      for (const id of nodeIds) {
        if (!nodeIds_set.has(id)) throw new Error(`节点 "${id}" 不存在`);
      }
      targets = [...nodeIds];
    },

    getTargets() {
      return [...targets];
    },

    getSubgraph() {
      return state.getSubgraph(targets);
    },

    // ── 查询（全同步） ──

    getNodes() {
      return state.getNodes();
    },

    getNodeStatus(nodeId: string): NodeStatus {
      return state.getNodeStatus(nodeId);
    },

    previewNode(nodeId: string): PromptPreview {
      const node = getNode(nodeId);
      const outputs = state.getOutputsMap();

      const unresolvedRefs: string[] = [];
      const safeOutputs = new Map(outputs);

      for (const block of [...node.systemPrompt, ...node.userPrompt]) {
        if (block.kind === "ref" && !safeOutputs.has(block.nodeId)) {
          unresolvedRefs.push(block.nodeId);
          safeOutputs.set(block.nodeId, `[待生成: ${block.nodeId}]`);
        }
      }

      const system = resolveBlocks(node.systemPrompt, safeOutputs);
      const user = resolveBlocks(node.userPrompt, safeOutputs);

      return { system, user, unresolvedRefs };
    },

    getVersions(nodeId: string): NodeVersion[] {
      return state.getVersions(nodeId);
    },

    getCurrentVersion(nodeId: string): NodeVersion | null {
      return state.getCurrentVersion(nodeId);
    },

    estimateCost(): TokenEstimate {
      const subgraph = computeSubgraph(state.getNodes(), targets);
      const currentNodes = state.getNodes().filter((n) => subgraph.includes(n.id));
      const outputs = state.getOutputsMap();

      let inputTokens = 0;
      let outputTokens = 0;

      for (const node of currentNodes) {
        const current = state.getCurrentVersion(node.id);
        try {
          const system = resolveBlocks(node.systemPrompt, outputs);
          const user = resolveBlocks(node.userPrompt, outputs);
          const hash = computePromptHash(system, user);
          if (current && current.promptHash === hash) continue; // cached
          inputTokens += estimateTokens(system + user);
          outputTokens += 2000;
        } catch {
          inputTokens += 1000;
          outputTokens += 2000;
        }
      }

      return { inputTokens, outputTokens };
    },

    getDashboard(): WorkspaceDashboard {
      const subgraph = computeSubgraph(state.getNodes(), targets);
      const dashNodes: WorkspaceDashboard["nodes"] = state
        .getNodes()
        .map((node) => ({
          id: node.id,
          label: node.label,
          status: state.getNodeStatus(node.id),
        }));

      return { targets: [...targets], subgraph, nodes: dashNodes };
    },

    // ── 输出变更 ──

    async setNodeOutput(nodeId: string, text: string): Promise<void> {
      const hash = state.computeStructuralHash(nodeId);
      await state.addVersion(nodeId, {
        promptHash: hash,
        agentInjects: {},
        output: text,
        source: { kind: "human-edit" },
      });
    },

    async pickVersion(nodeId: string, versionId: string): Promise<void> {
      await state.switchVersion(nodeId, versionId);
    },

    // ── 节点管理 ──

    async addNode(node: NodeDef): Promise<void> {
      const currentNodes = state.getNodes();
      if (currentNodes.some((n) => n.id === node.id)) {
        throw new Error(`节点 "${node.id}" 已存在`);
      }
      await state.updateNodes([...currentNodes, node]);
      targets.push(node.id);
    },

    async removeNode(nodeId: string): Promise<void> {
      const currentNodes = state.getNodes();
      const filtered = currentNodes.filter((n) => n.id !== nodeId);
      if (filtered.length === currentNodes.length) {
        throw new Error(`节点 "${nodeId}" 不存在`);
      }
      await state.updateNodes(filtered);
      targets = targets.filter((t) => t !== nodeId);
    },

    // ── Prompt 结构化编辑 ──

    async addBlock(nodeId: string, prompt: "system" | "user", index: number, block: TextBlock): Promise<void> {
      const currentNodes = state.getNodes();
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`节点 "${nodeId}" 不存在`);
      const blocks = prompt === "system" ? node.systemPrompt : node.userPrompt;
      if (index < 0 || index > blocks.length) {
        throw new Error(`索引 ${index} 越界 (0..${blocks.length})`);
      }
      blocks.splice(index, 0, block);
      await state.updateNodes(currentNodes);
    },

    async removeBlock(nodeId: string, prompt: "system" | "user", index: number): Promise<void> {
      const currentNodes = state.getNodes();
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`节点 "${nodeId}" 不存在`);
      const blocks = prompt === "system" ? node.systemPrompt : node.userPrompt;
      if (index < 0 || index >= blocks.length) {
        throw new Error(`索引 ${index} 越界 (0..${blocks.length - 1})`);
      }
      blocks.splice(index, 1);
      await state.updateNodes(currentNodes);
    },

    async moveBlock(nodeId: string, prompt: "system" | "user", from: number, to: number): Promise<void> {
      const currentNodes = state.getNodes();
      const node = currentNodes.find((n) => n.id === nodeId);
      if (!node) throw new Error(`节点 "${nodeId}" 不存在`);
      const blocks = prompt === "system" ? node.systemPrompt : node.userPrompt;
      if (from < 0 || from >= blocks.length) {
        throw new Error(`from 索引 ${from} 越界`);
      }
      if (to < 0 || to >= blocks.length) {
        throw new Error(`to 索引 ${to} 越界`);
      }
      const [removed] = blocks.splice(from, 1);
      blocks.splice(to, 0, removed);
      await state.updateNodes(currentNodes);
    },

    // ── 节点级参数 ──

    async setNodeOverride(nodeId: string, override: NodeOverride): Promise<void> {
      getNode(nodeId); // 验证存在
      const prefs = state.getPreferences();
      if (!prefs.nodeOverrides) prefs.nodeOverrides = {};
      prefs.nodeOverrides[nodeId] = override;
      await state.updatePreferences(prefs);
    },

    // ── 执行 ──

    startRun({ mode, signal }): RunHandle {
      const subgraphIds = state.getSubgraph(targets);
      const subNodes = state.getNodes().filter((n) => subgraphIds.includes(n.id));
      const levels = topoLevels(subNodes);

      return startRunInternal({
        state,
        llmConfigs,
        nodes: subNodes,
        levels,
        mode,
        signal,
      });
    },

    // ── 事件 ──

    onChange(listener: (event: StateEvent) => void): () => void {
      return state.onChange(listener);
    },

    // ── RuntimeContext ──

    createRuntimeContext(): RuntimeContext {
      return {
        getNodeOutput(nodeId: string): string | null {
          return state.getNodeOutput(nodeId);
        },
        getWorkflowNodes() {
          return state.getNodes();
        },
        getNodeStatus(nodeId: string) {
          return state.getNodeStatus(nodeId);
        },
        getNodeVersions(nodeId: string) {
          return state.getVersions(nodeId);
        },
      };
    },
  };

  return ws;
}
