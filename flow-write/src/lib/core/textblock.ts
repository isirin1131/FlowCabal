/**
 * TextBlock System for FlowWrite (v2 - Metadata Only)
 *
 * This file contains ONLY metadata definitions (static, serializable).
 * Runtime state (resolved content, freeze status) is managed in core-runner.
 *
 * Types:
 * - TextBlock: Static text content
 * - VirtualTextBlockDef: Definition of a reference to another node's output
 * - TextBlockList: Container managing a sequence of text blocks
 */

// ============================================================================
// ID Types
// ============================================================================

/** Unique identifier for text blocks */
export type TextBlockId = string;

/** Unique identifier for nodes */
export type NodeId = string;

/** Generate a unique ID */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// TextBlock - Basic static text block (metadata)
// ============================================================================

/**
 * Static text block containing user-defined content.
 * Always ready for use, no runtime resolution needed.
 */
export interface TextBlock {
  readonly type: 'text';
  readonly id: TextBlockId;
  /** User-defined content */
  content: string;
}

/**
 * Create a new text block
 */
export function createTextBlock(content: string = ''): TextBlock {
  return {
    type: 'text',
    id: generateId(),
    content
  };
}

// ============================================================================
// VirtualTextBlockDef - Virtual text block definition (metadata only)
// ============================================================================

/**
 * Definition of a virtual text block that references another node's output.
 *
 * NOTE: Unlike v1, this does NOT contain runtime state (resolvedContent, frozen, state).
 * Those are managed in core-runner/state.ts as VirtualBlockState.
 *
 * This ensures VirtualTextBlockDef is fully serializable for persistence.
 */
export interface VirtualTextBlockDef {
  readonly type: 'virtual';
  readonly id: TextBlockId;
  /** The node whose output this block references */
  readonly sourceNodeId: NodeId;
  /** Optional display name for the placeholder (shown when pending) */
  displayName?: string;
}

/**
 * Create a new virtual text block definition
 */
export function createVirtualTextBlockDef(
  sourceNodeId: NodeId,
  displayName?: string
): VirtualTextBlockDef {
  return {
    type: 'virtual',
    id: generateId(),
    sourceNodeId,
    displayName
  };
}

// ============================================================================
// AnyTextBlockDef - Union type for all text block definitions
// ============================================================================

export type AnyTextBlockDef = TextBlock | VirtualTextBlockDef;

/**
 * Check if a block is a virtual text block definition
 */
export function isVirtualBlock(block: AnyTextBlockDef): block is VirtualTextBlockDef {
  return block.type === 'virtual';
}

/**
 * Check if a block is a static text block
 */
export function isStaticBlock(block: AnyTextBlockDef): block is TextBlock {
  return block.type === 'text';
}

// ============================================================================
// TextBlockList - Container for managing text block sequences (metadata)
// ============================================================================

/**
 * Container for a sequence of text blocks.
 * Used in prompts (system prompt, user prompt).
 */
export interface TextBlockList {
  readonly id: string;
  blocks: AnyTextBlockDef[];
}

/**
 * Create a new text block list
 */
export function createTextBlockList(initialBlocks?: AnyTextBlockDef[]): TextBlockList {
  return {
    id: generateId(),
    blocks: initialBlocks ?? []
  };
}

/**
 * Append a text block to the list
 */
export function appendBlock(list: TextBlockList, block: AnyTextBlockDef): TextBlockList {
  return {
    ...list,
    blocks: [...list.blocks, block]
  };
}

/**
 * Insert a text block at a specific index
 */
export function insertBlock(
  list: TextBlockList,
  index: number,
  block: AnyTextBlockDef
): TextBlockList {
  const newBlocks = [...list.blocks];
  newBlocks.splice(index, 0, block);
  return {
    ...list,
    blocks: newBlocks
  };
}

/**
 * Remove a text block by ID
 */
export function removeBlock(list: TextBlockList, blockId: TextBlockId): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.filter(b => b.id !== blockId)
  };
}

/**
 * Update a text block in the list
 */
export function updateBlock(
  list: TextBlockList,
  blockId: TextBlockId,
  updater: (block: AnyTextBlockDef) => AnyTextBlockDef
): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.map(b => b.id === blockId ? updater(b) : b)
  };
}

/**
 * Find a text block by ID
 */
export function findBlock(list: TextBlockList, blockId: TextBlockId): AnyTextBlockDef | undefined {
  return list.blocks.find(b => b.id === blockId);
}

/**
 * Get all source node IDs that this list depends on (unfrozen virtual blocks)
 */
export function getDependencies(list: TextBlockList): NodeId[] {
  const deps = new Set<NodeId>();
  for (const block of list.blocks) {
    if (block.type === 'virtual') {
      deps.add(block.sourceNodeId);
    }
  }
  return Array.from(deps);
}

/**
 * Get all virtual text block definitions in the list
 */
export function getVirtualBlocks(list: TextBlockList): VirtualTextBlockDef[] {
  return list.blocks.filter(isVirtualBlock);
}

/**
 * Remove all virtual blocks that reference a specific node
 */
export function removeNodeReferences(list: TextBlockList, nodeId: NodeId): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.filter(b => !(b.type === 'virtual' && b.sourceNodeId === nodeId))
  };
}

// ============================================================================
// Serialization Helpers
// ============================================================================

/**
 * Serialize a text block list to JSON-safe object
 */
export function serializeTextBlockList(list: TextBlockList): unknown {
  return {
    id: list.id,
    blocks: list.blocks.map(block => ({ ...block }))
  };
}

/**
 * Deserialize a text block list from JSON
 */
export function deserializeTextBlockList(data: unknown): TextBlockList {
  const obj = data as { id: string; blocks: AnyTextBlockDef[] };
  return {
    id: obj.id,
    blocks: obj.blocks
  };
}
