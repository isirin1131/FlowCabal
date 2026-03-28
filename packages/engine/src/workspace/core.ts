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

function syncRef(ws: Workspace, nodeId: string, refNodeId: string, isAdd: boolean): void {
    if (isAdd) {
        if (!ws.upstream.has(nodeId)) ws.upstream.set(nodeId, []);
        if (!ws.upstream.get(nodeId)!.includes(refNodeId)) {
            ws.upstream.get(nodeId)!.push(refNodeId);
        }
        if (!ws.downstream.has(refNodeId)) ws.downstream.set(refNodeId, []);
        if (!ws.downstream.get(refNodeId)!.includes(nodeId)) {
            ws.downstream.get(refNodeId)!.push(nodeId);
        }
    } else {
        const upstream = ws.upstream.get(nodeId);
        if (upstream) {
            const i = upstream.indexOf(refNodeId);
            if (i !== -1) upstream.splice(i, 1);
        }
        const downstream = ws.downstream.get(refNodeId);
        if (downstream) {
            const i = downstream.indexOf(nodeId);
            if (i !== -1) downstream.splice(i, 1);
        }
    }
    if (!ws.stale_nodes.includes(nodeId)) {
        ws.stale_nodes.push(nodeId);
    }
}

export function addBlock(ws: Workspace, nodeId: string, block: TextBlock, isSystem: boolean): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    if (isSystem) {
        node.systemPrompt.push(block);
    } else {
        node.userPrompt.push(block);
    }
    if (block.kind === 'ref') {
        syncRef(ws, nodeId, block.nodeId, true);
    }
    if (!ws.stale_nodes.includes(nodeId)) {
        ws.stale_nodes.push(nodeId);
    }
    return true;
}

export function removeBlock(ws: Workspace, nodeId: string, isSystem: boolean, blockIndex: number): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    const blocks = isSystem ? node.systemPrompt : node.userPrompt;
    if (blockIndex < 0 || blockIndex >= blocks.length) return false;
    const removed = blocks.splice(blockIndex, 1)[0];
    if (removed.kind === 'ref') {
        syncRef(ws, nodeId, removed.nodeId, false);
    }
    if (!ws.stale_nodes.includes(nodeId)) {
        ws.stale_nodes.push(nodeId);
    }
    return true;
}

export function updateBlock(ws: Workspace, nodeId: string, isSystem: boolean, blockIndex: number, block: TextBlock): boolean {
    const node = getNode(ws, nodeId);
    if (!node) return false;
    const blocks = isSystem ? node.systemPrompt : node.userPrompt;
    if (blockIndex < 0 || blockIndex >= blocks.length) return false;
    const oldBlock = blocks[blockIndex];
    if (oldBlock.kind === 'ref') {
        const oldRefId = oldBlock.nodeId;
        if (block.kind === 'ref' && block.nodeId !== oldRefId) {
            syncRef(ws, nodeId, oldRefId, false);
            syncRef(ws, nodeId, block.nodeId, true);
        } else if (block.kind !== 'ref') {
            syncRef(ws, nodeId, oldRefId, false);
        }
    } else if (block.kind === 'ref') {
        syncRef(ws, nodeId, block.nodeId, true);
    }
    blocks[blockIndex] = block;
    if (!ws.stale_nodes.includes(nodeId)) {
        ws.stale_nodes.push(nodeId);
    }
    return true;
}
