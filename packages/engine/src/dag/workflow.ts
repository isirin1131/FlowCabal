import type { Workflow, NodeDef, Edge } from "../types.js";

/**
 * Kahn's algorithm — returns nodes in topological order.
 * Throws on cycle detection.
 */
export function topoSort(workflow: Workflow): NodeDef[] {
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));
  const inDegree = new Map<string, number>();
  const adj = new Map<string, string[]>();

  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0);
    adj.set(node.id, []);
  }

  for (const edge of workflow.edges) {
    adj.get(edge.source)!.push(edge.target);
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: NodeDef[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    sorted.push(nodeMap.get(id)!);
    for (const next of adj.get(id)!) {
      const newDeg = inDegree.get(next)! - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    }
  }

  if (sorted.length !== workflow.nodes.length) {
    throw new Error("Workflow contains a cycle");
  }

  return sorted;
}

/** Create a workflow object */
export function createWorkflow(
  id: string,
  name: string,
  nodes: NodeDef[],
  edges: Edge[]
): Workflow {
  return { id, name, nodes, edges };
}
