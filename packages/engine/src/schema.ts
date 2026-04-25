import { z } from "zod";

const JsonValueSchema: z.ZodType<import("./types.js").JsonValue> = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.lazy(() => z.array(JsonValueSchema)),
  z.lazy(() => z.record(z.string(), JsonValueSchema)),
]);

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

export const TextBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), content: z.string() }),
  z.object({ kind: z.literal("ref"), nodeId: z.string() }),
  z.object({ kind: z.literal("agent-inject"), hint: z.string() }),
]);

export const NodeDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  systemPrompt: z.array(TextBlockSchema),
  userPrompt: z.array(TextBlockSchema),
});

export const WorkflowSchema = z.object({
  name: z.string(),
  nodes: z.array(NodeDefSchema),
});

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

export const LlmConfigsFileSchema = z.record(z.string(), LlmConfigSchema);
