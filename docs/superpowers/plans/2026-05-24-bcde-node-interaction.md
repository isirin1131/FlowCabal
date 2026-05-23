# GUI 节点交互与流式运行（B+C+D+E 期）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 引入节点 4 态视觉、双尺度 stream（节点级 + token 级）、连线只读化（onConnect 移除 + handle 隐藏 + edge 短横笔触）、EditorPanel ref 创建增强（picker + 防环）、RunButton 重画（dag 进度）、新「加入 target」操作 API + 右键菜单。

**Architecture:** engine 追加新流式接口 `runAllStream`（异步生成器），旧 `runAll` / `runSingle` 完全不动以保 CLI 兼容；API route 改返回 NDJSON 流；GUI store 用 fetch + ReadableStream 解析流并派发到节点视觉 / RunButton 进度 / OutputsPanel 流式文本。视觉规范继承 A 期定下的 paper / clay / ink + Source Serif 排印语言。

**Tech Stack:** Next.js 15（packages/apps/gui 是定制 Next.js，避免假设 API 与训练数据一致）、React、Tailwind v4、shadcn/ui、zustand、xyflow、sonner 2.0.7、Vercel AI SDK（已含 `streamText`）。

**Spec:** `docs/superpowers/specs/2026-05-24-bcde-node-interaction.md`

**测试策略说明：** 本项目主要改动 UI 视觉 + 流式行为。无视觉回归测试基础设施。每个 Task 的"测试"步骤是：①`bun run typecheck:gui && bun run typecheck` 通过；②手动 `bun dev` 在浏览器验证。Plan 不让 executor 启动 dev server（会阻塞）；executor 推进每个 Task 至 typecheck 通过 + commit 即可。最终 Task 给出手动验收 checklist，由用户在浏览器逐项核对。

---

## File Structure

**新增**
- `packages/apps/gui/src/components/CustomEdge.tsx` — C3 短横笔触 edge component
- `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts` — POST「加入 target」

**修改**
- `packages/engine/src/workspace/core/runner.ts` — 追加 `runAllStream` + `NodeEvent` 类型
- `packages/engine/src/index.ts` — export 新 API
- `packages/apps/gui/src/app/api/engine/run-all/route.ts` — 改返回 NDJSON 流
- `packages/apps/gui/src/store/useStore.ts` — 流式 handler + addToTarget + 新 state + 多选
- `packages/apps/gui/src/components/Canvas.tsx` — xyflow 配置 + edgeTypes + 右键菜单 + 多选集成
- `packages/apps/gui/src/components/FlowNode.tsx` — 4 态视觉 + 选中外环 + handle 合并隐藏
- `packages/apps/gui/src/components/RunButton.tsx` — A 风格重画 + dag 进度
- `packages/apps/gui/src/components/EditorPanel.tsx` — 三选一菜单 + 引用上游 picker
- `packages/apps/gui/src/components/OutputsPanel.tsx` — running 态流式渲染

**不动**
- engine 旧 `runAll` / `runSingle` / `runNode` —— CLI 继续使用
- `packages/cli/src/commands/run.ts`
- `packages/apps/gui/src/components/FloatingPanel.tsx` —— A 期已重画
- `packages/apps/gui/src/components/SettingsDialog.tsx`
- A 期定下的视觉规范

---

## Task 1: engine `runAllStream` + `NodeEvent` 类型

**Files:**
- Modify: `packages/engine/src/workspace/core/runner.ts` (append new function + type)
- Modify: `packages/engine/src/index.ts` (add export)

---

- [ ] **Step 1.1: 在 runner.ts 追加 NodeEvent 类型与 runAllStream 函数**

打开 `packages/engine/src/workspace/core/runner.ts`。在文件**末尾**追加（不动现有 runNode / runSingle / runAll）：

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
    yield { type: 'dag-start', total: list.length, nodeIds: [...list] };

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
            throw err;
        }
    }

    yield { type: 'dag-done', executed };
}
```

注意：`createStream` 已在 `packages/engine/src/llm/generate.ts:34` 导出（使用 Vercel AI SDK 的 `streamText`）。`resolvePrompt` 已是 runner.ts 内的私有 helper，复用之。

- [ ] **Step 1.2: 在 engine/index.ts 导出新 API**

打开 `packages/engine/src/index.ts`，找到 workspace 相关 export，确认 runner 已经走 `export * from "./workspace/index.js"` 或类似 — 检查实际：

Run from repo root:
```bash
grep -n "runAll\|runner" packages/engine/src/index.ts packages/engine/src/workspace/index.ts
```

Expected: 至少有一行类似 `export * from "./workspace/core/runner.js"` 或具名 export。

如果是 `export *`，新 `runAllStream` 和 `NodeEvent` 已自动导出，跳到 Step 1.3。

如果是具名 export 比如 `export { runAll, runSingle } from "./workspace/core/runner.js"`，需要加：

```typescript
export { runAll, runSingle, runAllStream, type NodeEvent } from "./workspace/core/runner.js";
```

- [ ] **Step 1.3: typecheck engine**

Run from repo root:
```bash
bun run typecheck
```

Expected: PASS（含 engine + cli 两个 tsconfig）。

如果 fail 大概率是 createStream import 路径或者 NodeEvent 类型签名问题。

- [ ] **Step 1.4: Commit**

```bash
git add packages/engine/src/workspace/core/runner.ts packages/engine/src/index.ts
git commit -m "$(cat <<'EOF'
feat(engine): 新增 runAllStream 流式接口与 NodeEvent 类型

旧 runAll / runSingle 完全不动，保持 CLI 接口不变。
新接口内部用 createStream 替代 generate，可推 token-level chunks。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: API route — NDJSON 流式 + 新「加入 target」route

**Files:**
- Modify: `packages/apps/gui/src/app/api/engine/run-all/route.ts` (rewrite)
- Create: `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts`

---

- [ ] **Step 2.1: 重写 run-all route 为 NDJSON 流式 response**

打开 `packages/apps/gui/src/app/api/engine/run-all/route.ts`，整文件替换为：

```typescript
import { readWorkspace, writeWorkspace, runAllStream, readLlmConfigs } from '@flowcabal/engine'

export async function POST(request: Request) {
  const { workspaceId } = await request.json()
  const projectDir = process.cwd()
  const config = readLlmConfigs()['default']
  if (!config) {
    return new Response(JSON.stringify({ error: 'No default LLM config' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return new Response(JSON.stringify({ error: 'Workspace not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      try {
        for await (const event of runAllStream(workspace, config, projectDir)) {
          controller.enqueue(encoder.encode(JSON.stringify(event) + '\n'))
        }
        writeWorkspace(projectDir, workspaceId, workspace)
      } catch {
        // node-error 已 yield 给客户端；catch 阻止 unhandled throw
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
```

- [ ] **Step 2.2: 新建 target route**

创建文件 `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts`：

```typescript
import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params
  const { nodeId } = await request.json()
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  if (!workspace.target_nodes.includes(nodeId)) {
    workspace.target_nodes.push(nodeId)
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
```

注意：Next.js 15 的 dynamic route `params` 是 Promise，必须 await。

- [ ] **Step 2.3: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。

- [ ] **Step 2.4: Commit**

