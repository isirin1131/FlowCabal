/**
 * Workflow System for FlowWrite
 *
 * Manages a collection of nodes and handles:
 * - Dependency resolution (topological sort)
 * - Workflow execution (sequential based on dependencies)
 * - State propagation between nodes
 */

import {
  type Node,
  type NodeMap,
  type NodeState,
  createNodeMap,
  getNodeDependencies,
  isNodeReady,
  getNodePrompt,
  getNodeOutput,
  setNodePending,
  setNodeRunning,
  setNodeCompleted,
  setNodeError,
  resetNode,
  propagateNodeOutput
} from './node';
import { type NodeId, resetNodeDependents } from './textblock';

// ============================================================================
// Workflow State
// ============================================================================

export type WorkflowState = 'idle' | 'running' | 'completed' | 'error';

export interface Workflow {
  readonly id: string;
  name: string;
  nodes: NodeMap;
  state: WorkflowState;
  /** Execution order determined by topological sort */
  executionOrder: NodeId[];
  /** Currently executing node index in executionOrder */
  currentIndex: number;
}

export function createWorkflow(name: string, nodes: Node[] = []): Workflow {
  return {
    id: crypto.randomUUID(),
    name,
    nodes: createNodeMap(nodes),
    state: 'idle',
    executionOrder: [],
    currentIndex: -1
  };
}

// ============================================================================
// Dependency Resolution (Topological Sort)
// ============================================================================

export interface DependencyError {
  type: 'cycle' | 'missing';
  nodeIds: NodeId[];
  message: string;
}

export type TopologicalSortResult =
  | { success: true; order: NodeId[] }
  | { success: false; error: DependencyError };

/**
 * Perform topological sort on nodes using Kahn's algorithm
 * Returns execution order or error if cycle/missing dependency detected
 */
export function topologicalSort(nodes: NodeMap): TopologicalSortResult {
  // Build adjacency list and in-degree count
  const inDegree = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>(); // node -> nodes that depend on it

  // Initialize
  for (const [id] of nodes) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  // Calculate in-degrees and build reverse adjacency
  for (const [id, node] of nodes) {
    const deps = getNodeDependencies(node);

    for (const depId of deps) {
      // Check for missing dependency
      if (!nodes.has(depId)) {
        return {
          success: false,
          error: {
            type: 'missing',
            nodeIds: [id, depId],
            message: `Node "${node.name}" depends on missing node "${depId}"`
          }
        };
      }

      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
      dependents.get(depId)!.push(id);
    }
  }

  // Kahn's algorithm
  const queue: NodeId[] = [];
  const result: NodeId[] = [];

  // Start with nodes that have no dependencies
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    result.push(current);

    for (const dependent of dependents.get(current) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 0) - 1;
      inDegree.set(dependent, newDegree);

      if (newDegree === 0) {
        queue.push(dependent);
      }
    }
  }

  // Check for cycle (not all nodes processed)
  if (result.length !== nodes.size) {
    const cycleNodes = Array.from(nodes.keys()).filter(id => !result.includes(id));
    return {
      success: false,
      error: {
        type: 'cycle',
        nodeIds: cycleNodes,
        message: `Circular dependency detected involving nodes: ${cycleNodes.join(', ')}`
      }
    };
  }

  return { success: true, order: result };
}

/**
 * Prepare workflow for execution
 * Performs topological sort and sets initial states
 */
export function prepareWorkflow(workflow: Workflow): Workflow | DependencyError {
  const sortResult = topologicalSort(workflow.nodes);

  if (!sortResult.success) {
    return sortResult.error;
  }

  // Reset all nodes and set ready ones to pending
  let nodes = new Map(workflow.nodes);
  for (const [id, node] of nodes) {
    const resetted = resetNode(node);
    nodes.set(id, isNodeReady(resetted) ? setNodePending(resetted) : resetted);
  }

  return {
    ...workflow,
    nodes,
    state: 'running',
    executionOrder: sortResult.order,
    currentIndex: 0
  };
}

// ============================================================================
// Workflow Execution
// ============================================================================

/** Callback for executing a single node's LLM call */
export type NodeExecutor = (nodeId: NodeId, prompt: string, node: Node) => Promise<string>;

/**
 * Execute a single node in the workflow
 */
