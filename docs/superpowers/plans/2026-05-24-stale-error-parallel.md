# F 期 stale + error + 并行 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 engine 内"另起炉灶"三个新模块（stale-tracker / dataflow-runner / error-log），把 BCDE 期留下的 stale 闭环 / error 闭环 / runAll 节点并行三件事全部落地；GUI 视觉用 ✱ 双色 + 尾栏文字 + Radix Tooltip 把闭环呈出来；旧 engine 函数零删改（CLI 用旧路径继续能跑）。

**Architecture:** Workspace schema 把 `stale_nodes: string[]` 升级为 `StaleEntry[]`（带 `direct/propagated` kind）。stale 走 eager 扩散，CRUD 立即标 transitive downstream；errors 持久化为 per-workspace NDJSON log；runAll 改 Kahn 运行时变体 + fire-and-forget + EventChannel mpsc，不限并发，error 不传染旁支。GUI store 加 `runtimeErrors` map 派生视图，节点 ✱ + error 文字 + Tooltip 加重跑按钮。

**Tech Stack:** Bun + TypeScript (`bun:test` 内置 test runner), Zod (schema 校验), Next 16 Turbopack + React 19 (GUI), zustand (store), xyflow (canvas), Radix UI (Tooltip)。

---

## File Structure

**新建文件**：

| 文件 | 责任 |
|---|---|
| `packages/engine/src/workspace/core/stale-tracker.ts` | eager 扩散 + direct/propagated 分类的写入 helper |
| `packages/engine/src/workspace/core/stale-tracker.test.ts` | T1-T9 单测 |
| `packages/engine/src/workspace/core/error-log.ts` | NDJSON append-only + reader API |
| `packages/engine/src/workspace/core/error-log.test.ts` | T17-T20 单测 |
| `packages/engine/src/workspace/core/dataflow-runner.ts` | Kahn 运行时变体 + EventChannel + DataflowEvent 协议 |
| `packages/engine/src/workspace/core/dataflow-runner.test.ts` | T10-T16 单测 |
| `packages/engine/src/workspace/core/event-channel.ts` | mpsc-like async channel helper（dataflow-runner 内部用） |
| `packages/apps/gui/src/app/api/workspaces/[id]/errors/route.ts` | GET errors.log（per-node=last / 全量） |

**修改文件**：

| 文件 | 改动概述 |
|---|---|
| `packages/engine/src/types.ts` | 加 `StaleEntry` 类型；`Workspace.stale_nodes: StaleEntry[]` |
| `packages/engine/src/schema.ts` | `StaleEntrySchema` + 改 `WorkspaceSchema.stale_nodes` |
| `packages/engine/src/workspace/core/node.ts` | 三处 stale push 1 行类型升级 |
| `packages/engine/src/workspace/core/index.ts` | export 三个新模块 |
| `packages/engine/src/index.ts` | 顶层 re-export `StaleEntry / ErrorEntry / DataflowEvent / runAllDataflow / stale-tracker 函数 / error-log 函数` |
| `packages/apps/gui/src/lib/serialization.ts` | `stale_nodes` 字段在 `recordToWorkspace` / `workspaceToRecord` 的处理升级 |
| `packages/apps/gui/src/app/api/workspaces/[id]/blocks/route.ts` | 调旧 block CRUD 后接 `markBlockEdited` |
| `packages/apps/gui/src/app/api/workspaces/nodes/route.ts` | DELETE 分支抓 snapshot 后接 `markRemovedNodeDownstream` |
| `packages/apps/gui/src/app/api/engine/run-all/route.ts` | import `runAllDataflow` 替换 `runAllStream` |
| `packages/apps/gui/src/store/useStore.ts` | `runtimeErrors` state、`#handleNodeEvent` 升级、`internal_loadWorkspace` 追加 fetch errors、新 selector helper、workspace 切换清 runtimeErrors |
| `packages/apps/gui/src/components/FlowNode.tsx` | ✱ 角标双色 + error 尾栏文字 + Radix Tooltip + 重跑按钮 |
| `packages/cli/src/commands/workspace.ts` | `workspaceStatus` 输出 stale_nodes 多行格式 |

**不动**：

- `packages/engine/src/workspace/core/runner.ts`（旧 `runAll / runSingle / runAllStream / runNode`）
- `packages/engine/src/workspace/core/graph.ts`（旧 `todoList / calcStale / fullTopoQueue`）
- `packages/cli/src/commands/run.ts`
- `packages/cli/src/commands/node.ts`
- BCDE 期定的所有视觉规范、右键菜单、EditorPanel ref picker、RunButton

---

## Task 1: Schema + types 升级 + serialization

**Files:**
- Modify: `packages/engine/src/types.ts`
- Modify: `packages/engine/src/schema.ts`
- Modify: `packages/apps/gui/src/lib/serialization.ts`

- [ ] **Step 1: 改 `types.ts` 加 StaleEntry 并升级 Workspace**

替换 `packages/engine/src/types.ts` 中的 `Workspace` interface（保留其他 export 不动）：

```typescript
export type StaleEntry = { id: string; kind: 'direct' | 'propagated' };

export interface Workspace {
  id: string;
  name: string;
  nodes: NodeDef[];
  outputs: Map<string, string>;
  upstream: Map<string, string[]>;
  downstream: Map<string, string[]>;
  target_nodes: string[];
  stale_nodes: StaleEntry[];   // 从 string[] 升级
}
```

- [ ] **Step 2: 改 `schema.ts` 同步 Zod**

替换 `WorkspaceSchema`，新增 `StaleEntrySchema`：

```typescript
export const StaleEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['direct', 'propagated']),
});

export const WorkspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  nodes: z.array(NodeDefSchema),
  outputs: z.record(z.string(), z.string()),
  upstream: z.record(z.string(), z.array(z.string())),
  downstream: z.record(z.string(), z.array(z.string())),
  target_nodes: z.array(z.string()),
  stale_nodes: z.array(StaleEntrySchema),
});
```

- [ ] **Step 3: 改 GUI 端 serialization.ts**

打开 `packages/apps/gui/src/lib/serialization.ts`，找到 `recordToWorkspace` 和 `workspaceToRecord` 函数。在两个函数里 `stale_nodes` 字段的处理升级：

`recordToWorkspace` 内部 stale_nodes 处理改为（其他字段不动）：

```typescript
stale_nodes: record.stale_nodes ?? [],   // 已是 StaleEntry[] 格式，直接透传
```

`workspaceToRecord` 内部 stale_nodes 字段同样直接透传：

```typescript
stale_nodes: ws.stale_nodes,
```

如果 serialization.ts 里之前有把 stale_nodes 当 string[] 的 .map / .filter 调用，全部去掉。

