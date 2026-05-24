import { test, expect, describe } from 'bun:test';
import { Workspace, NodeDef } from '../../types';
import {
  getDirectStale,
  getPropagatedStale,
  markBlockEdited,
  markRemovedNodeDownstream,
  clearOnRun,
} from './stale-tracker';

function mkWs(nodes: string[], edges: [string, string][] = []): Workspace {
  // edges: [source, target] = source 是 target 的 upstream
  const ws: Workspace = {
    id: 'test-ws',
    name: 'test',
    nodes: nodes.map((id): NodeDef => ({ id, label: id, systemPrompt: [], userPrompt: [] })),
    outputs: new Map(),
    upstream: new Map(),
    downstream: new Map(),
    target_nodes: [],
    stale_nodes: [],
  };
  for (const [src, tgt] of edges) {
    if (!ws.upstream.has(tgt)) ws.upstream.set(tgt, []);
    ws.upstream.get(tgt)!.push(src);
    if (!ws.downstream.has(src)) ws.downstream.set(src, []);
    ws.downstream.get(src)!.push(tgt);
  }
  return ws;
}

describe('upsert 升级降级矩阵', () => {
  test('T1: ∅ + direct = direct', () => {
    const ws = mkWs(['A']);
    markBlockEdited(ws, 'A');
    expect(getDirectStale(ws)).toEqual(new Set(['A']));
    expect(getPropagatedStale(ws)).toEqual(new Set());
  });

  test('T2: ∅ + propagated = propagated', () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    markBlockEdited(ws, 'A');
    expect(getDirectStale(ws)).toEqual(new Set(['A']));
    expect(getPropagatedStale(ws)).toEqual(new Set(['B']));
  });

  test('T3: direct + direct = direct', () => {
    const ws = mkWs(['A']);
    markBlockEdited(ws, 'A');
    markBlockEdited(ws, 'A');
    expect(getDirectStale(ws)).toEqual(new Set(['A']));
  });

  test('T4: direct + propagated 不降级', () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    markBlockEdited(ws, 'B');                 // B 自身 direct
    markBlockEdited(ws, 'A');                 // 扩散把 B 标 propagated（尝试降级）
    expect(getDirectStale(ws)).toEqual(new Set(['A', 'B']));
    expect(getPropagatedStale(ws)).toEqual(new Set());
  });

  test('T5: propagated + direct 升级', () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    markBlockEdited(ws, 'A');                 // B → propagated
    markBlockEdited(ws, 'B');                 // B → direct
    expect(getDirectStale(ws)).toEqual(new Set(['A', 'B']));
    expect(getPropagatedStale(ws)).toEqual(new Set());
  });

  test('T6: propagated + propagated = propagated', () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['C', 'B']]);
    markBlockEdited(ws, 'A');                 // B → propagated
    markBlockEdited(ws, 'C');                 // B 还是 propagated（被 C 也扩散）
    expect(getDirectStale(ws)).toEqual(new Set(['A', 'C']));
    expect(getPropagatedStale(ws)).toEqual(new Set(['B']));
  });
});

describe('其他行为', () => {
  test('T7: markBlockEdited BFS transitive downstream (深度 3)', () => {
    const ws = mkWs(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['C', 'D']]);
    markBlockEdited(ws, 'A');
    expect(getDirectStale(ws)).toEqual(new Set(['A']));
    expect(getPropagatedStale(ws)).toEqual(new Set(['B', 'C', 'D']));
  });

  test('T7b: BFS cycle 防御（不死循环）', () => {
    const ws = mkWs(['A', 'B'], [['A', 'B'], ['B', 'A']]);
    markBlockEdited(ws, 'A');
    // BFS visited set 兜住，跑完不挂
    expect(getDirectStale(ws)).toEqual(new Set(['A']));
    expect(getPropagatedStale(ws)).toEqual(new Set(['B']));
  });

  test('T8: markRemovedNodeDownstream 空 snapshot 不报错', () => {
    const ws = mkWs(['A']);
    markRemovedNodeDownstream(ws, []);
    expect(ws.stale_nodes).toEqual([]);
  });

  test('T8b: markRemovedNodeDownstream 标 propagated', () => {
    const ws = mkWs(['A', 'B', 'C', 'D'], [['A', 'B'], ['B', 'C'], ['B', 'D']]);
    // 模拟删 A，A 之前 downstream snapshot = [B]，B 的 downstream = [C, D]
    markRemovedNodeDownstream(ws, ['B']);
    expect(getDirectStale(ws)).toEqual(new Set());
    expect(getPropagatedStale(ws)).toEqual(new Set(['B', 'C', 'D']));
  });

  test('T9: clearOnRun 仅清自身', () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
    markBlockEdited(ws, 'A');                 // A direct, B/C propagated
    clearOnRun(ws, 'A');
    expect(getDirectStale(ws)).toEqual(new Set());
    expect(getPropagatedStale(ws)).toEqual(new Set(['B', 'C'])); // B/C 仍 propagated
  });
});
