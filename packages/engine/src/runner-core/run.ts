import { stat } from "fs/promises";
import type {
  LlmConfig,
  LlmConfigsFile,
  NodeDef,
  NodeOverride,
  RunEvent,
  RunHandle,
  RunMode,
  RunSummary,
  ExecutionPlan,
  WorkspacePreferences,
  TokenEstimate,
  LevelNodeResult,
} from "../types.js";
import { memoryIndexPath, nodeOutputPath } from "../paths.js";
import type { WorkspaceState } from "./state.js";
import { resolveBlocks, resolveBlocksFull, computePromptHash } from "./resolve.js";
import { estimateTokens } from "./budget.js";
import { createStream } from "../llm/generate.js";
import { runAgent } from "../agent/agent.js";
import { SYSTEM_PROMPT_INJECT } from "../agent/prompts.js";

// ── EventBus ──

type Listener = (event: RunEvent) => void;

function createEventBus() {
  const listeners = new Set<Listener>();
  return {
    subscribe(fn: Listener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    emit(event: RunEvent) {
      for (const fn of listeners) fn(event);
    },
  };
}

// ── Helpers ──

export { computePromptHash };

function resolveLlmConfig(
  llmConfigs: LlmConfigsFile,
  preferences: WorkspacePreferences | undefined,
  nodeId: string,
): LlmConfig {
  const override = preferences?.nodeOverrides?.[nodeId];
  const name = override?.llmConfigName ?? "default";
  const base = llmConfigs[name];
  if (!base) {
    throw new Error(`LLM 配置 "${name}" 不存在`);
  }
  if (!override) return base;
  return applyOverride(base, override);
}

function applyOverride(base: LlmConfig, override: NodeOverride): LlmConfig {
  return {
    ...base,
    temperature: override.temperature ?? base.temperature,
    maxTokens: override.maxTokens ?? base.maxTokens,
    topP: override.topP ?? base.topP,
    frequencyPenalty: override.frequencyPenalty ?? base.frequencyPenalty,
    presencePenalty: override.presencePenalty ?? base.presencePenalty,
  };
}

async function isContextStale(
  rootDir: string,
  workspaceId: string,
  nodeId: string,
): Promise<boolean> {
  try {
    const [indexStat, cacheStat] = await Promise.all([
      stat(memoryIndexPath(rootDir)),
      stat(nodeOutputPath(rootDir, workspaceId, nodeId)),
    ]);
    return indexStat.mtimeMs > cacheStat.mtimeMs;
  } catch {
    return false;
  }
}

function collectAgentInjectHints(node: NodeDef): string[] {
  const hints: string[] = [];
  for (const block of [...node.systemPrompt, ...node.userPrompt]) {
    if (block.kind === "agent-inject") {
      hints.push(block.hint);
    }
  }
  return hints;
}

function buildAgentInjectMessage(node: NodeDef, hint: string): string {
  return `为节点「${node.label}」准备上下文注入。\n\n注入提示：${hint}`;
}

// ── Run Options ──

export interface StartRunOptions {
  state: WorkspaceState;
  llmConfigs: LlmConfigsFile;
  nodes: NodeDef[];
  levels: string[][];
  mode: RunMode;
  signal?: AbortSignal;
}

// ── startRun ──

export function startRun(opts: StartRunOptions): RunHandle {
  const bus = createEventBus();
  const controller = opts.signal
    ? undefined
    : new AbortController();
  const signal = opts.signal ?? controller!.signal;

  // step 模式的 gate
  let gateResolve: (() => void) | null = null;

  // done Promise
  let doneResolve: (value: RunSummary | null) => void;
  const donePromise = new Promise<RunSummary | null>((resolve) => {
    doneResolve = resolve;
  });

  const handle: RunHandle = {
    subscribe: (fn) => bus.subscribe(fn),
    advance: () => {
      if (gateResolve) {
        gateResolve();
        gateResolve = null;
      }
      return Promise.resolve();
    },
    abort: () => {
      controller?.abort();
    },
    done: donePromise,
  };

  // queueMicrotask 延迟启动：保证 subscribe 在第一个事件之前
  queueMicrotask(() => {
    runLoop(opts, bus, signal, () => {
      return new Promise<void>((resolve) => {
        gateResolve = resolve;
      });
    })
      .then((summary) => {
        doneResolve!(summary);
      })
      .catch(() => {
        doneResolve!(null);
      });
  });

  return handle;
}

// ── 执行循环 ──

async function runLoop(
  opts: StartRunOptions,
  bus: ReturnType<typeof createEventBus>,
  signal: AbortSignal,
  waitForGate: () => Promise<void>,
): Promise<RunSummary | null> {
  const { state, llmConfigs, nodes, levels, mode } = opts;
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const preferences = state.getPreferences();

  // 计划（从 state 读）
  const outputs = state.getOutputsMap();
  let cachedCount = 0;
  let inputEst = 0;
  let outputEst = 0;
  for (const levelIds of levels) {
    for (const nodeId of levelIds) {
      const node = nodeMap.get(nodeId)!;
      try {
        const systemStructural = resolveBlocks(node.systemPrompt, outputs);
        const userStructural = resolveBlocks(node.userPrompt, outputs);
        const hash = computePromptHash(systemStructural, userStructural);
        const current = state.getCurrentVersion(nodeId);
        if (current && current.promptHash === hash) {
          cachedCount++;
        } else {
          inputEst += estimateTokens(systemStructural + userStructural);
          outputEst += 2000;
        }
      } catch {
        inputEst += 1000;
        outputEst += 2000;
      }
    }
  }

  const estimate: TokenEstimate = { inputTokens: inputEst, outputTokens: outputEst };
  const plan: ExecutionPlan = {
    levels,
    totalNodes: levels.flat().length,
    cachedNodes: cachedCount,
    estimate,
  };
  bus.emit({ type: "run:planned", plan });

  const startTime = Date.now();
  bus.emit({ type: "run:start" });

  let generatedCount = 0;
  let errorCount = 0;
  cachedCount = 0; // 重新计数实际结果

  try {
    for (let levelIdx = 0; levelIdx < levels.length; levelIdx++) {
      if (signal.aborted) {
        bus.emit({ type: "run:aborted" });
        return null;
      }

      const levelIds = levels[levelIdx];
      bus.emit({ type: "level:start", level: levelIdx, nodeIds: levelIds });

      // 构建 RuntimeContext（从 state 读实时数据）
      const runtimeCtx = {
        getNodeOutput: (id: string) => state.getNodeOutput(id),
        getWorkflowNodes: () => state.getNodes(),
        getNodeStatus: (id: string) => state.getNodeStatus(id),
        getNodeVersions: (id: string) => state.getVersions(id),
      };

      // 并行执行 level 内所有节点
      const nodeResults = await Promise.allSettled(
        levelIds.map((nodeId) =>
          executeOneNode(nodeId, nodeMap, state, runtimeCtx, {
            llmConfigs, preferences, signal, bus,
          }),
        ),
      );

      const levelResults: LevelNodeResult[] = [];
      for (const result of nodeResults) {
        if (result.status === "fulfilled") {
          if (result.value.cached) cachedCount++;
          else generatedCount++;
          levelResults.push(result.value);
        } else {
          errorCount++;
        }
      }

      // step 模式：level 完成后暂停（非最后一层）
      if (mode === "step" && levelIdx < levels.length - 1) {
        bus.emit({ type: "level:paused", nextLevel: levelIdx + 1, results: levelResults });
        await waitForGate();
        if (signal.aborted) {
          bus.emit({ type: "run:aborted" });
          return null;
        }
        // step 模式无需重新加载——state 是内存的，编辑后自然可见
      } else {
        bus.emit({ type: "level:done", level: levelIdx, results: levelResults });
      }
    }

    const summary: RunSummary = {
      totalNodes: levels.flat().length,
      cachedNodes: cachedCount,
      generatedNodes: generatedCount,
      errorNodes: errorCount,
      durationMs: Date.now() - startTime,
    };
    bus.emit({ type: "run:done", summary });
    return summary;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bus.emit({ type: "run:error", error: msg });
    return null;
  }
}

// ── 单节点执行 ──

interface NodeExecOpts {
  llmConfigs: LlmConfigsFile;
  preferences?: WorkspacePreferences;
  signal: AbortSignal;
  bus: ReturnType<typeof createEventBus>;
}

interface RuntimeCtx {
  getNodeOutput(nodeId: string): string | null;
  getWorkflowNodes(): NodeDef[];
  getNodeStatus(nodeId: string): import("../types.js").NodeStatus;
  getNodeVersions(nodeId: string): import("../types.js").NodeVersion[];
}

async function executeOneNode(
  nodeId: string,
  nodeMap: Map<string, NodeDef>,
  state: WorkspaceState,
  runtimeCtx: RuntimeCtx,
  opts: NodeExecOpts,
): Promise<LevelNodeResult> {
  const { llmConfigs, preferences, signal, bus } = opts;
  const node = nodeMap.get(nodeId)!;

  bus.emit({ type: "node:start", nodeId, label: node.label });

  try {
    // structural resolve (agent-inject → placeholder)
    const outputs = state.getOutputsMap();
    const systemStructural = resolveBlocks(node.systemPrompt, outputs);
    const userStructural = resolveBlocks(node.userPrompt, outputs);
    const promptHash = computePromptHash(systemStructural, userStructural);

    // cache check（从 state 内存读）
    const current = state.getCurrentVersion(nodeId);

    if (current && current.promptHash === promptHash) {
      // 检查上下文过期
      const hints = collectAgentInjectHints(node);
      if (hints.length > 0) {
        const stale = await isContextStale(state.rootDir, state.workspaceId, nodeId);
        if (stale) {
          bus.emit({
            type: "context:stale-warning",
            nodeId,
            reason: "memory index.md 在缓存生成后被修改",
          });
        }
      }
      bus.emit({ type: "node:cache-hit", nodeId, versionId: current.id });
      bus.emit({ type: "node:done", nodeId, versionId: current.id, cached: true, output: current.output });
      return { nodeId, versionId: current.id, output: current.output, cached: true };
    }

    // agent-inject
    const hints = collectAgentInjectHints(node);
    const agentInjects = new Map<string, string>();

    if (hints.length > 0) {
      const llmConfig = resolveLlmConfig(llmConfigs, preferences, nodeId);
      for (const hint of hints) {
        bus.emit({ type: "node:agent-inject", nodeId, hint });
        const message = buildAgentInjectMessage(node, hint);
        const result = await runAgent(
          state.rootDir,
          llmConfig,
          message,
          SYSTEM_PROMPT_INJECT,
          runtimeCtx,
          signal,
        );
        agentInjects.set(hint, result);
      }
    }

    // full resolve
    const fullSystem = resolveBlocksFull(node.systemPrompt, outputs, agentInjects);
    const fullUser = resolveBlocksFull(node.userPrompt, outputs, agentInjects);

    // LLM streaming
    const llmConfig = resolveLlmConfig(llmConfigs, preferences, nodeId);
    const startMs = Date.now();
    const stream = createStream(llmConfig, fullSystem, fullUser, signal);

    let output = "";
    for await (const chunk of stream.textStream) {
      output += chunk;
      bus.emit({ type: "node:generating", nodeId, chunk });
    }

    const durationMs = Date.now() - startMs;

    // 写新版本（通过 state，内存立即可见）
    const version = await state.addVersion(nodeId, {
      promptHash,
      agentInjects: Object.fromEntries(agentInjects),
      output,
      source: { kind: "generated" },
      trace: {
        model: llmConfig.model,
        inputTokens: estimateTokens(fullSystem + fullUser),
        outputTokens: estimateTokens(output),
        durationMs,
        resolvedSystem: fullSystem,
        resolvedUser: fullUser,
      },
    });

    bus.emit({ type: "node:done", nodeId, versionId: version.id, cached: false, output });
    return { nodeId, versionId: version.id, output, cached: false };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    bus.emit({ type: "node:error", nodeId, error: msg });
    throw e;
  }
}
