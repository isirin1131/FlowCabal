# GUI 节点交互与流式运行（B+C+D+E 期）设计稿

> 上一期 A 期统一了视觉调性。本期把节点状态可视化、运行流式可视化、交互层（鼠标 / 选中 / 多选）、EditorPanel 的 ref 创建做到位。整体保持上一期定下的 paper / clay / ink + Source Serif 排印语言。

## 目标

让节点状态（target / completed / running）一眼可读；让运行进度可见到节点 + token 两个尺度；让 ref 创建在 EditorPanel 内自洽；让画布连线退化为只读的依赖速览。

## 本期范围

### 包含

- **节点状态机 4 态**：target+pending / target+completed / completed / running（叠加）
- **连线只读化**：onConnect 移除、handle 圆点隐藏、edge 改 C3「短横笔触」端点装饰
- **节点选中态**：ink 黑 1.5px 外环 box-shadow；多选时 FloatingPanel 自动关闭
- **鼠标交互层**：单击 / shift+click / cmd+click / shift+drag 框选 / 右键三项菜单（重命名 / 删除 / 加入 target）
- **EditorPanel ref 创建**：「+ 添加段落」三选一菜单 + 「引用上游」picker（含局部键盘 + 防环过滤）
- **RunButton 重画**：纸张 button 风格 + idle/running 两态 + 多行 dag 进度
- **engine 新增 `runAllStream`**：异步生成器接口，旧 `runAll` / `runSingle` 完全不动（CLI 兼容）
- **双尺度 stream**：节点级（RunButton K/N 进度 + 节点 N1 光晕）+ token 级（OutputsPanel 字逐渐浮现）
- **API NDJSON 流式 response**：`/api/engine/run-all` 改返回 NDJSON 流；GUI 用 fetch + ReadableStream reader 解析
- **「加入 target」操作**：新 API + store action，把节点加入 `target_nodes`，**不动 output**

### 不含（推下期）

- **stale 视觉**：✱ 角标 / tooltip / 「加入 target 重跑」按钮 / calcStale 接通到 UI
- **error 视觉**：runtimeErrors / runAll catch on error / 节点红顶斜体 / 错误 tooltip
- **「移出 target」入口** 与 **草稿态**（无 output + 无 target 的第 5 态）
- **键盘整层**（方向键 / Tab / Enter / Esc / cmd+R / cmd+A / Backspace 同步）—— 仅保留 picker 内部的局部键盘
- **复制粘贴节点 / undo/redo / 运行中编辑锁**

## 节点状态机

四态正交两个维度：

| 维度 | 信号 |
|---|---|
| target_nodes 中？ | 顶部 1.5px clay 实线 + 尾栏 clay 红文字 + 红圆点 |
| 不在 target_nodes 中？ | 顶部 1px rule 灰 + 尾栏 ink-faint 文字 + ink 黑圆点 |

跟 output 状态交叉得 4 态 + 1 个动态叠加态：

| 状态 | target | output | 顶描边 | 尾栏文字 | 尾栏色 |
|---|---|---|---|---|---|
| target+pending | ✓ | 空 | 1.5px clay | 待运行 | clay 红 |
| target+completed | ✓ | 有 | 1.5px clay | 待重跑 · N 字 | clay 红 |
| completed | × | 有 | 1px rule 灰 | completed · N 字 | ink 黑 |
| running（叠加） | ✓ | 跑中 | 上述 + 四边 1.5px clay + 外环柔光 + 背景微提 | 正在生成… | clay 红 |

### 状态转移

- **新建节点** → target+pending（engine `addNode` 已自动 push target_nodes）
- **target+pending 跑成功** → completed（engine 已 filter target_nodes / stale_nodes）
- **completed 节点右键「加入 target」** → target+completed（加入 target_nodes，**output 保留**）
- **target+completed 跑成功** → completed（output 被覆盖）
- **任意 target 态进入 stream** → running 叠加 → 完成后回到对应 base 态

## 视觉规范

### 节点 (FlowNode)

继承 A 期定的尺寸 / 字体 / 颜色。新增视觉差异点：

