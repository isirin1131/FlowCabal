/**
 * FlowWrite Database
 *
 * IndexedDB persistence using Dexie.js with a document-oriented schema.
 * Stores workflows as complete JSON documents and settings as key-value pairs.
 *
 * Serialization Strategy:
 * - TextBlock, VirtualTextBlock, TextBlockList: Plain objects, serialize directly
 * - Node, ApiConfiguration: Plain objects with nested TextBlockLists
 * - Workflow: Contains Map<NodeId, Node> which requires conversion to array
 */

import Dexie, { type Table } from 'dexie';
import type {
  Workflow,
  Node,
  NodeId,
  TextBlockList,
  AnyTextBlock,
  TextBlock,
  VirtualTextBlock,
  ApiConfiguration
} from '../core';

// ============================================================================
// Record Types
// ============================================================================

/**
 * Workflow storage record
 * Stores the entire workflow object as a JSON document
 */
export interface WorkflowRecord {
  id: string;
  name: string;
  data: string;  // JSON.stringify(Workflow) - stored as string for compatibility
  createdAt: number;
  updatedAt: number;
}

/**
 * Settings storage record
 * Key-value store for app settings, preferences, and API test state
 */
export interface SettingsRecord {
  key: string;
  value: string;  // JSON.stringify(value) - stored as string for compatibility
  updatedAt: number;
}

// ============================================================================
// Database Definition
// ============================================================================

class FlowWriteDB extends Dexie {
  workflows!: Table<WorkflowRecord>;
  settings!: Table<SettingsRecord>;

  constructor() {
    super('FlowWriteDB');

    this.version(1).stores({
      // Workflows indexed by id (primary), name, and updatedAt for sorting
      workflows: 'id, name, updatedAt',
      // Settings indexed by key (primary)
      settings: 'key'
    });
  }
}

// ============================================================================
// Database Instance
// ============================================================================

export const db = new FlowWriteDB();

// ============================================================================
// Type Guards for Validation
// ============================================================================

/**
 * Validate that an object is a valid TextBlock
 */
export function isValidTextBlock(obj: unknown): obj is TextBlock {
  if (!obj || typeof obj !== 'object') return false;
  const block = obj as Record<string, unknown>;
  return (
    block.type === 'text' &&
    typeof block.id === 'string' &&
    typeof block.content === 'string'
  );
}

/**
 * Validate that an object is a valid VirtualTextBlock
 */
export function isValidVirtualTextBlock(obj: unknown): obj is VirtualTextBlock {
  if (!obj || typeof obj !== 'object') return false;
  const block = obj as Record<string, unknown>;
  return (
    block.type === 'virtual' &&
    typeof block.id === 'string' &&
    typeof block.sourceNodeId === 'string' &&
    ['pending', 'resolved', 'error'].includes(block.state as string) &&
    typeof block.frozen === 'boolean'
  );
}

/**
 * Validate that an object is a valid AnyTextBlock
 */
export function isValidAnyTextBlock(obj: unknown): obj is AnyTextBlock {
  return isValidTextBlock(obj) || isValidVirtualTextBlock(obj);
}

/**
 * Validate that an object is a valid TextBlockList
 */
export function isValidTextBlockList(obj: unknown): obj is TextBlockList {
  if (!obj || typeof obj !== 'object') return false;
  const list = obj as Record<string, unknown>;
  return (
    typeof list.id === 'string' &&
    Array.isArray(list.blocks) &&
    list.blocks.every(isValidAnyTextBlock)
  );
}

/**
 * Validate that an object is a valid ApiConfiguration
 */
export function isValidApiConfiguration(obj: unknown): obj is ApiConfiguration {
  if (!obj || typeof obj !== 'object') return false;
  const config = obj as Record<string, unknown>;
  return (
    config.connection !== null &&
    typeof config.connection === 'object' &&
    config.parameters !== null &&
    typeof config.parameters === 'object' &&
    isValidTextBlockList(config.systemPrompt) &&
    isValidTextBlockList(config.userPrompt)
  );
}

/**
 * Validate that an object is a valid Node
 */