- [ ] **Step 4: 运行 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck
```

预期：engine 包内 `node.ts` 三处 stale_nodes.push 报错（push string 类型不匹配），其他文件通过。下一个 task 修这三处。

- [ ] **Step 5: 暂不 commit**

等 Task 2 完成 typecheck 全过再一起 commit。

---

## Task 2: 旧 `node.ts` 三处 stale push 类型升级

**Files:**
- Modify: `packages/engine/src/workspace/core/node.ts:51-53`（removeNode 内 push）
- Modify: `packages/engine/src/workspace/core/node.ts:91`（insertBlock 内 push）
- Modify: `packages/engine/src/workspace/core/node.ts:110`（removeBlock 内 push）
- Modify: `packages/engine/src/workspace/core/node.ts:138`（updateBlock 内 push）

- [ ] **Step 1: 改 removeNode 内 downstream push**

打开 `node.ts`，在 `removeNode` 函数里找到这段：

```typescript
if (!ws.stale_nodes.includes(downstreamId)) {
  ws.stale_nodes.push(downstreamId);
}
```

改成：

```typescript
if (!ws.stale_nodes.some(e => e.id === downstreamId)) {
  ws.stale_nodes.push({ id: downstreamId, kind: 'propagated' });
}
```

- [ ] **Step 2: 改 insertBlock / removeBlock / updateBlock 内自身 push**

三处都是：

```typescript
if (ws.outputs.has(nodeId) && !ws.stale_nodes.includes(nodeId)) ws.stale_nodes.push(nodeId);
```

改成：

```typescript
if (ws.outputs.has(nodeId) && !ws.stale_nodes.some(e => e.id === nodeId)) {
  ws.stale_nodes.push({ id: nodeId, kind: 'direct' });
}
```

`insertBlock` 第 91 行 / `removeBlock` 第 110 行 / `updateBlock` 第 138 行 三处都改。

- [ ] **Step 3: 改 removeNode 内开头那行（也涉及 stale_nodes 类型）**

`node.ts` 第 30 行：

```typescript
ws.stale_nodes = ws.stale_nodes.filter(id => id !== nodeId);
```

改成：

```typescript
ws.stale_nodes = ws.stale_nodes.filter(e => e.id !== nodeId);
```

- [ ] **Step 4: 同样改 runner.ts 内 filter**

打开 `packages/engine/src/workspace/core/runner.ts`，搜 `stale_nodes = ws.stale_nodes.filter`。三处（`runNode` 第 47 行、`runAllStream` 第 118 行、另一处如果有）都改为：

```typescript
ws.stale_nodes = ws.stale_nodes.filter(e => e.id !== nodeId);
```

- [ ] **Step 5: 改 graph.ts calcStale 内的字段读写**

打开 `graph.ts`，找 `calcStale` 函数。它把 `stale_nodes` 当 `string[]` 用：

```typescript
const staleSet = new Set(ws.stale_nodes);
const queue = [...ws.stale_nodes];
// ...
if (!staleSet.has(downId)) {
  staleSet.add(downId);
  ws.stale_nodes.push(downId);
}
```

改成（保持 calcStale 原语义"扩散 lazy 标记"）：

```typescript
const staleIds = new Set(ws.stale_nodes.map(e => e.id));
const queue = [...staleIds];
// ...
if (!staleIds.has(downId)) {
  staleIds.add(downId);
  ws.stale_nodes.push({ id: downId, kind: 'propagated' });
}
```

注意：`calcStale` 是旧 lazy 模式的扩散函数，扩散来的下游一律 propagated。

- [ ] **Step 6: 改 cli/run.ts runPreview 输出**

打开 `packages/cli/src/commands/run.ts`，runPreview 函数里：

```typescript
for (const nodeId of ws.stale_nodes) {
  const node = ws.nodes.find(n => n.id === nodeId);
  ...
}
```

改成：

```typescript
for (const entry of ws.stale_nodes) {
  const node = ws.nodes.find(n => n.id === entry.id);
  const label = node?.label || 'unknown';
  console.log(`  ${entry.id} (${entry.kind}) — ${label}`);
}
```

`ws.stale_nodes.length === 0` 判断不变。

- [ ] **Step 7: 运行 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck
```

预期：engine + cli 包通过。GUI 端可能报 store 里 stale_nodes 相关错误（下面 task 处理），先记着。

- [ ] **Step 8: Commit Task 1+2 一起**

```bash
git add packages/engine/src/types.ts packages/engine/src/schema.ts \
        packages/engine/src/workspace/core/node.ts \
        packages/engine/src/workspace/core/runner.ts \
        packages/engine/src/workspace/core/graph.ts \
        packages/cli/src/commands/run.ts \
        packages/apps/gui/src/lib/serialization.ts

git commit -m "$(cat <<'EOF'
refactor(engine): stale_nodes 字段升级为 StaleEntry[]（无向下兼容）

- types/schema: stale_nodes: string[] → { id, kind: 'direct'|'propagated' }[]
- node.ts 三处旧 push 1 行类型升级（保持插入即标 stale 行为）
- runner.ts / graph.ts / cli/run.ts 字段访问适配
- GUI serialization 直接透传

旧函数语义保留供 CLI 用；新模块（stale-tracker / dataflow-runner /
error-log）在后续 task 加入。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: stale-tracker 模块（TDD）

**Files:**
- Create: `packages/engine/src/workspace/core/stale-tracker.ts`
- Test: `packages/engine/src/workspace/core/stale-tracker.test.ts`

- [ ] **Step 1: 写测试 fixture helper**

新建 `stale-tracker.test.ts`：

```typescript
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
```

- [ ] **Step 2: 写升级降级矩阵 T1-T6**

继续在测试文件：

```typescript
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
```

- [ ] **Step 3: 写 T7-T9 其他 case**

```typescript
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
```

- [ ] **Step 4: 跑测试验证 fail**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/stale-tracker.test.ts
```

预期：FAIL with "Cannot find module './stale-tracker'" 或类似。

- [ ] **Step 5: 实现 stale-tracker.ts**

新建 `packages/engine/src/workspace/core/stale-tracker.ts`：

```typescript
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
```

- [ ] **Step 6: 跑测试验证 pass**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/stale-tracker.test.ts
```

预期：PASS 9 个测试。

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/workspace/core/stale-tracker.ts \
        packages/engine/src/workspace/core/stale-tracker.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): stale-tracker 模块 + 升级降级矩阵单测

eager 扩散：markBlockEdited 把 nodeId 标 direct 并 BFS transitive
downstream 标 propagated；markRemovedNodeDownstream 把 snapshot 内的
downstream 全标 propagated；clearOnRun 仅清自身。

升级规则：direct 不被降级；propagated 被 direct 升级。9 个测试覆盖
T1-T9（含 cycle 防御）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: error-log 模块（TDD）

**Files:**
- Create: `packages/engine/src/workspace/core/error-log.ts`
- Test: `packages/engine/src/workspace/core/error-log.test.ts`

- [ ] **Step 1: 写测试**

新建 `error-log.test.ts`：

```typescript
import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join, tmpdir } from 'os';
import { appendError, readAllErrors, readLastErrorPerNode } from './error-log';

