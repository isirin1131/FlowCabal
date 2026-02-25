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

// ── LLM Configs File ──
/** llm-configs.json: Record<name, LlmConfig>，"default" 为默认配置 */
export type LlmConfigsFile = Record<string, LlmConfig>;

// ── Runtime Context（Agent ↔ DAG-core 接口） ──
export interface RuntimeContext {
  getNodeOutput(nodeId: string): string | null;
  getWorkflowNodes(): NodeDef[];
}

// ── Project Config ──
export interface ProjectConfig {
  name: string;
}
