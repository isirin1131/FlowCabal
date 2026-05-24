# Stale 闭环 + Error 闭环 + 图原生并行执行 设计稿

> 上一期 BCDE 把节点 4 态视觉、双尺度 stream、连线只读化、EditorPanel ref picker、RunButton dag 进度做完。本期补齐 BCDE 留下的三块——stale 闭环、error 闭环、`runAll` 节点并行执行。同时砍掉旧 `lazytag`（懒标 + 不驱动重跑）设计，换成 eager 扩散 + 视觉提示。整体保持 A 期定下的 paper / clay / ink 排印语言。

## 目标

让任何节点 / block 增删改后，受影响的节点立刻视觉提示用户「需要决策」；让运行错误持久成日志且节点级可见；让多节点的并行支路真正并行跑、单分支错误不污染其他支路。

## 本期范围

### 包含

- **stale-tracker 模块**：新建 `engine/workspace/core/stale-tracker.ts`，eager 扩散（block CRUD / removeNode 立即标自身 + transitive downstream），direct / propagated 两类分级
- **stale 视觉双色**：节点右上角 ✱ 角标，direct = 深红 clay-deep，propagated = clay-deep @ 45% alpha
- **stale 重跑入口**：✱ tooltip 含「加入 target 重跑」按钮，复用 BCDE 的 `addToTarget` action，**output 保留**
- **Workspace schema 升级**：`stale_nodes: string[] → StaleEntry[]`（带 kind 字段），无向下兼容
- **error-log 模块**：新建 `engine/workspace/core/error-log.ts`，NDJSON append-only，path per workspace
- **error 视觉**：节点尾栏文字斜体 clay-deep 「上次失败 · N 字」，**不动边框**；tooltip 含 message 摘要 + 「加入 target 重跑」
- **runtimeErrors store map**：GUI store 加 `runtimeErrors: Map<nodeId, ErrorEntry>`，loadWorkspace 时 fetch 派生，stream 期间增量更新
- **dataflow-runner 模块**：新建 `engine/workspace/core/dataflow-runner.ts`，Kahn 运行时变体调度，**不限并发**，error 不传染旁支
- **DataflowEvent 协议升级**：旧 `NodeEvent` 字段升级，`dag-done` 改为 `{ done, failed, stuck }` 三集合
- **API route `GET /api/workspaces/:id/errors`**：拉取 errors.log 解析后的 per-node last entry
- **API route `POST /api/workspaces/:id/blocks`** 和 **`DELETE /api/workspaces/nodes`** 接入 stale-tracker

### 不含（推下期）

- 移出 target 入口 + 草稿态（无 output + 无 target 的第 5 态）
- 键盘整层（方向键 / Tab / Enter / Esc / cmd+R / Backspace 同步）
- 复制粘贴节点 / undo / redo / 运行中编辑锁
- errors.log timeline 视图（GUI 仅显示 per-node last，无完整历史 UI）
- LLM rate-limit 自动退避 / 重试机制

## 砍掉的旧设计

`ws.stale_nodes: string[]` 之前的 lazytag 模式有三个问题：

1. **触发不全**：仅 `block CRUD` 在「该节点已有 output」时标自己；`add/rename node`、改 LLM config、本节点无 output 时改 prompt 全部不标
2. **扩散是 lazy 的**：靠 `calcStale(ws)` 在 `runSingle/runAll/runAllStream/runPreview/workspaceStatus` 入口才扩散到 downstream —— 改完 block 那一刻 GUI 看不到 downstream 变红，要跑一次才知道
3. **不驱动重跑**：`todoList(ws)` 完全无视 stale_nodes，只看「upstream outputs 有没有」—— stale 的 completed 节点不会自动进 todo，必须用户显式右键加 target

本期方案：
- 取消 lazy 模式，CRUD 完成**立即**扩散到 transitive downstream
- `stale_nodes` 是 single source of truth，eager 写入后无需再算
- stale 仍然**不驱动重跑**（todoList 行为不变），只是视觉提示 + 提供重跑入口
- 旧 `calcStale(ws)` 函数保留但**新代码不调用**（CLI 旧 `run.ts` 仍调，行为不变）

## 架构总览

```
packages/engine/src/workspace/core/
  graph.ts            ← 不动（fullTopoQueue / todoList / calcStale 保留供 CLI / 旧 runner）
  node.ts             ← 1 行类型升级（旧 push 'stale_nodes' string → StaleEntry）
  runner.ts           ← 不动（runAll / runSingle / runAllStream / runNode 保留供 CLI）
  index.ts            ← 追加 export 新模块

  stale-tracker.ts    ← 新：eager 扩散 + direct/propagated 分类
  dataflow-runner.ts  ← 新：Kahn 运行时变体 + DataflowEvent
  error-log.ts        ← 新：NDJSON append/read
```

**约束兑现**：

