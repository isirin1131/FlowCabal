# 右键 toggle target + Output markdown 渲染 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) 节点右键改成直接 toggle target，DAG 跑步态拦下；ContextMenuPanel 精简到只剩 pane 单项菜单；删除节点入口迁到 FloatingPanel 底栏。(2) 抽 `<Prose>` 到 `components/Prose.tsx`，memory + OutputsPanel 共用，drop cap 由 `first` prop 控制。

**Architecture:** API 单端点 `POST /target` 支持可选 `op: 'add' | 'toggle'`，缺省 `'add'` 不动 `addToTarget`。store 加 `toggleTarget` action 与现有 `addToTarget` 并列。Canvas `onNodeContextMenu` 不再调 `selectNode` / `setContextMenu`，直接 toggle。Prose 抽到独立组件，memory 改 import，OutputsPanel 复用。

**Tech Stack:** Bun + TypeScript, Next 16 Turbopack + React 19 (GUI), Zustand 4.x (state), sonner (toast), react-markdown 10.x + remark-gfm 4.x (markdown), Tailwind v4 (style)。

参考 spec：`docs/superpowers/specs/2026-05-25-right-click-toggle-and-output-markdown-design.md`。

---

## File Structure

**修改文件**：

| 文件 | 改动概述 |
|---|---|
| `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts` | POST handler 加 op 分支 |
| `packages/apps/gui/src/store/useStore.ts` | 加 `toggleTarget` 类型 + `internal_toggleTarget` 方法 + factory wrapper |
| `packages/apps/gui/src/components/Canvas.tsx` | 加 sonner import；`onNodeContextMenu` 改 toggle；`ContextMenuPanel` 精简到只剩 pane 分支 |
| `packages/apps/gui/src/components/FloatingPanel.tsx` | 底栏改 flex，右侧加「删除节点」 |
| `packages/apps/gui/src/app/memory/page.tsx` | 删 inline `Prose`，改 `import { Prose } from '@/components/Prose'` |
| `packages/apps/gui/src/components/OutputsPanel.tsx` | 加 Prose import；running + completed 正文用 `<Prose>` 替换原 div |

**新建文件**：

| 文件 | 责任 |
|---|---|
| `packages/apps/gui/src/components/Prose.tsx` | 抽自 memory/page.tsx:32-40 的 `<Prose>` 公共组件 |

**不动**：
- engine 任何文件（无 schema / 文件 IO 变化）
- cli（与 engine 无关）
- 其他 GUI component（FlowNode / EditorPanel / Header / RunButton 等不受影响）

---

## Task 1: API `POST /target` 加 `op` 字段

**Files:**
- Modify: `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts`

- [ ] **Step 1: 整文件替换为新 handler**

打开 `packages/apps/gui/src/app/api/workspaces/[id]/target/route.ts`，整文件替换为：

```typescript
import { NextResponse } from 'next/server'
import { readWorkspace, writeWorkspace } from '@flowcabal/engine'
import { workspaceToRecord } from '@/lib/serialization'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: workspaceId } = await params
  const { nodeId, op } = await request.json() as { nodeId: string; op?: 'add' | 'toggle' }
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, workspaceId)
  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
  }
  const has = workspace.target_nodes.includes(nodeId)
  if (op === 'toggle') {
    if (has) workspace.target_nodes = workspace.target_nodes.filter(id => id !== nodeId)
    else workspace.target_nodes.push(nodeId)
  } else {
    if (!has) workspace.target_nodes.push(nodeId)
  }
  writeWorkspace(projectDir, workspaceId, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}
```

- [ ] **Step 2: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 3: 启 dev server**

Run: `bun run dev`（保持运行；后续 Task 验证都依赖它）

等 `Ready in <ms>` 出现后打开新终端继续。

- [ ] **Step 4: cURL 验证 add（缺省 op）**

先准备一个 workspace 用于测试。如果没有，去 GUI 创建一个、加 2 个节点 A 和 B，记下 workspace id（GUI Header 或浏览器 devtools 看 `/api/workspaces` 响应）。

记录 nodeA / nodeB / wsId。后续命令用这三个变量：

