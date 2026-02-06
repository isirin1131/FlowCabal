/**
 * FlowCabal Core Module (metadata only)
 *
 * Exports type definitions and pure functions for workflow metadata.
 * Runtime state and execution logic belong in core-runner.
 */

// Text Block System
export {
  type TextBlockId,
  type NodeId,
  type TextBlock,
  type VirtualTextBlockDef,
  type AnyTextBlockDef,
  type TextBlockList,

  generateId,
  createTextBlock,
  createVirtualTextBlockDef,
  createTextBlockList,
  appendBlock,
  insertBlock,
  removeBlock,
  updateBlock,
  findBlock,
  getDependencies
} from './textblock';

// API Configuration System
export {
  type ApiConnection,
  type ApiParameters,
  type ApiConfiguration,

  defaultApiConnection,
  defaultApiParameters,

  createApiConfiguration,
  getApiConfigDependencies,
  updateApiConnection,
  updateApiParameters,
  updateSystemPrompt,
  updateUserPrompt
} from './apiconfig';

// Node System
export {
  type NodeDefinition,
  type NodeMap,

  createNodeDefinition,
  getNodeDependencies,
  updateNodeApiConfig,
  updateNodePosition,
  updateNodeName,
  createNodeMap
} from './node';

// Workflow System
export {
  type WorkflowDefinition,
  type DependencyError,
  type TopologicalSortResult,

  createWorkflowDefinition,
  topologicalSort,
  addNode,
  removeNode,
  updateNode,
  getNode,
  getNodes
} from './workflow';