```
┌─────────────────────────┐   ← 顶描边色承担「是否 target」
│  II                     │   ← Roman 28px clay-deep
│  第一章                 │   ← 标题 16px ink
│                         │
│  系统 1 段 · 引自 I    │   ← meta 11px ink-faint
│  用户 1 段              │
│  ─────────────────────  │   ← border-top: 1px / 1.5px (跟顶描边同色)
│  ● 待重跑     1,240 字  │   ← 尾栏色承担「是否 target」
└─────────────────────────┘
```

- **顶描边**：`border-top: 1.5px solid var(--color-clay-deep)` (target) / `border-top: 1px solid var(--color-rule)` (非 target)
- **尾栏 border-top** 同色（target 时也是 clay）
- **尾栏圆点** + 文字 color：
  - target 态：`#B65C45` (clay)
  - 非 target completed：圆点 `#3F392C` (ink) + 文字 `#9C8967` (ink-faint)
- **字数**：tabular-nums，无 output 显示 `—`

### Running 叠加层 (N1 光晕)

底层保留对应的 target / completed 顶描边色，叠加：

```css
.running {
  border-color: var(--color-clay-deep);      /* 四边升级到 clay */
  border-width: 1.5px;
  border-top-width: 2.5px;
  background: var(--color-paper-light);      /* #FAF3DD，比 paper-deep 亮 */
  box-shadow:
    0 0 0 4px rgba(182, 92, 69, 0.12),
    0 0 18px rgba(182, 92, 69, 0.25);
}
```

视觉：「这一格被聚光灯打亮」。无 CSS animation（前几版动画在浏览器渲染不稳，决定纯静态光晕传达 active 状态）。

### Edge (C3 · 短横笔触)

xyflow custom edge 类型，新建 `CustomEdge.tsx` component。结构：

```svg
<!-- 上游端：clay-deep 短横 -->
<line x1={sourceX - 8} y1={sourceY + 3} x2={sourceX + 8} y2={sourceY + 3}
      stroke="#8A4732" stroke-width="2" />

<!-- 主体线：rule 灰直线，target 端缩 8px -->
<line x1={sourceX} y1={sourceY + 5} x2={targetX} y2={targetY - 8}
      stroke="#C9BFAA" stroke-width="1" />
```

- **不分类型**：同一上游被 system + user 都引用画一条线即可
- **不分方向感动画 / 渐变**：纯静态几何（前几版渐变 SVG defs 在 frame template 中不渲染，最终决定纯几何 elements）

### Handle 视觉隐藏

xyflow `<Handle>` 节点仍存在以保持 edge 路径计算，但视觉完全隐藏：

```tsx
<Handle type="target" position={Position.Top} id="t"
  className="!opacity-0 !pointer-events-none" />
<Handle type="source" position={Position.Bottom} id="s"
  className="!opacity-0 !pointer-events-none" />
```

合并 system / user 两个 target handle 为单一 dummy handle —— 因为 onConnect 已经移除，handle id 不再有语义。

### 选中态

```css
.selected {
  box-shadow: 0 0 0 1.5px var(--color-ink);   /* #3F392C 黑外环 */
}
```

跟 4 态全部正交叠加。running 节点选中时光晕 + ink 外环共存：

```css
.running.selected {
  box-shadow:
    0 0 0 1.5px var(--color-ink),
    0 0 0 4px rgba(182, 92, 69, 0.12),
    0 0 18px rgba(182, 92, 69, 0.25);
}
```

### RunButton（风格 A · 纸张 button）

位置：`fixed bottom-6 right-6`（不变）。

**idle 态**（单行紧凑）：

```
┌─────────────────────────────┐
│  Run  ·  5 节点待跑          │
└─────────────────────────────┘
```

- `bg-white`
- `border: 1px solid #D9D0B8`
- `border-radius: 6px`
- `padding: 14px 28px`
- `box-shadow: 0 2px 8px rgba(0,0,0,0.04)`
- 「Run」`font-display italic text-[16px] text-clay-deep`
- 「·」`text-rule`
- 「5 节点待跑」`font-body text-[11px] text-ink-faint`

**running 态**（多行展开）：

```
┌─────────────────────────────┐
│ 正在生成           2 / 5    │
│ II  第一章 · 出场           │
│ ████████░░░░░░░░░░░░░       │
└─────────────────────────────┘
```

- 第一行 left：`font-display italic text-[14px] text-clay-deep`「正在生成」
- 第一行 right：`font-mono text-[11px] text-ink-faint tabular-nums`「2 / 5」
- 第二行：`font-display text-[14px]` —— Roman clay + 标题 ink
- 第三行：`h-[2px] bg-rule-soft rounded-[1px]` 容器，内层 `bg-clay-deep` 宽 `${current/total * 100}%`