```bash
WS=<your-workspace-id>
A=<node-a-id>
B=<node-b-id>

# 1. add 缺省 op：把 A 加进 target
curl -s -X POST "http://localhost:3000/api/workspaces/$WS/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$A\"}" | jq '.workspace.target_nodes'
# Expected: 数组包含 A
```

- [ ] **Step 5: cURL 验证 op=add 显式**

```bash
# 显式 op=add，B 加进 target
curl -s -X POST "http://localhost:3000/api/workspaces/$WS/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$B\",\"op\":\"add\"}" | jq '.workspace.target_nodes'
# Expected: 数组包含 A 和 B

# 再调一次 add A（已在）— 不重复
curl -s -X POST "http://localhost:3000/api/workspaces/$WS/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$A\",\"op\":\"add\"}" | jq '.workspace.target_nodes'
# Expected: 数组仍只含 A 和 B 各一次
```

- [ ] **Step 6: cURL 验证 op=toggle（移出）**

```bash
# toggle A（已在）→ 移出
curl -s -X POST "http://localhost:3000/api/workspaces/$WS/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$A\",\"op\":\"toggle\"}" | jq '.workspace.target_nodes'
# Expected: 数组只剩 B
```

- [ ] **Step 7: cURL 验证 op=toggle（加入）**

```bash
# toggle A（不在）→ 加入
curl -s -X POST "http://localhost:3000/api/workspaces/$WS/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$A\",\"op\":\"toggle\"}" | jq '.workspace.target_nodes'
# Expected: 数组含 A 和 B
```

- [ ] **Step 8: cURL 验证 404 兜底**

```bash
curl -s -X POST "http://localhost:3000/api/workspaces/no-such-ws/target" \
  -H 'Content-Type: application/json' \
  -d "{\"nodeId\":\"$A\",\"op\":\"toggle\"}" -w "\nHTTP %{http_code}\n"
# Expected: {"error":"Workspace not found"}, HTTP 404
```

- [ ] **Step 9: Commit**

```bash
git add packages/apps/gui/src/app/api/workspaces/\[id\]/target/route.ts
git commit -m "$(cat <<'EOF'
feat(gui/api): target POST 加 op?: 'add' | 'toggle'

- 缺省 op='add'：保持现有 addToTarget 链路完全兼容
- op='toggle'：在 target 内移出，不在则加入
- 单端点单调用完成 toggle，前端无需先 GET 后判断

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: store 加 `toggleTarget` action

**Files:**
- Modify: `packages/apps/gui/src/store/useStore.ts`

- [ ] **Step 1: 加类型签名**

打开 `packages/apps/gui/src/store/useStore.ts`，找到 line 30：

```typescript
  addToTarget: (nodeId: string) => Promise<void>
```

下面紧跟着加一行：

```typescript
  toggleTarget: (nodeId: string) => Promise<void>
```

最终 GuiState 那段应该是：

```typescript
  addToTarget: (nodeId: string) => Promise<void>
  toggleTarget: (nodeId: string) => Promise<void>
```

- [ ] **Step 2: 加 internal_toggleTarget 方法**

找到 line 526 的 `internal_addToTarget` 方法定义。在它的结束 `}` 下面（line 547 后面）加：

```typescript
  internal_toggleTarget = async (nodeId: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    const wasInTarget = ws.target_nodes.includes(nodeId)
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nodeId, op: 'toggle' }),
      })
      const data = await res.json()
      if (data.workspace) {
        const updatedWs = recordToWorkspace(data.workspace)
        this.#set((s: any) => ({
          workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
        }))
        toast.success(wasInTarget ? '已移出运行目标' : '已加入运行目标')
      }
    } catch {
      toast.error('操作失败')
    }
  }
```

- [ ] **Step 3: factory 末尾加 wrapper**

找到 line 579：

```typescript
    addToTarget: (nodeId: string) => actions.internal_addToTarget(nodeId),
```

紧跟着加：

```typescript
    toggleTarget: (nodeId: string) => actions.internal_toggleTarget(nodeId),
```

- [ ] **Step 4: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 5: Commit**

```bash
git add packages/apps/gui/src/store/useStore.ts
git commit -m "$(cat <<'EOF'
feat(gui/store): 加 toggleTarget action