export function isValidNode(obj: unknown): obj is Node {
  if (!obj || typeof obj !== 'object') return false;
  const node = obj as Record<string, unknown>;
  return (
    typeof node.id === 'string' &&
    typeof node.name === 'string' &&
    isValidApiConfiguration(node.apiConfig) &&
    ['idle', 'pending', 'running', 'completed', 'error'].includes(node.state as string) &&
    node.position !== null &&
    typeof node.position === 'object'
  );
}

// ============================================================================
// Serialization Functions
// ============================================================================

/**
 * Serialized workflow structure (for storage)
 */
interface SerializedWorkflow {
  id: string;
  name: string;
  nodes: [NodeId, Node][];
  state: string;
  executionOrder: NodeId[];
  currentIndex: number;
}

/**
 * Serialize a workflow for storage
 * Converts NodeMap to array of [id, node] tuples
 */
export function serializeWorkflow(workflow: Workflow): string {
  const serializable: SerializedWorkflow = {
    id: workflow.id,
    name: workflow.name,
    nodes: Array.from(workflow.nodes.entries()),
    state: workflow.state,
    executionOrder: workflow.executionOrder,
    currentIndex: workflow.currentIndex
  };
  return JSON.stringify(serializable);
}

/**
 * Deserialize a workflow from storage
 * Validates structure and converts nodes array back to Map
 */
export function deserializeWorkflow(data: string): Workflow {
  const parsed = JSON.parse(data) as SerializedWorkflow;

  // Validate basic structure
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid workflow data: not an object');
  }

  if (typeof parsed.id !== 'string' || typeof parsed.name !== 'string') {
    throw new Error('Invalid workflow data: missing id or name');
  }

  if (!Array.isArray(parsed.nodes)) {
    throw new Error('Invalid workflow data: nodes is not an array');
  }

  // Validate each node entry
  const nodeEntries: [NodeId, Node][] = [];
  for (const entry of parsed.nodes) {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new Error('Invalid workflow data: invalid node entry format');
    }
    const [nodeId, node] = entry;
    if (typeof nodeId !== 'string') {
      throw new Error('Invalid workflow data: node ID is not a string');
    }
    if (!isValidNode(node)) {
      throw new Error(`Invalid workflow data: invalid node structure for node ${nodeId}`);
    }
    nodeEntries.push([nodeId, node as Node]);
  }

  return {
    id: parsed.id,
    name: parsed.name,
    nodes: new Map(nodeEntries),
    state: (parsed.state || 'idle') as Workflow['state'],
    executionOrder: Array.isArray(parsed.executionOrder) ? parsed.executionOrder : [],
    currentIndex: typeof parsed.currentIndex === 'number' ? parsed.currentIndex : 0
  };
}

// ============================================================================
// Individual Serialization Helpers
// ============================================================================

/**
 * Serialize a TextBlockList (plain JSON)
 * Can be used for storing prompts independently
 */
export function serializeTextBlockList(list: TextBlockList): string {
  return JSON.stringify(list);
}

/**
 * Deserialize a TextBlockList with validation
 */
export function deserializeTextBlockList(data: string): TextBlockList {
  const parsed = JSON.parse(data);
  if (!isValidTextBlockList(parsed)) {
    throw new Error('Invalid TextBlockList data');
  }
  return parsed;
}

/**
 * Serialize a Node (plain JSON)
 * Can be used for storing individual nodes or templates
 */
export function serializeNode(node: Node): string {
  return JSON.stringify(node);
}

/**
 * Deserialize a Node with validation
 */
export function deserializeNode(data: string): Node {
  const parsed = JSON.parse(data);
  if (!isValidNode(parsed)) {
    throw new Error('Invalid Node data');
  }
  return parsed;
}

/**
 * Serialize an ApiConfiguration (plain JSON)
 * Can be used for storing API presets
 */
export function serializeApiConfiguration(config: ApiConfiguration): string {
  return JSON.stringify(config);
}

/**
 * Deserialize an ApiConfiguration with validation
 */
export function deserializeApiConfiguration(data: string): ApiConfiguration {
  const parsed = JSON.parse(data);
  if (!isValidApiConfiguration(parsed)) {
    throw new Error('Invalid ApiConfiguration data');
  }
  return parsed;
}