describe('error-log', () => {
  let rootDir: string;
  const wsId = 'test-ws';

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'fc-error-log-'));
    mkdirSync(join(rootDir, '.flowcabal', 'cache', wsId), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  test('T17: appendError 后 readAllErrors 回读', async () => {
    appendError(rootDir, wsId, 'node1', 'oh no');
    appendError(rootDir, wsId, 'node2', 'also bad');
    const all = await readAllErrors(rootDir, wsId);
    expect(all.length).toBe(2);
    expect(all[0].nodeId).toBe('node1');
    expect(all[0].message).toBe('oh no');
    expect(all[1].nodeId).toBe('node2');
  });

  test('T18: readLastErrorPerNode 后覆盖前', async () => {
    appendError(rootDir, wsId, 'node1', 'first');
    appendError(rootDir, wsId, 'node1', 'second');
    appendError(rootDir, wsId, 'node2', 'other');
    const map = await readLastErrorPerNode(rootDir, wsId);
    expect(map.size).toBe(2);
    expect(map.get('node1')?.message).toBe('second');
    expect(map.get('node2')?.message).toBe('other');
  });

  test('T19: 坏行容错', async () => {
    const logPath = join(rootDir, '.flowcabal', 'cache', wsId, 'errors.log');
    writeFileSync(logPath, '{"ts":"2026-05-24T00:00:00.000Z","nodeId":"a","message":"ok"}\n');
    writeFileSync(logPath, '{not-json-broken\n', { flag: 'a' });
    writeFileSync(logPath, '{"ts":"2026-05-24T00:00:01.000Z","nodeId":"b","message":"good"}\n', { flag: 'a' });
    const all = await readAllErrors(rootDir, wsId);
    expect(all.length).toBe(2);                 // 坏行跳过，两条正常的回读
    expect(all[0].nodeId).toBe('a');
    expect(all[1].nodeId).toBe('b');
  });

  test('T20: appendError 写盘失败不抛', () => {
    // 给一个不存在的路径，appendFileSync 会抛但 appendError 必须吞掉
    expect(() => appendError('/nonexistent/path', wsId, 'a', 'msg')).not.toThrow();
  });

  test('T20b: errors.log 不存在时 readAllErrors 返回 []', async () => {
    const all = await readAllErrors(rootDir, 'never-existed');
    expect(all).toEqual([]);
  });
});
```

- [ ] **Step 2: 跑测试验证 fail**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/error-log.test.ts
```

预期：FAIL with module not found。

- [ ] **Step 3: 检查 `paths.ts` 是否有 getWorkspaceDir**

```bash
grep -n "getWorkspaceDir" /Users/zhecai/FlowCabal/packages/engine/src/paths.ts
```

确认 `getWorkspaceDir(rootDir, wsId)` 函数存在（BCDE 期 cli workspace.ts 用过）。如果没有，看实际函数名是什么，下一步代码用真实函数名。

- [ ] **Step 4: 实现 error-log.ts**

新建 `packages/engine/src/workspace/core/error-log.ts`：

```typescript
import { appendFileSync, existsSync, createReadStream } from 'fs';
import { join } from 'path';
import { createInterface } from 'readline';
import { getWorkspaceDir } from '../../paths';

export interface ErrorEntry {
  ts: string;       // ISO8601
  nodeId: string;
  message: string;
}

export function appendError(rootDir: string, wsId: string, nodeId: string, message: string): void {
  try {
    const path = join(getWorkspaceDir(rootDir, wsId), 'errors.log');
    const entry = { ts: new Date().toISOString(), nodeId, message };
    appendFileSync(path, JSON.stringify(entry) + '\n', { flag: 'a' });
  } catch (err) {
    console.warn(`[error-log] failed to append:`, (err as Error).message);
  }
}

export async function readAllErrors(rootDir: string, wsId: string): Promise<ErrorEntry[]> {
  const path = join(getWorkspaceDir(rootDir, wsId), 'errors.log');
  if (!existsSync(path)) return [];

  const result: ErrorEntry[] = [];
  const stream = createReadStream(path);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      result.push(JSON.parse(line) as ErrorEntry);
    } catch {
      // 坏行跳过
    }
  }
  return result;
}

export async function readLastErrorPerNode(rootDir: string, wsId: string): Promise<Map<string, ErrorEntry>> {
  const all = await readAllErrors(rootDir, wsId);
  const map = new Map<string, ErrorEntry>();
  for (const e of all) map.set(e.nodeId, e);   // 后覆盖前 → last
  return map;
}
```

- [ ] **Step 5: 跑测试验证 pass**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/error-log.test.ts
```

预期：PASS 5 个测试。

- [ ] **Step 6: Commit**

```bash
git add packages/engine/src/workspace/core/error-log.ts \
        packages/engine/src/workspace/core/error-log.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): error-log 模块（NDJSON append-only + reader）

per-workspace errors.log 路径 <rootDir>/.flowcabal/cache/<wsId>/errors.log。
appendError 写盘失败仅 console.warn，不抛；readAllErrors 坏行跳过；
readLastErrorPerNode 用 full scan + 后覆盖前算出 per-node last。

5 个测试覆盖 T17-T20b。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5a: event-channel helper

**Files:**
- Create: `packages/engine/src/workspace/core/event-channel.ts`

- [ ] **Step 1: 实现 EventChannel**

新建 `packages/engine/src/workspace/core/event-channel.ts`：

```typescript
// mpsc-like async channel：多生产者 push，单消费者 await next()
export class EventChannel<T> {
  private buffer: T[] = [];
  private resolvers: ((value: T | null) => void)[] = [];
  private closed = false;

  push(value: T): void {
    if (this.closed) return;
    if (this.resolvers.length > 0) {
      this.resolvers.shift()!(value);
    } else {
      this.buffer.push(value);
    }
  }

  async next(): Promise<T | null> {
    if (this.buffer.length > 0) return this.buffer.shift()!;
    if (this.closed) return null;
    return new Promise<T | null>((resolve) => this.resolvers.push(resolve));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    for (const r of this.resolvers) r(null);
    this.resolvers = [];
  }
}
```

- [ ] **Step 2: 不写测试**

EventChannel 是 dataflow-runner 的私有实现，由 dataflow-runner 测试间接覆盖。不单独建 test 文件 —— YAGNI。

- [ ] **Step 3: 暂不 commit**

跟下一个 Task 5b 一起 commit。

---

## Task 5b: dataflow-runner 模块（TDD）

**Files:**
- Create: `packages/engine/src/workspace/core/dataflow-runner.ts`
- Test: `packages/engine/src/workspace/core/dataflow-runner.test.ts`

- [ ] **Step 1: 写测试 mock 框架**

新建 `dataflow-runner.test.ts`：

```typescript
import { test, expect, describe, mock, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join, tmpdir } from 'os';
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
    // 取 system / user 第一段当 nodeId 提示 —— 测试 ws 故意把 label 当 prompt
    const nodeId = user.split('\n')[0] || system.split('\n')[0] || 'unknown';
    nodeStartOrder.push(nodeId);
    const behavior = mockBehavior[nodeId] ?? 'success';
    return {
      textStream: (async function* () {
        if (behavior === 'error') throw new Error(`mock error for ${nodeId}`);
        const tokens = behavior === 'success' ? ['output-of-', nodeId] : behavior.tokens;
        for (const t of tokens) yield t;
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
      // 把 id 当 user prompt 字面量，mock createStream 据此分辨节点
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
```

- [ ] **Step 2: 写测试 T10-T16**

继续在文件：