- 模仿 internal_addToTarget 结构
- wasInTarget 在 fetch 前快照本地状态决定 toast 文案
- API 调用带 op: 'toggle'；addToTarget 不动保持现有 StaleTooltip / ErrorTooltip 路径

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Canvas onNodeContextMenu + ContextMenuPanel 精简

**Files:**
- Modify: `packages/apps/gui/src/components/Canvas.tsx`

- [ ] **Step 1: 加 sonner import**

打开 `packages/apps/gui/src/components/Canvas.tsx`。

在 line 18 的 `import { getLayoutedElements } from '@/lib/engine-to-flow'` 下面加：

```typescript
import { toast } from 'sonner'
```

- [ ] **Step 2: 替换 ContextMenuPanel 整段**

找到 line 23 的 `function ContextMenuPanel({ x, y, nodeId, selectedIds, onClose }`，整段替换（含原来到 line 118 的所有内容）为：

```tsx
function ContextMenuPanel({ x, y, nodeId, onClose }: {
  x: number
  y: number
  nodeId: string | null
  onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
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

  if (nodeId !== null) return null  // 节点不再走菜单；防回归挡板

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-paper border border-rule rounded-md shadow-lift py-1 animate-slide-in font-body text-[13px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-left px-3 py-1.5 cursor-pointer transition-colors duration-150 hover:bg-clay-faint text-ink hover:text-clay-deep"
        onClick={() => { createNode(`节点 ${nanoid(4)}`); onClose() }}
      >
        添加节点
      </button>
    </div>
  )
}
```

注意：原 `selectedIds: Set<string>` 参数 + 整个 `if (nodeId === null) ... else ...` 复杂分支已全部删除；只留 pane 单项「添加节点」。

- [ ] **Step 3: CanvasInner 加 dagProgress / toggleTarget selectors**

找到 `function CanvasInner()` 内的 useStore selectors（约 line 179-186）。

在 `const createNode = useStore((s) => s.createNode)` 那行（约 line 186）下面加：

```typescript
  const dagProgress = useStore((s) => s.dagProgress)
  const toggleTarget = useStore((s) => s.toggleTarget)
```

- [ ] **Step 4: 重写 onNodeContextMenu**

找到 `onNodeContextMenu` 定义（约 line 211-216）：

```typescript
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    // 如果右键的节点不在选中集，先单选它（避免在 ContextMenuPanel 渲染中 setState）
    if (!selectedNodeIds.has(node.id)) selectNode(node.id)
    setContextMenu({ x: event.clientX - 10, y: event.clientY - 10, nodeId: node.id })
  }, [selectedNodeIds, selectNode])
```

整段替换为：

```typescript
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    if (dagProgress !== null) {
      toast.warning('运行中无法修改 target')
      return
    }
    toggleTarget(node.id)
  }, [dagProgress, toggleTarget])
```

- [ ] **Step 5: 调用点去掉 selectedIds prop**

找到 ContextMenuPanel 调用点（约 line 257-265）：

```tsx
      {contextMenu && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          selectedIds={selectedNodeIds}
          onClose={() => setContextMenu(null)}
        />
      )}
```

把 `selectedIds={selectedNodeIds}` 那行删掉。最终：

```tsx
      {contextMenu && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}
```

- [ ] **Step 6: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 7: 浏览器手工验证（核心交互）**

dev server 仍在跑。打开 `http://localhost:3000`。准备一个含 ≥ 2 个节点的 workspace。

按顺序验证：

1. **右键未在 target 的节点** → 节点顶描边变深红（`clay-deep`，1.5px），状态文字变 "待运行"（无 output 时）或 "待重跑"（有 output 时）；右下 toast 提示 "已加入运行目标"；**编辑器没开**
2. **再右键同一节点** → 顶描边变回 1px rule，状态文字 "completed"；toast "已移出运行目标"
3. **连续右键 5 次** → 加入 / 移出正确翻转 5 次，每次有对应 toast
4. **左键点节点** → FloatingPanel 编辑器**正常打开**（左键路径不受影响）
5. **shift+左键** 选中 3 个节点（顶部出现选中外环）→ 右键其中一个 → **只**那个 toggle，其他两个仍选中且 target 状态不变
6. **空白处右键** → 弹「添加节点」单项菜单；点它创建新节点；按 Esc 或点别处关闭

