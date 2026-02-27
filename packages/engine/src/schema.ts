import { z } from "zod";

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
  promptHash: z.string(),
  agentInjects: z.record(z.string(), z.string()),
  output: z.string(),
  source: VersionSourceSchema,
  current: z.boolean(),
  createdAt: z.string(),
  trace: ExecutionTraceSchema.optional(),
});

// ── Node Version File（磁盘格式） ──
export const NodeVersionFileSchema = z.object({
  versions: z.array(NodeVersionSchema),
  currentId: z.string(),
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