```typescript
describe('runAllDataflow 调度', () => {
  test('T10: linear chain 全成功', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['B', 'C']]);
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'B', 'C']);
    expect(done.failed).toEqual([]);
    expect(done.stuck).toEqual([]);
    expect(ws.outputs.size).toBe(3);
    expect(ws.target_nodes).toEqual([]);       // 全部 target 移除
  });

  test('T11: branch 全成功', async () => {
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'B', 'C']);
    // A 必须先于 B / C 出 node-start
    const aStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'A');
    const bStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'B');
    const cStart = events.findIndex(e => e.type === 'node-start' && e.nodeId === 'C');
    expect(aStart).toBeLessThan(bStart);
    expect(aStart).toBeLessThan(cStart);
  });

  test('T12: 独立分支 fail 不阻塞旁支', async () => {
    // A→B, A→C, B fail, C 独立完成
    const ws = mkWs(['A', 'B', 'C'], [['A', 'B'], ['A', 'C']]);
    mockBehavior = { B: 'error' };
    const events = await collectEvents(ws);
    const done = events.find(e => e.type === 'dag-done') as Extract<DataflowEvent, { type: 'dag-done' }>;
    expect(done.done.sort()).toEqual(['A', 'C']);
    expect(done.failed).toEqual(['B']);
    expect(done.stuck).toEqual([]);
    // B 仍在 target_nodes（fail 不移除）
    expect(ws.target_nodes).toContain('B');
    // A / C 已移除
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
    // X→Y→Z, X→W; target={Z, W}
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
    // 在 A 第一个 token 后立即 abort
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
    // A 可能 fail 或 stuck（依 mock 内部对 signal 的响应），但 B 必 stuck
    expect(done.stuck).toContain('B');
  });

  test('T16: 跑完 ws 状态正确', async () => {
    const ws = mkWs(['A', 'B'], [['A', 'B']]);
    ws.stale_nodes = [{ id: 'A', kind: 'direct' }, { id: 'B', kind: 'propagated' }];
    await collectEvents(ws);
    expect(ws.outputs.get('A')).toBe('output-of-A');
    expect(ws.outputs.get('B')).toBe('output-of-B');
    expect(ws.target_nodes).toEqual([]);
    expect(ws.stale_nodes).toEqual([]);        // 都被 clearOnRun 清掉
  });
});
```

- [ ] **Step 3: 跑测试验证 fail**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/dataflow-runner.test.ts
```

预期：FAIL with module not found。

- [ ] **Step 4: 实现 dataflow-runner.ts**

新建 `packages/engine/src/workspace/core/dataflow-runner.ts`：

```typescript
import { Workspace, LlmConfig, TextBlock } from '../../types';
import { createStream } from '../../llm/generate.js';
import { runMemoryAgent } from '../../agent/memory-agent.js';
import { todoList } from './graph.js';
import { getNode } from './node.js';
import { clearOnRun } from './stale-tracker.js';
import { appendError } from './error-log.js';
import { EventChannel } from './event-channel.js';

export type DataflowEvent =
  | { type: 'dag-start'; total: number; nodeIds: string[] }
  | { type: 'node-start'; nodeId: string }
  | { type: 'node-token'; nodeId: string; chunk: string }
  | { type: 'node-complete'; nodeId: string; output: string }
  | { type: 'node-error'; nodeId: string; message: string }
  | { type: 'dag-done'; done: string[]; failed: string[]; stuck: string[] };

async function resolvePrompt(
  ws: Workspace,
  blocks: TextBlock[],
  rootDir: string,
  llmConfig: LlmConfig,
): Promise<string> {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'literal') {
      parts.push(block.content);
    } else if (block.kind === 'ref') {
      const output = ws.outputs.get(block.nodeId);
      if (output) parts.push(output);
    } else if (block.kind === 'agent-inject') {
      const injected = await runMemoryAgent(
        rootDir,
        llmConfig,
        block.hint,
        { readonly: true },
      );
      if (injected) parts.push(injected);
    }
  }
  return parts.join('\n\n');
}

export async function* runAllDataflow(
  ws: Workspace,
  config: LlmConfig,
  rootDir: string,
  abortSignal?: AbortSignal,
): AsyncGenerator<DataflowEvent> {
  const todo = new Set(todoList(ws));

  if (todo.size === 0) {
    yield { type: 'dag-done', done: [], failed: [], stuck: [] };
    return;
  }

  // 初始 in-degree：只数 todo 内的 upstream
  const inDeg = new Map<string, number>();
  for (const id of todo) {
    const ups = ws.upstream.get(id) || [];
    inDeg.set(id, ups.filter(u => todo.has(u)).length);
  }

  const channel = new EventChannel<DataflowEvent>();
  const done = new Set<string>();
  const failed = new Set<string>();
  const running = new Set<string>();

  const finalizeIfDone = () => {
    if (running.size === 0) {
      const stuck = [...todo].filter(id => !done.has(id) && !failed.has(id));
      channel.push({ type: 'dag-done', done: [...done], failed: [...failed], stuck });
      channel.close();
    }
  };

  const launchReady = () => {
    for (const id of todo) {
      if (running.has(id) || done.has(id) || failed.has(id)) continue;
      if (inDeg.get(id) === 0) {
        running.add(id);
        // fire-and-forget；fireNode 完成时自动调 onSettle
        fireNode(id);
      }
    }
  };

  const onSettle = (nodeId: string) => {
    running.delete(nodeId);
    launchReady();
    finalizeIfDone();
  };

  const fireNode = async (nodeId: string): Promise<void> => {
    channel.push({ type: 'node-start', nodeId });
    const node = getNode(ws, nodeId);
    if (!node) {
      failed.add(nodeId);
      channel.push({ type: 'node-error', nodeId, message: 'node not found' });
      onSettle(nodeId);
      return;
    }
    try {
      const system = await resolvePrompt(ws, node.systemPrompt, rootDir, config);
      const user = await resolvePrompt(ws, node.userPrompt, rootDir, config);
      let accumulated = '';
      const stream = createStream(config, system, user, abortSignal);
      for await (const chunk of stream.textStream) {
        accumulated += chunk;
        channel.push({ type: 'node-token', nodeId, chunk });
      }
      ws.outputs.set(nodeId, accumulated);
      ws.target_nodes = ws.target_nodes.filter(t => t !== nodeId);
      clearOnRun(ws, nodeId);
      done.add(nodeId);
      channel.push({ type: 'node-complete', nodeId, output: accumulated });
      // 触发 downstream 的 inDeg 减一
      for (const ds of ws.downstream.get(nodeId) || []) {
        if (todo.has(ds) && inDeg.has(ds)) inDeg.set(ds, inDeg.get(ds)! - 1);
      }
    } catch (err) {
      const message = (err as Error).message;
      channel.push({ type: 'node-error', nodeId, message });
      try { appendError(rootDir, ws.id, nodeId, message); } catch {}
      failed.add(nodeId);
      // 不动 target_nodes / 不动 downstream inDeg
    }
    onSettle(nodeId);
  };

  channel.push({ type: 'dag-start', total: todo.size, nodeIds: [...todo] });
  launchReady();

  // 兜底：如果一开始就没 ready（理论不该，todo 非空必有 inDeg=0）
  if (running.size === 0) {
    const stuck = [...todo];
    channel.push({ type: 'dag-done', done: [], failed: [], stuck });
    channel.close();
  }

  while (true) {
    const event = await channel.next();
    if (event === null) break;
    yield event;
  }
}
```

- [ ] **Step 5: 跑测试验证 pass**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/dataflow-runner.test.ts
```