**空 todoList**（无节点要跑）：保持 idle 形态但文字「Run · 暂无待跑」灰显，`disabled`。

**「N 节点待跑」数字含义**：N = 当前 workspace 的 `todoList(ws)` 长度 —— 包含 `target_nodes` 本身 + 它们传递地没有 output 的依赖。这跟 RunButton 点下去实际会跑的节点数一致。GUI 端通过 store 派生（不调 API）：

```typescript
todoListCount = (ws: Workspace) => {
  // 与 engine todoList 同算法的轻量复制
  const todo = new Set<string>();
  const visit = (id: string) => {
    if (todo.has(id)) return;
    todo.add(id);
    for (const dep of ws.upstream.get(id) || []) {
      if (!ws.outputs.has(dep)) visit(dep);
    }
  };
  ws.target_nodes.forEach(visit);
  return todo.size;
};
```

### EditorPanel 加段菜单

「+ 添加段落」点击后弹一级菜单（绝对定位，挂在按钮右下方）：

```
┌──────────────────┐
│  — 文字           │
│  — agent 注入     │
│  — 引用上游  ▸    │  ← hover 展开二级
└──────────────────┘
```

- `bg-white border border-rule rounded-md shadow-lift`
- 每行 `padding: 6px 14px`，`font-body text-[12px] text-ink`
- hover：`bg-paper`
- 「引用上游」hover 触发二级展开 + 一直保持高亮（`bg-paper text-clay-deep`）

### EditorPanel 「引用上游」picker（二级）

```
┌──────────────────────────────┐
│  — 可引用上游 —              │
│  I    世界设定                │
│  II   第一章 · 出场       ↵  │  ← 当前焦点行
│  III  第二章 · 转折           │
│  V    第四章 · 终    会成环   │  ← 灰显，不可选
└──────────────────────────────┘
```

- 同样 `bg-white border border-rule rounded-md shadow-lift`，宽 220px
- header：`font-mono text-[10.5px] text-ink-faint tracking-[0.08em]`「— 可引用上游 —」
- 每项：`padding: 6px 14px`，左侧 Roman `text-clay-deep font-display`，标题 `text-ink`
- 焦点行：`bg-paper`，右侧显示 `↵` 提示 Enter 确认
- 会成环节点：`opacity-40` + 右侧 mono 9px italic「会成环」 + `cursor-not-allowed` + 不响应 click / Enter
- 列表空（比如这是 I 节点没有上游）：「— 无可引用上游 —」灰字提示

**新插入 ref block 反馈**：

ref block 创建后顶部立即 `border-top: 1.5px solid clay-deep`，**800ms 后通过 CSS transition 淡回** 1px rule 灰。给用户「这是新加的」一瞬反馈。

## 鼠标交互

| 触发 | 动作 |
|---|---|
| 单击节点 | 选中 + 开 FloatingPanel |
| shift+click 节点 | 加入选中集（进入多选） |
| cmd+click 节点 | 切换该节点选中状态 |
| shift+drag 空白 | 框选（xyflow 默认） |
| 右键节点 | 弹三项菜单 |
| 右键空白 | 添加节点 / 自动排版（已有） |
| 双击空白 | 创建节点（已有） |
| 拖拽节点 | 移动位置（xyflow 默认） |

### 多选时 FloatingPanel 行为

- 进入多选（`selectedNodeIds.size >= 2`）→ FloatingPanel 自动关闭，`selectedNodeId = null`
- 退回单选（`selectedNodeIds.size === 1`）→ 抽屉重新打开，`selectedNodeId = [first]`
- 清空选中 → 抽屉关闭

实现：store 增加 `selectedNodeIds: Set<string>` —— 单选场景与 `selectedNodeId` 同步；多选时 `selectedNodeId = null`。

### 右键菜单（节点上）

收紧成三项：

1. **重命名** —— 自动打开 FloatingPanel（如果未开）并立即进入顶部 label 的 inline 编辑模式（复用 FloatingPanel.tsx 已有的 `setEditing(true)` 流程）
2. **删除** —— 调 `store.deleteNode(nodeId)`
3. **加入 target** —— 调 `store.addToTarget(nodeId)`：POST `/api/workspaces/:id/target` → engine `ws.target_nodes.push(nodeId)`（去重）→ workspace 持久化 → store 更新

