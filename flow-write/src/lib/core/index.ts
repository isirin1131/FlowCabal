/**
 * FlowWrite Core Module
 *
 * Export all core types and functions for the workflow system.
 */

// Text Block System
export {
  // Types
  type TextBlockId,
  type NodeId,
  type TextBlock,
  type VirtualTextBlock,
  type VirtualTextBlockState,
  type AnyTextBlock,
  type TextBlockList,

  // TextBlock functions
  generateId,
  createTextBlock,

  // VirtualTextBlock functions
  createVirtualTextBlock,
  resolveVirtualTextBlock,
  errorVirtualTextBlock,
  freezeVirtualTextBlock,
  unfreezeVirtualTextBlock,
  resetVirtualTextBlock,

  // AnyTextBlock functions
  getBlockContent,
  isBlockReady,

  // TextBlockList functions
  createTextBlockList,
  appendBlock,
  insertBlock,
  removeBlock,
  updateBlock,
  findBlock,
  getListContent,
  isListReady,
  getPendingVirtualBlocks,
  getDependencies,
  resolveNodeOutput,
  resetNodeDependents
} from './textblock';

// Node System
export {
  // Types
  type NodeState,
  type LLMConfig,
  type Node,
  type NodeMap,

  // Constants
  defaultLLMConfig,

  // Node functions
  createNode,
  getNodeDependencies,
  isNodeReady,
  getNodePrompt,
  updateNodeInput,
  setNodePending,
  setNodeRunning,
  setNodeCompleted,
  setNodeError,
  resetNode,
  getNodeOutput,

  // Node collection functions
  createNodeMap,
  propagateNodeOutput
} from './node';

// Workflow System
export {
  // Types
  type WorkflowState,
  type Workflow,
  type DependencyError,
  type TopologicalSortResult,
  type NodeExecutor,

  // Workflow functions
  createWorkflow,
  topologicalSort,
  prepareWorkflow,
  executeNode,
  executeWorkflow,
  addNode,
  removeNode,
  updateNode,
  getNode,
  getNodes,
  resetWorkflow
} from './workflow';