若任一步与预期不符，检查 Step 4 的 `onNodeContextMenu` 是否漏改、检查 `dagProgress` selector 是否拼错。

- [ ] **Step 8: 浏览器验证 running 拦截**

继续在浏览器：

7. 把一个节点加进 target（右键加入）
8. 点 RunButton 开始跑 DAG
9. **跑步中右键任意节点** → toast.warning "运行中无法修改 target"；视觉无变化
10. 等 DAG 跑完（toast 「跑完 N 个节点」）→ 再右键节点 → 恢复正常 toggle

- [ ] **Step 9: Commit**

```bash
git add packages/apps/gui/src/components/Canvas.tsx
git commit -m "$(cat <<'EOF'
feat(gui/canvas): 节点右键改成直接 toggle target

- onNodeContextMenu 不再调 selectNode / setContextMenu（编辑器不再误开、菜单不再误显）
- dagProgress !== null 时 toast.warning 拦下；其他时 toggleTarget
- ContextMenuPanel 精简到只剩 pane 单项「添加节点」；删 selectedIds 参数和 node 分支
- 选中状态不再被右键修改（左键路径完全独立）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: FloatingPanel 底栏「删除节点」按钮

**Files:**
- Modify: `packages/apps/gui/src/components/FloatingPanel.tsx`

- [ ] **Step 1: 加 deleteNode selector**

打开 `packages/apps/gui/src/components/FloatingPanel.tsx`。

找到 line 16 的 `const renameNode = useStore((s) => s.renameNode)`，在它下面加：

```typescript
  const deleteNode = useStore((s) => s.deleteNode)
```

- [ ] **Step 2: 替换底栏**

找到底部的 mono id 段（约 line 147-149）：

```tsx
        {/* 底部 mono id */}
        <div className="shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
          id: {nodeId || '—'}
        </div>
```

整段替换为：

```tsx
        {/* 底部 mono id + 删除节点 */}
        <div className="shrink-0 px-7 py-3 border-t border-rule-soft flex items-center justify-between">
          <span className="font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
            id: {nodeId || '—'}
          </span>
          {nodeId && (
            <button
              type="button"
              onClick={() => {
                deleteNode(nodeId)
                onOpenChange(false)
              }}
              className="font-display italic text-[12.5px] text-error hover:opacity-80 transition-opacity cursor-pointer shrink-0 ml-3"
            >
              删除节点
            </button>
          )}
        </div>
```

- [ ] **Step 3: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 4: 浏览器手工验证**

dev server 仍在跑。打开 GUI，准备一个含 ≥ 2 个节点的 workspace（其中 A→B 有 ref 关系最佳，能验证下游处理）。

1. **左键 A 节点** → FloatingPanel 打开，editor tab 内容正常
2. **底栏右侧** 看到红色 italic「删除节点」链接（与左侧 `id: xxx` 同行）
3. **悬停「删除节点」** → 透明度变化
4. **点「删除节点」** → 节点 A 从画布消失；FloatingPanel 关闭；如果 B 引用了 A，B 的 EditorPanel 会显示对应 stale / 引用错误（旧路径处理）
5. **再左键 B 节点** → 面板打开，底栏仍能看到「删除节点」（针对 B）
6. **没有左键任何节点（panel 关闭状态）** → 底栏自然不可见，按钮也不可见

- [ ] **Step 5: Commit**

```bash
git add packages/apps/gui/src/components/FloatingPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui/floating-panel): 底栏右侧加「删除节点」按钮

- 红色 italic 文本按钮，与左侧 mono id 同行 flex justify-between
- 点击 deleteNode + onOpenChange(false) 关面板
- nodeId 为 null 时按钮不渲染（兜底）
- 不弹二次确认（与项目现有 delete 一致）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Prose 抽取到公共组件

