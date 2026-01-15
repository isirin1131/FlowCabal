import type { Node, Edge } from '@xyflow/svelte';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateConnection(
  connection: { source: string | null; target: string | null },
  nodes: Node[],
  edges: Edge[]
): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!connection.source || !connection.target) {
    errors.push('Both source and target must be defined');
    return { valid: false, errors, warnings };
  }

  if (connection.source === connection.target) {
    errors.push('Cannot connect a node to itself');
    return { valid: false, errors, warnings };
  }

  const sourceNode = nodes.find(n => n.id === connection.source);
  const targetNode = nodes.find(n => n.id === connection.target);

  if (!sourceNode || !targetNode) {
    errors.push('Source or target node not found');
    return { valid: false, errors, warnings };
  }

  const existingEdges = edges.filter(
    e => e.source === connection.source && e.target === connection.target
  );
  if (existingEdges.length > 0) {
    warnings.push('Connection already exists');
  }

  const incomingEdges = edges.filter(e => e.target === connection.target);
  const hasRequiredInput = targetNode.data?.requiresInput === true;
  if (hasRequiredInput && incomingEdges.length >= 1) {
    warnings.push('Target already has incoming connections');
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function validateWorkflow(nodes: Node[], edges: Edge[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (nodes.length === 0) {
    warnings.push('No nodes in workflow');
  }

  const nodeIds = new Set(nodes.map(n => n.id));
  for (const edge of edges) {
    if (!nodeIds.has(edge.source)) {
      errors.push(`Edge ${edge.id} references non-existent source node ${edge.source}`);
    }
    if (!nodeIds.has(edge.target)) {
      errors.push(`Edge ${edge.id} references non-existent target node ${edge.target}`);
    }
  }

  const nodesWithNoIncoming = nodes.filter(node => {
    return !edges.some(e => e.target === node.id);
  });
  const inputNodes = nodes.filter(n => n.type === 'input' || n.data?.isInput === true);
  const missingInputs = nodesWithNoIncoming.filter(n => !inputNodes.includes(n));
  if (missingInputs.length > 1) {
    warnings.push(`${missingInputs.length} nodes have no incoming connections (may need input nodes)`);
  }

  const nodesWithNoOutgoing = nodes.filter(node => {
    return !edges.some(e => e.source === node.id);
  });
  const outputNodes = nodes.filter(n => n.type === 'output' || n.data?.isOutput === true);
  const missingOutputs = nodesWithNoOutgoing.filter(n => !outputNodes.includes(n));
  if (missingOutputs.length > 0) {
    warnings.push(`${missingOutputs.length} nodes have no outgoing connections`);
  }

  return { valid: errors.length === 0, errors, warnings };
}

export function hasCycles(nodes: Node[], edges: Edge[]): boolean {
  const adj = new Map<string, string[]>();
  for (const node of nodes) {
    adj.set(node.id, []);
  }
  for (const edge of edges) {
    adj.get(edge.source)?.push(edge.target);
  }

  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  function hasCycleDFS(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);

    const neighbors = adj.get(nodeId) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycleDFS(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        return true;
      }
    }

    recursionStack.delete(nodeId);
    return false;
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      if (hasCycleDFS(node.id)) return true;
    }
  }

  return false;
}