「加入 target」对**已经在 target_nodes 的节点**自动隐藏（避免冗余项）。

### 多选时右键菜单行为

- **多选场景**（`selectedNodeIds.size >= 2`）右键任一选中节点：菜单项变为：
  - **重命名** —— 隐藏（重命名只对单节点有意义）
  - **删除 N 个节点** —— 批量删（循环调 `deleteNode`）
  - **加入 target** —— 仅当至少一个选中节点不在 target_nodes 时显示，批量调 `addToTarget`
- **右键非选中节点**（多选状态下右键一个没选的节点）：先把右键的节点设为单选 + 抽屉打开，菜单变回单节点三项。

删除当前菜单原有的「添加子节点」（会自动建 ref 跟连线只读原则冲突）、「复制节点」（复制粘贴下期）。「重命名」是新加项。

## EditorPanel ref 创建增强

### 「+ 添加段落」三选一

`+ 添加段落` 按钮点击 → 弹一级菜单（见视觉规范）。

行为：
- **文字** → 立即插入 `{kind: 'literal', content: ''}` block
- **agent 注入** → 立即插入 `{kind: 'agent-inject', hint: ''}` block
- **引用上游** → 弹二级 picker，不立即插入

### 「引用上游」picker

**列表内容**：当前节点的「可引用上游」 —— workspace 中所有**不会跟当前节点形成环**的非自身节点。环检测算法：

```typescript
// 把当前节点视为 source，检查目标 nodeId 加 ref 后会不会形成环
function canReference(ws: Workspace, currentNodeId: string, candidateId: string): boolean {
  if (candidateId === currentNodeId) return false;
  // 检查 candidateId 是否在 currentNodeId 的下游（含传递闭包）
  const visited = new Set<string>();
  const queue = [currentNodeId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const downs = ws.downstream.get(id) || [];
    for (const d of downs) {
      if (d === candidateId) return false;
      queue.push(d);
    }
  }
  return true;
}
```

**排序**：topo 序（按 `ws.nodes` 数组索引），自然递增。

**局部键盘**（picker 内有效，跟「键盘整层下期」原则不冲突）：
- ↑ / ↓ —— 移焦点行（跳过 disabled 的会成环项）
- Enter —— 确认当前焦点
- Esc —— 关 picker

**选中后**：
- picker + 一级菜单全关
- 在当前 prompt section（system / user 取决于 picker 打开时所在的 section）的末尾插入 `{kind: 'ref', nodeId: candidateId}` block
- 新 block 顶部高亮 1.5px clay 800ms 后淡回（CSS `transition: border-color 600ms ease-out`）

### ref block 只读

ref block 创建后 `nodeId` 字段无法在 UI 上修改（要换上游就用 `×` 删了重加）。block 视觉跟 A 期定的一致（顶 row mono `N · ref → Roman` + body italic「引自 Roman · 标题」）。

## 流式协议

### engine 新增 `runAllStream`

文件：`packages/engine/src/workspace/core/runner.ts`（**追加**新函数，不动旧的）。

```typescript
import { createStream } from '../../llm/generate.js';

export type NodeEvent =
  | { type: 'dag-start'; total: number; nodeIds: string[] }
  | { type: 'node-start'; nodeId: string }
  | { type: 'node-token'; nodeId: string; chunk: string }
  | { type: 'node-complete'; nodeId: string; output: string }
  | { type: 'node-error'; nodeId: string; message: string }
  | { type: 'dag-done'; executed: string[] };

export async function* runAllStream(
  ws: Workspace,
  config: LlmConfig,
  rootDir: string,
  abortSignal?: AbortSignal,
): AsyncGenerator<NodeEvent> {
  calcStale(ws);
  const list = todoList(ws);
  yield { type: 'dag-start', total: list.length, nodeIds: list };

  const executed: string[] = [];
  for (const nodeId of list) {
    const node = getNode(ws, nodeId);
    if (!node) continue;

    yield { type: 'node-start', nodeId };

    const system = await resolvePrompt(ws, node.systemPrompt, rootDir, config);
    const user = await resolvePrompt(ws, node.userPrompt, rootDir, config);

    let accumulated = '';
    try {
      const stream = createStream(config, system, user, abortSignal);
      for await (const chunk of stream.textStream) {
        accumulated += chunk;
        yield { type: 'node-token', nodeId, chunk };
      }
      ws.outputs.set(nodeId, accumulated);
      ws.stale_nodes = ws.stale_nodes.filter(id => id !== nodeId);
      ws.target_nodes = ws.target_nodes.filter(id => id !== nodeId);
      executed.push(nodeId);
      yield { type: 'node-complete', nodeId, output: accumulated };
    } catch (err) {
      yield { type: 'node-error', nodeId, message: (err as Error).message };
      throw err;  // 维持旧 runAll 中断语义；GUI 这一侧收到 stream EOF
    }
  }

  yield { type: 'dag-done', executed };
}
```

