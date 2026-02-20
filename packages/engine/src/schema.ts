import { z } from "zod";

// ── TextBlock ──
export const TextBlockSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("literal"), content: z.string() }),
  z.object({ kind: z.literal("ref"), nodeId: z.string() }),
]);

// ── NodeDef ──
export const NodeDefSchema = z.object({
  id: z.string(),
  label: z.string(),
  role: z.enum(["user_llm", "agent_llm"]),
  systemPrompt: z.array(TextBlockSchema),
  userPrompt: z.array(TextBlockSchema),
  parameters: z
    .object({
      temperature: z.number().min(0).max(2).optional(),
      maxTokens: z.number().positive().optional(),
    })
    .optional(),
});

// ── Edge ──
export const EdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
});

// ── Workflow ──
export const WorkflowSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(NodeDefSchema),
  edges: z.array(EdgeSchema),
});

// ── LLM Config ──
export const LlmProviderSchema = z.enum([
  "openai",
  "anthropic",
  "google",
  "openai-compatible",
]);

export const LlmConfigSchema = z.object({
  provider: LlmProviderSchema,
  baseURL: z.string().optional(),
  apiKey: z.string(),
  model: z.string(),
});

// ── Project Config (flowcabal.json) ──
export const ProjectConfigSchema = z.object({
  name: z.string(),
  rootDir: z.string(),
  userLlm: LlmConfigSchema,
  agentLlm: LlmConfigSchema,
});
