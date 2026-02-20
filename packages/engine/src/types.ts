// ── TextBlock ──
export type TextBlock =
  | { kind: "literal"; content: string }
  | { kind: "ref"; nodeId: string };

// ── Node ──
export interface NodeDef {
  id: string;
  label: string;
  role: "user_llm" | "agent_llm";
  systemPrompt: TextBlock[];
  userPrompt: TextBlock[];
  parameters?: { temperature?: number; maxTokens?: number };
}

// ── Workflow ──
export interface Edge {
  id: string;
  source: string;
  target: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: NodeDef[];
  edges: Edge[];
}

// ── LLM ──
export type LlmProvider = "openai" | "anthropic" | "google" | "openai-compatible";

export interface LlmConfig {
  provider: LlmProvider;
  baseURL?: string;
  apiKey: string;
  model: string;
}

// ── Project ──
export interface ProjectConfig {
  name: string;
  rootDir: string;
  userLlm: LlmConfig;
  agentLlm: LlmConfig;
}

// ── Store entry ──
export interface StoreEntry {
  path: string;       // relative to store/, e.g. "constraints/characters/芙兰朵露.md"
  summary: string;    // first line, used in L0 index
  content: string;    // full file content
}

// ── Execution ──
export interface NodeOutput {
  nodeId: string;
  text: string;
}