- engine 旧函数签名与功能行为完全保留 ✓
- CLI 不需任何改动（`cli/run.ts` / `cli/node.ts` 继续 import 旧函数）✓
- `cli/workspace.ts` 的 `workspaceStatus` 输出格式有 5 行格式化改动（适配新 schema）

## stale-tracker 模块

### 数据模型

`packages/engine/src/types.ts` 改：

```typescript
export type StaleEntry = { id: string; kind: 'direct' | 'propagated' };

export interface Workspace {
  // ... 其余不变
  stale_nodes: StaleEntry[];   // string[] → StaleEntry[]
}
```

`packages/engine/src/schema.ts` 改：

```typescript
export const StaleEntrySchema = z.object({
  id: z.string(),
  kind: z.enum(['direct', 'propagated']),
});

export const WorkspaceSchema = z.object({
  // ... 其余不变
  stale_nodes: z.array(StaleEntrySchema),
});
```

`packages/apps/gui/src/lib/serialization.ts` 的 `recordToWorkspace` / `workspaceToRecord` 跟着改 `stale_nodes` 字段处理。

### 模块导出

`packages/engine/src/workspace/core/stale-tracker.ts`：

```typescript
import { Workspace, StaleEntry } from '../../types';

export function getDirectStale(ws: Workspace): Set<string> {
  return new Set(ws.stale_nodes.filter(e => e.kind === 'direct').map(e => e.id));
}

export function getPropagatedStale(ws: Workspace): Set<string> {
  return new Set(ws.stale_nodes.filter(e => e.kind === 'propagated').map(e => e.id));
}

// block CRUD 触发：nodeId 自身 = direct；transitive downstream = propagated
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

// removeNode 触发：传入"被删节点的 downstream 快照"，全部 propagated
export function markRemovedNodeDownstream(ws: Workspace, downstreamSnapshot: string[]): void {
  const all = new Map<string, 'direct' | 'propagated'>();
  for (const e of ws.stale_nodes) all.set(e.id, e.kind);

  // BFS 把所有 transitive downstream 标 propagated
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

// run 成功后清自身（不连下游清）
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

### 升级 / 降级矩阵

| 当前态 | 新写入 | 结果 | 测试 case ID |
|---|---|---|---|
| ∅ | direct | direct | T1 |
| ∅ | propagated | propagated | T2 |
| direct | direct | direct | T3 |
| direct | propagated | direct（不降级，已被用户直接编辑） | T4 |
| propagated | direct | direct（升级） | T5 |
| propagated | propagated | propagated | T6 |

### 触发面 + 调用点

| 触发动作 | 函数 | 调用位置 |
|---|---|---|
| block insert/update/remove | `markBlockEdited(ws, nodeId)` | GUI `POST /api/workspaces/:id/blocks` 内紧跟旧 `insertBlock/updateBlock/removeBlock` 调用 |
| removeNode | `markRemovedNodeDownstream(ws, snapshot)` | GUI `DELETE /api/workspaces/nodes` 内，**先 `const snapshot = [...(ws.downstream.get(nodeId) || [])]` 抓快照**，再 `removeNode`，再调 tracker |
| run 成功 | `clearOnRun(ws, nodeId)` | dataflow-runner 内 fireNode 成功分支 |

### 旧 `node.ts` 1 行升级

`packages/engine/src/workspace/core/node.ts` 三处保留旧 push 行为，但因字段类型变了，把：

```typescript
if (ws.outputs.has(nodeId) && !ws.stale_nodes.includes(nodeId)) ws.stale_nodes.push(nodeId);
```

改成：

```typescript
if (ws.outputs.has(nodeId) && !ws.stale_nodes.some(e => e.id === nodeId)) {
  ws.stale_nodes.push({ id: nodeId, kind: 'direct' });
}
```

`removeNode` 内同理：

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

旧函数语义"插入后标 stale"完全保留；这是必要的类型升级，CLI 用旧路径仍能拿到 direct/propagated 视觉（虽然 propagation 范围仅 downstream 一跳，不到 transitive —— CLI 想要完整闭环就在 cli 命令里调 stale-tracker，本期不强制）。

## error-log 模块

### 文件路径

`<rootDir>/.flowcabal/cache/<workspaceId>/errors.log`

跟 workspace 目录同级，`workspaceDelete` 已用 `rmSync(wsDir, { recursive: true })` 清整个目录，errors.log 一起清。

### 数据格式

每行一个 NDJSON：

```json
{"ts":"2026-05-24T13:42:11.882Z","nodeId":"abc123","message":"AbortError: ..."}
```

### 模块导出

`packages/engine/src/workspace/core/error-log.ts`：

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
  const path = join(getWorkspaceDir(rootDir, wsId), 'errors.log');
  try {
    appendFileSync(path, JSON.stringify({ ts: new Date().toISOString(), nodeId, message }) + '\n', { flag: 'a' });
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
    try { result.push(JSON.parse(line) as ErrorEntry); } catch { /* skip 坏行 */ }
  }
  return result;
}

export async function readLastErrorPerNode(rootDir: string, wsId: string): Promise<Map<string, ErrorEntry>> {
  const all = await readAllErrors(rootDir, wsId);
  const map = new Map<string, ErrorEntry>();
  for (const e of all) map.set(e.nodeId, e); // 后覆盖前 → last
  return map;
}
```

