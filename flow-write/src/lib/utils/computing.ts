import type { Node, Edge } from '@xyflow/svelte';

export interface FlowExecutionOrder {
  nodes: Node[];
  edges: Edge[];
  executionOrder: string[];
  error?: string;
}

export function topologicalSort(nodes: Node[], edges: Edge[]): FlowExecutionOrder {
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
  }

  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  const executionOrder: string[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    executionOrder.push(current);

    const neighbors = adj.get(current) || [];
    for (const neighbor of neighbors) {
      inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
      if (inDegree.get(neighbor) === 0) {
        queue.push(neighbor);
      }
    }
  }

  if (executionOrder.length !== nodes.length) {
    return {
      nodes,
      edges,
      executionOrder: [],
      error: 'Cycle detected in workflow - cannot determine execution order'
    };
  }

  return { nodes, edges, executionOrder };
}

export function getExecutionOrder(nodes: Node[], edges: Edge[]): string[] {
  const result = topologicalSort(nodes, edges);
  return result.executionOrder;
}

export function getNodeDependencies(nodeId: string, edges: Edge[]): string[] {
  return edges
    .filter(e => e.target === nodeId)
    .map(e => e.source);
}

export function getNodeDependents(nodeId: string, edges: Edge[]): string[] {
  return edges
    .filter(e => e.source === nodeId)
    .map(e => e.target);
}

export function canExecuteNode(nodeId: string, completedNodes: Set<string>, edges: Edge[]): boolean {
  const dependencies = getNodeDependencies(nodeId, edges);
  return dependencies.every(dep => completedNodes.has(dep));
}

export function findPathBetweenNodes(
  startNodeId: string,
  endNodeId: string,
  edges: Edge[]
): string[] | null {
  const visited = new Set<string>();
  const queue: { nodeId: string; path: string[] }[] = [{ nodeId: startNodeId, path: [startNodeId] }];

  while (queue.length > 0) {
    const { nodeId, path } = queue.shift()!;

    if (nodeId === endNodeId) {
      return path;
    }

    if (visited.has(nodeId)) continue;
    visited.add(nodeId);

    const outgoing = edges.filter(e => e.source === nodeId);
    for (const edge of outgoing) {
      if (!visited.has(edge.target)) {
        queue.push({ nodeId: edge.target, path: [...path, edge.target] });
      }
    }
  }

  return null;
}