注意 `resolvePrompt` 是 runner.ts 私有 helper —— 当前已存在，新函数直接复用。

**导出**：
- `packages/engine/src/index.ts` 加 `export type { NodeEvent }` 和 `export { runAllStream }`
- 旧 `export { runAll, runSingle, todoList, calcStale }` 保持不动

**CLI 兼容**：`packages/cli/src/commands/run.ts` 继续 import `runAll` / `runSingle`，零改动。

### API route 改造

文件：`packages/apps/gui/src/app/api/engine/run-all/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { readWorkspace, writeWorkspace, runAllStream, readLlmConfigs } from '@flowcabal/engine';

export async function POST(request: Request) {
  const { workspaceId } = await request.json();
  const projectDir = process.cwd();
  const config = readLlmConfigs()['default'];
  if (!config) {
    return new Response(JSON.stringify({ error: 'No default LLM config' }), { status: 400 });
  }

  const workspace = readWorkspace(projectDir, workspaceId);
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), { status: 404 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const event of runAllStream(workspace, config, projectDir)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'));
        }
        writeWorkspace(projectDir, workspaceId, workspace);
      } catch (err) {
        // node-error 已 yield 给客户端；catch 阻止 unhandled throw
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  });
}
```

**注意**：用 NDJSON（每行一个 JSON）而非 EventSource SSE 格式 —— Next.js Route Handler 用 ReadableStream 最简单，客户端 fetch + getReader 解析也简单。

### GUI store 接 stream

文件：`packages/apps/gui/src/store/useStore.ts`

新增 state：

```typescript
runningOutput: Map<string, string>          // nodeId → 累积 token chunks
runningNodeId: string | null                // 当前正在跑的节点（用于 N1 光晕）
dagProgress: { current: number; total: number } | null
selectedNodeIds: Set<string>                // 多选集合（单选时 size <= 1）
```

`internal_runAll` 改写为消费 NDJSON stream：

```typescript
internal_runAll = async () => {
  const ws = this.#get().activeWorkspace;
  if (!ws) return;

  this.#set({
    runningOutput: new Map(),
    runningNodeId: null,
    dagProgress: null,
  });

  try {
    const res = await fetch('/api/engine/run-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId: ws.id }),
    });

    if (!res.ok || !res.body) {
      const err = await res.text().catch(() => 'unknown');
      toast.error(`运行失败：${err}`);
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          this.#handleNodeEvent(JSON.parse(line) as NodeEvent);
        } catch {
          // 跨 chunk 解析失败的行：忽略，下一轮 buffer 接住
        }
      }
    }

    // 流结束后 refresh workspace（engine 端可能已修改 outputs / target_nodes）
    await this.internal_loadWorkspace(ws.id);
  } catch {
    toast.error('运行失败');
  } finally {
    this.#set({
      runningOutput: new Map(),
      runningNodeId: null,
      dagProgress: null,
    });
  }
};

#handleNodeEvent = (event: NodeEvent) => {
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
        return {
          runningOutput: map,
          dagProgress: dp ? { ...dp, current: dp.current + 1 } : null,
        };
      });
      this.#applyNodeComplete(event.nodeId, event.output);
      break;
    case 'node-error':
      // 本期不接 UI（无 runtimeErrors map），仅 console
      console.error(`Node ${event.nodeId} error:`, event.message);
      break;
    case 'dag-done':
      this.#set({ runningNodeId: null });
      break;
  }
};
```

**新 action `addToTarget`**：

