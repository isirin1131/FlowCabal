import { readWorkspace, writeWorkspace } from '@flowcabal/engine';
import {
  addNode,
  removeNode,
  renameNode,
  getNode,
  insertBlock,
  removeBlock,
} from '@flowcabal/engine';
import type { TextBlock } from '@flowcabal/engine';

export function nodeAdd(
  label: string,
  rootDir: string,
  workspaceId: string
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = addNode(ws, label);
  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Node created: ${node.id} (${label})`);
}

export function nodeRm(
  nodeId: string,
  rootDir: string,
  workspaceId: string
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = removeNode(ws, nodeId);
  if (!result) {
    console.error('Node not found');
    return;
  }

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Node removed: ${nodeId}`);
}

export function nodeRename(
  nodeId: string,
  newLabel: string,
  rootDir: string,
  workspaceId: string
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = renameNode(ws, nodeId, newLabel);
  if (!result) {
    console.error('Node not found');
    return;
  }

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Node renamed: ${nodeId} -> ${newLabel}`);
}

export function nodeList(rootDir: string, workspaceId: string): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  if (ws.nodes.length === 0) {
    console.log('No nodes');
    return;
  }

  for (const node of ws.nodes) {
    console.log(`${node.id} ${node.label}`);
  }
}

export function nodeCat(nodeId: string, rootDir: string, workspaceId: string): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  console.log(`# ${node.label} (${nodeId})`);
  console.log('');
  console.log('## Blocks');

  const allBlocks = [
    ...node.systemPrompt.map((b, i) => ({ block: b, section: 'system', index: i })),
    ...node.userPrompt.map((b, i) => ({ block: b, section: 'user', index: i })),
  ];

  if (allBlocks.length === 0) {
    console.log('  (empty)');
  } else {
    for (const { block, section, index } of allBlocks) {
      console.log(`  [${section}:${index}] ${formatBlock(block)}`);
    }
  }

  console.log('');
  console.log('## Output');

  if (ws.outputs.has(nodeId)) {
    const output = ws.outputs.get(nodeId);
    console.log(JSON.stringify(output, null, 2));
  } else {
    console.log('  (no output)');
  }
}

function formatBlock(block: TextBlock): string {
  switch (block.kind) {
    case 'literal':
      return `text: "${block.content.slice(0, 50)}${block.content.length > 50 ? '...' : ''}"`;
    case 'ref':
      return `ref: →${block.nodeId}`;
    case 'agent-inject':
      return `inject: ${block.hint.slice(0, 30)}${block.hint.length > 30 ? '...' : ''}`;
  }
}

export function nodeInsRef(
  nodeId: string,
  upstreamId: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index?: number
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const block: TextBlock = { kind: 'ref', nodeId: upstreamId };
  const result = insertBlock(ws, nodeId, block, isSystem, index);
  if (!result) {
    console.error('Node not found');
    return;
  }

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Added ref: ${nodeId} -> ${upstreamId}`);
}

export function nodeInsText(
  nodeId: string,
  content: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index?: number
): void {
  const ws = readWorkspace(rootDir, workspaceId);
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

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Added text to node ${nodeId}`);
}

export function nodeInsInject(
  nodeId: string,
  hint: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index?: number
): void {
  const ws = readWorkspace(rootDir, workspaceId);
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

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Added inject to node ${nodeId}`);
}

export function nodeRmBlock(
  nodeId: string,
  rootDir: string,
  workspaceId: string,
  isSystem: boolean = false,
  index: number
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const result = removeBlock(ws, nodeId, isSystem, index);
  if (!result) {
    console.error('Node or block not found');
    return;
  }

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Removed block [${isSystem ? 'system' : 'user'}:${index}] from node ${nodeId}`);
}

export function nodeTarget(
  nodeId: string,
  rootDir: string,
  workspaceId: string
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  if (!ws.target_nodes.includes(nodeId)) {
    ws.target_nodes.push(nodeId);
  }

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Node ${nodeId} added to targets`);
}

export function nodeUntarget(
  nodeId: string,
  rootDir: string,
  workspaceId: string
): void {
  const ws = readWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const node = getNode(ws, nodeId);
  if (!node) {
    console.error('Node not found');
    return;
  }

  ws.target_nodes = ws.target_nodes.filter(id => id !== nodeId);

  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Node ${nodeId} removed from targets`);
}
