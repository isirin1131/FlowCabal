import { z } from "zod";
import type { Workspace } from "./types.js";

// ── JSON Value (for providerOptions) ──
const JsonValueSchema: z.ZodType<import("./types.js").JsonValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.lazy(() => z.array(JsonValueSchema)),
  z.lazy(() => z.record(z.string(), JsonValueSchema)),
]);

// ── LLM Config ──
export const LlmProviderSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "mistral",
  "xai",
  "cohere",
  "openai-compatible",
]);

export const LlmConfigSchema = z.object({
  provider: LlmProviderSchema,
  baseURL: z.string().optional(),
  apiKey: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
  providerOptions: z.record(z.string(), z.record(z.string(), z.lazy(() => JsonValueSchema))).optional(),
});

// ── TextBlock ──
export const TextBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), content: z.string() }),
  z.object({ kind: z.literal("ref"), nodeId: z.string() }),
  z.object({ kind: z.literal("agent-inject"), hint: z.string() }),
]);

// ── NodeDef ──
export const NodeDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  systemPrompt: z.array(TextBlockSchema),
  userPrompt: z.array(TextBlockSchema),
});

// ── Workflow ──
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(NodeDefSchema),
});

// ── Workspace ──
export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(NodeDefSchema),
  outputs: z.record(z.string(), z.string()),
  upstream: z.record(z.string(), z.array(z.string())),
  downstream: z.record(z.string(), z.array(z.string())),
  target_nodes: z.array(z.string()),
  stale_nodes: z.array(z.string()),
});

// ── LLM Configs File ──
export const LlmConfigsFileSchema = z.record(z.string(), LlmConfigSchema);

// ── Project Config ──
export const ProjectConfigSchema = z.object({
  name: z.string(),
});

// ── Workspace Meta ──
export const WorkspaceMetaSchema = z.object({
  projectId: z.string(),
  createdAt: z.string(),
});

// ── Version Source ──
export const VersionSourceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("generated") }),
  z.object({ kind: z.literal("human-edit") }),
  z.object({ kind: z.literal("conversation"), summary: z.string() }),
]);

// ── Execution Trace ──
export const ExecutionTraceSchema = z.object({
  model: z.string(),
  inputTokens: z.number(),
  outputTokens: z.number(),
  durationMs: z.number(),
  resolvedSystem: z.string(),
  resolvedUser: z.string(),
});

// ── Node Version ──
export const NodeVersionSchema = z.object({
  id: z.string(),
  output: z.string(),
  source: VersionSourceSchema,
  createdAt: z.string(),
});

// ── Node Override ──
export const NodeOverrideSchema = z.object({
  llmConfigName: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().positive().optional(),
  topP: z.number().min(0).max(1).optional(),
  frequencyPenalty: z.number().min(-2).max(2).optional(),
  presencePenalty: z.number().min(-2).max(2).optional(),
});

// ── Workspace Preferences ──
export const WorkspacePreferencesSchema = z.object({
  nodeOverrides: z.record(z.string(), NodeOverrideSchema).optional(),
});

// ── Agent Gate ──
export const AgentGateTypeSchema = z.enum(["node", "level"]);

export const AgentGateCriteriaSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("quality-threshold"),
    minScore: z.number().min(0).max(10),
    evaluationPrompt: z.string(),
  }),
  z.object({
    kind: z.literal("content-match"),
    requiredPatterns: z.array(z.string()),
    forbiddenPatterns: z.array(z.string()),
  }),
  z.object({
    kind: z.literal("agent-judgment"),
    judgmentPrompt: z.string(),
  }),
  z.object({
    kind: z.literal("always-pass"),
  }),
]);

export const AgentGateConfigSchema = z.object({
  id: z.string(),
  type: AgentGateTypeSchema,
  targetId: z.string(),
  criteria: AgentGateCriteriaSchema,
  enabled: z.boolean(),
});

// ── Todo List ──
export const TodoLevelSchema = z.object({
  index: z.number(),
  nodes: z.array(z.string()),
  agentGateId: z.string().optional(),
});

export const TodoListSchema = z.object({
  levels: z.array(TodoLevelSchema),
});

// ── Node Status ──
export const NodeStatusSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pending") }),
  z.object({ kind: z.literal("running") }),
  z.object({ kind: z.literal("completed"), versionId: z.string() }),
  z.object({ kind: z.literal("failed"), error: z.string() }),
  z.object({ kind: z.literal("blocked"), reason: z.string() }),
]);

// ── Workspace State ──
export const WorkspaceStateSchema = z.object({
  meta: WorkspaceMetaSchema,
  nodes: z.array(NodeDefSchema),
  preferences: WorkspacePreferencesSchema,
  targetNodes: z.array(z.string()).transform(arr => new Set(arr)),
  staleNodes: z.array(z.string()).transform(arr => new Set(arr)),
  nodeVersions: z.record(z.string(), z.object({
    currentVersionId: z.string(),
    versions: z.array(NodeVersionSchema),
  })),
  agentGates: z.record(z.string(), AgentGateConfigSchema),
});

// ── Targets File ──
export const TargetsFileSchema = z.array(z.string());

// ── Stale Roots File ──
export const StaleRootsFileSchema = z.array(z.string());