### 写入时机

dataflow-runner 的 fireNode catch 路径里**先 emit `node-error` event** 给 stream，**再** `appendError`（catch 一层保护，写盘失败仅 console.warn），再加入 failed set。失败的 fs 不阻塞调度。

### 已知限制

- **不做 rotate**：单工作区累计错误数有限，预期最大也几 KB。不引入大小限制 / 滚动机制
- **并发写**：单 dag 跑只有一个调度器在 append，无并发。多 GUI tab 同时跑同一 workspace 会 race —— 本期忽略
- **errors.log 不随节点删除清理**：是不可变历史。下次同 nodeId 重建（理论不会，id 是 newId 生成）也读不到老条目

## dataflow-runner 模块

### 事件协议

`packages/engine/src/workspace/core/dataflow-runner.ts`：

```typescript
export type DataflowEvent =
  | { type: 'dag-start'; total: number; nodeIds: string[] }
  | { type: 'node-start'; nodeId: string }
  | { type: 'node-token'; nodeId: string; chunk: string }
  | { type: 'node-complete'; nodeId: string; output: string }
  | { type: 'node-error'; nodeId: string; message: string }
  | { type: 'dag-done'; done: string[]; failed: string[]; stuck: string[] };
```

差异点（vs 旧 `NodeEvent`）：
- `dag-done.executed: string[]` → `dag-done.done/failed/stuck: string[]`
- `node-error` 不再 throw 中断；scheduler 继续跑无关支路

旧 `NodeEvent` 类型保留作为 deprecated alias 不删，但 GUI 改用 `DataflowEvent`。

### 调度算法（Kahn 运行时变体）

```typescript
import { Workspace, LlmConfig } from '../../types';
import { createStream } from '../../llm/generate.js';
import { todoList } from './graph.js';
import { getNode } from './node.js';
import { clearOnRun } from './stale-tracker.js';
import { appendError } from './error-log.js';

async function resolvePrompt(ws: Workspace, blocks, rootDir, config): Promise<string> {
  // 与 runner.ts 现有 resolvePrompt 同语义；本模块独立 import / 复制即可，不耦合旧 runner
  // ...（与现有实现相同）
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

  const inDeg = new Map<string, number>();
  for (const id of todo) {
    const ups = ws.upstream.get(id) || [];
    inDeg.set(id, ups.filter(u => todo.has(u)).length);
  }

  yield { type: 'dag-start', total: todo.size, nodeIds: [...todo] };

  const done = new Set<string>();
  const failed = new Set<string>();
  const running = new Map<string, Promise<{ id: string; events: DataflowEvent[] }>>();

  // events buffer channel
  const eventQueue: DataflowEvent[] = [];
  let signalResolve: (() => void) | null = null;
  const waitForEvent = () => new Promise<void>((r) => { signalResolve = r; });
  const push = (e: DataflowEvent) => {
    eventQueue.push(e);
    if (signalResolve) { signalResolve(); signalResolve = null; }
  };

  const fireNode = async (nodeId: string): Promise<void> => {
    push({ type: 'node-start', nodeId });
    const node = getNode(ws, nodeId);
    if (!node) {
      failed.add(nodeId);
      push({ type: 'node-error', nodeId, message: 'node not found' });
      return;
    }
    try {
      const system = await resolvePrompt(ws, node.systemPrompt, rootDir, config);
      const user = await resolvePrompt(ws, node.userPrompt, rootDir, config);
      let accumulated = '';
      const stream = createStream(config, system, user, abortSignal);
      for await (const chunk of stream.textStream) {
        accumulated += chunk;
        push({ type: 'node-token', nodeId, chunk });
      }
      ws.outputs.set(nodeId, accumulated);
      ws.target_nodes = ws.target_nodes.filter(t => t !== nodeId);  // 唯一移除点
      clearOnRun(ws, nodeId);                                        // 清自身 stale
      done.add(nodeId);
      push({ type: 'node-complete', nodeId, output: accumulated });
      // 触发 downstream inDeg--
      for (const ds of ws.downstream.get(nodeId) || []) {
        if (todo.has(ds) && inDeg.has(ds)) inDeg.set(ds, inDeg.get(ds)! - 1);
      }
    } catch (err) {
      const message = (err as Error).message;
      push({ type: 'node-error', nodeId, message });
      try { appendError(rootDir, ws.id, nodeId, message); } catch {}
      failed.add(nodeId);
      // 不动 ws.target_nodes —— 节点保留在 target 里（如果它本来就在）
      // 不动 downstream inDeg —— ds 永远不 ready，自然 stuck
    }
  };

  const launchReady = () => {
    for (const id of todo) {
      if (running.has(id) || done.has(id) || failed.has(id)) continue;
      if (inDeg.get(id) === 0) {
        running.set(id, fireNode(id).then(() => ({ id, events: [] })));
      }
    }
  };

  // 主循环（以下为算法伪代码 —— 具体 mpsc channel + Promise.race 收集已 settled
  // fireNode 的实现 plan 阶段细化，可选包 async-mutex / Channel lib）
  launchReady();
  while (running.size > 0 || eventQueue.length > 0) {
    while (eventQueue.length > 0) yield eventQueue.shift()!;
    if (running.size === 0) break;

    // 等待任意一个 settle 或新 event 推入
    await Promise.race([
      ...running.values(),     // fireNode 完成
      waitForEvent(),          // event push 唤醒
    ]);

    // 把所有已 settled 的 fireNode 从 running 移除
    // （真实实现：用 wrapper Promise 在 fireNode 完成时调 running.delete + 触发 launchReady）

    launchReady();
  }

  while (eventQueue.length > 0) yield eventQueue.shift()!;

  const stuck = [...todo].filter(id => !done.has(id) && !failed.has(id));
  yield { type: 'dag-done', done: [...done], failed: [...failed], stuck };
}
```