```bash
git add packages/apps/gui/src/app/api/engine/run-all/route.ts packages/apps/gui/src/app/api/workspaces/
git commit -m "$(cat <<'EOF'
feat(gui/api): run-all 改 NDJSON 流式 response，新增 target POST route

run-all 用 ReadableStream 把 engine runAllStream 的 NodeEvent
逐行 JSON.stringify 推给 client。
target route 把节点加入 ws.target_nodes 并持久化。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: store — NodeEvent handler + runAll 重写 + addToTarget + 新 state

**Files:**
- Modify: `packages/apps/gui/src/store/useStore.ts` (substantial additions; internal_runAll rewrite)

---

- [ ] **Step 3.1: 在 useStore.ts 顶部加 NodeEvent import 与 todoListCount helper**

打开 `packages/apps/gui/src/store/useStore.ts`。在文件**第 3 行**（`import type { Workspace, NodeDef, TextBlock } from '@flowcabal/engine'`）改为：

```typescript
import type { Workspace, NodeDef, TextBlock, NodeEvent } from '@flowcabal/engine'
```

在 `toRoman` 函数定义之后（约第 45 行之后）追加：

```typescript
function todoListCount(ws: Workspace): number {
  const todo = new Set<string>()
  const visit = (id: string) => {
    if (todo.has(id)) return
    todo.add(id)
    for (const dep of ws.upstream.get(id) || []) {
      if (!ws.outputs.has(dep)) visit(dep)
    }
  }
  ws.target_nodes.forEach(visit)
  return todo.size
}

export { todoListCount }
```

- [ ] **Step 3.2: 扩 GuiState 类型**

找到 `type GuiState = { ... }`（约第 8 行起），把它改成：

```typescript
type GuiState = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  selectedNodeIds: Set<string>
  floatingPanelOpen: boolean
  isLoading: boolean
  runningOutput: Map<string, string>
  runningNodeId: string | null
  dagProgress: { current: number; total: number } | null
} & {
  switchWorkspace: (id: string) => void
  loadWorkspace: (id: string) => Promise<void>
  saveActiveWorkspace: () => Promise<void>
  runAll: () => Promise<void>
  createNode: (label: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  addToTarget: (nodeId: string) => Promise<void>
  updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) => Promise<void>
  addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) => Promise<void>
  removeBlock: (nodeId: string, isSystem: boolean, index: number) => Promise<void>
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  selectNode: (id: string | null) => void
  setSelectedNodeIds: (ids: Set<string>) => void
  renameNode: (nodeId: string, label: string) => Promise<void>
}
```

注意：**移除** 了 `onConnect` 字段（连线只读，不再有 onConnect handler）。新增了 `selectedNodeIds` / `runningOutput` / `runningNodeId` / `dagProgress` 四个 state 字段，以及 `addToTarget` / `setSelectedNodeIds` 两个 action。

- [ ] **Step 3.3: 在 WorkspaceActions class 内追加 #handleNodeEvent + #setNodeStatus + #applyNodeComplete 三个 private helpers + internal_addToTarget**

找到 `class WorkspaceActions { ... }`，在 `internal_removeBlock` 方法之**前**（约 line 320 处）追加：

```typescript
  #setNodeStatus = (nodeId: string, status: string) => {
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
      ),
    }))
  }

  #applyNodeComplete = (nodeId: string, output: string) => {
    this.#set((s: any) => {
      const ws = s.activeWorkspace
      if (!ws) return s
      const newOutputs = new Map(ws.outputs)
      newOutputs.set(nodeId, output)
      const newTarget = ws.target_nodes.filter((id: string) => id !== nodeId)
      const newStale = ws.stale_nodes.filter((id: string) => id !== nodeId)
      const newWs: Workspace = { ...ws, outputs: newOutputs, target_nodes: newTarget, stale_nodes: newStale }
      return {
        activeWorkspace: newWs,
        workspaces: s.workspaces.map((w: Workspace) => w.id === newWs.id ? newWs : w),
        nodes: s.nodes.map((n: any) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'completed', output } }
            : n
        ),
      }
    })
  }

  #handleNodeEvent = (event: NodeEvent) => {
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
          return {
            runningOutput: map,
            dagProgress: dp ? { ...dp, current: dp.current + 1 } : null,
          }
        })
        this.#applyNodeComplete(event.nodeId, event.output)
        break
      case 'node-error':
        // 本期不接 UI（无 runtimeErrors map），下期接 store.runtimeErrors
        console.error(`Node ${event.nodeId} error:`, event.message)
        break
      case 'dag-done':
        this.#set({ runningNodeId: null })
        break
    }
  }

  internal_addToTarget = async (nodeId: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/target`, {
        method: 'POST',
        body: JSON.stringify({ nodeId }),
      })
      const data = await res.json()
      if (data.workspace) {
        const updatedWs = recordToWorkspace(data.workspace)
        this.#set((s: any) => ({
          workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
        }))
        toast.success('已加入运行目标')
      }
    } catch {
      toast.error('操作失败')
    }
  }
```

- [ ] **Step 3.4: 重写 internal_runAll 为流式消费**

找到 `internal_runAll = async () => { ... }` 方法（约 line 146-181），整方法替换为：

```typescript
  internal_runAll = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return

    this.#set({
      runningOutput: new Map(),
      runningNodeId: null,
      dagProgress: null,
    })

    try {
      const res = await fetch('/api/engine/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws.id }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'unknown error')
        toast.error(`运行失败：${errText}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            this.#handleNodeEvent(JSON.parse(line) as NodeEvent)
          } catch {
            // 跨 chunk 解析失败的行：忽略，下一轮 buffer 接住
          }
        }
      }

      await this.internal_loadWorkspace(ws.id)
    } catch {
      toast.error('运行失败')
    } finally {
      this.#set({
        runningOutput: new Map(),
        runningNodeId: null,
        dagProgress: null,
      })
    }
  }