预期：PASS 7 个测试。如有某个 mock 行为不准（比如 mock createStream 拿不到 nodeId）调整测试 setup。

- [ ] **Step 6: 跑全 engine 测试**

```bash
cd /Users/zhecai/FlowCabal && bun test packages/engine/src/workspace/core/
```

预期：PASS 21 个测试（stale-tracker 9 + error-log 5 + dataflow 7）。

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/workspace/core/event-channel.ts \
        packages/engine/src/workspace/core/dataflow-runner.ts \
        packages/engine/src/workspace/core/dataflow-runner.test.ts
git commit -m "$(cat <<'EOF'
feat(engine): dataflow-runner 图原生并行调度 + EventChannel

Kahn 运行时变体：维护 inDeg map + fire-and-forget；node-complete 时
downstream inDeg-- 触发 launchReady；node-error 时不动 inDeg，下游
永远不 ready 自然 stuck。不限并发上限。

EventChannel mpsc 把多个 fire-and-forget fireNode 的 events 串成
generator 输出。

DataflowEvent.dag-done 字段 { done, failed, stuck } 替换旧 executed。
错误自动 appendError 到 errors.log。

7 个测试覆盖 T10-T16 含 abort signal。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: engine 顶层 re-export

**Files:**
- Modify: `packages/engine/src/workspace/core/index.ts`
- Modify: `packages/engine/src/index.ts`

- [ ] **Step 1: 改 core/index.ts**

打开 `packages/engine/src/workspace/core/index.ts`：

```typescript
export * from './node.js';
export * from './graph.js';
export * from './runner.js';
export * from './stale-tracker.js';
export * from './error-log.js';
export * from './dataflow-runner.js';
```

- [ ] **Step 2: 验证 engine 顶层 index 已经 wildcard re-export core**

```bash
cat /Users/zhecai/FlowCabal/packages/engine/src/index.ts
```

如果是 `export * from './workspace/core'` 则不用动。如果是手列 export，按下面加：

```typescript
export type { StaleEntry, ErrorEntry, DataflowEvent } from './workspace/core/...';
export {
  getDirectStale, getPropagatedStale, markBlockEdited, markRemovedNodeDownstream, clearOnRun,
  appendError, readAllErrors, readLastErrorPerNode,
  runAllDataflow,
} from './workspace/core';
```

- [ ] **Step 3: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck
```

预期：engine + cli 通过。

- [ ] **Step 4: Commit**

```bash
git add packages/engine/src/workspace/core/index.ts packages/engine/src/index.ts
git commit -m "feat(engine): export stale-tracker / error-log / dataflow-runner

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 7: GUI API `blocks` 路由接 stale-tracker

**Files:**
- Modify: `packages/apps/gui/src/app/api/workspaces/[id]/blocks/route.ts`

- [ ] **Step 1: 读现有 route**

```bash
cat /Users/zhecai/FlowCabal/packages/apps/gui/src/app/api/workspaces/\[id\]/blocks/route.ts
```

定位调 `insertBlock / updateBlock / removeBlock` 的位置。

- [ ] **Step 2: 在三处调用后追加 markBlockEdited**

import 加：

```typescript
import { markBlockEdited } from '@flowcabal/engine';
```

每个 action 分支（'insert' / 'update' / 'remove'）调旧函数成功后**接着调** `markBlockEdited(ws, nodeId)`，再 writeWorkspace。示例（看现有结构）：

```typescript
if (action === 'insert') {
  const ok = insertBlock(ws, nodeId, block, isSystem, index);
  if (!ok) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
  markBlockEdited(ws, nodeId);   // ← 新增
  writeWorkspace(projectDir, workspaceId, ws);
  return NextResponse.json({ workspace: workspaceToRecord(ws) });
}
// update / remove 分支同理
```

- [ ] **Step 3: 跑 typecheck GUI**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

预期：通过。

- [ ] **Step 4: Commit**

```bash
git add packages/apps/gui/src/app/api/workspaces/\[id\]/blocks/route.ts
git commit -m "feat(gui/api): blocks route 接 stale-tracker eager 扩散

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 8: GUI API `nodes` DELETE 接 stale-tracker

**Files:**
- Modify: `packages/apps/gui/src/app/api/workspaces/nodes/route.ts`

- [ ] **Step 1: 读现有 DELETE handler**

```bash
cat /Users/zhecai/FlowCabal/packages/apps/gui/src/app/api/workspaces/nodes/route.ts
```

- [ ] **Step 2: 改 DELETE：先抓 snapshot 再删再扩散**

import 加：

```typescript
import { markRemovedNodeDownstream } from '@flowcabal/engine';
```

DELETE handler 主要逻辑改成：

```typescript
const downstreamSnapshot = [...(ws.downstream.get(nodeId) || [])];
const ok = removeNode(ws, nodeId);
if (!ok) return NextResponse.json({ error: 'Node not found' }, { status: 404 });
markRemovedNodeDownstream(ws, downstreamSnapshot);
writeWorkspace(projectDir, workspaceId, ws);
return NextResponse.json({ workspace: workspaceToRecord(ws) });
```

注意：`removeNode` 内部已会自动把所有直接下游标 propagated（旧函数的 1 行升级保留这行为），`markRemovedNodeDownstream` 进一步做 transitive BFS 扩散。两次扩散都经过 upsert 规则不会冲突（已经是 propagated 的不变；direct 的不被降级）。

- [ ] **Step 3: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 4: Commit**

```bash
git add packages/apps/gui/src/app/api/workspaces/nodes/route.ts
git commit -m "feat(gui/api): nodes DELETE 接 stale-tracker transitive 扩散

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 9: GUI API `errors` 路由新建

**Files:**
- Create: `packages/apps/gui/src/app/api/workspaces/[id]/errors/route.ts`

- [ ] **Step 1: 新建 route**

`packages/apps/gui/src/app/api/workspaces/[id]/errors/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { readLastErrorPerNode, readAllErrors } from '@flowcabal/engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const url = new URL(request.url);
  const projectDir = process.cwd();

  if (url.searchParams.get('per-node') === 'last') {
    const map = await readLastErrorPerNode(projectDir, workspaceId);
    return NextResponse.json(Object.fromEntries(map));
  }
  const all = await readAllErrors(projectDir, workspaceId);
  return NextResponse.json(all);
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 3: Commit**

```bash
git add packages/apps/gui/src/app/api/workspaces/\[id\]/errors/route.ts
git commit -m "feat(gui/api): GET /api/workspaces/:id/errors（per-node=last / 全量）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 10: GUI API `run-all` 改用 dataflow-runner

**Files:**
- Modify: `packages/apps/gui/src/app/api/engine/run-all/route.ts`

- [ ] **Step 1: 读现有 route**

```bash
cat /Users/zhecai/FlowCabal/packages/apps/gui/src/app/api/engine/run-all/route.ts
```

- [ ] **Step 2: 改 import + 调用**

把 `runAllStream` 替换为 `runAllDataflow`：

```typescript
import { readWorkspace, writeWorkspace, runAllDataflow, readLlmConfigs } from '@flowcabal/engine';
```

