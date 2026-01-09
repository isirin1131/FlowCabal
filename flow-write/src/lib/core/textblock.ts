/**
 * TextBlock System for FlowWrite
 *
 * Implements the core text block abstractions for the workflow editor:
 * - TextBlock: Static text content
 * - VirtualTextBlock: Dynamic text that references node outputs with freeze capability
 * - TextBlockList: Container managing a sequence of text blocks
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
// VirtualTextBlock - Dynamic text referencing node outputs
// ============================================================================

/**
 * Represents the resolution state of a virtual text block
 * - pending: Source node has not been executed yet
 * - resolved: Source node has produced output
 * - error: Source node execution failed
 */
export type VirtualTextBlockState = 'pending' | 'resolved' | 'error';

export interface VirtualTextBlock {
  readonly type: 'virtual';
  readonly id: TextBlockId;
  /** The node whose output this block references */
  readonly sourceNodeId: NodeId;
  /** Current resolution state */
  state: VirtualTextBlockState;
  /** Resolved content (available when state is 'resolved' or frozen) */
  resolvedContent: string | null;
  /** When true, behaves as static text using resolvedContent */
  frozen: boolean;
  /** Optional display name for the placeholder */
  displayName?: string;
}

export function createVirtualTextBlock(
  sourceNodeId: NodeId,
  displayName?: string
): VirtualTextBlock {
  return {
    type: 'virtual',
    id: generateId(),
    sourceNodeId,
    state: 'pending',
    resolvedContent: null,
    frozen: false,
    displayName
  };
}

/**
 * Resolve a virtual text block with content from its source node
 */
export function resolveVirtualTextBlock(
  block: VirtualTextBlock,
  content: string
): VirtualTextBlock {
  if (block.frozen) {
    return block; // Frozen blocks cannot be updated
  }
  return {
    ...block,
    state: 'resolved',
    resolvedContent: content
  };
}

/**
 * Mark a virtual text block as having an error
 */
export function errorVirtualTextBlock(
  block: VirtualTextBlock,
  _error?: string
): VirtualTextBlock {
  if (block.frozen) {
    return block;
  }
  return {
    ...block,
    state: 'error',
    resolvedContent: null
  };
}

/**
 * Freeze a virtual text block - locks current content as static
 */
export function freezeVirtualTextBlock(block: VirtualTextBlock): VirtualTextBlock {
  if (block.state !== 'resolved' || block.resolvedContent === null) {
    throw new Error('Cannot freeze a virtual text block that has not been resolved');
  }
  return {
    ...block,
    frozen: true
  };
}

/**
 * Unfreeze a virtual text block - allows it to update again
 */
export function unfreezeVirtualTextBlock(block: VirtualTextBlock): VirtualTextBlock {
  return {
    ...block,
    frozen: false
  };
}

/**
 * Reset a virtual text block to pending state (if not frozen)
 */
export function resetVirtualTextBlock(block: VirtualTextBlock): VirtualTextBlock {
  if (block.frozen) {
    return block;
  }
  return {
    ...block,
    state: 'pending',
    resolvedContent: null
  };
}

// ============================================================================
// AnyTextBlock - Union type for all text blocks
// ============================================================================

export type AnyTextBlock = TextBlock | VirtualTextBlock;

/**
 * Get the display content of any text block
 * - TextBlock: returns content directly
 * - VirtualTextBlock (frozen/resolved): returns resolvedContent
 * - VirtualTextBlock (pending): returns placeholder string
 * - VirtualTextBlock (error): returns error placeholder
 */
export function getBlockContent(block: AnyTextBlock): string {
  if (block.type === 'text') {
    return block.content;
  }

  // Virtual text block
  if (block.frozen && block.resolvedContent !== null) {
    return block.resolvedContent;
  }

  switch (block.state) {
    case 'resolved':
      return block.resolvedContent ?? '';
    case 'pending':
      return `[${block.displayName ?? block.sourceNodeId}]`;
    case 'error':
      return `[Error: ${block.displayName ?? block.sourceNodeId}]`;
  }
}

/**
 * Check if a text block is ready (has actual content)
 */
export function isBlockReady(block: AnyTextBlock): boolean {
  if (block.type === 'text') {
    return true;
  }
  return block.frozen || block.state === 'resolved';
}

// ============================================================================
// TextBlockList - Container for managing text block sequences
// ============================================================================

export interface TextBlockList {
  readonly id: string;
  blocks: AnyTextBlock[];
}

export function createTextBlockList(initialBlocks?: AnyTextBlock[]): TextBlockList {
  return {
    id: generateId(),
    blocks: initialBlocks ?? []
  };
}

/**
 * Append a text block to the list
 */
export function appendBlock(list: TextBlockList, block: AnyTextBlock): TextBlockList {
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
  block: AnyTextBlock
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
  updater: (block: AnyTextBlock) => AnyTextBlock
): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.map(b => b.id === blockId ? updater(b) : b)
  };
}

/**
 * Find a text block by ID
 */
export function findBlock(list: TextBlockList, blockId: TextBlockId): AnyTextBlock | undefined {
  return list.blocks.find(b => b.id === blockId);
}

/**
 * Get the combined content of all blocks in the list
 */
export function getListContent(list: TextBlockList): string {
  return list.blocks.map(getBlockContent).join('');
}

/**
 * Check if all blocks in the list are ready
 */
export function isListReady(list: TextBlockList): boolean {
  return list.blocks.every(isBlockReady);
}

/**
 * Get all virtual text blocks that are pending
 */
export function getPendingVirtualBlocks(list: TextBlockList): VirtualTextBlock[] {
  return list.blocks.filter(
    (b): b is VirtualTextBlock => b.type === 'virtual' && !b.frozen && b.state === 'pending'
  );
}

/**
 * Get all source node IDs that this list depends on
 */
export function getDependencies(list: TextBlockList): NodeId[] {
  const deps = new Set<NodeId>();
  for (const block of list.blocks) {
    if (block.type === 'virtual' && !block.frozen) {
      deps.add(block.sourceNodeId);
    }
  }
  return Array.from(deps);
}

/**
 * Resolve all virtual text blocks that reference a specific node
 */
export function resolveNodeOutput(
  list: TextBlockList,
  nodeId: NodeId,
  content: string
): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.map(block => {
      if (block.type === 'virtual' && block.sourceNodeId === nodeId) {
        return resolveVirtualTextBlock(block, content);
      }
      return block;
    })
  };
}

/**
 * Reset all virtual text blocks that reference a specific node
 */
export function resetNodeDependents(list: TextBlockList, nodeId: NodeId): TextBlockList {
  return {
    ...list,
    blocks: list.blocks.map(block => {
      if (block.type === 'virtual' && block.sourceNodeId === nodeId) {
        return resetVirtualTextBlock(block);
      }
      return block;
    })
  };
}