```

- [ ] **Step 3.5: 更新 create store 时的初始 state 与 action 暴露**

找到 `export const useStore = create<GuiState>()((set, get) => { ... })` 的初始对象（约 line 334 起），整个 return 块替换为：

```typescript
export const useStore = create<GuiState>()((set, get) => {
  const actions = new WorkspaceActions(set, get)
  return {
    workspaces: [], activeWorkspace: null, nodes: [], edges: [],
    selectedNodeId: null, selectedNodeIds: new Set(), floatingPanelOpen: false, isLoading: false,
    runningOutput: new Map(), runningNodeId: null, dagProgress: null,

    switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
    loadWorkspace: (id: string) => actions.internal_loadWorkspace(id),
    saveActiveWorkspace: () => actions.internal_saveActiveWorkspace(),
    runAll: () => actions.internal_runAll(),
    createNode: (label: string) => actions.internal_createNode(label),
    deleteNode: (nodeId: string) => actions.internal_deleteNode(nodeId),
    createWorkspace: (name: string) => actions.internal_createWorkspace(name),
    addToTarget: (nodeId: string) => actions.internal_addToTarget(nodeId),

    renameNode: (nodeId: string, label: string) => actions.internal_renameNode(nodeId, label),
    updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) =>
      actions.internal_updateBlock(nodeId, isSystem, index, block),
    addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) =>
      actions.internal_addBlock(nodeId, block, isSystem),
    removeBlock: (nodeId: string, isSystem: boolean, index: number) =>
      actions.internal_removeBlock(nodeId, isSystem, index),

    onNodesChange: (c: any) => set((s: any) => ({ nodes: applyNodeChanges(c, s.nodes) })),
    onEdgesChange: (c: any) => set((s: any) => ({ edges: applyEdgeChanges(c, s.edges) })),
    selectNode: (id: string | null) => set({
      selectedNodeId: id,
      selectedNodeIds: id ? new Set([id]) : new Set(),
      floatingPanelOpen: id !== null,
    }),
    setSelectedNodeIds: (ids: Set<string>) => set({
      selectedNodeIds: ids,
      selectedNodeId: ids.size === 1 ? [...ids][0] : null,
      floatingPanelOpen: ids.size === 1,
    }),
  }
})
```

注意：**移除** 了原来的 `onConnect` handler（连线只读，不再创建 ref via canvas drag）。`selectNode` 同步设置 `selectedNodeIds`。`setSelectedNodeIds` 是多选时的统一入口。

- [ ] **Step 3.6: 移除 useStore.ts 顶部不再需要的 import**

找到顶部 `import { applyNodeChanges, applyEdgeChanges, addEdge, type Node, type Edge } from '@xyflow/react'`，把 `addEdge` 去掉（不再使用）：

```typescript
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge } from '@xyflow/react'
```

- [ ] **Step 3.7: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。

- [ ] **Step 3.8: Commit**

```bash
git add packages/apps/gui/src/store/useStore.ts
git commit -m "$(cat <<'EOF'
feat(gui/store): 接入流式 NodeEvent + 多选 + 加入 target

internal_runAll 重写为消费 NDJSON 流；新增 runningOutput / runningNodeId /
dagProgress / selectedNodeIds 四个 state；addToTarget action；
移除已无用的 onConnect handler。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: CustomEdge component + Canvas xyflow 配置 + 右键菜单 + 多选集成

**Files:**
- Create: `packages/apps/gui/src/components/CustomEdge.tsx`
- Modify: `packages/apps/gui/src/components/Canvas.tsx` (rewrite)

---

- [ ] **Step 4.1: 新建 CustomEdge.tsx**

创建 `packages/apps/gui/src/components/CustomEdge.tsx`：

```tsx
import { type EdgeProps, BaseEdge, getStraightPath } from '@xyflow/react'

export function CustomEdge({ sourceX, sourceY, targetX, targetY, id }: EdgeProps) {
  const adjustedSourceY = sourceY + 5
  const adjustedTargetY = targetY - 8
  const [linePath] = getStraightPath({
    sourceX,
    sourceY: adjustedSourceY,
    targetX,
    targetY: adjustedTargetY,
  })
  return (
    <>
      <line
        x1={sourceX - 8}
        y1={sourceY + 3}
        x2={sourceX + 8}
        y2={sourceY + 3}
        stroke="#8A4732"
        strokeWidth={2}
        strokeLinecap="square"
      />
      <BaseEdge id={id} path={linePath} style={{ stroke: '#C9BFAA', strokeWidth: 1 }} />
    </>
  )
}
```

- [ ] **Step 4.2: 整文件重写 Canvas.tsx**

打开 `packages/apps/gui/src/components/Canvas.tsx`，整文件替换为：

```tsx
'use client'
import { memo, useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useViewport,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import FlowNode from './FlowNode'
import { CustomEdge } from './CustomEdge'
import { nanoid } from 'nanoid'
import { getLayoutedElements } from '@/lib/engine-to-flow'

const nodeTypes: NodeTypes = { flowNode: FlowNode }
const edgeTypes: EdgeTypes = { custom: CustomEdge }

function ContextMenuPanel({ x, y, nodeId, selectedIds, onClose }: {
  x: number
  y: number
  nodeId: string | null
  selectedIds: Set<string>
  onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const addToTarget = useStore((s) => s.addToTarget)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectNode = useStore((s) => s.selectNode)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  type Item = { label: string; onClick: () => void; danger?: boolean }

  let items: Item[] = []

  if (nodeId === null) {
    // 空白处
    items = [{ label: '添加节点', onClick: () => { createNode(`节点 ${nanoid(4)}`); onClose() } }]
  } else {
    const isMulti = selectedIds.size >= 2 && selectedIds.has(nodeId)
    if (isMulti) {
      const ids = [...selectedIds]
      const someNotTarget = activeWorkspace
        ? ids.some(id => !activeWorkspace.target_nodes.includes(id))
        : false
      items = [
        { label: `删除 ${ids.length} 个节点`, onClick: () => {
          for (const id of ids) deleteNode(id)
          onClose()
        }, danger: true },
      ]
      if (someNotTarget) {
        items.unshift({ label: '加入 target', onClick: () => {
          for (const id of ids) {
            if (!activeWorkspace?.target_nodes.includes(id)) addToTarget(id)
          }
          onClose()
        }})
      }
    } else {
      // 单选节点（如果右键的节点不在选中集，先单选它）
      if (!selectedIds.has(nodeId)) selectNode(nodeId)
      const inTarget = activeWorkspace?.target_nodes.includes(nodeId) ?? false
      items = [
        { label: '重命名', onClick: () => {
          selectNode(nodeId)
          // 触发抽屉打开后由 FloatingPanel 的双击 label 流程接管；
          // 这里 dispatch 一个 custom event 让 FloatingPanel 进入编辑模式
          window.dispatchEvent(new CustomEvent('flowcabal:rename-node', { detail: { nodeId } }))
          onClose()
        }},
        { label: '删除', onClick: () => { deleteNode(nodeId); onClose() }, danger: true },
      ]
      if (!inTarget) {
        items.push({ label: '加入 target', onClick: () => { addToTarget(nodeId); onClose() } })
      }
    }
  }

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-paper border border-rule rounded-md shadow-lift py-1 animate-slide-in font-body text-[13px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={[
            'w-full text-left px-3 py-1.5 cursor-pointer transition-colors duration-150',
            'hover:bg-clay-faint',
            item.danger ? 'text-error hover:!text-error' : 'text-ink hover:text-clay-deep',
          ].join(' ')}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ZoomReadout() {
  const { zoom } = useViewport()
  const { fitView } = useReactFlow()
  const pct = Math.round(zoom * 100)
  return (
    <Panel position="bottom-right" className="!m-0">
      <div className="font-mono text-[10.5px] text-ink-faint tracking-wide px-4 py-3 pointer-events-auto select-none">
        <span className="tabular-nums">zoom {pct}%</span>
        <span className="text-rule mx-3">·</span>
        <button
          type="button"
          onClick={() => fitView({ duration: 240 })}
          className="hover:text-ink transition-colors cursor-pointer"
        >
          <kbd className="font-mono not-italic">⌘0</kbd> fit
        </button>
      </div>
    </Panel>
  )
}

function LayoutButton() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const handleLayout = useCallback(() => {
    if (nodes.length === 0) return
    const { nodes: laid, edges: laidE } = getLayoutedElements(nodes, edges)
    useStore.setState({ nodes: laid, edges: laidE })
  }, [nodes, edges])

  return (
    <Panel position="top-left" className="!m-0">
      <button
        type="button"
        onClick={handleLayout}
        className="font-display italic text-[13px] text-ink-soft hover:text-clay transition-colors px-4 py-3 pointer-events-auto cursor-pointer"
      >
        — 自动排版
      </button>
    </Panel>
  )
}

function EmptyState() {
  return (
    <Panel position="top-center" className="!mt-24">
      <div className="text-center pointer-events-none select-none">
        <div className="font-display italic text-ink-soft text-[18px] mb-1">
          画布为空
        </div>
        <div className="font-body text-[13px] text-ink-faint">
          双击画布添加节点，或在空白处右键
        </div>
      </div>
    </Panel>
  )
}

function CanvasInner() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const selectNode = useStore((s) => s.selectNode)
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds)
  const selectedNodeIds = useStore((s) => s.selectedNodeIds)
  const createNode = useStore((s) => s.createNode)

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; nodeId: string | null
  } | null>(null)

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.shiftKey) {
      // 加入选中
      const next = new Set(selectedNodeIds)
      next.add(node.id)
      setSelectedNodeIds(next)
    } else if (event.metaKey || event.ctrlKey) {
      // 切换选中
      const next = new Set(selectedNodeIds)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      setSelectedNodeIds(next)
    } else {
      // 单选
      selectNode(node.id)
    }
  }, [selectNode, setSelectedNodeIds, selectedNodeIds])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX - 10, y: event.clientY - 10, nodeId: node.id })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    const e = 'clientX' in event ? event : event
    setContextMenu({ x: e.clientX - 10, y: e.clientY - 10, nodeId: null })
  }, [])

  const onPaneDoubleClick = useCallback(() => {
    createNode(`节点 ${nanoid(4)}`)
  }, [createNode])

  // 把 selectedNodeIds 同步到 xyflow 节点的 selected 字段
  const decoratedNodes = nodes.map(n => ({
    ...n,
    selected: selectedNodeIds.has(n.id),
  }))

  return (
    <div className="w-full h-full relative select-none bg-paper">
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 0 }}
        defaultEdgeOptions={{ type: 'custom' }}
        proOptions={{ hideAttribution: true }}
      >
        <LayoutButton />
        <ZoomReadout />
        {nodes.length === 0 && <EmptyState />}
      </ReactFlow>
      {contextMenu && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          selectedIds={selectedNodeIds}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

export default memo(Canvas)
```