**Files:**
- Create: `packages/apps/gui/src/components/Prose.tsx`
- Modify: `packages/apps/gui/src/app/memory/page.tsx`

- [ ] **Step 1: 新建 Prose.tsx**

创建 `packages/apps/gui/src/components/Prose.tsx`：

```tsx
'use client'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function Prose({ children, first }: { children: string; first?: boolean }) {
  return (
    <div className={`fc-prose font-display text-[16px] leading-[1.7] text-ink ${first ? 'fc-prose-first' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

- [ ] **Step 2: 改 memory/page.tsx imports**

打开 `packages/apps/gui/src/app/memory/page.tsx`。

找到 line 3-4：

```tsx
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
```

整两行删除。

在 line 2 的 `import { useState, useRef, useCallback, useEffect } from 'react'` 后面（紧跟其下）加：

```tsx
import { Prose } from '@/components/Prose'
```

import block 顶部最终应大致是：

```tsx
'use client'
import { useState, useRef, useCallback, useEffect } from 'react'
import { Prose } from '@/components/Prose'
import type { MemoryStreamChunk } from '@flowcabal/engine'
import {
  isPersistenceAvailable,
  ...
} from '@/lib/memory-db'
```

- [ ] **Step 3: 删 inline Prose 函数**

在同文件中找到 line 32-40（注释行 28-31 也一并清理）：

```tsx
// ───────────────────────────────────────────────────────────────
//  Markdown 渲染（助手消息正文）
//  display serif 16px / 行高 1.7，首段 drop cap 由 .fc-prose-first 接管
// ───────────────────────────────────────────────────────────────
function Prose({ children, first }: { children: string; first?: boolean }) {
  return (
    <div className={`fc-prose font-display text-[16px] leading-[1.7] text-ink ${first ? 'fc-prose-first' : ''}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  )
}
```

整段（包括 4 行注释）删除。

- [ ] **Step 4: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 5: 浏览器手工验证 memory 回归**

dev server 仍在跑。打开 `http://localhost:3000/memory`。

1. **新建对话** → 输入 `# 标题\n\n这是 **粗体** 测试。\n\n- 列表项 1\n- 列表项 2` → 回车发送
2. **等待 LLM 返回** → 第一条助手消息回来后，第一段**仍带 56px clay drop cap**（与改前一致）
3. **继续问** → 助手第二条消息的第一段也带 drop cap
4. **段内 `**粗体**`、`# 标题`、列表都正确渲染**（与改前一致）

若 drop cap 没了，检查 memory/page.tsx 里 `<Prose>` 调用是否仍传 `first={isFirstText}`（line ~980）；这一行不应该被本期改动碰过。

- [ ] **Step 6: Commit**

```bash
git add packages/apps/gui/src/components/Prose.tsx packages/apps/gui/src/app/memory/page.tsx
git commit -m "$(cat <<'EOF'
refactor(gui): Prose 抽到 components/Prose.tsx 公共组件

- 字符级 1:1 平移 memory/page.tsx 内 inline Prose
- memory 改 import @/components/Prose，删 react-markdown / remark-gfm 直接 import
- drop cap 仍由 first prop 控制；CSS 不动

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: OutputsPanel 用 `<Prose>` 渲染输出

**Files:**
- Modify: `packages/apps/gui/src/components/OutputsPanel.tsx`

- [ ] **Step 1: 加 Prose import**

打开 `packages/apps/gui/src/components/OutputsPanel.tsx`。

在 line 3 的 `import { useStore, toRoman } from '@/store/useStore'` 后面（紧跟其下）加：

```tsx
import { Prose } from './Prose'
```

- [ ] **Step 2: 替换 running 态正文**

找到 line 76-78：

```tsx
        <div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
          {runningChunks}
        </div>
```

整段替换为：

```tsx
        <Prose>{runningChunks}</Prose>
