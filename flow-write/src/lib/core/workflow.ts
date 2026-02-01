/**
 * Workflow System for FlowWrite (v2 - Metadata Only)
 *
 * A WorkflowDefinition represents the static metadata of a workflow.
 * Runtime state (execution status, current node) is managed in core-runner.
 *
 * This file contains:
 * - WorkflowDefinition type
 * - Topological sort algorithm (pure function)
 * - Workflow modification functions
 */

import {
  type NodeId,
  type NodeDefinition,
  type NodeMap,
  createNodeMap,
  getNodeDependencies,
  nodeMapToArray,
  serializeNodeMap,
  deserializeNodeMap
} from './node';
import { removeNodeReferences } from './textblock';

// ============================================================================
// WorkflowDefinition - Static workflow metadata
// ============================================================================

/**
 * Static definition of a workflow (metadata only).
 *
 * NOTE: Unlike v1 Workflow, this does NOT contain:
 * - state (idle/running/completed/error)
 * - executionOrder
 * - currentIndex
 *
 * Those are runtime state, managed in core-runner/state.ts as WorkflowRuntimeState.
 */
export interface WorkflowDefinition {
  readonly id: string;
  /** Display name for the workflow */
  name: string;
  /** Collection of node definitions */
  nodes: NodeMap;
  /** Optional description */
  description?: string;
  /** Creation timestamp */
  createdAt?: number;
  /** Last modified timestamp */
  updatedAt?: number;
}

/**
 * Create a new workflow definition
 */
export function createWorkflowDef(
  name: string,
  nodes: NodeDefinition[] = []
): WorkflowDefinition {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    name,
    nodes: createNodeMap(nodes),
    createdAt: now,
    updatedAt: now
  };
}

// ============================================================================
// Dependency Resolution (Topological Sort)
// ============================================================================

/**
 * Error types for dependency resolution
 */
export interface DependencyError {
  type: 'cycle' | 'missing';
  nodeIds: NodeId[];
  message: string;
}

/**
 * Result of topological sort
 */
export type TopologicalSortResult =
  | { success: true; order: NodeId[] }
  | { success: false; error: DependencyError };

/**
 * Perform topological sort on nodes using Kahn's algorithm.
 * Returns execution order or error if cycle/missing dependency detected.
 *
 * This is a pure function - it does not modify any state.
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
 * Validate a workflow's dependency graph
 */
export function validateWorkflow(workflow: WorkflowDefinition): TopologicalSortResult {
  return topologicalSort(workflow.nodes);
}

// ============================================================================
// Workflow Modification
// ============================================================================

/**
 * Add a node to the workflow
 */
export function addNode(
  workflow: WorkflowDefinition,
  node: NodeDefinition
): WorkflowDefinition {
  const nodes = new Map(workflow.nodes);
  nodes.set(node.id, node);
  return {
    ...workflow,
    nodes,
    updatedAt: Date.now()
  };
}

/**
 * Remove a node from the workflow
 */
export function removeNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId
): WorkflowDefinition {
  const nodes = new Map(workflow.nodes);
  nodes.delete(nodeId);

  // Clean up references to this node in other nodes' prompts
  for (const [id, node] of nodes) {
    const cleanedSystemPrompt = removeNodeReferences(node.apiConfig.systemPrompt, nodeId);
    const cleanedUserPrompt = removeNodeReferences(node.apiConfig.userPrompt, nodeId);

    if (
      cleanedSystemPrompt !== node.apiConfig.systemPrompt ||
      cleanedUserPrompt !== node.apiConfig.userPrompt
    ) {
      nodes.set(id, {
        ...node,
        apiConfig: {
          ...node.apiConfig,
          systemPrompt: cleanedSystemPrompt,
          userPrompt: cleanedUserPrompt
        }
      });
    }
  }

  return {
    ...workflow,
    nodes,
    updatedAt: Date.now()
  };
}

/**
 * Update a node in the workflow
 */
export function updateNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId,
  updater: (node: NodeDefinition) => NodeDefinition
): WorkflowDefinition {
  const node = workflow.nodes.get(nodeId);
  if (!node) return workflow;

  const nodes = new Map(workflow.nodes);
  nodes.set(nodeId, updater(node));

  return {
    ...workflow,
    nodes,
    updatedAt: Date.now()
  };
}

/**
 * Get a node by ID
 */
export function getNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId
): NodeDefinition | undefined {
  return workflow.nodes.get(nodeId);
}

/**
 * Get all nodes as an array
 */
export function getNodes(workflow: WorkflowDefinition): NodeDefinition[] {
  return nodeMapToArray(workflow.nodes);
}

/**
 * Update workflow metadata
 */
export function updateWorkflowMeta(
  workflow: WorkflowDefinition,
  updates: { name?: string; description?: string }
): WorkflowDefinition {
  return {
    ...workflow,
    ...updates,
    updatedAt: Date.now()
  };
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize a workflow for persistence
 */
export function serializeWorkflow(workflow: WorkflowDefinition): string {
  return JSON.stringify({
    ...workflow,
    nodes: serializeNodeMap(workflow.nodes)
  });
}

/**
 * Deserialize a workflow from persistence
 */
export function deserializeWorkflow(data: string): WorkflowDefinition {
  const parsed = JSON.parse(data);
  return {
    ...parsed,
    nodes: deserializeNodeMap(parsed.nodes)
  };
}
