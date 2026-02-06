/**
 * Workflow System for FlowCabal (metadata only)
 *
 * WorkflowDefinition describes the structure of a workflow.
 * Runtime state (execution state, order) belongs in core-runner.
 */

import {
  type NodeDefinition,
  type NodeMap,
  createNodeMap,
  getNodeDependencies
} from './node';
import { type NodeId } from './textblock';

// ============================================================================
// WorkflowDefinition - Pure metadata, no runtime state
// ============================================================================

export interface WorkflowDefinition {
  readonly id: string;
  name: string;
  nodes: NodeMap;
}

export function createWorkflowDefinition(
  name: string,
  nodes: NodeDefinition[] = []
): WorkflowDefinition {
  return {
    id: crypto.randomUUID(),
    name,
    nodes: createNodeMap(nodes)
  };
}

// ============================================================================
// Dependency Analysis (pure functions on metadata)
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
 * Perform topological sort on nodes using Kahn's algorithm.
 * Returns execution order or error if cycle/missing dependency detected.
 */
export function topologicalSort(nodes: NodeMap): TopologicalSortResult {
  const inDegree = new Map<NodeId, number>();
  const dependents = new Map<NodeId, NodeId[]>();

  for (const [id] of nodes) {
    inDegree.set(id, 0);
    dependents.set(id, []);
  }

  for (const [id, node] of nodes) {
    const deps = getNodeDependencies(node);

    for (const depId of deps) {
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

  const queue: NodeId[] = [];
  const result: NodeId[] = [];

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

// ============================================================================
// Workflow Modification (pure functions on metadata)
// ============================================================================

export function addNode(
  workflow: WorkflowDefinition,
  node: NodeDefinition
): WorkflowDefinition {
  const nodes = new Map(workflow.nodes);
  nodes.set(node.id, node);
  return { ...workflow, nodes };
}

export function removeNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId
): WorkflowDefinition {
  const nodes = new Map(workflow.nodes);
  nodes.delete(nodeId);
  return { ...workflow, nodes };
}

export function updateNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId,
  updater: (node: NodeDefinition) => NodeDefinition
): WorkflowDefinition {
  const node = workflow.nodes.get(nodeId);
  if (!node) return workflow;

  const nodes = new Map(workflow.nodes);
  nodes.set(nodeId, updater(node));
  return { ...workflow, nodes };
}

export function getNode(
  workflow: WorkflowDefinition,
  nodeId: NodeId
): NodeDefinition | undefined {
  return workflow.nodes.get(nodeId);
}

export function getNodes(workflow: WorkflowDefinition): NodeDefinition[] {
  return Array.from(workflow.nodes.values());
}
