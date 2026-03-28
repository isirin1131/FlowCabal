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
  name: string;
  nodes: NodeDef[];
}

// ── Workspace ──
export interface Workspace {
  id: string;
  name: string;
  nodes: NodeDef[];
  outputs: Map<string, string>;
  upstream: Map<string, string[]>;
  downstream: Map<string, string[]>;
  target_nodes: string[];
  stale_nodes: string[];
  todo_queue: string[];
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