handler 主体里 `for await` 用新函数 + 同样 NDJSON enqueue + finally writeWorkspace（其他不动）：

```typescript
const stream = new ReadableStream({
  async start(controller) {
    const encoder = new TextEncoder();
    try {
      for await (const event of runAllDataflow(workspace, config, projectDir)) {
        controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
      }
      writeWorkspace(projectDir, workspaceId, workspace);
    } catch (err) {
      console.error('[run-all] unexpected:', err);
    } finally {
      controller.close();
    }
  },
});
```

- [ ] **Step 3: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 4: Commit**

```bash
git add packages/apps/gui/src/app/api/engine/run-all/route.ts
git commit -m "feat(gui/api): run-all 改用 dataflow-runner（图原生并行 + error 不传染）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 11: GUI store `runtimeErrors` state + 加载 fetch

**Files:**
- Modify: `packages/apps/gui/src/store/useStore.ts`

- [ ] **Step 1: 加 state 字段**

在 `useStore` 的 GuiState 类型加：

```typescript
runtimeErrors: Map<string, ErrorEntry>
```

文件顶部 import 加 `ErrorEntry`：

```typescript
import type { Workspace, NodeDef, TextBlock, NodeEvent, ErrorEntry } from '@flowcabal/engine'
```

(NodeEvent 暂留兼容；下一 task 改 DataflowEvent。)

`create<GuiState>()` 的 initial state 里加：

```typescript
runtimeErrors: new Map(),
```

- [ ] **Step 2: loadWorkspace 追加 fetch errors**

`internal_loadWorkspace` 函数尾部（在 `internal_switchWorkspace` 调用之后）追加：

```typescript
try {
  const errRes = await fetch(`/api/workspaces/${workspaceId}/errors?per-node=last`)
  if (errRes.ok) {
    const errMap: Record<string, ErrorEntry> = await errRes.json()
    this.#set({ runtimeErrors: new Map(Object.entries(errMap)) })
  }
} catch {
  // 加载错误日志失败不阻塞 workspace 加载
}
```

- [ ] **Step 3: switchWorkspace 清 runtimeErrors**

`internal_switchWorkspace` 函数顶部（在改 activeWorkspace 之前）：

```typescript
this.#set({ runtimeErrors: new Map() })
```

防止切换 workspace 时残留上一个 workspace 的 error 视觉。

- [ ] **Step 4: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 5: Commit**

```bash
git add packages/apps/gui/src/store/useStore.ts
git commit -m "feat(gui/store): runtimeErrors state + loadWorkspace fetch errors.log

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 12: GUI store `#handleNodeEvent` 升级到 DataflowEvent

**Files:**
- Modify: `packages/apps/gui/src/store/useStore.ts`

- [ ] **Step 1: import DataflowEvent + 替换 NodeEvent 类型**

import 改：

```typescript
import type { Workspace, NodeDef, TextBlock, DataflowEvent, ErrorEntry } from '@flowcabal/engine'
```

把所有 `NodeEvent` 引用替换成 `DataflowEvent`。

- [ ] **Step 2: 改 #handleNodeEvent**

`#handleNodeEvent` 函数体替换为：

```typescript
#handleNodeEvent = (event: DataflowEvent) => {
  switch (event.type) {
    case 'dag-start':
      this.#set({ dagProgress: { current: 0, total: event.total } })
      break
    case 'node-start':
      this.#set({ runningNodeId: event.nodeId })
      this.#setNodeStatus(event.nodeId, 'running')
      break
    case 'node-token':
      this.#set((s: any) => {
        const map = new Map(s.runningOutput)
        map.set(event.nodeId, (map.get(event.nodeId) ?? '') + event.chunk)
        return { runningOutput: map }
      })
      break
    case 'node-complete':
      this.#set((s: any) => {
        const map = new Map(s.runningOutput)
        map.delete(event.nodeId)
        const dp = s.dagProgress
        const errMap = new Map(s.runtimeErrors)
        errMap.delete(event.nodeId)
        return {
          runningOutput: map,
          runtimeErrors: errMap,
          dagProgress: dp ? { ...dp, current: dp.current + 1 } : null,
        }
      })
      this.#applyNodeComplete(event.nodeId, event.output)
      break
    case 'node-error':
      this.#set((s: any) => {
        const errMap = new Map(s.runtimeErrors)
        errMap.set(event.nodeId, {
          ts: new Date().toISOString(),
          nodeId: event.nodeId,
          message: event.message,
        })
        return { runtimeErrors: errMap }
      })
      break
    case 'dag-done':
      this.#set({ runningNodeId: null })
      if (event.failed.length > 0 || event.stuck.length > 0) {
        toast.warning(
          `跑完：成功 ${event.done.length}，失败 ${event.failed.length}` +
          (event.stuck.length > 0 ? `，未跑 ${event.stuck.length}` : '')
        )
      } else if (event.done.length > 0) {
        toast.success(`跑完 ${event.done.length} 个节点`)
      }
      break
  }
}
```

注意：`dag-done` 是 toast 提示的唯一位置 —— 移除 `internal_runAll` finally 里原有的 `toast.error('运行失败')`（如果有的话），改由 dag-done 失败摘要承担。

- [ ] **Step 3: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 4: Commit**

```bash
git add packages/apps/gui/src/store/useStore.ts
git commit -m "feat(gui/store): handleNodeEvent 升级到 DataflowEvent

dag-done 携 done/failed/stuck 三集合，toast 摘要替换原 finally 失败 toast。
node-complete 时清除该节点 runtimeErrors（success 抹掉历史 error）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 13: GUI store selector helper

**Files:**
- Modify: `packages/apps/gui/src/store/useStore.ts`

- [ ] **Step 1: 加 selector 函数（导出供组件用）**

在 `useStore.ts` 文件末尾（`export const useStore` 之后）追加：

```typescript
export function getStaleKindForNode(ws: Workspace | null, nodeId: string): 'direct' | 'propagated' | null {
  if (!ws) return null
  const entry = ws.stale_nodes.find(e => e.id === nodeId)
  return entry?.kind ?? null
}