```typescript
internal_addToTarget = async (nodeId: string) => {
  const ws = this.#get().activeWorkspace;
  if (!ws) return;
  try {
    const res = await fetch(`/api/workspaces/${ws.id}/target`, {
      method: 'POST',
      body: JSON.stringify({ nodeId }),
    });
    const data = await res.json();
    if (data.workspace) {
      this.#updateNodeDataFromWorkspace(recordToWorkspace(data.workspace));
      toast.success(`已加入运行目标`);
    }
  } catch {
    toast.error('操作失败');
  }
};
```

### 新 API route「加入 target」

文件：`packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts`（**新建**）

```typescript
import { NextResponse } from 'next/server';
import { readWorkspace, writeWorkspace } from '@flowcabal/engine';
import { workspaceToRecord } from '@/lib/serialization';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params;
  const { nodeId } = await request.json();
  const projectDir = process.cwd();
  const workspace = readWorkspace(projectDir, workspaceId);
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  if (!workspace.target_nodes.includes(nodeId)) {
    workspace.target_nodes.push(nodeId);
  }
  writeWorkspace(projectDir, workspaceId, workspace);
  return NextResponse.json({ workspace: workspaceToRecord(workspace) });
}
```

## OutputsPanel 流式渲染

文件：`packages/apps/gui/src/components/OutputsPanel.tsx`

A 期定的 2 态（pending / completed）扩展为 3 态：

```tsx
const isRunning = useStore((s) => s.runningNodeId === selectedNodeId);
const runningChunks = useStore((s) => s.runningOutput.get(selectedNodeId));
const completed = !isRunning && outputs.has(selectedNodeId);

if (isRunning) {
  return (
    <div className="max-w-[680px] mx-auto">
      <SceneLabel text={`output · ${roman} · 正在生成`} />
      {/* 不显示 meta 行（字数 / 复制按钮） */}
      <div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
        {runningChunks ?? ''}
      </div>
      <div className="text-center mt-4 font-display italic text-[14.5px] text-ink-soft">
        — 正在生成 —
      </div>
    </div>
  );
}
// pending / completed 态：跟 A 期完全一致
```

**字逐渐浮现**：每次 node-token 事件触发 store re-render，`runningChunks` 字符串增长，React 自然增量渲染，呈打字机效果。

**Auto-scroll**：抽屉滚动容器（FloatingPanel 内的 `.flex-1.overflow-y-auto`）在 `runningChunks` 长度变化时滚到底部。复用 memory chat 已有的 auto-scroll 逻辑（如果有）；否则用 `useEffect` 监听 length 变化 + `ref.scrollTop = ref.scrollHeight`。

## xyflow 配置变更

文件：`packages/apps/gui/src/components/Canvas.tsx`

```diff
- onConnect={onConnect}
- deleteKeyCode={['Backspace', 'Delete']}
+ // onConnect 移除：连线只读，xyflow 自动从 upstream/downstream 渲染 edge
+ // deleteKeyCode 暂关：键盘整层下期，本期用户用右键菜单删
+ nodesConnectable={false}
+ edgeTypes={edgeTypes}  // 新建 CustomEdge
+ defaultEdgeOptions={{ type: 'custom' }}
```

文件：`packages/apps/gui/src/components/FlowNode.tsx`

```diff
- <Handle type="target" position={Position.Top} id="system" className="!left-[35%]" />
- <Handle type="target" position={Position.Top} id="user" className="!left-[65%]" />
+ <Handle type="target" position={Position.Top} id="t"
+   className="!opacity-0 !pointer-events-none" />
  
  {/* ... 节点内容 ... */}
  
- <Handle type="source" position={Position.Bottom} id="output" className="!left-1/2" />
+ <Handle type="source" position={Position.Bottom} id="s"
+   className="!opacity-0 !pointer-events-none" />
```

system / user 两个 target handle 合并为单一 `t` —— 因为 onConnect 已无，handle id 不再有语义。

文件：`packages/apps/gui/src/components/CustomEdge.tsx`（**新建**）

```tsx
import { type EdgeProps, getStraightPath } from '@xyflow/react';

export function CustomEdge({ sourceX, sourceY, targetX, targetY }: EdgeProps) {
  const [linePath] = getStraightPath({
    sourceX, sourceY: sourceY + 5,   // 留出 5px 给端点装饰
    targetX, targetY: targetY - 8,   // 接入下游前缩 8px
  });
  return (
    <>
      {/* 短横笔触端点 */}
      <line x1={sourceX - 8} y1={sourceY + 3} x2={sourceX + 8} y2={sourceY + 3}
            stroke="#8A4732" strokeWidth="2" strokeLinecap="square" />
      {/* 主体线 */}
      <path d={linePath} stroke="#C9BFAA" strokeWidth="1" fill="none" />
    </>
  );
}
```

