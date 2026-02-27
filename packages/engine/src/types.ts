// ── JSON ──
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

// ── TextBlock ──
export type TextBlock =
  | { kind: "literal"; content: string }
  | { kind: "ref"; nodeId: string }
  | { kind: "agent-inject"; hint: string };

// ── Node ──
export interface NodeDef {
  id: string;
  label: string;
  systemPrompt: TextBlock[];
  userPrompt: TextBlock[];
}

// ── Workflow ──
export interface Workflow {
  id: string;
  name: string;
  nodes: NodeDef[];
}

// ── LLM ──
export type LlmProvider =
  | "openai"
  | "anthropic"
  | "google"
  | "mistral"
  | "xai"
  | "cohere"
  | "openai-compatible";

export interface LlmConfig {
  provider: LlmProvider;
  baseURL?: string;
  apiKey: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  providerOptions?: Record<string, Record<string, JsonValue>>;
}

/** llm-configs.json: Record<name, LlmConfig>，"default" 为默认配置 */
export type LlmConfigsFile = Record<string, LlmConfig>;

// ── Project Config ──
export interface ProjectConfig {
  name: string;
}

// ── Workspace Meta ──
export interface WorkspaceMeta {
  projectId: string;
  createdAt: string; // ISO 8601
}

// ── Node Version（取代 NodeOutputCache） ──

export type VersionSource =
  | { kind: "generated" }
  | { kind: "human-edit" }
  | { kind: "conversation"; summary: string };

export interface ExecutionTrace {
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  resolvedSystem: string;
  resolvedUser: string;
}

export interface NodeVersion {
  id: string;                    // nanoid
  promptHash: string;            // 结构性 hash（literal+ref 展开，agent-inject 占位）
  agentInjects: Record<string, string>;
  output: string;
  source: VersionSource;
  current: boolean;              // 恰好一个为 true
  createdAt: string;
  trace?: ExecutionTrace;        // 仅 generated 有
}

/** 磁盘格式：outputs/<node-id>.json */
export interface NodeVersionFile {
  versions: NodeVersion[];
  currentId: string;
}

// ── Node Status（导出属性，不存储） ──
export type NodeStatus = "cached" | "stale" | "pending";

// ── Node Override（per-node 参数覆盖） ──
export interface NodeOverride {
  llmConfigName?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
}

// ── Workspace Preferences（per-node 覆盖） ──
export interface WorkspacePreferences {
  nodeOverrides?: Record<string, NodeOverride>;
}

// ── Execution Plan ──
export interface ExecutionPlan {
  levels: string[][];            // 每层的 nodeId 列表
  totalNodes: number;
  cachedNodes: number;
  estimate: TokenEstimate;
}

// ── Token Estimate ──
export interface TokenEstimate {
  inputTokens: number;
  outputTokens: number;
}

// ── Run Summary ──
export interface RunSummary {
  totalNodes: number;
  cachedNodes: number;
  generatedNodes: number;
  errorNodes: number;
  durationMs: number;
}

// ── State Event（state.ts 变更通知） ──
export type StateEvent =
  | { type: "version:added"; nodeId: string; versionId: string; affected: string[] }
  | { type: "version:switched"; nodeId: string; versionId: string; affected: string[] }
  | { type: "nodes:changed"; affected: string[] }
  | { type: "targets:changed"; targets: string[] }
  | { type: "preferences:changed"; nodeId: string };

// ── Level Node Result（level:done / level:paused 携带） ──
export interface LevelNodeResult {
  nodeId: string;
  versionId: string;
  output: string;
  cached: boolean;
}

// ── Run Event（取代 ExecutorEvent） ──
export type RunEvent =
  // Run 生命周期
  | { type: "run:planned"; plan: ExecutionPlan }
  | { type: "run:start" }
  | { type: "run:done"; summary: RunSummary }
  | { type: "run:error"; error: string }
  | { type: "run:aborted" }
  // Level（并行 + 进度）
  | { type: "level:start"; level: number; nodeIds: string[] }
  | { type: "level:done"; level: number; results: LevelNodeResult[] }
  | { type: "level:paused"; nextLevel: number; results: LevelNodeResult[] }
  // Node
  | { type: "node:start"; nodeId: string; label: string }
  | { type: "node:cache-hit"; nodeId: string; versionId: string }
  | { type: "node:agent-inject"; nodeId: string; hint: string }
  | { type: "node:generating"; nodeId: string; chunk: string }
  | { type: "node:done"; nodeId: string; versionId: string; cached: boolean; output: string }
  | { type: "node:error"; nodeId: string; error: string }
  // 上下文预警
  | { type: "context:stale-warning"; nodeId: string; reason: string };

// ── Run Mode ──
export type RunMode = "auto" | "step";

// ── Prompt Preview ──
export interface PromptPreview {
  system: string;          // structural resolve（agent-inject 用占位符）
  user: string;
  unresolvedRefs: string[]; // 上游缺失的 nodeId
}

// ── Workspace Dashboard ──
export interface WorkspaceDashboard {
  targets: string[];
  subgraph: string[];
  nodes: { id: string; label: string; status: NodeStatus }[];
}

// ── Runtime Context（Agent ↔ runner-core 接口） ──
export interface RuntimeContext {
  getNodeOutput(nodeId: string): string | null;
  getWorkflowNodes(): NodeDef[];
  getNodeStatus(nodeId: string): NodeStatus;
  getNodeVersions(nodeId: string): NodeVersion[];
}

// ── Run Handle（startRun 返回） ──
export interface RunHandle {
  subscribe(listener: (event: RunEvent) => void): () => void;
  advance(): Promise<void>;
  abort(): void;
  done: Promise<RunSummary | null>;  // null if aborted/error
}
