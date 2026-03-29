import {
  loadWorkspace,
  saveWorkspace,
  loadPreferences,
  loadLlmConfig,
} from '@flowcabal/engine';
import {
  addNode,
  removeNode,
  renameNode,
  getNode,
  insertBlock,
  removeBlock,
} from '@flowcabal/engine';
import type { TextBlock } from '@flowcabal/engine';

export async function nodeAdd(
  label: string,
  rootDir: string,
  workspaceId: string
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = addNode(ws, label);
  saveWorkspace(rootDir, ws);
  console.log(`Node created: ${node.id} (${label})`);
}

export async function nodeRm(
  nodeId: string,
  rootDir: string,
  workspaceId: string
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = removeNode(ws, nodeId);
  if (!result) {
    console.error('Node not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Node removed: ${nodeId}`);
}

export async function nodeRename(
  nodeId: string,
  newLabel: string,
  rootDir: string,
  workspaceId: string
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = renameNode(ws, nodeId, newLabel);
  if (!result) {
    console.error('Node not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Node renamed: ${nodeId} -> ${newLabel}`);
}

export function nodeList(rootDir: string, workspaceId: string): void {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  if (ws.nodes.length === 0) {
    console.log('No nodes');
    return;
  }

  console.log('Nodes:');
  for (const node of ws.nodes) {
    const isTarget = ws.target_nodes.includes(node.id);
    const hasOutput = ws.outputs.has(node.id);
    const isStale = ws.stale_nodes.includes(node.id);
    const status = hasOutput ? (isStale ? '[stale]' : '[done]') : '[pending]';
    console.log(`  ${node.id} ${status} — ${node.label}`);
  }
}

export function nodeShow(nodeId: string, rootDir: string, workspaceId: string): void {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  console.log(`# ${node.label} (${node.id})`);
  console.log('');
  console.log('## systemPrompt');
  if (node.systemPrompt.length === 0) {
    console.log('  (empty)');
  } else {
    for (let i = 0; i < node.systemPrompt.length; i++) {
      const block = node.systemPrompt[i];
      console.log(`  [${i}] ${formatBlock(block)}`);
    }
  }
  console.log('');
  console.log('## userPrompt');
  if (node.userPrompt.length === 0) {
    console.log('  (empty)');
  } else {
    for (let i = 0; i < node.userPrompt.length; i++) {
      const block = node.userPrompt[i];
      console.log(`  [${i}] ${formatBlock(block)}`);
    }
  }
}

function formatBlock(block: TextBlock): string {
  switch (block.kind) {
    case 'literal':
      return `literal: ${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}`;
    case 'ref':
      return `ref: →${block.nodeId}`;
    case 'agent-inject':
      return `inject: ${block.hint.slice(0, 30)}${block.hint.length > 30 ? '...' : ''}`;
  }
}

export function nodeStatus(nodeId: string, rootDir: string, workspaceId: string): void {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  const hasOutput = ws.outputs.has(nodeId);
  const isTarget = ws.target_nodes.includes(nodeId);
  const isStale = ws.stale_nodes.includes(nodeId);
  const upstream = ws.upstream.get(nodeId) || [];
  const downstream = ws.downstream.get(nodeId) || [];

  console.log(`Node: ${node.label} (${nodeId})`);
  console.log(`  Status: ${hasOutput ? (isStale ? 'stale' : 'done') : 'pending'}`);
  console.log(`  Target: ${isTarget ? 'yes' : 'no'}`);
  console.log(`  Upstream: ${upstream.length > 0 ? upstream.join(', ') : '(none)'}`);
  console.log(`  Downstream: ${downstream.length > 0 ? downstream.join(', ') : '(none)'}`);
  console.log(`  Blocks: ${node.systemPrompt.length + node.userPrompt.length}`);
}

export async function nodeAddRef(
  nodeId: string,
  upstreamId: string,
  rootDir: string,
  workspaceId: string
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const block: TextBlock = { kind: 'ref', nodeId: upstreamId };
  const result = insertBlock(ws, nodeId, block, false);
  if (!result) {
    console.error('Node not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Added ref: ${nodeId} -> ${upstreamId}`);
}

export async function nodeAddLiteral(
  nodeId: string,
  content: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index?: number
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const block: TextBlock = { kind: 'literal', content };
  const result = insertBlock(ws, nodeId, block, isSystem, index);
  if (!result) {
    console.error('Node not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Added literal block to node ${nodeId}`);
}

export async function nodeAddInject(
  nodeId: string,
  hint: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index?: number
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const block: TextBlock = { kind: 'agent-inject', hint };
  const result = insertBlock(ws, nodeId, block, isSystem, index);
  if (!result) {
    console.error('Node not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Added inject block to node ${nodeId}`);
}

export async function nodeRmBlock(
  nodeId: string,
  blockIndex: number,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = removeBlock(ws, nodeId, isSystem, blockIndex);
  if (!result) {
    console.error('Node or block not found');
    return;
  }

  saveWorkspace(rootDir, ws);
  console.log(`Removed block [${blockIndex}] from node ${nodeId}`);
}

export async function nodeTarget(
  nodeId: string,
  rootDir: string,
  workspaceId: string,
  add: boolean = true
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  if (add) {
    if (!ws.target_nodes.includes(nodeId)) {
      ws.target_nodes.push(nodeId);
    }
  } else {
    ws.target_nodes = ws.target_nodes.filter(id => id !== nodeId);
  }

  saveWorkspace(rootDir, ws);
  console.log(`Node ${nodeId} ${add ? 'added to' : 'removed from'} targets`);
}
