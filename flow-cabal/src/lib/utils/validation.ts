import type { Node, Edge } from '@xyflow/svelte';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
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