export function propagatedUpstreamRomans(ws: Workspace | null, nodeId: string): string[] {
  if (!ws) return []
  const directIds = new Set(
    ws.stale_nodes.filter(e => e.kind === 'direct').map(e => e.id)
  )
  const result: string[] = []
  const visited = new Set<string>()
  const queue = [...(ws.upstream.get(nodeId) || [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    if (directIds.has(id)) {
      const idx = ws.nodes.findIndex(n => n.id === id)
      if (idx >= 0) result.push(toRoman(idx + 1))
    }
    for (const u of ws.upstream.get(id) || []) queue.push(u)
  }
  return result
}
```

(toRoman 已在文件顶部，直接复用。)

- [ ] **Step 2: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck:gui
```

- [ ] **Step 3: Commit**

```bash
git add packages/apps/gui/src/store/useStore.ts
git commit -m "feat(gui/store): getStaleKindForNode / propagatedUpstreamRomans selectors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 14: FlowNode ✱ 角标双色

**Files:**
- Modify: `packages/apps/gui/src/components/FlowNode.tsx`

- [ ] **Step 1: 读现有 FlowNode**

```bash
cat /Users/zhecai/FlowCabal/packages/apps/gui/src/components/FlowNode.tsx
```

定位顶部 Roman 字符所在的 row（A 期 / BCDE 期已有），✱ 要叠加在该行右侧 / 节点右上角 absolute。

- [ ] **Step 2: 在组件顶部加 selector hook**

```typescript
import { useStore, getStaleKindForNode } from '@/store/useStore'

// 在组件内
const activeWs = useStore((s) => s.activeWorkspace)
const staleKind = getStaleKindForNode(activeWs, props.id)
```

- [ ] **Step 3: 加 ✱ 角标 JSX**

在节点内容的 wrapper 内（FlowNode 根 div 内），加 absolute 定位的 ✱：

```tsx
{staleKind && (
  <span
    className="absolute top-2 right-3 font-display italic text-[14px] leading-none"
    style={{
      color: staleKind === 'direct'
        ? 'var(--color-clay-deep)'
        : 'rgba(182, 92, 69, 0.45)',
    }}
    aria-label={staleKind === 'direct' ? '已编辑，待重跑' : '上游已变，待重跑'}
  >
    ✱
  </span>
)}
```

确认 FlowNode 根 div 已是 `relative` 定位（A 期 / BCDE 期应已是）。如不是加 `relative` class。

- [ ] **Step 4: 浏览器手动验证**

```bash
cd /Users/zhecai/FlowCabal && bun run dev
```

打开浏览器，新建 workspace，加节点 A→B→C。编辑 A 的 user prompt → 期望 A 右上角 ✱ 深红，B/C 右上角 ✱ 浅红。

- [ ] **Step 5: Commit**

```bash
git add packages/apps/gui/src/components/FlowNode.tsx
git commit -m "feat(gui/flownode): ✱ 角标右上角双色（direct 深红 / propagated 浅红）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 15: FlowNode error 尾栏文字

**Files:**
- Modify: `packages/apps/gui/src/components/FlowNode.tsx`

- [ ] **Step 1: 加 error selector**

在组件内加：

```typescript
const errorEntry = useStore((s) => s.runtimeErrors.get(props.id))
const hasError = !!errorEntry
```

- [ ] **Step 2: 改尾栏（footer）文字**

FlowNode 现有尾栏 JSX（BCDE 期定的「待运行 / 待重跑 · N 字 / completed · N 字 / 正在生成…」）外面包一层条件：

```tsx
{hasError ? (
  <div className="flex items-center justify-between">
    <span className="font-display italic text-[12px]"
          style={{ color: 'var(--color-clay-deep)' }}>
      ● 上次失败
    </span>
    <span className="font-mono text-[10px] text-ink-faint tabular-nums">
      {output ? `${output.length} 字` : '—'}
    </span>
  </div>
) : (
  /* BCDE 期已有的 4 态尾栏 JSX 保留 */
)}
```

- [ ] **Step 3: 手动验证**

dev server 重启。临时把 LLM key 改坏，运行某个节点 → 节点尾栏出现「● 上次失败 · —」红文字。

- [ ] **Step 4: Commit**

```bash
git add packages/apps/gui/src/components/FlowNode.tsx
git commit -m "feat(gui/flownode): error 尾栏文字斜体 clay-deep「上次失败」

不动节点边框，仅尾栏文字层切换。✱ 角标跟 error 文字可共存。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 16: FlowNode Tooltip + 「加入 target 重跑」按钮

**Files:**
- Modify: `packages/apps/gui/src/components/FlowNode.tsx`
- Maybe Create: `packages/apps/gui/src/components/StaleTooltip.tsx`（如果 FlowNode 太长）

- [ ] **Step 1: 检查 Radix Tooltip 是否已装**

```bash
grep -n "@radix-ui/react-tooltip" /Users/zhecai/FlowCabal/packages/apps/gui/package.json
```

如未装：

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun add @radix-ui/react-tooltip
```

- [ ] **Step 2: 包 TooltipProvider**

打开 layout 或 root page，确认有 `<Tooltip.Provider>` 包裹。如没有，在 `packages/apps/gui/src/app/layout.tsx` 加：

```tsx
import * as Tooltip from '@radix-ui/react-tooltip'

// 在 RootLayout 的 body 内层包：
<Tooltip.Provider delayDuration={200}>
  {children}
</Tooltip.Provider>
```

- [ ] **Step 3: 在 FlowNode 内把 ✱ 角标包成 Tooltip trigger**

import 加：

```tsx
import * as Tooltip from '@radix-ui/react-tooltip'
import { propagatedUpstreamRomans } from '@/store/useStore'
```

✱ 角标 JSX 改造：

```tsx
{staleKind && (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <span
        className="absolute top-2 right-3 font-display italic text-[14px] leading-none cursor-help"
        style={{
          color: staleKind === 'direct'
            ? 'var(--color-clay-deep)'
            : 'rgba(182, 92, 69, 0.45)',
        }}
      >
        ✱
      </span>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        className="bg-white border border-rule rounded-md shadow-lift px-3 py-2 max-w-[260px]"
      >
        <StaleTooltipBody nodeId={props.id} staleKind={staleKind} />
        <Tooltip.Arrow className="fill-white" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
)}
```

- [ ] **Step 4: 定义 StaleTooltipBody（可放 FlowNode 同文件）**

```tsx
function StaleTooltipBody({ nodeId, staleKind }: { nodeId: string; staleKind: 'direct' | 'propagated' }) {
  const activeWs = useStore((s) => s.activeWorkspace)
  const addToTarget = useStore((s) => s.addToTarget)
  const romans = staleKind === 'propagated' ? propagatedUpstreamRomans(activeWs, nodeId) : []

  const desc = staleKind === 'direct'
    ? '本节点已编辑，上次输出可能不是最新'
    : `上游 ${romans.slice(0, 3).join(', ')}${romans.length > 3 ? '…' : ''} 已变更，本节点输出可能不是最新`

  return (
    <div>
      <p className="font-body text-[12px] text-ink leading-snug">{desc}</p>
      <div className="border-t border-rule mt-2 pt-2">
        <button
          onClick={() => addToTarget(nodeId)}
          className="font-display italic text-[12px] text-clay-deep hover:underline"
        >
          加入 target 重跑
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: 给 error 尾栏文字也包 Tooltip**

Task 15 加的 error 尾栏 JSX 改成 Tooltip trigger：

```tsx
{hasError ? (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <div className="flex items-center justify-between cursor-help">
        <span className="font-display italic text-[12px]"
              style={{ color: 'var(--color-clay-deep)' }}>
          ● 上次失败
        </span>
        <span className="font-mono text-[10px] text-ink-faint tabular-nums">
          {output ? `${output.length} 字` : '—'}
        </span>
      </div>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content
        side="top"
        className="bg-white border border-rule rounded-md shadow-lift px-3 py-2 max-w-[300px]"
      >
        <ErrorTooltipBody nodeId={props.id} entry={errorEntry!} />
        <Tooltip.Arrow className="fill-white" />
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
) : ( /* 原 4 态尾栏 */ )}
```

- [ ] **Step 6: 定义 ErrorTooltipBody**

```tsx
function ErrorTooltipBody({ nodeId, entry }: { nodeId: string; entry: ErrorEntry }) {
  const addToTarget = useStore((s) => s.addToTarget)
  return (
    <div>
      <p className="font-display italic text-[12px] text-clay-deep mb-1">上次运行失败</p>
      <p className="font-mono text-[10px] text-ink leading-relaxed">
        {entry.message.slice(0, 200)}{entry.message.length > 200 ? '…' : ''}
      </p>
      <div className="border-t border-rule mt-2 pt-2">
        <button
          onClick={() => addToTarget(nodeId)}
          className="font-display italic text-[12px] text-clay-deep hover:underline"
        >
          加入 target 重跑
        </button>
      </div>
    </div>
  )
}
```

import `ErrorEntry` 类型从 `@flowcabal/engine`。

- [ ] **Step 7: 手动验证 hover + click**

dev server 重启。

1. 编辑某节点 prompt → hover ✱ → tooltip 弹出 → 点「加入 target 重跑」→ 节点变 target 态，output 保留
2. 跑挂某节点 → hover 尾栏「上次失败」→ tooltip 显示 message 摘要 → 点「加入 target 重跑」→ 进 target

- [ ] **Step 8: Commit**

```bash
git add packages/apps/gui/src/components/FlowNode.tsx \
        packages/apps/gui/src/app/layout.tsx \
        packages/apps/gui/package.json
git commit -m "feat(gui/flownode): ✱ + error 尾栏 Radix Tooltip + 加入 target 重跑

✱ tooltip：direct「已编辑」/ propagated「上游 X, Y 已变更」，含 upstream
Roman 列表（最多 3 个）。error tooltip：message 摘要前 200 字符。两个
tooltip 都含「加入 target 重跑」按钮调 store.addToTarget。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 17: CLI `workspaceStatus` 输出格式升级

**Files:**
- Modify: `packages/cli/src/commands/workspace.ts:78-94`

- [ ] **Step 1: 改 workspaceStatus**

打开 `packages/cli/src/commands/workspace.ts`，找 `workspaceStatus` 函数，把：

```typescript
console.log(`  Stale: ${ws.stale_nodes.join(', ') || '(none)'}`);
```

改成多行：

```typescript
if (ws.stale_nodes.length === 0) {
  console.log(`  Stale: (none)`);
} else {
  console.log(`  Stale:`);
  for (const entry of ws.stale_nodes) {
    console.log(`    ${entry.id} (${entry.kind})`);
  }
}
```

- [ ] **Step 2: 跑 typecheck**

```bash
cd /Users/zhecai/FlowCabal && bun run typecheck
```

- [ ] **Step 3: 手动验证**

```bash
cd /Users/zhecai/FlowCabal && bun flowcabal workspace status <some-workspace-id>
```

预期输出格式正常。

- [ ] **Step 4: Commit**

```bash
git add packages/cli/src/commands/workspace.ts
git commit -m "refactor(cli): workspaceStatus 输出 stale_nodes 多行带 kind

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 18: 手动 e2e 验证

**Files:** 无代码改动；仅人工验证 + AGENTS.md 沉淀

- [ ] **Step 1: 6 个 e2e 场景**

dev server 启动：

```bash
cd /Users/zhecai/FlowCabal && bun run dev
```

逐项验证：

| # | 场景 | 期望 |
|---|---|---|
| 1 | 加 A→B→C，改 A user prompt | A ✱ 深红，B/C ✱ 浅红 |
| 2 | hover A ✱ → 点「加入 target 重跑」→ 跑完 | A ✱ 消，output 不变；B/C ✱ 仍浅红 |
| 3 | LLM key 改坏，跑某节点 | 尾栏「上次失败 · —」红斜体；刷新页面仍持续 |
| 4 | 修 LLM key，hover error tooltip 点重跑 | error 消，节点 completed |
| 5 | A→{B,C}（独立分支），让 B 抛错 | C 仍并行跑完，dag-done toast「成功 2，失败 1」 |
| 6 | A→B，A 抛错 | B 不跑（stuck），仍保持 target+pending 视觉，dag-done toast「成功 0，失败 1，未跑 1」 |

- [ ] **Step 2: 把核心 trap 沉淀进 AGENTS.md**

在 `AGENTS.md` 的 "项目内已知陷阱" 末尾加：

```markdown
### stale-tracker 必须在 block CRUD / removeNode **之后**调

`packages/apps/gui/src/app/api/workspaces/[id]/blocks/route.ts` 和
`.../nodes/route.ts` 的 DELETE handler 必须：先调 engine 旧函数
（insertBlock/removeNode 等），再调 stale-tracker 的
markBlockEdited / markRemovedNodeDownstream。**调前抓 downstream
snapshot** —— removeNode 会清掉 ws.downstream Map，调完再读会拿到空数组。

### dataflow-runner 的 inDeg 只数 todo 内的边

`packages/engine/src/workspace/core/dataflow-runner.ts` 的 inDeg 初始化
仅统计 todo 集内的 upstream。todo 外的节点 output 已是 cache 命中，
视为已 done —— 否则 inDeg 永远 > 0，全部节点卡在 pending。

### error 节点失败时 *不* push target_nodes

dataflow-runner 的 fireNode catch 分支只做 `failed.add` + appendError，
**不动** ws.target_nodes。该节点如果本来在 target_nodes 里就留着；
不在的话（它是 target 祖先才进的 todo）也不主动加 —— 下次 runAll 凭
"没 output 且是 target 或 target 祖先" 自然重试。
```

- [ ] **Step 3: 更新 AGENTS.md 顶部「迭代历史」表**

在表第一行（最新优先）插：

```markdown
| 2026-05-24 | **F 期**：stale 闭环（eager 扩散 + direct/propagated 双色 ✱）+ error 闭环（errors.log NDJSON + 节点尾栏文字 + tooltip）+ runAll 图原生并行（Kahn 运行时变体 + 不限并发 + error 不传染） | [spec](docs/superpowers/specs/2026-05-24-stale-error-parallel-design.md) | [plan](docs/superpowers/plans/2026-05-24-stale-error-parallel.md) |
```

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): 沉淀 F 期陷阱与不变性

- stale-tracker 必须在 block CRUD / removeNode 之后调，且 removeNode
  调前抓 downstream snapshot
- dataflow-runner inDeg 只数 todo 内的边
- error 失败时不 push target_nodes

迭代历史加入 F 期。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完工后检查

- [ ] 跑所有 engine 测试一遍：`bun test packages/engine/src/workspace/core/`（期望 21 PASS）
- [ ] 跑两个 typecheck：`bun run typecheck && bun run typecheck:gui`（期望全通过）
- [ ] 启 dev server：`bun run dev`，过一遍 Task 18 的 6 个场景
- [ ] git log 检查：约 18 次 commits 形成清晰提交链
- [ ] 提交 PR（如需要）

完成本期目标：

✓ stale 闭环（eager 扩散 + 双色视觉 + tooltip 重跑入口）
✓ error 闭环（errors.log 持久化 + 视觉 + tooltip）
✓ runAll 图原生并行（Kahn 运行时变体 + 不限并发 + error 不传染）

下期议题（移出 target / 草稿态 / 键盘整层 / 复制粘贴 / undo / errors.log timeline）的接入点已在本期落地，开干即可。