主要变化：
- 顶部 import `CustomEdge`，定义 `edgeTypes`
- `nodesConnectable={false}` + 移除 `onConnect` + 移除 `deleteKeyCode` + 移除 `connectionLineStyle`
- `defaultEdgeOptions={{ type: 'custom' }}`
- `onNodeClick` 改造为单选 / shift+click / cmd+click 三分支
- `ContextMenuPanel` 重写为单选 / 多选两种菜单模式 + 三项收紧（重命名 / 删除 / 加入 target）
- 「重命名」通过 `window.dispatchEvent` 派发自定义事件给 FloatingPanel；FloatingPanel 不在本期改，预留事件接口（hooked 在 Step 5 / 后续）

- [ ] **Step 4.3: 在 FloatingPanel 接 rename event listener**

打开 `packages/apps/gui/src/components/FloatingPanel.tsx`。找到现有的 `useEffect` 块（around 第 28-31 行，依据 nodeId 同步 draft 和 editing 状态）之后，追加一个 useEffect：

```tsx
  useEffect(() => {
    const handleRename = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.nodeId === nodeId) {
        setDraft(node?.label || '')
        setEditing(true)
      }
    }
    window.addEventListener('flowcabal:rename-node', handleRename as EventListener)
    return () => window.removeEventListener('flowcabal:rename-node', handleRename as EventListener)
  }, [nodeId, node?.label])

```

`setEditing` 与 `setDraft` 已经在文件顶部声明（FloatingPanel A 期 chrome 重画时已有）。新 useEffect 监听全局 `flowcabal:rename-node` 事件，匹配当前 nodeId 时进入编辑模式。

- [ ] **Step 4.4: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS（如果报「rename-node 事件未定义」，不影响 typecheck，只在运行时无 listener；后续 Task 可接）。

- [ ] **Step 4.5: Commit**

```bash
git add packages/apps/gui/src/components/CustomEdge.tsx packages/apps/gui/src/components/Canvas.tsx packages/apps/gui/src/components/FloatingPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): Canvas 连线只读 + 多选 + 右键三项 + C3 短横笔触 edge

新建 CustomEdge 实现「上游短横 + 主体细线 + 下游缩进」C3 视觉。
Canvas 移除 onConnect / deleteKeyCode、nodesConnectable=false、defaultEdgeOptions type=custom。
onNodeClick 接 shift+click / cmd+click / 单选；ContextMenuPanel 重写。
重命名走 window CustomEvent，FloatingPanel 接 listener 自动进入 inline 编辑。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FlowNode — 4 态视觉 + handle 隐藏 + 选中外环

**Files:**
- Modify: `packages/apps/gui/src/components/FlowNode.tsx` (rewrite)

---

- [ ] **Step 5.1: 整文件重写 FlowNode.tsx**

打开 `packages/apps/gui/src/components/FlowNode.tsx`，整文件替换为：

```tsx
'use client'
import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { TextBlock } from '@flowcabal/engine'
import { useStore } from '@/store/useStore'

