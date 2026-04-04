import { Workspace } from '../../types';

export function fullTopoQueue(ws: Workspace): string[] {
    const inDegree = new Map<string, number>();
    for (const node of ws.nodes) {
        inDegree.set(node.id, 0);
    }
    for (const node of ws.nodes) {
        const deps = ws.upstream.get(node.id) || [];
        for (const dep of deps) {
            inDegree.set(node.id, (inDegree.get(node.id) || 0) + 1);
        }
    }

    const queue: string[] = [];
    for (const [nodeId, degree] of inDegree) {
        if (degree === 0) queue.push(nodeId);
    }

    const result: string[] = [];
    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        result.push(nodeId);

        const downs = ws.downstream.get(nodeId) || [];
        for (const downId of downs) {
            const newDegree = (inDegree.get(downId) || 0) - 1;
            inDegree.set(downId, newDegree);
            if (newDegree === 0) queue.push(downId);
        }
    }

    if (result.length !== ws.nodes.length) {
        const cyclicNodes = ws.nodes.filter(n => !result.includes(n.id)).map(n => n.id);
        throw new Error(`cyclic dependency detected: ${cyclicNodes.join(', ')}`);
    }

    return result;
}

export function todoList(ws: Workspace): string[] {
    const todo = new Set<string>();
    const visited = new Set<string>();

    function collectDeps(nodeId: string) {
        if (visited.has(nodeId)) return;
        visited.add(nodeId);
        todo.add(nodeId);

        const deps = ws.upstream.get(nodeId) || [];
        for (const depId of deps) {
            if (ws.outputs.has(depId)) continue;
            collectDeps(depId);
        }
    }

    for (const targetId of ws.target_nodes) {
        collectDeps(targetId);
    }

    const topoOrder = fullTopoQueue(ws);
    const orderMap = new Map<string, number>();
    for (let i = 0; i < topoOrder.length; i++) {
        orderMap.set(topoOrder[i], i);
    }

    const sorted = [...todo].sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));

    return sorted;
}

export function calcStale(ws: Workspace): void {
    const visited = new Set<string>();
    const staleSet = new Set(ws.stale_nodes);
    const queue = [...ws.stale_nodes];

    while (queue.length > 0) {
        const nodeId = queue.shift()!;
        if (visited.has(nodeId)) continue;
        visited.add(nodeId);

        const downs = ws.downstream.get(nodeId) || [];
        for (const downId of downs) {
            if (!staleSet.has(downId)) {
                staleSet.add(downId);
                ws.stale_nodes.push(downId);
            }
            queue.push(downId);
        }
    }
}
