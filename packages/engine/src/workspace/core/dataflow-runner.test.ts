import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { Workspace, NodeDef, LlmConfig } from '../../types';
import { runAllDataflow, DataflowEvent } from './dataflow-runner';

const TEST_CONFIG: LlmConfig = {
  provider: 'openai-compatible',
  apiKey: 'test',
  model: 'test-model',
};

// 测试用 mock generate / createStream
let mockBehavior: Record<string, 'success' | 'error' | { tokens: string[] }> = {};
let nodeStartOrder: string[] = [];

mock.module('../../llm/generate.js', () => ({
  createStream: (config: LlmConfig, system: string, user: string, signal?: AbortSignal) => {
    // 取 user / system 第一段当 nodeId 提示
    const nodeId = user.split('\n')[0] || system.split('\n')[0] || 'unknown';
    nodeStartOrder.push(nodeId);
    const behavior = mockBehavior[nodeId] ?? 'success';
    return {
      textStream: (async function* () {
        if (behavior === 'error') throw new Error(`mock error for ${nodeId}`);
        const tokens = behavior === 'success' ? ['output-of-', nodeId] : behavior.tokens;
        for (const t of tokens) {
          if (signal?.aborted) throw new Error('aborted');
          yield t;
          // Yield to microtask queue so abort can fire between tokens
          await new Promise<void>((r) => setTimeout(r, 0));
        }
      })(),
    };
  },
  generate: async () => 'unused-in-dataflow-tests',
}));

function mkWs(nodes: string[], edges: [string, string][] = [], targets: string[] = nodes): Workspace {
  const ws: Workspace = {
    id: 'test',
    name: 't',
    nodes: nodes.map((id): NodeDef => ({
      id,
      label: id,
      systemPrompt: [],
      userPrompt: [{ kind: 'literal', content: id }],
    })),
    outputs: new Map(),
    upstream: new Map(),
    downstream: new Map(),
    target_nodes: [...targets],
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

let rootDir: string;
beforeEach(() => {
  rootDir = mkdtempSync(join(tmpdir(), 'fc-dataflow-'));
  mkdirSync(join(rootDir, '.flowcabal', 'cache', 'test'), { recursive: true });
  mockBehavior = {};
  nodeStartOrder = [];
});
afterEach(() => {
  rmSync(rootDir, { recursive: true, force: true });
});

async function collectEvents(ws: Workspace): Promise<DataflowEvent[]> {
  const events: DataflowEvent[] = [];
  for await (const e of runAllDataflow(ws, TEST_CONFIG, rootDir)) {
    events.push(e);
  }
  return events;
}

describe('runAllDataflow 调度', () => {
  test('T10: linear chain 全成功', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'B', 'C']);
    expect(done.failed).toEqual([]);
    expect(done.stuck).toEqual([]);
    expect(ws.outputs.size).toBe(3);
    expect(ws.target_nodes).toEqual([]);
  });

  test('T11: branch 全成功', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'B', 'C']);
    const aStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'A');
    const bStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'B');
    const cStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'C');
    expect(aStart).toBeLessThan(bStart);
    expect(aStart).toBeLessThan(cStart);
  });

  test('T12: 独立分支 fail 不阻塞旁支', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
    mockBehavior = { B: 'error' };
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'C']);
    expect(done.failed).toEqual(['B']);
    expect(done.stuck).toEqual([]);
    expect(ws.target_nodes).toContain('B');
    expect(ws.target_nodes).not.toContain('A');
    expect(ws.target_nodes).not.toContain('C');
  });

  test('T13: fail 阻塞下游 → stuck', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
    mockBehavior = { A: 'error' };
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done).toEqual([]);
    expect(done.failed).toEqual(['A']);
    expect(done.stuck.sort()).toEqual(['B', 'C']);
  });

  test('T14: 多 target 共同祖先只跑一次', async () => {
    const ws = mkWs(
      ['X', 'Y', 'Z', 'W'],
      [['X', 'Y'], ['Y', 'Z'], ['X', 'W']],
      ['Z', 'W'],
    );
    const events = await collectEvents(ws);
    const xStarts = events.filter(e => e.type === 'node-start' && e.nodeId === 'X').length;
    expect(xStarts).toBe(1);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['W', 'X', 'Y', 'Z']);
  });

  test('T15: abort signal 中途 → 剩余进 stuck', async () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    const ctrl = new AbortController();
    mockBehavior = {
      A: { tokens: ['a-part-1', 'a-part-2'] },
    };
    const events: DataflowEvent[] = [];
    let firstTokenSeen = false;
    for await (const e of runAllDataflow(ws, TEST_CONFIG, rootDir, ctrl.signal)) {
      events.push(e);
      if (!firstTokenSeen && e.type === 'node-token' && e.nodeId === 'A') {
        firstTokenSeen = true;
        ctrl.abort();
      }
    }
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.stuck).toContain('B');
  });

  test('T16: 跑完 ws 状态正确', async () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    ws.stale_nodes = [{ id: 'A', kind: 'direct' }, { id: 'B', kind: 'propagated' }];
    await collectEvents(ws);
    expect(ws.outputs.get('A')).toBe('output-of-A');
    expect(ws.outputs.get('B')).toBe('output-of-B');
    expect(ws.target_nodes).toEqual([]);
    expect(ws.stale_nodes).toEqual([]);
  });
});
