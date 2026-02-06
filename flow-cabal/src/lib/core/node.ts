/**
 * Node System for FlowCabal (metadata only)
 *
 * A NodeDefinition describes a node in the workflow graph.
 * Runtime state (execution state, output) belongs in core-runner.
 */

import { type NodeId, generateId } from './textblock';
import {
  type ApiConfiguration,
  createApiConfiguration,
  getApiConfigDependencies
} from './apiconfig';

// ============================================================================
// NodeDefinition - Pure metadata, no runtime state
// ============================================================================

export interface NodeDefinition {
  readonly id: NodeId;
  /** Display name for the node */
  name: string;
  /** Position in the canvas (for UI) */
  position: { x: number; y: number };
  /** API configuration (connection, parameters, prompts) */
  apiConfig: ApiConfiguration;
}

export function createNodeDefinition(
  name: string,
  position: { x: number; y: number } = { x: 0, y: 0 },
  apiConfig: ApiConfiguration = createApiConfiguration()
): NodeDefinition {
  return {
    id: generateId(),
    name,
    position,
    apiConfig
  };
}

/**
 * Get the dependencies of a node (source nodes referenced in prompts)
 */
export function getNodeDependencies(node: NodeDefinition): NodeId[] {
  return getApiConfigDependencies(node.apiConfig);
}

/**
 * Update node API configuration
 */
export function updateNodeApiConfig(
  node: NodeDefinition,
  updater: (config: ApiConfiguration) => ApiConfiguration
): NodeDefinition {
  return { ...node, apiConfig: updater(node.apiConfig) };
}

/**
 * Update node position
 */
export function updateNodePosition(
  node: NodeDefinition,
  position: { x: number; y: number }
): NodeDefinition {
  return { ...node, position };
}

/**
 * Update node name
 */
export function updateNodeName(node: NodeDefinition, name: string): NodeDefinition {
  return { ...node, name };
}

// ============================================================================
// Node Collection Type
// ============================================================================

export type NodeMap = Map<NodeId, NodeDefinition>;

export function createNodeMap(nodes: NodeDefinition[] = []): NodeMap {
  return new Map(nodes.map(n => [n.id, n]));
}