**实现注意**：
1. 上面的 events channel 是简化版，真实实现要避免 `Promise.race` 上重复 await 的 leak —— 用一个 mpsc-like helper class（plan 阶段细化），但语义如上
2. `resolvePrompt` 在 `runner.ts` 是私有函数。dataflow-runner 复制一份独立的（不 export），避免依赖旧 runner 模块。复制粘贴 ~25 行 OK，不引入循环依赖
3. `runAllDataflow` 完成时所有 outputs 已落入 ws.outputs；route handler 在 stream 结束 finally 里 `writeWorkspace` 一次

### `inDeg` 的"只数 todo 内的边"简化

如果 todo = {A, B, C} 且 A 的 upstream = [X, Y]，其中 X 在 todo 内（X→A），Y 不在 todo 内（Y 已有 output）—— 此时 `inDeg[A] = 1`（只数 X）。

理由：todo 外的节点的 output 已是 cache 命中，视为"已 done"。这避免 inDeg 永远 > 0 卡死。

## GUI 视觉规范

### 节点 ✱ 角标（FlowNode）

继承 BCDE 期 4 态视觉。新增叠加：

```
┌─────────────────────────┐
│  II             ✱       │  ← 右上角，clay-deep（direct）或 alpha 45%（propagated）
│  第一章                 │
│                         │
│  系统 1 段 · 引自 I     │
│  用户 1 段              │
│  ─────────────────────  │
│  ● 上次失败  1,240 字   │  ← 尾栏文字斜体 clay-deep（error）
└─────────────────────────┘
```

- **✱ 字符**：`*`，`font-display italic 14px`
- **direct**：`color: var(--color-clay-deep)`（#B65C45）
- **propagated**：`color: rgba(182, 92, 69, 0.45)`
- **同节点 direct + propagated**：取 direct（升级规则已在 stale-tracker 处理，store 拿到的 entry 就是 direct）
- **位置**：节点内 absolute top-2 right-3，`pointer-events: auto`（hover 触发 tooltip）

### error 尾栏文字

不动节点边框。尾栏文字按状态分三层：

| 状态 | 文字 | color |
|---|---|---|
| target+pending / target+completed / completed | 「待运行」/「待重跑 · N 字」/「completed · N 字」（BCDE 已定） | clay 红 / clay 红 / ink + ink-faint |
| error（不论 target / hasOutput） | 「上次失败 · N 字」（N 字若无 output 显示 `—`） | `font-display italic var(--color-clay-deep)` |
| running（叠加） | 「正在生成…」（BCDE 已定） | clay 红 |

error 状态优先级在 base 4 态之上，尾栏文字直接被 error 文字替换。✱ 角标跟 error 文字可共存（节点既错过又被编辑过）。

### Tooltip 内容

用 Radix `<Tooltip>` portal 实现。

**✱ direct tooltip**：

```
本节点已编辑，上次输出可能不是最新
─────────────────────────────
[ 加入 target 重跑 ]
```

**✱ propagated tooltip**（含 upstream Roman list）：

```
上游 I, III 已变更，本节点输出可能不是最新
─────────────────────────────
[ 加入 target 重跑 ]
```

upstream Roman list 通过 store selector 算：取所有 transitive upstream ∩ stale_nodes（direct），转 Roman。最多展示 3 个，超出用 「…」。

**error tooltip**（hover 尾栏 error 文字）：

```
上次运行失败
─────────────────────────────
AbortError: signal aborted before response (前 200 字符)
─────────────────────────────
[ 加入 target 重跑 ]
```

### Tooltip 内按钮行为

「加入 target 重跑」按钮：

