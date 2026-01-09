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

// API Configuration System
export {
  // Types
  type ApiConnection,
  type ApiParameters,
  type ApiConfiguration,

  // Constants
  defaultApiConnection,
  defaultApiParameters,

  // Functions
  createApiConfiguration,
  getApiConfigDependencies,
  isApiConfigReady,
  getSystemPromptContent,
  getUserPromptContent,
  resolveApiConfigOutput,
  updateApiConnection,
  updateApiParameters,
  updateSystemPrompt,
  updateUserPrompt
} from './apiconfig';

// Node System
export {
  // Types
  type NodeState,
  type Node,
  type NodeMap,

  // Node functions
  createNode,
  getNodeDependencies,
  isNodeReady,
  getNodePrompt,
  updateNodeApiConfig,
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
