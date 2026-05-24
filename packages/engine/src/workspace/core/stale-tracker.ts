import { Workspace } from '../../types';

export function getDirectStale(ws: Workspace): Set<string> {
  return new Set(ws.stale_nodes.filter(e => e.kind === 'direct').map(e => e.id));
}

export function getPropagatedStale(ws: Workspace): Set<string> {
  return new Set(ws.stale_nodes.filter(e => e.kind === 'propagated').map(e => e.id));
}

export function markBlockEdited(ws: Workspace, nodeId: string): void {
  const all = new Map<string, 'direct' | 'propagated'>();
  for (const e of ws.stale_nodes) all.set(e.id, e.kind);

  upsert(all, nodeId, 'direct');

  const visited = new Set<string>([nodeId]);
  const queue = [...(ws.downstream.get(nodeId) || [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    upsert(all, id, 'propagated');
    for (const d of ws.downstream.get(id) || []) queue.push(d);
  }

  ws.stale_nodes = [...all].map(([id, kind]) => ({ id, kind }));
}

export function markRemovedNodeDownstream(ws: Workspace, downstreamSnapshot: string[]): void {
  const all = new Map<string, 'direct' | 'propagated'>();
  for (const e of ws.stale_nodes) all.set(e.id, e.kind);

  const visited = new Set<string>();
  const queue = [...downstreamSnapshot];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    upsert(all, id, 'propagated');
    for (const d of ws.downstream.get(id) || []) queue.push(d);
  }

  ws.stale_nodes = [...all].map(([id, kind]) => ({ id, kind }));
}

export function clearOnRun(ws: Workspace, nodeId: string): void {
  ws.stale_nodes = ws.stale_nodes.filter(e => e.id !== nodeId);
}

function upsert(m: Map<string, 'direct' | 'propagated'>, id: string, kind: 'direct' | 'propagated') {
  const cur = m.get(id);
  if (cur === 'direct') return;             // direct 不被降级
  if (kind === 'direct') { m.set(id, 'direct'); return; }
  if (!cur) m.set(id, 'propagated');
}