- 调 `store.addToTarget(nodeId)`（BCDE 已实现，直接复用）
- output 保留（**不清**）
- stale entry 保留（**不清** —— 等节点跑成功才被 clearOnRun 清）
- 节点视觉变 target+completed+stale（或 target+completed+error）

按钮 click 时 tooltip 自动关：用 Radix `<Tooltip.Root onOpenChange>` + 按钮 onClick 内手动 set open=false。

### RunButton todoListCount 不变

仍是 `todoList(ws).length`。**stale 节点不计入 N**（除非已在 target_nodes，那是 BCDE 行为）。

### 右键菜单不变

BCDE 期定的三项（重命名 / 删除 / 加入 target）保留。stale / error 操作都靠节点上的 ✱ tooltip 触发，不在右键加新项。

## GUI store 扩展

### 新 state

```typescript
runtimeErrors: Map<string, ErrorEntry>   // 加载 + stream 维护
```

`useStore` 初始 state 加 `runtimeErrors: new Map()`。

### loadWorkspace 时 fetch errors

```typescript
internal_loadWorkspace = async (workspaceId: string) => {
  // ... existing
  const ws = recordToWorkspace(data.workspace);
  // ... existing logic that updates workspaces array and switches

  // 追加：fetch errors.log 的 per-node last
  try {
    const errRes = await fetch(`/api/workspaces/${workspaceId}/errors?per-node=last`);
    if (errRes.ok) {
      const errMap: Record<string, ErrorEntry> = await errRes.json();
      this.#set({ runtimeErrors: new Map(Object.entries(errMap)) });
    }
  } catch {
    // 错误日志读失败不阻塞 workspace 加载
  }
};
```

### stream 事件处理升级

`#handleNodeEvent` 改接 `DataflowEvent`：

```typescript
#handleNodeEvent = (event: DataflowEvent) => {
  switch (event.type) {
    case 'dag-start':
      this.#set({ dagProgress: { current: 0, total: event.total } });
      break;
    case 'node-start':
      this.#set({ runningNodeId: event.nodeId });
      this.#setNodeStatus(event.nodeId, 'running');
      break;
    case 'node-token':
      this.#set((s) => {
        const map = new Map(s.runningOutput);
        map.set(event.nodeId, (map.get(event.nodeId) ?? '') + event.chunk);
        return { runningOutput: map };
      });
      break;
    case 'node-complete':
      this.#set((s) => {
        const map = new Map(s.runningOutput);
        map.delete(event.nodeId);
        const dp = s.dagProgress;
        const errMap = new Map(s.runtimeErrors);
        errMap.delete(event.nodeId);                    // 清掉历史 error
        return {
          runningOutput: map,
          runtimeErrors: errMap,
          dagProgress: dp ? { ...dp, current: dp.current + 1 } : null,
        };
      });
      this.#applyNodeComplete(event.nodeId, event.output);
      break;
    case 'node-error':
      this.#set((s) => {
        const errMap = new Map(s.runtimeErrors);
        errMap.set(event.nodeId, {
          ts: new Date().toISOString(),
          nodeId: event.nodeId,
          message: event.message,
        });
        return { runtimeErrors: errMap };
      });
      break;
    case 'dag-done':
      this.#set({ runningNodeId: null });
      if (event.failed.length > 0 || event.stuck.length > 0) {
        toast.warning(
          `跑完：成功 ${event.done.length}，失败 ${event.failed.length}` +
          (event.stuck.length > 0 ? `，未跑 ${event.stuck.length}` : ''),
        );
      } else if (event.done.length > 0) {
        toast.success(`跑完 ${event.done.length} 个节点`);
      }
      break;
  }
};
```

### 派生 selector

新增 selector：

```typescript
// store 暴露 helper 供组件用
export function getStaleKindForNode(ws: Workspace | null, nodeId: string): 'direct' | 'propagated' | null {
  if (!ws) return null;
  const entry = ws.stale_nodes.find(e => e.id === nodeId);
  return entry?.kind ?? null;
}

// 算 propagated 节点该 tooltip 里显示的 upstream Roman list
export function propagatedUpstreamRomans(ws: Workspace | null, nodeId: string): string[] {
  if (!ws) return [];
  const directIds = new Set(ws.stale_nodes.filter(e => e.kind === 'direct').map(e => e.id));
  const result: string[] = [];
  const visited = new Set<string>();
  const queue = [...(ws.upstream.get(nodeId) || [])];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    if (directIds.has(id)) {
      const idx = ws.nodes.findIndex(n => n.id === id);
      if (idx >= 0) result.push(toRoman(idx + 1));
    }
    for (const u of ws.upstream.get(id) || []) queue.push(u);
  }
  return result;
}
```

### 不灌进 node.data

FlowNode 通过 store subscribe `activeWorkspace` + 调 `getStaleKindForNode(ws, props.id)` 派生视觉，**不要**在 `syncNodeDataFromWorkspace` 里灌 staleKind 进 `node.data`。两套 source-of-truth 容易脱节。

## API routes 变更清单

