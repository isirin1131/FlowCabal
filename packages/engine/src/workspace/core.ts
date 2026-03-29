import { Workspace, NodeDef, TextBlock } from '../types';
import { newId } from './utils';


// ========= node CRUD ===================

export function getNode(ws: Workspace, nodeId: string): NodeDef | undefined {
    return ws.nodes.find(n => n.id === nodeId);
}

export function addNode(ws: Workspace, label: string): NodeDef {
    const node: NodeDef = {
        id: newId(),
        label,
        systemPrompt: [],
        userPrompt: []
    };
    ws.nodes.push(node);
    ws.target_nodes.push(node.id);
    return node;
}

export function removeNode(ws: Workspace, nodeId: string): boolean {
    const index = ws.nodes.findIndex(n => n.id === nodeId);
    if (index === -1) return false;
    
    ws.nodes.splice(index, 1);
    ws.target_nodes = ws.target_nodes.filter(id => id !== nodeId);
    ws.stale_nodes = ws.stale_nodes.filter(id => id !== nodeId);
    ws.outputs.delete(nodeId);

    for (const upstreamId of ws.upstream.get(nodeId) || []) {
        const deps = ws.downstream.get(upstreamId);
        if (deps) {
            const i = deps.indexOf(nodeId);
            if (i !== -1) deps.splice(i, 1);
        }
    }

    for (const downstreamId of ws.downstream.get(nodeId) || []) {
        const deps = ws.upstream.get(downstreamId);
        if (deps) {
            const i = deps.indexOf(nodeId);
            if (i !== -1) deps.splice(i, 1);
        }
        const node = getNode(ws, downstreamId);
        if (node) {
            node.systemPrompt = node.systemPrompt.filter(b => b.kind !== 'ref' || b.nodeId !== nodeId);
            node.userPrompt = node.userPrompt.filter(b => b.kind !== 'ref' || b.nodeId !== nodeId);
            if (!ws.stale_nodes.includes(downstreamId)) {
                ws.stale_nodes.push(downstreamId);
            }
        }
    }

    ws.upstream.delete(nodeId);
    ws.downstream.delete(nodeId);

    return true;
}

export function renameNode(ws: Workspace, nodeId: string, newLabel: string): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    node.label = newLabel;
    return true;
}


// ========= block CRUD ===================

export function insertBlock(ws: Workspace, nodeId: string, block: TextBlock, isSystem: boolean, index?: number): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    const blocks = isSystem ? node.systemPrompt : node.userPrompt;
    if (index === undefined || index >= blocks.length) {
        blocks.push(block);
    } else {
        blocks.splice(index, 0, block);
    }

    if (block.kind === 'ref') {
        const refId = block.nodeId;
        if (!ws.upstream.has(nodeId)) ws.upstream.set(nodeId, []);
        if (!ws.upstream.get(nodeId)!.includes(refId)) ws.upstream.get(nodeId)!.push(refId);
        if (!ws.downstream.has(refId)) ws.downstream.set(refId, []);
        if (!ws.downstream.get(refId)!.includes(nodeId)) ws.downstream.get(refId)!.push(nodeId);
    }

    if (ws.outputs.has(nodeId) && !ws.stale_nodes.includes(nodeId)) ws.stale_nodes.push(nodeId);
    return true;
}

export function removeBlock(ws: Workspace, nodeId: string, isSystem: boolean, blockIndex: number): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    const blocks = isSystem ? node.systemPrompt : node.userPrompt;
    if (blockIndex < 0 || blockIndex >= blocks.length) return false;
    const removed = blocks.splice(blockIndex, 1)[0];

    if (removed.kind === 'ref') {
        const refId = removed.nodeId;
        const up = ws.upstream.get(nodeId);
        if (up) { const i = up.indexOf(refId); if (i !== -1) up.splice(i, 1); }
        const down = ws.downstream.get(refId);
        if (down) { const i = down.indexOf(nodeId); if (i !== -1) down.splice(i, 1); }
    }

    if (ws.outputs.has(nodeId) && !ws.stale_nodes.includes(nodeId)) ws.stale_nodes.push(nodeId);
    return true;
}

export function updateBlock(ws: Workspace, nodeId: string, isSystem: boolean, blockIndex: number, block: TextBlock): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    const blocks = isSystem ? node.systemPrompt : node.userPrompt;
    if (blockIndex < 0 || blockIndex >= blocks.length) return false;
    const oldBlock = blocks[blockIndex];
    blocks[blockIndex] = block;

    if (oldBlock.kind === 'ref') {
        const oldRef = oldBlock.nodeId;
        const up = ws.upstream.get(nodeId);
        if (up) { const i = up.indexOf(oldRef); if (i !== -1) up.splice(i, 1); }
        const down = ws.downstream.get(oldRef);
        if (down) { const i = down.indexOf(nodeId); if (i !== -1) down.splice(i, 1); }
    }

    if (block.kind === 'ref') {
        const refId = block.nodeId;
        if (!ws.upstream.has(nodeId)) ws.upstream.set(nodeId, []);
        if (!ws.upstream.get(nodeId)!.includes(refId)) ws.upstream.get(nodeId)!.push(refId);
        if (!ws.downstream.has(refId)) ws.downstream.set(refId, []);
        if (!ws.downstream.get(refId)!.includes(nodeId)) ws.downstream.get(refId)!.push(nodeId);
    }

    if (ws.outputs.has(nodeId) && !ws.stale_nodes.includes(nodeId)) ws.stale_nodes.push(nodeId);
    return true;
}
