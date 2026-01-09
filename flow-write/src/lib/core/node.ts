/**
 * Node System for FlowWrite
 *
 * A node represents a single LLM API call in the workflow.
 * - Input: ApiConfiguration (connection, parameters, prompts as TextBlockLists)
 * - Output: TextBlock (LLM response)
 */

import {
  type TextBlock,
  type NodeId,
  createTextBlock,
  generateId
} from './textblock';

import {
  type ApiConfiguration,
  createApiConfiguration,
  getApiConfigDependencies,
  isApiConfigReady,
  getSystemPromptContent,
  getUserPromptContent,
  resolveApiConfigOutput
} from './apiconfig';

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
// Node
// ============================================================================

export interface Node {
  readonly id: NodeId;
  /** Display name for the node */
  name: string;
  /** API configuration (connection, parameters, prompts) */
  apiConfig: ApiConfiguration;
  /** Output from LLM (null until execution completes) */
  output: TextBlock | null;
  /** Current execution state */
  state: NodeState;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Position in the canvas (for UI) */
  position: { x: number; y: number };
}

export function createNode(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  apiConfig: ApiConfiguration = createApiConfiguration()
): Node {
  return {
    id: generateId(),
    name,
    apiConfig,
    output: null,
    state: 'idle',
    position
  };
}

/**
 * Get the dependencies of a node (source nodes it depends on)
 */
export function getNodeDependencies(node: Node): NodeId[] {
  return getApiConfigDependencies(node.apiConfig);
}

/**
 * Check if a node is ready to execute (all dependencies resolved)
 */
export function isNodeReady(node: Node): boolean {
  return isApiConfigReady(node.apiConfig);
}

/**
 * Get the final prompt strings for a node
 */
export function getNodePrompt(node: Node): { system: string; user: string } {
  return {
    system: getSystemPromptContent(node.apiConfig),
    user: getUserPromptContent(node.apiConfig)
  };
}

/**
 * Update node API configuration
 */
export function updateNodeApiConfig(node: Node, apiConfig: ApiConfiguration): Node {
  return { ...node, apiConfig };
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
 * Update a node's apiConfig when an upstream node completes
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
      const updatedApiConfig = resolveApiConfigOutput(
        node.apiConfig,
        completedNodeId,
        outputContent
      );
      newNodes.set(id, { ...node, apiConfig: updatedApiConfig });
    }
  }

  return newNodes;
}
