import { z } from "zod";

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