| route | method | 改动 |
|---|---|---|
| `/api/engine/run-all` | POST | 改调 `runAllDataflow(ws, config, projectDir)` 替换 `runAllStream`；事件协议升级；finally 内 `writeWorkspace` 不变 |
| `/api/workspaces/:id/errors` | GET | **新建**：query `?per-node=last` 返回 `Record<nodeId, ErrorEntry>`；无 query 返回 `ErrorEntry[]` 全量 |
| `/api/workspaces/:id/blocks` | POST | 现有 `insertBlock/updateBlock/removeBlock` 调用后**接着**调 `stale-tracker.markBlockEdited(ws, nodeId)`，再 `writeWorkspace` |
| `/api/workspaces/nodes` | DELETE | **先抓** `const downstreamSnapshot = [...(ws.downstream.get(nodeId) || [])]`，再 `removeNode`，再调 `stale-tracker.markRemovedNodeDownstream(ws, downstreamSnapshot)` |
| `/api/workspaces/:id/target` | POST | 不动（BCDE 已实现） |
| `/api/workspaces/nodes` | POST/PUT | 不动 stale（addNode / rename 不算 direct） |

新建 `packages/apps/gui/src/app/api/workspaces/[id]/errors/route.ts`：

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

## 数据流图

### block CRUD 触发 stale eager 扩散

```
GUI editor 改 prompt
  → store.updateBlock(...)
  → POST /api/workspaces/:id/blocks { action: 'update', ... }
  → route handler:
     - engine updateBlock(ws, ...)       [ 旧函数 1 行已升级写 {id, kind:'direct'} ]
     - stale-tracker.markBlockEdited(ws, nodeId)   [ direct + transitive propagated ]
     - writeWorkspace(projectDir, wsId, ws)
     - return { workspace: workspaceToRecord(ws) }
  → store.#updateNodeDataFromWorkspace(updatedWs)
  → FlowNode 通过 store selector 看到 stale_nodes → ✱ 立刻渲染
```

### removeNode 触发

```
GUI 右键删除
  → store.deleteNode(nodeId)
  → DELETE /api/workspaces/nodes { workspaceId, nodeId }
  → route handler:
     - const downstreamSnapshot = [...(ws.downstream.get(nodeId) || [])]
     - engine removeNode(ws, nodeId)
     - stale-tracker.markRemovedNodeDownstream(ws, downstreamSnapshot)
     - writeWorkspace
  → GUI 更新，被删节点的 downstream 全部 ✱ 浅红
```

### 并行 runAll

```
GUI RunButton click → store.runAll()
  → POST /api/engine/run-all (NDJSON stream)
  → route handler:
     for await (event of runAllDataflow(ws, config, projectDir)):
       stream.enqueue(JSON.stringify(event) + '\n')
     writeWorkspace
     stream.close
  → engine runAllDataflow:
     yield dag-start { total: 5, nodeIds: [I, II, III, IV, V] }
     // 假设 dag：I → II, I → III, II → IV, III → IV, IV → V
     // inDeg: I=0, II=1, III=1, IV=2, V=1
     launchReady → fire I
     yield node-start I
     yield node-token I, chunk * N
     yield node-complete I
     // I done, II.inDeg=0, III.inDeg=0
     launchReady → fire II + III 并发
     // 假设 II 抛 error，III 成功
     yield node-start II
     yield node-start III
     yield node-token III * N
     yield node-error II (II 写 errors.log)
     yield node-complete III
     // II failed, III done; IV.inDeg 仍 = 1（因为 II 没 done）→ 永远不 ready
     // V 等 IV done → IV 永远不 done → V 也不 ready
     // running 空，loop 退出
     yield dag-done { done: [I, III], failed: [II], stuck: [IV, V] }
  → GUI store.#handleNodeEvent:
     toast.warning('跑完：成功 2，失败 1，未跑 2')
     II 节点显示「上次失败」文字
     IV / V 仍是 target+pending（没出 stuck 专门视觉）
```

## 文件级影响清单

**新增**：

- `packages/engine/src/workspace/core/stale-tracker.ts`
- `packages/engine/src/workspace/core/dataflow-runner.ts`
- `packages/engine/src/workspace/core/error-log.ts`
- `packages/engine/src/workspace/core/stale-tracker.test.ts`
- `packages/engine/src/workspace/core/dataflow-runner.test.ts`
- `packages/engine/src/workspace/core/error-log.test.ts`
- `packages/apps/gui/src/app/api/workspaces/[id]/errors/route.ts`

**修改**：