type FlowNodeData = {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'completed' | 'running'
  output: string | null
  roman: string
  refRomans: string[]
  _deleting?: boolean
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

function FlowNode({ id, data, selected }: NodeProps<FlowNodeType>) {
  const isDeleting = (data as unknown as Record<string, unknown>)._deleting === true
  const runningNodeId = useStore((s) => s.runningNodeId)
  const activeWorkspace = useStore((s) => s.activeWorkspace)

  const isRunning = runningNodeId === id
  const inTarget = activeWorkspace?.target_nodes.includes(id) ?? false
  const hasOutput = !!data.output

  // status 派生：running 优先 > target+pending/completed > completed
  let visualStatus: 'target-pending' | 'target-completed' | 'completed' | 'running'
  if (isRunning) visualStatus = 'running'
  else if (inTarget && !hasOutput) visualStatus = 'target-pending'
  else if (inTarget && hasOutput) visualStatus = 'target-completed'
  else visualStatus = 'completed'

  const sysCount = data.systemPrompt?.length ?? 0
  const usrCount = data.userPrompt?.length ?? 0
  const refs = data.refRomans ?? []

  const wordCount = data.output ? estimateWords(data.output) : null

  // 顶描边 + 尾栏色 + 背景
  const topBorderClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed')
    ? 'border-t-[1.5px] border-t-clay-deep'
    : 'border-t-[1px] border-t-rule'
  const footerColorClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed' || visualStatus === 'running')
    ? 'text-clay-deep'
    : 'text-ink-faint'
  const footerDotClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed' || visualStatus === 'running')
    ? 'bg-clay-deep'
    : 'bg-ink'
  const footerBorderClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed')
    ? 'border-t border-t-clay-deep/30'
    : 'border-t border-t-rule-soft'

  // running 叠加层
  const runningClass = isRunning
    ? 'border-x-[1.5px] border-b-[1.5px] !border-clay-deep !border-t-[2.5px] bg-[#FAF3DD]'
    : ''
  const runningShadow = isRunning
    ? { boxShadow: '0 0 0 4px rgba(182,92,69,0.12), 0 0 18px rgba(182,92,69,0.25)' }
    : {}

  // 选中外环（ink box-shadow）
  const selectedShadow = selected
    ? { boxShadow: isRunning
        ? '0 0 0 1.5px #3F392C, 0 0 0 4px rgba(182,92,69,0.12), 0 0 18px rgba(182,92,69,0.25)'
        : '0 0 0 1.5px #3F392C' }
    : {}

  // status 文字 + 字数
  const statusText =
    visualStatus === 'target-pending' ? '待运行' :
    visualStatus === 'target-completed' ? '待重跑' :
    visualStatus === 'running' ? '正在生成…' :
    'completed'

  return (
    <article
      style={{ ...runningShadow, ...selectedShadow }}
      className={[
        'relative bg-paper-deep border-x border-b border-rule rounded-md',
        'min-w-[220px] max-w-[260px]',
        'transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out',
        'animate-node-enter',
        topBorderClass,
        runningClass,
        isDeleting ? 'opacity-40 scale-[0.97]' : 'opacity-100 scale-100',
      ].filter(Boolean).join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className="!opacity-0 !pointer-events-none"
      />

      <div className="px-[22px] pt-[16px] pb-[14px]">
        {/* Roman numeral */}
        <div className="font-display font-medium leading-none text-[28px] text-clay-deep">
          {data.roman || '—'}
        </div>

        {/* Title */}
        <h3 className="font-display text-[16px] font-medium text-ink leading-tight mt-[8px] tracking-[-0.01em]">
          {data.label}
        </h3>

        {/* Meta */}
        <div className="mt-[12px] font-body text-[11px] text-ink-faint leading-[1.7] tabular-nums">
          <div className="flex items-baseline gap-2">
            <span className="font-display italic text-[12px] text-ink-soft">系统</span>
            <span>
              {sysCount} 段
              {refs.length > 0 && (
                <> · 引自 {refs.join(', ')}</>
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display italic text-[12px] text-ink-soft">用户</span>
            <span>{usrCount} 段</span>
          </div>
        </div>

        {/* Foot */}
        <div
          className={[
            'mt-[14px] pt-[10px] flex items-center justify-between',
            'font-body text-[10.5px] tracking-wide lowercase',
            footerBorderClass,
          ].join(' ')}
        >
          <span className={`flex items-center gap-[6px] ${footerColorClass}`}>
            <span className={`inline-block w-[5px] h-[5px] rounded-full ${footerDotClass}`} aria-hidden="true" />
            <span>{statusText}</span>
          </span>
          <span className="text-ink-faint tabular-nums">
            {wordCount !== null ? `${wordCount.toLocaleString()} 字` : '—'}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="s"
        className="!opacity-0 !pointer-events-none"
      />
    </article>
  )
}

function estimateWords(text: string): number {
  let count = 0
  let inWord = false
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code > 0x3000) {
      count++
      inWord = false
    } else if (/\w/.test(ch)) {
      if (!inWord) { count++; inWord = true }
    } else {
      inWord = false
    }
  }
  return count
}

function areEqual(prev: NodeProps<FlowNodeType>, next: NodeProps<FlowNodeType>) {
  return (
    prev.data.label === next.data.label &&
    prev.data.systemPrompt?.length === next.data.systemPrompt?.length &&
    prev.data.userPrompt?.length === next.data.userPrompt?.length &&
    prev.data.status === next.data.status &&
    prev.data.output === next.data.output &&
    prev.data.roman === next.data.roman &&
    (prev.data.refRomans?.join(',') ?? '') === (next.data.refRomans?.join(',') ?? '') &&
    prev.selected === next.selected &&
    (prev.data as unknown as Record<string, unknown>)._deleting ===
    (next.data as unknown as Record<string, unknown>)._deleting
  )
}

export default memo(FlowNode, areEqual)
```

主要变化：
- 顶 / 尾 border + 颜色按 `visualStatus`（4 态派生）切换
- handle 合并为 `t` / `s` 单 ID + `!opacity-0`
- running 叠加：四边升级 clay + 顶 2.5px + 背景 paper-light + box-shadow 双层
- 选中外环 via `box-shadow` inline style，与 running shadow 合并
- 移除原 StatusDot 子组件（inline 一行表达）
- `status === 'error' / 'stale'` 分支已删除（本期不含）
- runningNodeId / target_nodes 直接订阅 store（保证状态机响应）

注意：areEqual 没有比较 `runningNodeId` 和 `target_nodes`，因为这些来自 store subscriber 而非 props；React 会因 useStore subscribe 触发 re-render。

- [ ] **Step 5.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。可能报 `paper-light` / `clay-deep` 等 Tailwind class 不存在 —— 这些应该在 A 期已经在 `globals.css @theme` 里定义好。如果 typecheck 不报但运行时无效，下个 Task 同问题统一处理。

- [ ] **Step 5.3: Commit**

```bash
git add packages/apps/gui/src/components/FlowNode.tsx
git commit -m "$(cat <<'EOF'
feat(gui): FlowNode 4 态视觉 + N1 光晕 + 选中外环 + handle 隐藏

派生 visualStatus（target-pending / target-completed / completed / running）
基于 runningNodeId + target_nodes + outputs；running 叠加四边升级 + 背景
paper-light + 双层 box-shadow 光晕；选中态 ink 黑 1.5px box-shadow 外环。
handle 合并为 t/s 单 ID 并完全隐藏。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: EditorPanel — 三选一菜单 + 引用上游 picker + 防环

**Files:**
- Modify: `packages/apps/gui/src/components/EditorPanel.tsx` (rewrite)

---

- [ ] **Step 6.1: 整文件重写 EditorPanel.tsx**

打开 `packages/apps/gui/src/components/EditorPanel.tsx`，整文件替换为：

```tsx
'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, toRoman } from '@/store/useStore'
import type { TextBlock, NodeDef, Workspace } from '@flowcabal/engine'

function SceneLabel({ text }: { text: string }) {
  return (
    <div className="text-center mb-6 select-none">
      <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
        <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
        {text}
        <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
      </span>
    </div>
  )
}

function canReference(ws: Workspace, currentNodeId: string, candidateId: string): boolean {
  if (candidateId === currentNodeId) return false
  const visited = new Set<string>()
  const queue = [currentNodeId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    const downs = ws.downstream.get(id) || []
    for (const d of downs) {
      if (d === candidateId) return false
      queue.push(d)
    }
  }
  return true
}

function AddMenu({ onPick, onClose, isSystem, ws, currentNodeId }: {
  onPick: (block: TextBlock) => void
  onClose: () => void
  isSystem: boolean
  ws: Workspace
  currentNodeId: string
}) {
  const [showPicker, setShowPicker] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPicker) setShowPicker(false)
        else onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose, showPicker])

  const candidates = ws.nodes.map((n, i) => ({
    node: n,
    index: i,
    canRef: canReference(ws, currentNodeId, n.id),
  }))

  return (
    <div ref={menuRef} className="absolute right-0 mt-2 z-10">
      {!showPicker && (
        <div className="bg-paper border border-rule rounded-md shadow-lift py-1 w-[160px] font-body text-[12px] text-ink">
          <button
            type="button"
            onClick={() => { onPick({ kind: 'literal', content: '' }); onClose() }}
            className="w-full text-left px-3.5 py-1.5 hover:bg-paper-deep transition-colors cursor-pointer"
          >
            — 文字
          </button>
          <button
            type="button"
            onClick={() => { onPick({ kind: 'agent-inject', hint: '' }); onClose() }}
            className="w-full text-left px-3.5 py-1.5 border-t border-rule-soft hover:bg-paper-deep transition-colors cursor-pointer"
          >
            — agent 注入
          </button>
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="w-full text-left px-3.5 py-1.5 border-t border-rule-soft hover:bg-paper-deep transition-colors cursor-pointer flex justify-between items-center text-clay-deep"
          >
            <span>— 引用上游</span>
            <span className="text-[10px] text-ink-faint">▸</span>
          </button>
        </div>
      )}
      {showPicker && (
        <RefPicker
          candidates={candidates}
          onPick={(nodeId) => {
            onPick({ kind: 'ref', nodeId })
            onClose()
          }}
          onClose={() => setShowPicker(false)}
        />
      )}
    </div>
  )
}

function RefPicker({ candidates, onPick, onClose }: {
  candidates: Array<{ node: NodeDef; index: number; canRef: boolean }>
  onPick: (nodeId: string) => void
  onClose: () => void
}) {
  const selectable = candidates.filter(c => c.canRef)
  const [focusIdx, setFocusIdx] = useState(0)

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setFocusIdx(i => Math.min(selectable.length - 1, i + 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setFocusIdx(i => Math.max(0, i - 1))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        if (selectable[focusIdx]) onPick(selectable[focusIdx].node.id)
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [focusIdx, selectable, onPick])

  if (candidates.length === 0) {
    return (
      <div className="bg-paper border border-rule rounded-md shadow-lift py-2 w-[220px] font-body text-[12px] text-ink-faint italic px-3.5">
        — 无可引用上游 —
      </div>
    )
  }

  return (
    <div className="bg-paper border border-rule rounded-md shadow-lift py-1 w-[220px] font-body text-[12px] text-ink">
      <div className="px-3.5 py-1 font-mono text-[10.5px] text-ink-faint tracking-[0.08em] border-b border-rule-soft mb-1">
        — 可引用上游 —
      </div>
      {candidates.map((c, i) => {
        const selectableIdx = selectable.indexOf(c)
        const focused = selectableIdx === focusIdx
        if (!c.canRef) {
          return (
            <div
              key={c.node.id}
              className="px-3.5 py-1.5 opacity-40 flex justify-between items-baseline cursor-not-allowed"
            >
              <span>
                <span className="text-ink-faint font-display mr-2">{toRoman(c.index + 1)}</span>
                {c.node.label}
              </span>
              <span className="font-mono text-[9px] text-ink-faint italic">会成环</span>
            </div>
          )
        }
        return (
          <button
            key={c.node.id}
            type="button"
            onClick={() => onPick(c.node.id)}
            className={[
              'w-full text-left px-3.5 py-1.5 flex justify-between items-baseline cursor-pointer transition-colors',
              focused ? 'bg-paper-deep' : 'hover:bg-paper-deep',
            ].join(' ')}
          >
            <span>
              <span className="text-clay-deep font-display mr-2">{toRoman(c.index + 1)}</span>
              {c.node.label}
            </span>
            {focused && <span className="font-mono text-[9.5px] text-ink-faint">↵</span>}
          </button>
        )
      })}
    </div>
  )
}

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const updateBlock = useStore((s) => s.updateBlock)
  const addBlock = useStore((s) => s.addBlock)
  const removeBlock = useStore((s) => s.removeBlock)

  const [addMenu, setAddMenu] = useState<{ isSystem: boolean } | null>(null)
  const [highlightKey, setHighlightKey] = useState<string | null>(null)

  const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
  if (!node || !activeWorkspace) {
    return (
      <div className="max-w-[680px] mx-auto text-center py-12">
        <p className="font-display italic text-[14.5px] text-ink-soft">— 节点未找到 —</p>
      </div>
    )
  }

  const upstreamRoman = (sourceId: string): string => {
    const i = activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === sourceId)
    return i >= 0 ? toRoman(i + 1) : '—'
  }
  const upstreamLabel = (sourceId: string): string => {
    const n = activeWorkspace.nodes.find((n: NodeDef) => n.id === sourceId)
    return n?.label || sourceId
  }

  const handleAdd = useCallback((block: TextBlock, isSystem: boolean) => {
    const blocks = isSystem ? node.systemPrompt : node.userPrompt
    const nextIndex = blocks.length
    const key = `${isSystem ? 'sys' : 'usr'}-${nextIndex}`
    addBlock(nodeId, block, isSystem)
    setHighlightKey(key)
    setTimeout(() => setHighlightKey(k => k === key ? null : k), 800)
  }, [addBlock, nodeId, node.systemPrompt, node.userPrompt])

  const renderBlock = (block: TextBlock, i: number, isSystem: boolean) => {
    const key = `${isSystem ? 'sys' : 'usr'}-${i}`
    const highlighted = highlightKey === key
    const kindLabel =
      block.kind === 'ref'
        ? `ref → ${upstreamRoman(block.nodeId)}`
        : block.kind
    return (
      <div
        key={i}
        className={[
          'bg-paper-deep border border-rule rounded-md mb-3 last:mb-0 transition-colors duration-[600ms] ease-out',
          highlighted ? '!border-t-[1.5px] !border-t-clay-deep' : '',
        ].join(' ')}
      >
        <div className="px-4 py-2 border-b border-rule-soft flex items-baseline justify-between">
          <span className="font-mono text-[11px] text-ink-faint tracking-wide lowercase">
            {i + 1} · {kindLabel}
          </span>
          <button
            type="button"
            onClick={() => removeBlock(nodeId, isSystem, i)}
            className="font-display text-[16px] leading-none text-ink-faint hover:text-error transition-colors cursor-pointer"
            aria-label="删除段落"
          >
            ×
          </button>
        </div>
        <div className="px-4 py-3">
          {block.kind === 'literal' && (
            <textarea
              defaultValue={block.content}
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: e.target.value })}
              className="block w-full bg-transparent outline-none resize-none border-0 font-display text-[15px] text-ink leading-[1.65] min-h-[80px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
          {block.kind === 'agent-inject' && (
            <textarea
              defaultValue={block.hint}
              placeholder="向 agent 描述要注入的内容…"
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })}
              className="block w-full bg-transparent outline-none resize-none border-0 font-display italic text-[14.5px] text-ink-soft leading-[1.65] min-h-[60px] placeholder:text-ink-faint placeholder:italic"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
          {block.kind === 'ref' && (
            <div className="font-display italic text-[14.5px] text-ink-soft leading-[1.65]">
              引自 {upstreamRoman(block.nodeId)} · {upstreamLabel(block.nodeId)}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[680px] mx-auto flex flex-col gap-12">
      <section>
        <SceneLabel text="system prompt" />
        <div>
          {node.systemPrompt.map((b, i) => renderBlock(b, i, true))}
        </div>
        <div className="mt-3 text-right relative">
          <button
            type="button"
            onClick={() => setAddMenu({ isSystem: true })}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
          {addMenu?.isSystem && (
            <AddMenu
              isSystem={true}
              ws={activeWorkspace}
              currentNodeId={nodeId}
              onPick={(block) => handleAdd(block, true)}
              onClose={() => setAddMenu(null)}
            />
          )}
        </div>
      </section>

      <section>
        <SceneLabel text="user prompt" />
        <div>
          {node.userPrompt.map((b, i) => renderBlock(b, i, false))}
        </div>
        <div className="mt-3 text-right relative">
          <button
            type="button"
            onClick={() => setAddMenu({ isSystem: false })}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
          {addMenu && !addMenu.isSystem && (
            <AddMenu
              isSystem={false}
              ws={activeWorkspace}
              currentNodeId={nodeId}
              onPick={(block) => handleAdd(block, false)}
              onClose={() => setAddMenu(null)}
            />
          )}
        </div>
      </section>
    </div>
  )
}
```

主要变化：
- 顶部新增 `canReference()` 防环算法（BFS downstream）
- 新增 `AddMenu`（一级三选一） + `RefPicker`（二级 picker，含局部键盘）
- 新插入 block 经 `highlightKey` 控制 800ms 顶部 1.5px clay 描边后通过 `transition-colors duration-[600ms]` 淡回

- [ ] **Step 6.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。

- [ ] **Step 6.3: Commit**

```bash
git add packages/apps/gui/src/components/EditorPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): EditorPanel 三选一菜单 + 引用上游 picker + 防环

「+ 添加段落」点开一级菜单（文字 / agent / 引用上游）；
引用上游 hover 弹二级 picker，列可引用上游 + 灰显「会成环」节点；
局部键盘（方向键 + Enter + Esc）；新插入 block 800ms 顶描边高亮。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: RunButton — A 风格重画 + dag 进度

**Files:**
- Modify: `packages/apps/gui/src/components/RunButton.tsx` (rewrite)

---

- [ ] **Step 7.1: 整文件重写 RunButton.tsx**

打开 `packages/apps/gui/src/components/RunButton.tsx`，整文件替换为：

```tsx
'use client'
import { useCallback } from 'react'
import { useStore, todoListCount, toRoman } from '@/store/useStore'

export function RunButton() {
  const runAll = useStore((s) => s.runAll)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const dagProgress = useStore((s) => s.dagProgress)
  const runningNodeId = useStore((s) => s.runningNodeId)
  const nodes = useStore((s) => s.nodes)

  const isRunning = dagProgress !== null
  const count = activeWorkspace ? todoListCount(activeWorkspace) : 0
  const disabled = isRunning || !activeWorkspace || count === 0

  const handleRun = useCallback(() => {
    if (!disabled) runAll()
  }, [runAll, disabled])

  // running 态：找当前 running 节点的 Roman + label
  let runningRoman = '—'
  let runningLabel = ''
  if (runningNodeId && activeWorkspace) {
    const idx = activeWorkspace.nodes.findIndex((n) => n.id === runningNodeId)
    if (idx >= 0) {
      runningRoman = toRoman(idx + 1)
      runningLabel = activeWorkspace.nodes[idx].label
    }
  }

  const progressPct = dagProgress
    ? Math.round((dagProgress.current / Math.max(1, dagProgress.total)) * 100)
    : 0

  if (isRunning) {
    return (
      <div
        className="fixed bottom-6 right-6 z-10 bg-white border border-rule rounded-md shadow-paper min-w-[260px] px-6 py-3.5 select-none"
      >
        <div className="flex justify-between items-baseline mb-1.5">
          <span className="font-display italic text-[14px] text-clay-deep">正在生成</span>
          <span className="font-mono text-[11px] text-ink-faint tabular-nums">
            {dagProgress.current} / {dagProgress.total}
          </span>
        </div>
        <div className="font-display text-[14px] text-ink mb-2.5">
          <span className="text-clay-deep mr-2">{runningRoman}</span>
          {runningLabel || '— —'}
        </div>
        <div className="h-[2px] bg-rule-soft rounded-[1px] overflow-hidden">
          <div
            className="h-full bg-clay-deep transition-all duration-200 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={handleRun}
      disabled={disabled}
      className={[
        'fixed bottom-6 right-6 z-10 bg-white border border-rule rounded-md shadow-paper px-7 py-3.5',
        'flex items-baseline gap-2.5 select-none',
        disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-paper-deep cursor-pointer',
        'transition-colors duration-150',
      ].join(' ')}
    >
      <span className="font-display italic text-[16px] text-clay-deep">Run</span>
      <span className="text-rule">·</span>
      <span className="font-body text-[11px] text-ink-faint">
        {count === 0 ? '暂无待跑' : `${count} 节点待跑`}
      </span>
    </button>
  )
}
```

主要变化：
- 移除 shadcn Button / Spinner / lucide Play 依赖（直接 `<button>` 或 `<div>`）
- idle：纸张 button，「Run · N 节点待跑」单行
- running：多行展开，顶行「正在生成 / N / M」、中行 Roman + 标题、底行 2px 进度条
- count 用 `todoListCount(activeWorkspace)` 派生
- 进度宽度由 `dagProgress.current / total * 100%`

- [ ] **Step 7.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。

- [ ] **Step 7.3: Commit**

```bash
git add packages/apps/gui/src/components/RunButton.tsx
git commit -m "$(cat <<'EOF'
feat(gui): RunButton 重画为纸张 button + dag 进度

idle 「Run · N 节点待跑」单行；running 多行展开（标题 / Roman+label / 2px 进度条）。
移除 shadcn Button / Spinner / lucide Play 依赖。
count 与 progress 全由 store 派生（todoListCount + dagProgress）。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: OutputsPanel — running 态流式渲染

**Files:**
- Modify: `packages/apps/gui/src/components/OutputsPanel.tsx` (rewrite)

---

- [ ] **Step 8.1: 整文件重写 OutputsPanel.tsx**

打开 `packages/apps/gui/src/components/OutputsPanel.tsx`，整文件替换为：

```tsx
'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore, toRoman } from '@/store/useStore'
import type { NodeDef } from '@flowcabal/engine'

function estimateWords(text: string): number {
  let count = 0
  let inWord = false
  for (const ch of text) {
    const code = ch.charCodeAt(0)
    if (code > 0x3000) {
      count++
      inWord = false
    } else if (/\w/.test(ch)) {
      if (!inWord) { count++; inWord = true }
    } else {
      inWord = false
    }
  }
  return count
}

export function OutputsPanel() {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const runningNodeId = useStore((s) => s.runningNodeId)
  const runningOutput = useStore((s) => s.runningOutput)
  const [copied, setCopied] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)

  if (!selectedNodeId || !activeWorkspace) {
    return (
      <div className="max-w-[680px] mx-auto text-center py-12">
        <p className="font-display italic text-[14.5px] text-ink-soft">— 未选择节点 —</p>
      </div>
    )
  }

  const idx = activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === selectedNodeId)
  const node = idx >= 0 ? activeWorkspace.nodes[idx] : null
  const roman = idx >= 0 ? toRoman(idx + 1) : '—'

  const isRunning = runningNodeId === selectedNodeId
  const runningChunks = runningOutput.get(selectedNodeId) ?? ''
  const output = activeWorkspace.outputs.get(selectedNodeId) ?? null

  // running 态：auto-scroll
  useEffect(() => {
    if (isRunning && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [isRunning, runningChunks])

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [output])

  // ── running 态 ──
  if (isRunning) {
    return (
      <div className="max-w-[680px] mx-auto" ref={scrollRef}>
        <div className="text-center mb-3 select-none">
          <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
            <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
            output · {roman} · 正在生成
            <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
          </span>
        </div>
        <div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
          {runningChunks}
        </div>
        <div className="text-center mt-6 font-display italic text-[14.5px] text-ink-soft">
          — 正在生成 —
        </div>
      </div>
    )
  }

  // ── pending / completed 态 ──
  const status = output ? 'completed' : 'pending'
  const statusLabel = status === 'completed' ? 'completed' : 'pending'
  const wordCount = output ? estimateWords(output) : 0

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="text-center mb-3 select-none">
        <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
          <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
          output · {roman} · {node?.label || '未知节点'}
          <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
        </span>
      </div>

      <div className="text-center mb-8 flex items-baseline justify-center gap-3 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
        <span>{statusLabel}</span>
        {output && (
          <>
            <span className="text-rule">·</span>
            <span className="tabular-nums">{wordCount.toLocaleString()} 字</span>
            <span className="text-rule">·</span>
            <button
              type="button"
              onClick={handleCopy}
              className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer normal-case tracking-normal"
            >
              {copied ? '已复制 ✓' : '复制 ↗'}
            </button>
          </>
        )}
      </div>

      {output ? (
        <>
          <div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
            {output}
          </div>
          <div className="text-center mt-12 font-mono text-[12px] text-ink-faint tracking-[0.6em] select-none">
            ·  ·  ·
          </div>
        </>
      ) : (
        <div className="text-center mt-12 font-display italic text-[14.5px] text-ink-soft">
          — 此节点尚未付印 —
        </div>
      )}
    </div>
  )
}
```

主要变化：
- 新增 `isRunning` 派生 + `runningChunks` 读取
- running 分支：scene label「output · Roman · 正在生成」+ 流式字符 + 底部「— 正在生成 —」斜体
- 流式渲染靠 store re-render（每次 node-token 事件 store 改变 → React 自然 re-render → 文本拼接增长）
- auto-scroll 通过 `useEffect` 监听 `runningChunks` length 变化滑到底
- A 期定下的 pending / completed 视觉完全保留

- [ ] **Step 8.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: PASS。

- [ ] **Step 8.3: Commit**

```bash
git add packages/apps/gui/src/components/OutputsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): OutputsPanel 新增 running 态 + 流式 token 渲染

isRunning 时显示 scene label「output · Roman · 正在生成」+ 累积 chunks
+ 底部 — 正在生成 — 斜体；auto-scroll 跟着 chunks 增长滑到底。
pending / completed 态保留 A 期视觉。

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: 全栈 typecheck + 手动验收 checklist

**Files:** 无（验收阶段）

---

- [ ] **Step 9.1: 全栈 typecheck**

Run from repo root:
```bash
bun run typecheck:gui && bun run typecheck
```

Expected: 两条全 PASS。

如果 fail，对照报错文件 + Task 修复。

- [ ] **Step 9.2: 列 commit 链做最终自检**

Run from repo root:
```bash
git log --oneline -12
```

Expected: 看到本期 8 个 feat / docs commit + Task 9 之前的状态。

- [ ] **Step 9.3: 提示用户手动验收**

这一步由 **用户** 在浏览器执行，不是 executor。告诉用户：

> 现在请在终端运行 `bun dev`，然后在浏览器打开 `http://localhost:3000` 逐项验收下面的 checklist。

**手动验收 checklist**：

**节点状态视觉（C 核心）**
- [ ] 新建节点：顶部 1.5px clay 实线 + 尾栏「待运行」红字 + 红圆点
- [ ] 跑完节点：顶部 1px rule 灰 + 尾栏「completed · N 字」黑点 + 灰字
- [ ] 右键 completed 节点 → 「加入 target」→ 顶部立即变回 1.5px clay 实线 + 尾栏「待重跑」红字
- [ ] 节点运行中：四边升级 clay 1.5px + 顶 2.5px + 背景微亮 + 外环柔光
- [ ] 选中节点：ink 黑 1.5px 外环（box-shadow），跟以上 4 态都正交叠加

**连线 / handle / edge（B + C）**
- [ ] 节点上下不再有 handle 圆点（完全看不见）
- [ ] 把鼠标拖到节点边缘**不能**拖出连线（nodesConnectable=false）
- [ ] edge：上游端 16px clay-deep 短横 + 1px rule 灰直线 + 接入下游前留 8px 空白

**交互 / 选中（B + D）**
- [ ] 单击节点 → 选中并开 FloatingPanel
- [ ] shift+click 第二个节点 → 抽屉自动关 + 两个节点都显示 ink 外环
- [ ] cmd+click 已选节点 → 取消选中
- [ ] shift+drag 空白 → 框选（xyflow 默认）
- [ ] Backspace / Delete **不再删节点**（暂关）
- [ ] 右键单节点：菜单显示 重命名 / 删除 / 加入 target（如果不在 target）
- [ ] 右键多选节点：菜单显示 加入 target（如果有不在的）/ 删除 N 个节点

**EditorPanel（B + D）**
- [ ] 「+ 添加段落」点开 → 三项菜单（文字 / agent 注入 / 引用上游 ▸）
- [ ] hover「引用上游」→ 二级 picker 弹出，列可引用上游 + 会成环的节点灰显
- [ ] picker 内 ↑↓ 移焦点（跳过会成环项）+ Enter 确认 + Esc 关
- [ ] 选中后 picker 关，新 ref block 出现在末尾，顶 1.5px clay 高亮 800ms 后淡回
- [ ] 「重命名」右键项 → FloatingPanel 抽屉打开（如果没开）且立即进入 label inline 编辑模式（光标在 input 内，文字全选）

**运行 / 流式（E）**
- [ ] 点 RunButton 触发 runAll
- [ ] RunButton 切换到 running 多行视图：标题 / Roman+label / 进度条
- [ ] 跑每个节点时，节点视觉变 N1 光晕 + FloatingPanel 打开（点选）看 OutputsPanel 显示「— output · Roman · 正在生成 —」+ 字逐渐浮现 + 底部「— 正在生成 —」斜体
- [ ] 每个节点跑完，RunButton 进度条增长 + 该节点变 completed
- [ ] 全部跑完 RunButton 回到 idle 态

**回归（A 期内容不破坏）**
- [ ] /memory 页面正常 + memory chat 流式正常
- [ ] /manuscripts 页面正常 + 文件列表显示
- [ ] Header 导航：memory · manuscripts · ⋯ · 付印 不变
- [ ] SettingsDialog 正常打开 + LLM 配置增删改可用
- [ ] Toast 视觉跟 A 期一致（paper 底 + display 衬线）
- [ ] 全程 console 无 error / warn

**CLI 兼容（关键回归）**
- [ ] 在终端跑 `bun packages/cli/src/index.ts run <workspaceId>` 正常工作（CLI 用旧 runAll 接口）

- [ ] **Step 9.4: 验收通过 → 报完成；不通过 → 列具体 fail 项报告**

如果所有 checklist 通过：报「BCDE 期完成」+ commit 链总长度（应该是 8 个 feat commit + 本 docs spec 一个）。

如果任一 fail：列具体 fail 项 + 反推哪个 Task 出问题 + 提交 fix commit。
