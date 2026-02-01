/**
 * Core Runner Module
 *
 * Manages workflow execution and runtime state.
 *
 * Architecture:
 * - core/ contains metadata (static, serializable)
 * - core-runner/ contains running-state (ephemeral, volatile)
 *
 * The WorkflowRunner class:
 * - Listens to EventBus commands (workflow:run, workflow:stop)
 * - Manages node execution sequentially based on topological order
 * - Emits state updates via EventBus (node:state, node:output)
 * - Handles UI locking during execution
 */

// Export state types and helpers
export {
  type NodeState,
  type NodeRuntimeState,
  type NodeStateMap,
  type VirtualBlockResolutionState,
  type VirtualBlockState,
  type VirtualBlockStateMap,
  type WorkflowState,
  type WorkflowRuntimeState,
  createNodeRuntimeState,
  createVirtualBlockState,
  createWorkflowRuntimeState,
  updateNodeState,
  setNodePending,
  setNodeRunning,
  setNodeCompleted,
  setNodeError,
  resetNodeState,
  updateVirtualBlockState,
  resolveVirtualBlock,
  freezeVirtualBlock,
  unfreezeVirtualBlock,
  resetVirtualBlock
} from './state';