```

- [ ] **Step 3: 替换 completed 态正文**

找到 line 121-123（在 `{output ? (` 之后）：

```tsx
          <div className="font-display text-[16px] leading-[1.7] text-ink whitespace-pre-wrap break-words">
            {output}
          </div>
```

整段替换为：

```tsx
          <Prose>{output}</Prose>
```

- [ ] **Step 4: typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

- [ ] **Step 5: 浏览器手工验证 markdown 渲染**

dev server 仍在跑。需要有 LLM 配置可用（如果还没，去 settings 配一个），且工作区里有节点。

1. **造一个 markdown-rich 输出节点**：节点 `userPrompt` 写「请输出一段含 # 标题、**粗体**、- 列表、行内 `code`、和 ```代码块``` 的中文示例」
2. **加进 target → 跑 DAG**
3. **跑步中**切到 output tab → partial markdown **实时渲染**（不再是 `whitespace-pre-wrap` 文本）
4. **跑完后** output tab → 完整 markdown 排版：
   - `# 标题` → 22px display 字体加粗
   - `**粗体**` → 加粗 ink
   - `- 列表` → 左侧 clay `·` 标记
   - 行内 `` `code` `` → mono + 浅底
   - ``` ```代码块``` ``` → mono + paper-deep 背景 + rule 边
5. **output 区**无 drop cap（首字不应该有 56px 大字）
6. **复制按钮**仍工作（点「复制 ↗」拷出原始 markdown 文本）

若 drop cap 出现了，检查 OutputsPanel 里 `<Prose>` 调用是否误传了 `first` prop（应该不传）。

- [ ] **Step 6: Commit**

```bash
git add packages/apps/gui/src/components/OutputsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui/outputs): 节点 output 用 <Prose> 渲染 markdown

- running 态 + completed 态正文都换成 <Prose>（边流边渲染，与 memory 一致）
- 不传 first prop → 无 drop cap（按用户需求）
- 字号 / 行高 / 颜色不变（Prose 外层 className 与原 div 完全相同）

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: 端到端人工验证 + 总 typecheck

**Files:** 无（验证步骤）

- [ ] **Step 1: 准备测试场景**

清理浏览器到 `http://localhost:3000`。准备：

- 一个工作区，含 ≥ 3 个节点
- 至少一个节点有 ref 引用关系（A→B）
- 至少一个节点有过往 output（跑过一次的）
- 至少一个节点带 stale ✱（编辑过 ref 上游或自身后未跑）
- 至少一个节点带 error footer（之前跑挂过的）

如果场景没现成，按这几步搭：

1. 建工作区 ws-e2e
2. 加节点 A：systemPrompt 一段「你是测试助手」
3. 加节点 B：systemPrompt 引用 A
4. 跑 A + B → 都有 output
5. 编辑 A 的 systemPrompt → A 直接 stale ✱（direct）、B 间接 stale ✱（propagated）

- [ ] **Step 2: 走 spec 测试章节 17 步**

参考 spec `docs/superpowers/specs/2026-05-25-right-click-toggle-and-output-markdown-design.md` 「测试 / GUI 人工」节的 17 步：

1. 右键未在 target 的节点 → 顶描边变 clay-deep，状态文字 "待运行" / "待重跑"；toast "已加入运行目标"
2. 再右键同节点 → 顶描边变回 rule，状态文字 "completed"；toast "已移出运行目标"
3. 多次连续右键同节点 → 加入 / 移出正确翻转
4. 右键节点时编辑器**不**打开
5. shift+左键 选中 3 个节点后右键其中一个 → 只 toggle 被右键那个
6. 跑步中右键 → toast.warning "运行中无法修改 target"
7. DAG 跑完后右键 → 正常 toggle
8. StaleTooltipBody（节点 ✱ 悬停）「加入 target 重跑」 → 仍正常加入
9. ErrorTooltipBody（节点 "● 上次失败" 悬停）「加入 target 重跑」 → 仍正常加入
10. 左键节点 → FloatingPanel 打开，底栏右侧红色「删除节点」可见
11. 点「删除节点」 → 节点消失，面板关闭，下游 ref 报错走旧路径
12. output 含 `# 标题` / `**bold**` / `- list` / `code` / ```code block``` → 完成态 markdown 渲染正确
13. 跑某节点时切 output tab → partial markdown 实时渲染
14. memory 对话页 → 第一段仍带 56px clay drop cap
15. 空白处右键 → 弹「添加节点」单项菜单
16. 空白菜单 Esc / 外点 → 关闭
17. `bun run typecheck:gui` pass

任一步与 Expected 不符则 stop 并 debug，回到对应 Task 修。

- [ ] **Step 3: 总 typecheck**

Run: `bun run typecheck:gui`
Expected: 无错误。

Run: `bun run typecheck`
Expected: engine 部分通过（本期不动 engine，与上期 baseline 一致）。

- [ ] **Step 4: 无残留代码**

Run:
```bash
grep -rn "selectedIds" packages/apps/gui/src/components/Canvas.tsx
```
Expected: 空（ContextMenuPanel 已不接 selectedIds）。

Run:
```bash
grep -rn "whitespace-pre-wrap break-words" packages/apps/gui/src/components/OutputsPanel.tsx
```
Expected: 空（已被 `<Prose>` 替换）。

Run:
```bash
grep -n "ReactMarkdown\|remarkGfm" packages/apps/gui/src/app/memory/page.tsx
```
Expected: 空（已迁到 Prose.tsx）。

Run:
```bash
grep -n "function Prose" packages/apps/gui/src/app/memory/page.tsx
```
Expected: 空（已删 inline Prose）。

如有遗漏命中，回 Task 3 / 5 / 6 修。

- [ ] **Step 5: git status clean**

Run: `git status`
Expected: clean（所有 commit 完成）。

Run: `git log --oneline -10`
Expected: 6 个本期 commit + 1 个 spec commit + 1 个 spec 修正 commit 在最顶端。

---

## Self-Review

### Spec 覆盖

- API `op?: 'add' | 'toggle'` → Task 1 ✓
- store `toggleTarget` action → Task 2 ✓
- Canvas `onNodeContextMenu` 改 toggle → Task 3 ✓
- `ContextMenuPanel` 精简到 pane 单项 → Task 3 ✓
- DAG 跑步态 toast.warning 拦下 → Task 3 Step 4, 验证 Task 3 Step 8 ✓
- FloatingPanel 底栏「删除节点」 → Task 4 ✓
- Prose 抽到 components/Prose.tsx → Task 5 ✓
- memory 改 import → Task 5 ✓
- OutputsPanel running + completed 用 `<Prose>` → Task 6 ✓
- 不传 `first` 无 drop cap → Task 6 Step 5 验证 ✓
- 错误与边界（11 行表格）→ Task 3-6 各分散覆盖，端到端 Task 7 17 步收口 ✓
- engine 测试跳过 → 无 task ✓

### Placeholder 扫描

无 TBD / TODO / 「适当处理」。所有 code 步骤都给了具体代码块。所有命令都给了 expected。

### 类型一致性

- `toggleTarget` 签名 `(nodeId: string) => Promise<void>` 在 Task 2 Step 1 引入，Task 3 Step 3 selector + Step 4 useCallback 一致使用 ✓
- `Prose` props `{ children: string; first?: boolean }` 在 Task 5 Step 1 定义，Task 5 memory 调用（保留原 `first={isFirstText}`）+ Task 6 OutputsPanel 调用（不传 first）一致 ✓
- API body `{ nodeId: string; op?: 'add' | 'toggle' }` 在 Task 1 Step 1 schema + Task 2 Step 2 fetch body 完全匹配（`op: 'toggle'`）✓
- ContextMenuPanel 新签名 `{ x, y, nodeId, onClose }` 与 Task 3 Step 5 调用点 prop 列表一致 ✓
- `deleteNode` store selector 命名与 Task 4 Step 1 selector / Step 2 onClick 一致 ✓
- `dagProgress` store 字段名（store 现状 line 18）与 Task 3 selector / useCallback dep 一致 ✓

无类型 / 命名漂移。

### 实施顺序

Task 1（API）→ Task 2（store）→ Task 3（Canvas）→ Task 4（FloatingPanel）→ Task 5（Prose 抽）→ Task 6（OutputsPanel）→ Task 7（E2E）。

每个 Task 独立可 commit、可回滚。Task 5 抽 Prose 时 Task 6 还没用到（memory 仍正常工作），所以 Task 5 commit 后可单独验证 memory 回归再继续。
