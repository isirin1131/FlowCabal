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
}
