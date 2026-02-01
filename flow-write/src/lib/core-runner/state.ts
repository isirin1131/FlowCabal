/**
 * Core Runner State Types
 *
 * This file contains all runtime state types that are NOT persisted.
 * These types are ephemeral and managed during workflow execution.
 *
 * Design Principle:
 * - core/ contains metadata (static, serializable)
 * - core-runner/ contains running-state (ephemeral, volatile)
 */

import type { NodeId, TextBlockId } from '$lib/core/textblock';

// ============================================================================
// Node Runtime State
// ============================================================================

/**
 * Execution state of a node
 */
export type NodeState = 'idle' | 'pending' | 'running' | 'completed' | 'error';

/**
 * Runtime state for a single node
 */
export interface NodeRuntimeState {
  /** Current execution state */
  state: NodeState;
  /** Output content from LLM (null until completed) */
  output: string | null;
  /** Error message if state is 'error' */
  errorMessage?: string;
  /** Timestamp when execution started */
  startedAt?: number;
  /** Timestamp when execution completed/errored */
  finishedAt?: number;
}

/**
 * Create initial node runtime state
 */
export function createNodeRuntimeState(): NodeRuntimeState {
  return {
    state: 'idle',
    output: null
  };
}

/**
 * Map of node IDs to their runtime states
 */
export type NodeStateMap = Map<NodeId, NodeRuntimeState>;

// ============================================================================
// Virtual Block Runtime State
// ============================================================================

/**
 * Resolution state of a virtual text block
 */
export type VirtualBlockResolutionState = 'pending' | 'resolved' | 'error';

/**
 * Runtime state for a virtual text block
 */
export interface VirtualBlockState {
  /** Current resolution state */
  state: VirtualBlockResolutionState;
  /** Resolved content (available when state is 'resolved') */
  resolvedContent: string | null;
  /** Whether the content is frozen (won't update on re-execution) */
  frozen: boolean;
}

/**
 * Create initial virtual block state
 */
export function createVirtualBlockState(): VirtualBlockState {
  return {
    state: 'pending',
    resolvedContent: null,
    frozen: false
  };
}

/**
 * Map of virtual block IDs to their runtime states
 */
export type VirtualBlockStateMap = Map<TextBlockId, VirtualBlockState>;

// ============================================================================
// Workflow Runtime State
// ============================================================================

/**
 * Execution state of a workflow
 */
export type WorkflowState = 'idle' | 'running' | 'paused' | 'completed' | 'error';

/**
 * Runtime state for a workflow execution
 */
export interface WorkflowRuntimeState {
  /** Workflow ID being executed */
  workflowId: string;
  /** Current execution state */
  state: WorkflowState;
  /** Execution order determined by topological sort */
  executionOrder: NodeId[];
  /** Index of currently executing node in executionOrder */
  currentIndex: number;
  /** Runtime states of all nodes */
  nodeStates: NodeStateMap;
  /** Runtime states of all virtual blocks */
  virtualBlockStates: VirtualBlockStateMap;
  /** Timestamp when execution started */
  startedAt?: number;
  /** Timestamp when execution completed/errored */
  finishedAt?: number;
  /** Overall error message if state is 'error' */
  errorMessage?: string;
}

/**
 * Create initial workflow runtime state
 */
export function createWorkflowRuntimeState(workflowId: string): WorkflowRuntimeState {
  return {
    workflowId,
    state: 'idle',
    executionOrder: [],
    currentIndex: 0,
    nodeStates: new Map(),
    virtualBlockStates: new Map()
  };
}

// ============================================================================
// State Update Helpers
// ============================================================================

/**
 * Update a node's runtime state
 */
export function updateNodeState(
  states: NodeStateMap,
  nodeId: NodeId,
  updates: Partial<NodeRuntimeState>
): NodeStateMap {
  const current = states.get(nodeId) ?? createNodeRuntimeState();
  const newStates = new Map(states);
  newStates.set(nodeId, { ...current, ...updates });
  return newStates;
}

/**
 * Set node to pending state
 */
export function setNodePending(states: NodeStateMap, nodeId: NodeId): NodeStateMap {
  return updateNodeState(states, nodeId, {
    state: 'pending',
    errorMessage: undefined
  });
}

/**
 * Set node to running state
 */
export function setNodeRunning(states: NodeStateMap, nodeId: NodeId): NodeStateMap {
  return updateNodeState(states, nodeId, {
    state: 'running',
    startedAt: Date.now()
  });
}

/**
 * Set node to completed state
 */
export function setNodeCompleted(
  states: NodeStateMap,
  nodeId: NodeId,
  output: string
): NodeStateMap {
  return updateNodeState(states, nodeId, {
    state: 'completed',
    output,
    finishedAt: Date.now(),
    errorMessage: undefined
  });
}

/**
 * Set node to error state
 */
export function setNodeError(
  states: NodeStateMap,
  nodeId: NodeId,
  errorMessage: string
): NodeStateMap {
  return updateNodeState(states, nodeId, {
    state: 'error',
    errorMessage,
    finishedAt: Date.now()
  });
}

/**
 * Reset a node to idle state
 */
export function resetNodeState(states: NodeStateMap, nodeId: NodeId): NodeStateMap {
  return updateNodeState(states, nodeId, createNodeRuntimeState());
}

/**
 * Update a virtual block's state
 */
export function updateVirtualBlockState(
  states: VirtualBlockStateMap,
  blockId: TextBlockId,
  updates: Partial<VirtualBlockState>
): VirtualBlockStateMap {
  const current = states.get(blockId) ?? createVirtualBlockState();
  const newStates = new Map(states);
  newStates.set(blockId, { ...current, ...updates });
  return newStates;
}

/**
 * Resolve a virtual block with content
 */
export function resolveVirtualBlock(
  states: VirtualBlockStateMap,
  blockId: TextBlockId,
  content: string
): VirtualBlockStateMap {
  const current = states.get(blockId);
  
  // Don't update frozen blocks
  if (current?.frozen) {
    return states;
  }
  
  return updateVirtualBlockState(states, blockId, {
    state: 'resolved',
    resolvedContent: content
  });
}

/**
 * Freeze a virtual block
 */
export function freezeVirtualBlock(
  states: VirtualBlockStateMap,
  blockId: TextBlockId
): VirtualBlockStateMap {
  const current = states.get(blockId);
  
  // Can only freeze resolved blocks
  if (current?.state !== 'resolved' || current.resolvedContent === null) {
    return states;
  }
  
  return updateVirtualBlockState(states, blockId, { frozen: true });
}

/**
 * Unfreeze a virtual block
 */
export function unfreezeVirtualBlock(
  states: VirtualBlockStateMap,
  blockId: TextBlockId
): VirtualBlockStateMap {
  return updateVirtualBlockState(states, blockId, { frozen: false });
}

/**
 * Reset a virtual block to pending state (if not frozen)
 */
export function resetVirtualBlock(
  states: VirtualBlockStateMap,
  blockId: TextBlockId
): VirtualBlockStateMap {
  const current = states.get(blockId);
  
  // Don't reset frozen blocks
  if (current?.frozen) {
    return states;
  }
  
  return updateVirtualBlockState(states, blockId, {
    state: 'pending',
    resolvedContent: null
  });
}
