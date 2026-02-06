/**
 * TextBlock System for FlowCabal (metadata only)
 *
 * Core text block definitions - pure metadata, no runtime state.
 * Runtime state (resolved content, frozen state) belongs in core-runner.
 */

/** Unique identifier for text blocks */
export type TextBlockId = string;

/** Unique identifier for nodes */
export type NodeId = string;

/** Generate a unique ID */
export function generateId(): string {
  return crypto.randomUUID();
}

// ============================================================================
// TextBlock - Basic static text block
// ============================================================================

export interface TextBlock {
  readonly type: 'text';
  readonly id: TextBlockId;
  content: string;
}

export function createTextBlock(content: string = ''): TextBlock {
  return {
    type: 'text',
    id: generateId(),
    content
  };
}

// ============================================================================
// VirtualTextBlockDef - Definition of a dynamic text block (metadata only)
// ============================================================================

/**
 * Defines a virtual text block that references a node's output.
 * Runtime state (resolved content, frozen state) is managed by core-runner.
 */
export interface VirtualTextBlockDef {
  readonly type: 'virtual';
  readonly id: TextBlockId;
  /** The node whose output this block references */
  readonly sourceNodeId: NodeId;
  /** Optional display name for the placeholder */
  displayName?: string;
}

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

// ============================================================================
// TextBlockList - Container for managing text block sequences
// ============================================================================

export interface TextBlockList {
  readonly id: string;
  blocks: AnyTextBlockDef[];
}

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