注册：
```typescript
const edgeTypes = { custom: CustomEdge };
```

**用 straight path 而非 bezier 的理由**：短横笔触端点需要精确对齐 source / target 锚点，bezier 曲线的端点切线方向不稳定（取决于起止点距离），straight path 让上游 16px 短横始终水平、下游 8px 缩进可预测。代价是密集节点画面 edge 会交叉得多，但对小说写作场景的 dag 规模（10-30 个节点）影响可接受。

## 数据流图

### 新建节点 → target+pending
```
GUI createNode(label)
  → POST /api/workspaces/nodes { workspaceId, label }
  → engine addNode(ws, label) [push target_nodes]
  → writeWorkspace
  → return workspace
  → GUI 状态更新（节点显示 target+pending）
```

### 「加入 target」 completed → target+completed
```
GUI 右键「加入 target」 → store.addToTarget(nodeId)
  → POST /api/workspaces/:id/target { nodeId }
  → ws.target_nodes.push(nodeId)（去重）
  → writeWorkspace
  → return workspace
  → GUI 状态更新（completed → target+completed，output 不变）
```

### 运行（dag stream）
```
GUI RunButton click → store.runAll()
  ↓
fetch POST /api/engine/run-all (stream response)
  ↓
route handler:
  for await (event of runAllStream(ws, config, projectDir)):
    stream.enqueue(JSON.stringify(event) + '\n')
  writeWorkspace
  stream.close
  ↓
engine runAllStream:
  yield dag-start { total: 5, nodeIds: [I, II, III, IV, V] }
  for each nodeId:
    yield node-start { nodeId }
    createStream(config, sys, user)
      for await chunk: yield node-token { nodeId, chunk }
    ws.outputs.set + filter target_nodes / stale_nodes
    yield node-complete { nodeId, output }
  yield dag-done { executed }
  ↓
GUI store.#handleNodeEvent:
  dag-start  → dagProgress = { current: 0, total: 5 }
  node-start → runningNodeId = nodeId（N1 光晕、RunButton 第二行）
  node-token → runningOutput.update（OutputsPanel re-render 增长）
  node-complete → outputs.set, dagProgress.current++（节点变 completed）
  dag-done   → runningNodeId = null
  ↓
finally: refresh workspace, 清 runningOutput / dagProgress
```

## 文件级影响清单

**新增**：
- `packages/apps/gui/src/components/CustomEdge.tsx` — C3 短横笔触 edge component
- `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts` — POST「加入 target」

**修改**：
- `packages/engine/src/workspace/core/runner.ts` — 新增 `runAllStream` + `NodeEvent` 类型；旧 `runAll` / `runSingle` / `runNode` 不动
- `packages/engine/src/index.ts` — export `runAllStream` 和 `NodeEvent`
- `packages/apps/gui/src/app/api/engine/run-all/route.ts` — 改返回 NDJSON 流式 response
- `packages/apps/gui/src/store/useStore.ts` — `internal_runAll` 重写为消费 stream；新增 `addToTarget` action；新增 state `runningOutput` / `runningNodeId` / `dagProgress` / `selectedNodeIds`；新增 helper `#handleNodeEvent` / `#applyNodeComplete` / `#setNodeStatus`
- `packages/apps/gui/src/components/Canvas.tsx` — 移除 onConnect / deleteKeyCode；加 `nodesConnectable={false}` 和 `edgeTypes`；右键菜单收紧三项；多选状态管理；shift+click / cmd+click 接 store.selectedNodeIds
- `packages/apps/gui/src/components/FlowNode.tsx` — 4 态视觉（顶描边色 + 尾栏色按 target/非 target 二分；running 叠加 N1 光晕）；选中态 box-shadow；handle 合并 + 隐藏
- `packages/apps/gui/src/components/RunButton.tsx` — A 风格重画（idle / running 两态 + dag 进度细条）；shadcn Button / Spinner / Play 依赖移除
- `packages/apps/gui/src/components/EditorPanel.tsx` — 「+ 添加段落」改三选一菜单 + 「引用上游」二级 picker（含局部键盘）+ 新插入 block 800ms 高亮
- `packages/apps/gui/src/components/OutputsPanel.tsx` — running 态显示 `runningOutput.get(nodeId)` 流式 chunks

