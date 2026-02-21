import type { Workflow, NodeDef, NodeOutput, ProjectConfig } from "../types.js";
import { topoSort } from "./workflow.js";
import { resolveBlocks } from "./resolve.js";
import { generate, streamGenerate } from "../llm/generate.js";
import { getProvider } from "../llm/provider.js";

export interface ExecutorCallbacks {
  onNodeStart?: (node: NodeDef) => void;
  onNodeStream?: (node: NodeDef, chunk: string) => void;
  onNodeEnd?: (node: NodeDef, output: string) => void;
}

/**
 * Execute a workflow in topological order.
 * Each node's output feeds into downstream refs.
 */
export async function executeWorkflow(
  workflow: Workflow,
  config: ProjectConfig,
  callbacks?: ExecutorCallbacks
): Promise<Map<string, NodeOutput>> {
  const sorted = topoSort(workflow);
  const outputs = new Map<string, NodeOutput>();

  for (const node of sorted) {
    callbacks?.onNodeStart?.(node);

    const systemPrompt = resolveBlocks(node.systemPrompt, outputs);
    const userPrompt = resolveBlocks(node.userPrompt, outputs);

    const llmConfig = node.llm ?? config.defaultLlm;
    const provider = getProvider(llmConfig);

    let text: string;
    if (callbacks?.onNodeStream) {
      text = await streamGenerate(provider, llmConfig.model, systemPrompt, userPrompt, node.parameters, (chunk) => {
        callbacks.onNodeStream!(node, chunk);
      });
    } else {
      text = await generate(provider, llmConfig.model, systemPrompt, userPrompt, node.parameters);
    }

    callbacks?.onNodeEnd?.(node, text);
    outputs.set(node.id, { nodeId: node.id, text });
  }

  return outputs;
}