- `packages/engine/src/types.ts` — `stale_nodes: string[] → StaleEntry[]`；export `StaleEntry`
- `packages/engine/src/schema.ts` — `StaleEntrySchema` + `WorkspaceSchema.stale_nodes` 升级
- `packages/engine/src/workspace/core/node.ts` — 三处 stale push 行 1 行类型升级，旧函数语义保留
- `packages/engine/src/workspace/core/index.ts` — `export * from './stale-tracker.js'` + `error-log` + `dataflow-runner`
- `packages/engine/src/index.ts` — re-export `StaleEntry`、`ErrorEntry`、`DataflowEvent`、`runAllDataflow`、stale-tracker 函数、error-log 函数
- `packages/apps/gui/src/lib/serialization.ts` — `stale_nodes` 字段处理升级
- `packages/apps/gui/src/app/api/engine/run-all/route.ts` — import `runAllDataflow` 替换 `runAllStream`
- `packages/apps/gui/src/app/api/workspaces/[id]/blocks/route.ts` — 调用后接 `markBlockEdited`
- `packages/apps/gui/src/app/api/workspaces/nodes/route.ts` — DELETE 分支抓 snapshot + 调 `markRemovedNodeDownstream`
- `packages/apps/gui/src/store/useStore.ts` — 加 `runtimeErrors` state、`#handleNodeEvent` 升级、`internal_loadWorkspace` 追加 fetch errors、加 selector helper
- `packages/apps/gui/src/components/FlowNode.tsx` — ✱ 角标 + error 尾栏文字 + Radix Tooltip + 「加入 target 重跑」按钮 click handler
- `packages/cli/src/commands/workspace.ts` — `workspaceStatus` 输出 stale_nodes 适配新 schema。示例：

  ```
  # 节奏
  Workspace ID: w_abc
    Nodes: 5
    Targets: n_03
    Stale:
      n_01 (direct)
      n_02 (propagated)
    Outputs: 3
  ```

  从原来一行 `Stale: id1, id2` 改成多行，每个 id 后括号标 kind。

**不动（兼容）**：

- `packages/engine/src/workspace/core/runner.ts` — `runAll`、`runSingle`、`runAllStream`、`runNode` 完全保留供 CLI
- `packages/engine/src/workspace/core/graph.ts` — `fullTopoQueue`、`todoList`、`calcStale` 完全保留
- `packages/cli/src/commands/run.ts` — 零改动
- `packages/cli/src/commands/node.ts` — 零改动
- BCDE 期定下的所有视觉规范 + 右键菜单 + EditorPanel ref picker + RunButton

## CLI 兼容矩阵

| CLI 操作 | stale 行为 | error 行为 | runAll 行为 |
|---|---|---|---|
| `fc node ins ref` 等 block CRUD | 节点自身 direct（旧 1 行升级生效）；downstream 不扩散 | 不变 | 不变 |
| `fc node rm` removeNode | downstream 一跳标 propagated（旧函数已有逻辑）；不传递扩散 | 不变 | 不变 |
| `fc run` | 跑前 `calcStale` 仍 lazy 扩散一次（旧 runAll 内调）—— 与 GUI 端 eager 扩散结果在 ws.stale_nodes 上**对齐** | 抛错中断（不写 errors.log，因为 CLI 不调 dataflow-runner） | 串行 fail-fast |

差异：CLI 端不享受**完整闭环**（GUI 那种 transitive propagation + errors.log 写入 + 并行）。这是预期的"分层"——CLI 是技术用户用的，他们可以 `fc workspace status` 看 stale_nodes，跑挂了看 stderr。要 CLI 也享受闭环就在 cli 命令里加调 stale-tracker / error-log / dataflow-runner，本期不强制。

## 测试策略

### engine 三模块单测

`packages/engine/src/workspace/core/stale-tracker.test.ts`：

- T1-T6：升级 / 降级矩阵 6 个 case，每个独立 ws fixture
- T7：`markBlockEdited` BFS 走 transitive downstream，cycle 防御（构造 A→B→A 看 visited set 是否兜住）
- T8：`markRemovedNodeDownstream` snapshot 模式：传入空 snapshot 不报错
- T9：`clearOnRun` 仅清自身，downstream propagated 保留

`packages/engine/src/workspace/core/dataflow-runner.test.ts`：

- T10：linear chain A→B→C 全成功 → done=3, failed=0, stuck=0
- T11：branch A→{B,C} 全成功 → 观察 B / C 同时出 node-start（events 时序）
- T12：中间 fail（A→{B,C} 两分支独立；B fail）→ done={A,C}, failed={B}, stuck={}
- T13：fail 阻塞下游 A→B→C，A fail → done={}, failed={A}, stuck={B,C}
- T14：多 target 共同祖先（X→Y→Z, X→W; target={Z,W}）→ X 只跑一次（events node-start X 出现一次）
- T15：abort signal 中途 → 收到 abort 时 running 节点 throw，剩余进 stuck，dag-done 正常 emit
- T16：dataflow-runner 跑完 ws.outputs 已 set、ws.target_nodes 已 filter（done 那些）、ws.stale_nodes 已清（done 那些）

`packages/engine/src/workspace/core/error-log.test.ts`：

- T17：appendError → readAllErrors 回读条目数 / 字段对应
- T18：readLastErrorPerNode 后覆盖前
- T19：坏行容错（手写 JSON 缺右括号那行）跳过不抛
- T20：appendError 写盘失败（mock fs throw）不抛