**不动（兼容）**：
- engine 旧 `runAll` / `runSingle` —— CLI 继续使用
- `packages/cli/src/commands/run.ts` —— 零改动
- `packages/apps/gui/src/components/FloatingPanel.tsx` —— chrome A 期已重画
- `packages/apps/gui/src/components/SettingsDialog.tsx`
- A 期定下的所有视觉规范（scene-label / hairline block / drop cap / Roman 数字 / 字体 / 颜色变量）

## 风险与已知边界

1. **当 LLM 速度非常快或返回非常短**：node-token 事件可能数十毫秒内就完了，OutputsPanel 「字逐渐浮现」效果不明显。可接受。

2. **NDJSON 跨 chunk 解析**：用 line-buffered 解析（split '\n' + 保留最后一行作 buffer），是稳健做法 —— 但如果某个事件的 JSON 字段含 `\n` 字符（极少），buffer 边界 fix 仍稳健。stringify 默认会 escape 字符串内换行为 `\n`。

3. **xyflow handle 隐藏不影响 edge 路径**：`!opacity-0` 让 handle DOM 仍可定位，xyflow 内部 ref 算 path 正常。CustomEdge 内的偏移补偿（sourceY + 5, targetY - 8）专门预留了端点装饰空间。

4. **多选时抽屉自动关闭可能略意外**：用户首次 shift+click 第二个节点时抽屉会突然关。可以考虑首次 toast 提示「已切换到多选模式」，但本期暂不做（视觉差异本身能让用户理解：选中外环 + 抽屉关）。

5. **未接 node-error UI**：stream 推 node-error 但 GUI 仅 console.warn。下期接 store.runtimeErrors 时不用改 API / stream 协议，只用扩 store 的 handler。这是有意 forward-compat 的设计。

6. **「加入 target」对 stale 的语义影响**：本期不做 stale 视觉，但 engine 内部 calcStale 仍跑（todoList 依赖）。GUI 不显示 ✱ 标记，但 ws.stale_nodes 字段会持久化 —— 下期接 stale 视觉时不用改 engine。

7. **dag 进度对「下游被上游阻塞」的处理**：本期不做 runAll catch on error。若某节点 throw，runAllStream 也 throw（yield node-error 后 throw），stream 提前 EOF，GUI 收到 stream done 但 dag-done 没收到 → finally 清进度 state。视觉上看是「跑到一半进度停了」，用户看 toast 知道运行失败 —— 可接受作为本期行为。

8. **runAllStream 异步生成器的 await**：route handler 的 `for await...of` 自然处理 async iteration，每个 `yield` 都会让出控制让 stream.enqueue 触发 → 客户端的 reader.read() 收到。无需特殊 flush 调用。

## 与下期的衔接

下期（错误 / stale / 键盘 / 移出 target / 复制粘贴 / undo）的接入点：

- **stale 视觉**：FlowNode 加 ✱ + tooltip，数据源 `ws.stale_nodes`（本期已经在持久化）。tooltip 操作「加入 target 重跑」复用本期的 `addToTarget` action + 加一个「清 output」步骤。
- **error 视觉**：store 加 `runtimeErrors: Map<nodeId, string>`，本期 `#handleNodeEvent` 的 `case 'node-error'` 改为写入这个 map。FlowNode error 视觉跟着 map 触发。
- **错误自动加 target**：engine `runAllStream` 在 catch 时 `ws.target_nodes.push(nodeId)` 后再 yield node-error，**这一行**就把错误 → 自动 target 的语义补全。
- **键盘**：xyflow `deleteKeyCode` 重新启用 + 接 `onNodesDelete` 同步 engine；新增方向键 / Tab / Enter / Esc / cmd+R / cmd+A 等 handler。
- **「移出 target」**：右键菜单加第四项 + 新 API route `DELETE /api/workspaces/:id/target` + 引入「草稿态」（无 output + 无 target）的第 5 态视觉（下期单独议题再定）。

每条都是 1-2 个文件的局部扩展，本期的架构没有任何障碍。