export async function executeNode(
  workflow: Workflow,
  executor: NodeExecutor
): Promise<Workflow> {
  if (workflow.state !== 'running' || workflow.currentIndex >= workflow.executionOrder.length) {
    return workflow;
  }

  const currentNodeId = workflow.executionOrder[workflow.currentIndex];
  const currentNode = workflow.nodes.get(currentNodeId);

  if (!currentNode) {
    return { ...workflow, state: 'error' };
  }

  // Set node to running
  let nodes = new Map(workflow.nodes);
  nodes.set(currentNodeId, setNodeRunning(currentNode));

  try {
    // Execute LLM call
    const prompt = getNodePrompt(currentNode);
    const output = await executor(currentNodeId, prompt, currentNode);

    // Update node with output
    nodes.set(currentNodeId, setNodeCompleted(currentNode, output));

    // Propagate output to dependent nodes
    nodes = propagateNodeOutput(nodes, currentNodeId, output);

    // Update dependent nodes' states (set to pending if now ready)
    for (const [id, node] of nodes) {
      if (node.state === 'idle' && isNodeReady(node)) {
        nodes.set(id, setNodePending(node));
      }
    }

    const nextIndex = workflow.currentIndex + 1;
    const isCompleted = nextIndex >= workflow.executionOrder.length;

    return {
      ...workflow,
      nodes,
      currentIndex: nextIndex,
      state: isCompleted ? 'completed' : 'running'
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    nodes.set(currentNodeId, setNodeError(currentNode, errorMessage));

    return {
      ...workflow,
      nodes,
      state: 'error'
    };
  }
}

/**
 * Execute all nodes in the workflow sequentially
 */
export async function executeWorkflow(
  workflow: Workflow,
  executor: NodeExecutor,
  onProgress?: (workflow: Workflow) => void
): Promise<Workflow> {
  let current = workflow;

  if (current.state !== 'running') {
    const prepared = prepareWorkflow(current);
    if ('type' in prepared) {
      // It's an error
      return { ...current, state: 'error' };
    }
    current = prepared;
  }

  while (current.state === 'running' && current.currentIndex < current.executionOrder.length) {
    current = await executeNode(current, executor);
    onProgress?.(current);
  }

  return current;
}

// ============================================================================
// Workflow Modification
// ============================================================================

/**
 * Add a node to the workflow
 */
export function addNode(workflow: Workflow, node: Node): Workflow {
  const nodes = new Map(workflow.nodes);
  nodes.set(node.id, node);
  return { ...workflow, nodes, state: 'idle', executionOrder: [], currentIndex: -1 };
}

/**
 * Remove a node from the workflow
 */
export function removeNode(workflow: Workflow, nodeId: NodeId): Workflow {
  const nodes = new Map(workflow.nodes);
  nodes.delete(nodeId);

  // Reset virtual blocks in other nodes that referenced this node
  for (const [id, node] of nodes) {
    const updatedInput = resetNodeDependents(node.input, nodeId);
    if (updatedInput !== node.input) {
      nodes.set(id, { ...node, input: updatedInput });
    }
  }

  return { ...workflow, nodes, state: 'idle', executionOrder: [], currentIndex: -1 };
}

/**
 * Update a node in the workflow
 */
export function updateNode(
  workflow: Workflow,
  nodeId: NodeId,
  updater: (node: Node) => Node
): Workflow {
  const node = workflow.nodes.get(nodeId);
  if (!node) return workflow;

  const nodes = new Map(workflow.nodes);
  nodes.set(nodeId, updater(node));

  return { ...workflow, nodes, state: 'idle', executionOrder: [], currentIndex: -1 };
}

/**
 * Get a node by ID
 */
export function getNode(workflow: Workflow, nodeId: NodeId): Node | undefined {
  return workflow.nodes.get(nodeId);
}

/**
 * Get all nodes as an array
 */
export function getNodes(workflow: Workflow): Node[] {
  return Array.from(workflow.nodes.values());
}

/**
 * Reset the workflow to idle state
 */
export function resetWorkflow(workflow: Workflow): Workflow {
  const nodes = new Map(workflow.nodes);

  for (const [id, node] of nodes) {
    nodes.set(id, resetNode(node));
  }

  return {
    ...workflow,
    nodes,
    state: 'idle',
    executionOrder: [],
    currentIndex: -1
  };
}