mock LLM：测试用一个 `mockGenerate` / `mockCreateStream`，按 nodeId hash 决定成功 / 失败，给确定 chunk 序列。

### GUI 手动 e2e 路径

1. **stale 双色基线**：新工作区，加 A→B→C。改 A 的 user prompt → A 立即 ✱ 深红，B + C ✱ 浅红
2. **重跑入口语义**：hover A ✱ → tooltip 「加入 target 重跑」点 → A 变 target+completed，output 保留。点 RunButton → A 跑成功 → A ✱ 消，B/C ✱ 仍浅红
3. **error 视觉 + 持久化**：把 LLM config 故意写错 baseURL，运行 → 节点变「上次失败 · —」文字。**刷新页面** → error 视觉持续（来自 errors.log）。修 LLM config，hover ✱ tooltip 点重跑 → 节点变 completed，error 消失
4. **并行 + 局部失败不阻塞**：构造 A→{B,C}（A 跑成功后 B/C 应并发），让 B 跑挂 → C 正常完成，dag-done toast「成功 2，失败 1」，B 显示 error 视觉，C 显示 completed
5. **stuck 节点不渲染额外视觉**：构造 A→B，让 A 跑挂 → A error，B 仍 target+pending（视觉不变，没专门 stuck UI）
6. **schema 升级冒烟**：现有 workspace.json（如果有的话）打开会因 stale_nodes 是 string[] 跟新 schema 不匹配——**预期失败**，需要重新建 workspace（user 已确认无向后兼容）。新建的 workspace 立刻能正常用

## 风险与已知边界

1. **stream channel 实现复杂度**：dataflow-runner 的 events queue + Promise.race 多 fireNode 协作需要小心写。plan 阶段细化 mpsc 实现。最坏情况包一个第三方 mpsc-async lib（如 `async-mutex` 配 `Channel`），本期评估后决定。

2. **`inDeg` 边权变化**：dataflow-runner 启动后 ws 结构不会变（运行中没 CRUD），所以 inDeg 在 init 后就稳定。如果运行中 user 改 prompt（"运行中编辑锁"下期议题），inDeg 会脱节——本期假设 user 不会运行时编辑，不防御。

3. **stale-tracker BFS cycle 防御**：理论上 dag 不该有 cycle，但 `markBlockEdited` 的 BFS 加 visited set 兜底。

4. **errors.log 并发写**：多 GUI tab 跑同一 workspace 时并发 append 可能导致行错乱。本期忽略，用户场景中没人这么用。

5. **abort 路径未接 GUI UI**：dataflow-runner 接受 abortSignal，但本期 RunButton 没"取消"按钮。signal 仅用于测试 / 未来 UI 入口。

6. **propagated tooltip 的 upstream Roman list 算法是 O(V+E)**：每次 hover 计算一次。dag 规模 < 50 节点完全可接受。如果性能成问题再 memoize。

7. **stale 视觉的 ✱ 字符渲染**：用 `*` 字符 + `font-display italic` —— 不同字体 fallback 时 ✱ 位置可能轻微飘。备选 Unicode `✱`（U+2731）更稳但可能没 italic glyph。**默认用 `*`**；A 期已加载的 Source Serif 必有此 glyph。

8. **runtimeErrors store map 跟 ws 切换不同步问题**：切换 workspace 时若 `runtimeErrors` 没清空会显示上一个 workspace 的 error。`internal_switchWorkspace` 内加 `this.#set({ runtimeErrors: new Map() })` 再 `internal_loadWorkspace` 内 fetch 一次。

## 与下期的衔接

下期议题（**移出 target / 草稿态 / 键盘整层 / 复制粘贴 / undo**）的接入点：

- **移出 target**：右键菜单加第四项「移出 target」+ 新 API `DELETE /api/workspaces/:id/target`。引入「草稿态」第 5 视觉态（无 output + 无 target）。
- **键盘整层**：xyflow `deleteKeyCode` 重启 + 接 `onNodesDelete` 同步 engine；新增方向键 / Tab / Enter / Esc / cmd+R / cmd+A 等 handler。本期 ✱ tooltip 的「加入 target 重跑」按钮加 `Cmd+R` shortcut hint，下期接通。
- **复制粘贴 + undo**：clipboard 序列化 NodeDef + downstream subgraph 复制；undo 加 ws snapshot stack。本期不留接入点。
- **errors.log timeline 视图**：完整历史 UI（hover 节点显示「失败过 N 次」+ 时间线）—— 已有 `readAllErrors` API 接口。下期加 GUI panel 即可。
- **CLI 端 stale 闭环 / 并行**：把 cli/commands/node.ts 改造调 stale-tracker；cli/commands/run.ts 改用 dataflow-runner —— 本期模块都已就位，CLI 想升级是几行的事。

每条都是 1-2 个文件的局部扩展，本期架构没任何阻碍。
