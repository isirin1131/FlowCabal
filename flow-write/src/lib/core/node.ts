/**
 * Node System for FlowWrite
 *
 * A node represents a single LLM API call in the workflow.
 * - Input: TextBlockList (prompt composed of static and virtual text blocks)
 * - Output: TextBlock (LLM response)
 */

import {
  type TextBlockList,
  type TextBlock,
  type NodeId,
  createTextBlockList,
  createTextBlock,
  getDependencies,
  isListReady,
  getListContent,
  resolveNodeOutput,
  generateId
} from './textblock';

// ============================================================================
// Node State
// ============================================================================

/**
 * Execution state of a node
 * - idle: Not yet executed, waiting for dependencies or user trigger
 * - pending: Dependencies satisfied, queued for execution
 * - running: Currently executing LLM API call
 * - completed: Execution finished successfully
 * - error: Execution failed
 */
export type NodeState = 'idle' | 'pending' | 'running' | 'completed' | 'error';

// ============================================================================
// LLM Configuration
// ============================================================================

export interface LLMConfig {
  /** API provider (e.g., 'openai', 'anthropic', 'custom') */
  provider: string;
  /** Model identifier (e.g., 'gpt-4', 'claude-3-opus') */
  model: string;
  /** API endpoint URL (for custom providers) */
  endpoint?: string;
  /** Temperature for sampling (0-2) */
  temperature?: number;
  /** Maximum tokens to generate */
  maxTokens?: number;
  /** System prompt */
  systemPrompt?: string;
}

export const defaultLLMConfig: LLMConfig = {
  provider: 'openai',
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 2048
};

// ============================================================================
// Node
// ============================================================================

export interface Node {
  readonly id: NodeId;
  /** Display name for the node */
  name: string;
  /** Input prompt composed of text blocks */
  input: TextBlockList;
  /** Output from LLM (null until execution completes) */
  output: TextBlock | null;
  /** Current execution state */
  state: NodeState;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** LLM configuration for this node */
  llmConfig: LLMConfig;
  /** Position in the canvas (for UI) */
  position: { x: number; y: number };
}

export function createNode(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  llmConfig: LLMConfig = defaultLLMConfig
): Node {
  return {
    id: generateId(),
    name,
    input: createTextBlockList(),
    output: null,
    state: 'idle',
    llmConfig,
    position
  };
}

/**
 * Get the dependencies of a node (source nodes it depends on)
 */
export function getNodeDependencies(node: Node): NodeId[] {
  return getDependencies(node.input);
}

/**
 * Check if a node is ready to execute (all dependencies resolved)
 */
export function isNodeReady(node: Node): boolean {
  return isListReady(node.input);
}

/**
 * Get the final prompt string for a node
 */
export function getNodePrompt(node: Node): string {
  return getListContent(node.input);
}

/**
 * Update node input
 */
export function updateNodeInput(node: Node, input: TextBlockList): Node {
  return { ...node, input };
}

/**
 * Set node to pending state (ready to execute)
 */
export function setNodePending(node: Node): Node {
  return { ...node, state: 'pending', errorMessage: undefined };
}

/**
 * Set node to running state
 */
export function setNodeRunning(node: Node): Node {
  return { ...node, state: 'running' };
}

/**
 * Set node to completed state with output
 */
export function setNodeCompleted(node: Node, outputContent: string): Node {
  return {
    ...node,
    state: 'completed',
    output: createTextBlock(outputContent),
    errorMessage: undefined
  };
}

/**
 * Set node to error state
 */
export function setNodeError(node: Node, errorMessage: string): Node {
  return {
    ...node,
    state: 'error',
    errorMessage,
    output: null
  };
}

/**
 * Reset node to idle state (clear output)
 */
export function resetNode(node: Node): Node {
  return {
    ...node,
    state: 'idle',
    output: null,
    errorMessage: undefined
  };
}

/**
 * Get the output content of a node (empty string if not completed)
 */
export function getNodeOutput(node: Node): string {
  return node.output?.content ?? '';
}

// ============================================================================
// Node Collection Helpers
// ============================================================================

export type NodeMap = Map<NodeId, Node>;

export function createNodeMap(nodes: Node[] = []): NodeMap {
  return new Map(nodes.map(n => [n.id, n]));
}

/**
 * Update a node's input when an upstream node completes
 */
export function propagateNodeOutput(
  nodes: NodeMap,
  completedNodeId: NodeId,
  outputContent: string
): NodeMap {
  const newNodes = new Map(nodes);

  for (const [id, node] of nodes) {
    const deps = getNodeDependencies(node);
    if (deps.includes(completedNodeId)) {
      const updatedInput = resolveNodeOutput(node.input, completedNodeId, outputContent);
      newNodes.set(id, { ...node, input: updatedInput });
    }
  }

  return newNodes;
}
