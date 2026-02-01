/**
 * Node System for FlowWrite (v2 - Metadata Only)
 *
 * A NodeDefinition represents the static metadata of a node.
 * Runtime state (execution status, output) is managed in core-runner.
 *
 * This separation ensures:
 * - NodeDefinition is fully serializable for persistence
 * - Clean boundary between "what a node is" and "how it's running"
 */

import { type NodeId, generateId } from './textblock';
import {
  type ApiConfiguration,
  createApiConfiguration,
  getApiConfigDependencies
} from './apiconfig';

// ============================================================================
// Re-export commonly used types
// ============================================================================

export type { NodeId } from './textblock';

// ============================================================================
// NodeDefinition - Static node metadata
// ============================================================================

/**
 * Static definition of a node (metadata only).
 *
 * NOTE: Unlike v1 Node, this does NOT contain:
 * - state (idle/pending/running/completed/error)
 * - output (TextBlock)
 * - errorMessage
 *
 * Those are runtime state, managed in core-runner/state.ts as NodeRuntimeState.
 */
export interface NodeDefinition {
  readonly id: NodeId;
  /** Display name for the node */
  name: string;
  /** Position in the canvas (for UI persistence) */
  position: { x: number; y: number };
  /** API configuration (connection, parameters, prompts) */
  apiConfig: ApiConfiguration;
}

/**
 * Create a new node definition
 */
export function createNodeDef(
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
 * Get the dependencies of a node (source nodes it depends on)
 */
export function getNodeDependencies(node: NodeDefinition): NodeId[] {
  return getApiConfigDependencies(node.apiConfig);
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

/**
 * Update node API configuration
 */
export function updateNodeApiConfig(
  node: NodeDefinition,
  apiConfig: ApiConfiguration
): NodeDefinition {
  return { ...node, apiConfig };
}

/**
 * Update node API configuration with a partial update
 */
export function updateNodeApiConfigPartial(
  node: NodeDefinition,
  updates: Partial<ApiConfiguration>
): NodeDefinition {
  return {
    ...node,
    apiConfig: { ...node.apiConfig, ...updates }
  };
}

// ============================================================================
// NodeMap - Collection type
// ============================================================================

export type NodeMap = Map<NodeId, NodeDefinition>;

/**
 * Create a NodeMap from an array of nodes
 */
export function createNodeMap(nodes: NodeDefinition[] = []): NodeMap {
  return new Map(nodes.map(n => [n.id, n]));
}

/**
 * Convert a NodeMap to an array
 */
export function nodeMapToArray(nodes: NodeMap): NodeDefinition[] {
  return Array.from(nodes.values());
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize a NodeMap for persistence
 */
export function serializeNodeMap(nodes: NodeMap): unknown {
  return Array.from(nodes.entries());
}

/**
 * Deserialize a NodeMap from persistence
 */
export function deserializeNodeMap(data: unknown): NodeMap {
  const entries = data as [NodeId, NodeDefinition][];
  return new Map(entries);
}
