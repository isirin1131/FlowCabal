# FlowCabal GUI 开发指南

**版本 2.0.0** | FlowCabal GUI Agent | 2026 年 4 月

> 本文档指导 Agent 使用 Next.js、@xyflow/react、shadcn/ui、Zustand 和 Tailwind CSS v4 构建 FlowCabal GUI。

---

## 目录

1. [项目初始化](#1-项目初始化)
2. [架构](#2-架构)
3. [UI 组件](#3-ui-组件)
4. [xyflow 集成](#4-xyflow-集成)
5. [自定义节点组件](#5-自定义节点组件)
6. [浮动面板](#6-浮动面板)
7. [状态管理](#7-状态管理)
8. [API 路由](#8-api-路由)
9. [记忆与手稿](#9-记忆与手稿)
10. [固定输出页面](#10-固定输出页面)
11. [性能优化](#11-性能优化)
12. [代码模式](#12-代码模式)
13. [视图过渡](#13-视图过渡)
14. [网页设计指南](#14-网页设计指南)
15. [实施计划](#15-实施计划)
16. [未来扩展](#16-未来扩展)

---

## 1. 项目初始化

### 技术栈

- **框架**: Next.js (App Router)
- **图形 UI**: @xyflow/react
- **状态管理**: Zustand (class-based actions)
- **样式**: Tailwind CSS v4 + shadcn/ui
- **构建工具**: Bun

### 安装步骤

```bash
# 在 monorepo 根目录
mkdir -p packages/apps/gui
cd packages/apps/gui
bunx --bun create-next-app@latest . --typescript --tailwind --eslint
npx --bun shadcn@latest init --preset nova
npx --bun shadcn@latest add button card dialog dropdown-menu textarea separator scroll-area badge
bun add @xyflow/react zustand nanoid zod dagre
bun add lucide-react
bun add @flowcabal/engine
```

注意：`@flowcabal/engine` 是 monorepo 内的 workspace 包。Node.js 模块（`fs`、`path`、`os`）只能在 API route 中 import，client component 只引用 type definitions。

### Tailwind CSS v4 主题配置

```css
/* packages/apps/gui/src/app/globals.css */
@import "tailwindcss";

@theme {
  --color-background: oklch(100% 0 0);
  --color-foreground: oklch(14.5% 0.025 264);
  --color-primary: oklch(14.5% 0.025 264);
  --color-primary-foreground: oklch(98% 0.01 264);
  --color-secondary: oklch(96% 0.01 264);
  --color-secondary-foreground: oklch(14.5% 0.025 264);
  --color-muted: oklch(96% 0.01 264);
  --color-muted-foreground: oklch(46% 0.02 264);
  --color-accent: oklch(96% 0.01 264);
  --color-accent-foreground: oklch(14.5% 0.025 264);
  --color-destructive: oklch(53% 0.22 27);
  --color-destructive-foreground: oklch(98% 0.01 264);
  --color-border: oklch(91% 0.01 264);
  --color-ring: oklch(14.5% 0.025 264);
  --color-card: oklch(100% 0 0);
  --color-card-foreground: oklch(14.5% 0.025 264);

  --color-status-pending: oklch(55% 0.02 264);
  --color-status-stale: oklch(72% 0.15 40);
  --color-status-completed: oklch(72% 0.15 170);
  --color-status-error: oklch(62% 0.18 27);

  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  --animate-fade-in: fade-in 0.2s ease-out;
  --animate-slide-in: slide-in 0.3s ease-out;

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes slide-in {
    from { transform: translateY(-0.5rem); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
}

@custom-variant dark (&:where(.dark, .dark *));

.dark {
  --color-background: oklch(14.5% 0.025 264);
  --color-foreground: oklch(98% 0.01 264);
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}
```

---

## 2. 架构

### 页面布局

```
┌─────────────────────────────────────────────────────────────┐
│          Header                                             │
│  [Logo] [workspace ▼] [+ New] [Outputs] [Memory] [Manuscripts]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   xyflow Canvas                             │
│                               ┌──────────────────┐          │
│                               │  ▶ Run (floating) │          │
│                               └──────────────────┘          │
│                    [Floating Panel]                          │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
packages/apps/gui/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 根布局，包含 providers
│   │   ├── page.tsx                # 主画布（ViewTransition enabled）
│   │   ├── outputs/page.tsx        # 固定输出页面
│   │   ├── memory/page.tsx         # 记忆聊天页面
│   │   └── manuscripts/page.tsx    # 手稿管理
│   ├── components/
│   │   ├── ui/                     # shadcn 组件
│   │   ├── Header.tsx
│   │   ├── Canvas.tsx              # xyflow 包装器（memoized）
│   │   ├── FlowNode.tsx            # 自定义节点（memoized with areEqual）
│   │   ├── FloatingPanel.tsx       # 编辑器/输出/配置面板（Dialog）
│   │   └── RunButton.tsx           # 浮动运行按钮
│   ├── store/
│   │   └── useStore.ts             # Zustand store（class-based actions）
│   └── lib/
│       ├── api.ts                  # Engine API 客户端
│       ├── serialization.ts        # Workspace <-> JSON 转换（browser-safe）
│       └── utils.ts                # cn() 工具函数
├── package.json
├── next.config.ts
└── tsconfig.json
```

### 关键依赖

| 包 | 用途 | 备注 |
|---------|---------|------|
| `@xyflow/react` | 图形 UI | `import '@xyflow/react/dist/style.css'` |
| `zustand` | 状态管理 | Class-based actions 模式 |
| `shadcn` | UI 组件 | `npx shadcn@latest info` 获取项目配置 |
| `tailwindcss` | 样式 | v4 使用 CSS-first `@theme` |
| `dagre` | 自动布局 | 用于节点定位 |

### CLI 集成

GUI 与 CLI 共享同一数据层：

| 层面 | 路径 | 共享方 |
|---------|------|--------|
| Project 缓存 | `./.flowcabal-project-cache/<wsId>/workspace.json` | GUI API + CLI |
| LLM 配置 | `~/.config/flowcabal/llm-configs.json` | GUI API + CLI |
| Workflow 模板 | `~/.config/flowcabal/workflows/*.json` | GUI API + CLI |
| Agent 记忆 | `./memory/` | GUI API + CLI |

GUI 的 API routes 使用 `process.cwd()` 作为 `projectDir`，与 CLI 操作同一项目目录。
CLI 可独立运行（headless），GUI 提供可视化层。

---

## 3. UI 组件

### shadcn 关键规则

| 类别 | 规则 |
|----------|------|
| **样式** | `className` 用于布局而非样式。使用语义化颜色（`bg-primary`，不要 `bg-blue-500`）。使用 `gap-*` 而非 `space-y-*`。使用 `size-*` 处理等宽尺寸。 |
| **表单** | 使用 `FieldGroup` + `Field`。验证：Field 上加 `data-invalid`，control 上加 `aria-invalid`。禁用：Field 上加 `data-disabled`，control 上加 `disabled`。 |
| **ToggleGroups** | 2-7 个选项时，使用 `ToggleGroup` + `ToggleGroupItem`，不要循环 Button 加 active 状态。 |
| **InputGroups** | 始终使用 `InputGroupInput`（不是原始 `Input`）和 `InputGroupAddon`（不是定位的 Button）。 |
| **组合** | 项目始终在 Group 内（`SelectItem` → `SelectGroup`，`CommandItem` → `CommandGroup`）。使用完整 Card 组合。Dialog 必须有 `DialogTitle`。 |
| **Button 中的图标** | 图标使用 `data-icon="inline-start"` 或 `data-icon="inline-end"`。图标不加尺寸类。 |
| **Button 加载状态** | 用 `Spinner` + `data-icon` + `disabled` 组合，不用 `isPending` 属性。 |
| **Z-index** | 不要在 Dialog、Sheet、Popover 等覆盖组件上设置 z-index。 |
| **组件** | 使用现成的：`Alert` 用于提示，`Empty` 用于空状态，`sonner` 用于 toast，`Skeleton` 用于加载占位，`Separator` 用于分隔线，`Badge` 用于标签。 |
| **FieldSet** | 使用 `FieldSet` + `FieldLegend` 组合相关复选框/单选框，不要用带标题的 `div`。 |

### 表单验证模式

使用 shadcn 的 `FieldGroup` + `Field` 组合来处理表单验证：

```tsx
import { FieldGroup, Field, FieldError, Label } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

<FieldGroup>
  <Field data-invalid={!!errors.name}>
    <Label>名称</Label>
    <Input
      value={name}
      onChange={(e) => setName(e.target.value)}
      aria-invalid={!!errors.name}
      aria-describedby={errors.name ? 'name-error' : undefined}
    />
    {errors.name && (
      <FieldError id="name-error" role="alert">{errors.name}</FieldError>
    )}
  </Field>
</FieldGroup>
```

### Button 加载状态组合

```tsx
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'

<Button disabled={isLoading}>
  {isLoading && <Spinner data-icon="inline-start" />}
  {isLoading ? '保存中...' : '保存'}
</Button>
```

### Card 完整组合

```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文字</CardDescription>
  </CardHeader>
  <CardContent>内容区域</CardContent>
  <CardFooter>
    <Button>操作</Button>
  </CardFooter>
</Card>
```

### Dialog 完整结构

```tsx
<Dialog open={open} onOpenChange={onOpenChange}>
  <DialogTrigger asChild>
    <Button>打开</Button>
  </DialogTrigger>
  <DialogContent>
    <DialogTitle>对话框标题</DialogTitle>
    <DialogDescription>可选的描述</DialogDescription>
    {/* 内容 */}
    <DialogFooter>
      <Button>确认</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

### ToggleGroup 用法

```tsx
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

<ToggleGroup value={view} onValueChange={setView}>
  <ToggleGroupItem value="editor">编辑器</ToggleGroupItem>
  <ToggleGroupItem value="outputs">输出</ToggleGroupItem>
  <ToggleGroupItem value="config">配置</ToggleGroupItem>
</ToggleGroup>
```

---

## 4. xyflow 集成

### Canvas 组件

Canvas 组件使用 `memo()` 包装，采用细粒度 selector 订阅 xyflow 状态，避免全量 store 订阅。MiniMap 使用语义化颜色 token（`--color-status-*`）显示节点状态。

```tsx
// packages/apps/gui/src/components/Canvas.tsx
'use client'
import { memo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type NodeMouseEvent,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import { FlowNode } from './FlowNode'

const nodeTypes: NodeTypes = { flowNode: FlowNode }

function Canvas() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const selectNode = useStore((s) => s.selectNode)

  const onNodeClick = useCallback((_event: NodeMouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
    >
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
      <MiniMap
        nodeColor={(node: Node) => {
          const status = node.data?.status
          if (status === 'completed') return 'var(--color-status-completed)'
          if (status === 'error') return 'var(--color-status-error)'
          if (status === 'stale') return 'var(--color-status-stale)'
          return 'var(--color-status-pending)'
        }}
      />
    </ReactFlow>
  )
}

export default memo(Canvas)
```

---

## 5. 自定义节点组件

### FlowNode

FlowNode 是自定义 xyflow 节点，包含双目标 Handle（system 在 25% 高度, user 在 75% 高度）和单个 source Handle。显示 label、各区域 block 数量、状态指示点。

```tsx
// packages/apps/gui/src/components/FlowNode.tsx
'use client'
import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { TextBlock } from '@flowcabal/engine'

type FlowNodeData = {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'stale' | 'completed' | 'error'
  output: string | null
}

function FlowNode({ data, selected }: NodeProps<FlowNodeData>) {
  const statusColor: Record<string, string> = {
    pending: 'bg-status-pending',
    stale: 'bg-status-stale',
    completed: 'bg-status-completed',
    error: 'bg-status-error',
  }

  return (
    <div className={`px-4 py-3 bg-card border-2 rounded-lg shadow-sm min-w-[200px] ${selected ? 'border-ring' : 'border-border'}`}>
      <Handle type="target" position={Position.Left} id="system" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Left} id="user" style={{ top: '75%' }} />
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${statusColor[data.status] || 'bg-status-pending'}`} />
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground space-y-1">
        <div>系统: {data.systemPrompt?.length || 0} blocks</div>
        <div>用户: {data.userPrompt?.length || 0} blocks</div>
      </div>
      <Handle type="source" position={Position.Right} id="output" />
    </div>
  )
}

function areEqual(prev: NodeProps<FlowNodeData>, next: NodeProps<FlowNodeData>) {
  return (
    prev.data.label === next.data.label &&
    prev.data.systemPrompt?.length === next.data.systemPrompt?.length &&
    prev.data.userPrompt?.length === next.data.userPrompt?.length &&
    prev.data.status === next.data.status &&
    prev.data.output === next.data.output &&
    prev.selected === next.selected
  )
}

export default memo(FlowNode, areEqual)
```

### 右键菜单

**节点右键菜单（在节点上右键）：**
- 添加子节点
- 删除节点
- 复制节点

**画布右键菜单（空白区域右键）：**
- 双击：添加节点
- 右键：快捷菜单

---

## 6. 浮动面板

### 带标签页的浮动面板

```tsx
// packages/apps/gui/src/components/FloatingPanel.tsx
'use client'
import { useState } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EditorPanel } from './EditorPanel'
import { OutputsPanel } from './OutputsPanel'
import { ConfigPanel } from './ConfigPanel'

export function FloatingPanel({ nodeId, open, onOpenChange }: {
  nodeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [tab, setTab] = useState<'editor' | 'outputs' | 'config'>('editor')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[70vh] p-0 gap-0">
        <div className="px-4 py-2 border-b">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="editor">编辑器</TabsTrigger>
              <TabsTrigger value="outputs">输出</TabsTrigger>
              <TabsTrigger value="config">配置</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {tab === 'editor' && nodeId && <EditorPanel nodeId={nodeId} />}
          {tab === 'outputs' && <OutputsPanel />}
          {tab === 'config' && <ConfigPanel />}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

### 带 Block 管理的编辑器面板

```tsx
// packages/apps/gui/src/components/EditorPanel.tsx
'use client'
import { useStore } from '@/store/useStore'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus } from 'lucide-react'
import type { TextBlock, NodeDef } from '@flowcabal/engine'

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const { activeWorkspace, updateBlock, addBlock, removeBlock } = useStore()
  const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
  if (!node) return null

  const renderBlocks = (blocks: TextBlock[], isSystem: boolean) => (
    <div className="space-y-2">
      {blocks.map((block, i) => (
        <div key={i} className="p-3 bg-muted rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <Badge variant="secondary">{i + 1}. {block.kind}</Badge>
            <Button variant="ghost" size="icon" onClick={() => removeBlock(nodeId, isSystem, i)} className="text-destructive">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
          {block.kind === 'literal' && (
            <Textarea
              defaultValue={block.content}
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: e.target.value })}
              className="min-h-[80px]"
            />
          )}
          {block.kind === 'agent-inject' && (
            <Textarea
              defaultValue={block.hint}
              placeholder="提示..."
              onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })}
              className="min-h-[60px]"
            />
          )}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between mb-3">
          <h3 className="font-semibold">系统提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}>
            <Plus className="w-4 h-4" /> 添加
          </Button>
        </div>
        {renderBlocks(node.systemPrompt, true)}
      </div>
      <div>
        <div className="flex justify-between mb-3">
          <h3 className="font-semibold">用户提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}>
            <Plus className="w-4 h-4" /> 添加
          </Button>
        </div>
        {renderBlocks(node.userPrompt, false)}
      </div>
    </div>
  )
}
```

---

## 7. 状态管理

### Zustand Store（Class-based Actions 模式）

```typescript
// packages/apps/gui/src/store/useStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges, addEdge, type Node, type Edge } from '@xyflow/react'
import type { Workspace, NodeDef } from '@flowcabal/engine'
import { recordToWorkspace, workspaceToRecord } from '@/lib/serialization'

type GuiState = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  floatingPanelOpen: boolean
  pinnedOutputs: string[]
  isLoading: boolean
}

class WorkspaceActions {
  #set: any
  #get: any
  constructor(set: any, get: any) { this.#set = set; this.#get = get }

  internal_switchWorkspace = (id: string) => {
    const ws = this.#get().workspaces.find((w: Workspace) => w.id === id)
    if (!ws) return
    const nodes = ws.nodes.map((n: NodeDef) => ({
      id: n.id, type: 'flowNode', position: { x: 0, y: 0 },
      data: {
        label: n.label,
        systemPrompt: n.systemPrompt,
        userPrompt: n.userPrompt,
        status: ws.outputs.has(n.id) ? 'completed' : 'pending',
        output: ws.outputs.get(n.id) ?? null,
      },
    }))
    const edges: Edge[] = []
    for (const [targetId, sources] of ws.upstream) {
      for (const sourceId of sources) {
        edges.push({
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'smoothstep',
          animated: ws.outputs.has(sourceId),
        })
      }
    }
    this.#set({ activeWorkspace: ws, nodes, edges })
  }

  internal_loadWorkspace = async (workspaceId: string) => {
    this.#set({ isLoading: true })
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`)
      const data = await res.json()
      if (!data.workspace) return
      const workspace = recordToWorkspace(data.workspace)
      const existing = this.#get().workspaces
      const idx = existing.findIndex((w: Workspace) => w.id === workspace.id)
      const updated = idx >= 0
        ? existing.map((w: Workspace) => w.id === workspace.id ? workspace : w)
        : [...existing, workspace]
      this.#set({ workspaces: updated })
      this.internal_switchWorkspace(workspace.id)
    } finally {
      this.#set({ isLoading: false })
    }
  }

  internal_saveActiveWorkspace = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    await fetch(`/api/workspaces/${ws.id}`, {
      method: 'PUT',
      body: JSON.stringify({ workspace: workspaceToRecord(ws) }),
    })
  }

  internal_runAll = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'pending' } }))
    }))
    try {
      const res = await fetch('/api/engine/run-all', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: ws.id }),
      })
      const data = await res.json()
      const updatedWs = recordToWorkspace(data.workspace)
      this.#set((s: any) => ({
        workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
        activeWorkspace: updatedWs,
        nodes: s.nodes.map((n: any) => ({
          ...n,
          data: {
            ...n.data,
            status: updatedWs.outputs.has(n.id) ? 'completed' : 'pending',
            output: updatedWs.outputs.get(n.id) ?? null,
          },
        })),
      }))
    } catch {
      this.#set((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'error' } }))
      }))
    }
  }
}

export const useStore = create<GuiState>()(
  persist((set, get) => {
    const actions = new WorkspaceActions(set, get)
    return {
      workspaces: [], activeWorkspace: null, nodes: [], edges: [],
      selectedNodeId: null, floatingPanelOpen: false, pinnedOutputs: [], isLoading: false,
      switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
      loadWorkspace: (id: string) => actions.internal_loadWorkspace(id),
      saveActiveWorkspace: () => actions.internal_saveActiveWorkspace(),
      runAll: () => actions.internal_runAll(),
      onNodesChange: (c) => set((s: any) => ({ nodes: applyNodeChanges(c, s.nodes) })),
      onEdgesChange: (c) => set((s: any) => ({ edges: applyEdgeChanges(c, s.edges) })),
      onConnect: (c) => set((s: any) => ({ edges: addEdge({ ...c, type: 'smoothstep', animated: true }, s.edges) })),
      selectNode: (id) => set({ selectedNodeId: id, floatingPanelOpen: id !== null }),
      togglePinOutput: (id) => set((s: any) => {
        const pinned = s.pinnedOutputs.includes(id)
          ? s.pinnedOutputs.filter((i: string) => i !== id)
          : [...s.pinnedOutputs, id]
        return { pinnedOutputs: pinned }
      }),
    }
  }, {
    name: 'flowcabal-gui-storage',
    partialize: (state) => ({
      pinnedOutputs: state.pinnedOutputs,
    }),
  })
)
```

### 乐观更新模式

节点 CRUD 通过 workspace 级 API 操作（engine 的 `addNode`/`removeNode` 在 server 端执行）：

```typescript
// 创建操作 - 乐观更新：先添加 xyflow node，后台同步到 engine
internal_createNode: async (label: string) => {
  const ws = this.#get().activeWorkspace
  if (!ws) return
  const tmpId = `tmp-${Date.now()}`
  this.#set((s: any) => ({
    nodes: [...s.nodes, { id: tmpId, type: 'flowNode', position: { x: 100, y: 100 },
      data: { label, systemPrompt: [], userPrompt: [], status: 'pending', output: null } }],
  }))
  try {
    await fetch('/api/workspaces/nodes', {
      method: 'POST',
      body: JSON.stringify({ workspaceId: ws.id, label }),
    })
  } catch {
    this.#set((s: any) => ({ nodes: s.nodes.filter((n: any) => n.id !== tmpId) }))
  }
}

// 删除操作 - 非乐观更新（破坏性操作，难以恢复），显示加载状态
internal_deleteNode: async (nodeId: string) => {
  const ws = this.#get().activeWorkspace
  if (!ws) return
  this.#set((s: any) => ({
    nodes: s.nodes.map((n: any) =>
      n.id === nodeId ? { ...n, data: { ...n.data, _deleting: true } } : n
    ),
  }))
  try {
    await fetch('/api/workspaces/nodes', {
      method: 'DELETE',
      body: JSON.stringify({ workspaceId: ws.id, nodeId }),
    })
    this.#set((s: any) => ({ nodes: s.nodes.filter((n: any) => n.id !== nodeId) }))
  } catch {
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: { ...n.data, _deleting: false } } : n
      ),
    }))
  }
}
```

### 细粒度 Selector

避免全量 store 订阅，只订阅需要的字段：

```typescript
// ✓ 正确：只订阅 nodes
const nodes = useStore((s) => s.nodes)

// ✗ 错误：全量订阅会导致不必要的重渲染
const store = useStore()
```

### 多 Workspace 架构

```
┌────────────────────────────────────────────┐
│ Zustand: workspaces Workspace[]           │
│           activeWorkspace: Workspace|null   │
├────────────────────────────────────────────┤
│ 多个 workspace 独立加载                     │
│ 运行时隔离防止状态污染                      │
└────────────────────────────────────────────┘
```

**切换逻辑：**
1. 切换时：`loadWorkspace(id)` → API 返回 records → `recordToWorkspace` 转为 Maps → store 更新
2. 用户固定输出时，更新时高亮

---

## 8. API 路由

> **关键设计：** engine 的 `Workspace` 包含 `Map` 类型字段（`outputs`、`upstream`、`downstream`），JSON 无法直接序列化。
> Client 与 server 之间以 records（`Record<string, ...>`）传输，在 API boundary 处转换。
> Client 代码只引用 engine 的 type definitions，不 import 任何 Node.js 模块。

### Workspace CRUD + 运行

```typescript
// packages/apps/gui/src/lib/serialization.ts — Workspace <-> JSON 转换（client + server 均可用）
import type { Workspace } from '@flowcabal/engine'

export function workspaceToRecord(ws: Workspace) {
  return {
    ...ws,
    outputs: Object.fromEntries(ws.outputs),
    upstream: Object.fromEntries(ws.upstream),
    downstream: Object.fromEntries(ws.downstream),
  }
}

export function recordToWorkspace(data: any): Workspace {
  return {
    ...data,
    outputs: new Map(Object.entries(data.outputs ?? {})),
    upstream: new Map(Object.entries(data.upstream ?? {})),
    downstream: new Map(Object.entries(data.downstream ?? {})),
  }
}

// packages/apps/gui/src/app/api/workspaces/[id]/route.ts
import { NextResponse } from 'next/server'
import {
  readWorkspace, writeWorkspace, initFromEmpty, runAll, readLlmConfigs,
} from '@flowcabal/engine'
import { workspaceToRecord, recordToWorkspace } from '@/lib/serialization'

// GET  — 加载 workspace（Map → records for JSON）
export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const projectDir = process.cwd()
  const workspace = readWorkspace(projectDir, params.id)
  if (!workspace) {
    return NextResponse.json({ workspace: null }, { status: 404 })
  }
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}

// POST — 创建新 workspace
export async function POST(request: Request) {
  const { name } = await request.json()
  const projectDir = process.cwd()
  const workspace = initFromEmpty(name)
  writeWorkspace(projectDir, workspace.id, workspace)
  return NextResponse.json({ workspace: workspaceToRecord(workspace) })
}

// PUT — 保存 workspace（client 发来 records，转 Map 后写入）
export async function PUT(
  request: Request,
  { params }: { params: { id: string } },
) {
  const { workspace: clientWs } = await request.json()
  const projectDir = process.cwd()
  writeWorkspace(projectDir, params.id, recordToWorkspace(clientWs))
  return NextResponse.json({ success: true })
}

// packages/apps/gui/src/app/api/engine/run-all/route.ts
export async function POST(request: Request) {
  const { workspaceId } = await request.json()
  const projectDir = process.cwd()
  const config = readLlmConfigs()['default']
  if (!config) {
    return NextResponse.json({ error: 'No default LLM config' }, { status: 400 })
  }
  try {
    const workspace = readWorkspace(projectDir, workspaceId)
    if (!workspace) {
      return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
    }
    const executed = await runAll(workspace, config, projectDir)
    // runAll 就地突变了 workspace.outputs — 写回磁盘
    writeWorkspace(projectDir, workspaceId, workspace)
    return NextResponse.json({ executed, workspace: workspaceToRecord(workspace) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
```

### LLM 配置 API

```
GET  /api/llm-configs
     Response: { configs: LlmConfig[] }

POST /api/llm-configs
     Body: LlmConfig
     Response: { success: boolean }

DELETE /api/llm-configs/:name
     Response: { success: boolean }
```

---

## 9. 记忆与手稿

### 记忆聊天页面

```tsx
// packages/apps/gui/src/app/memory/page.tsx
'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function MemoryPage() {
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([])
  const [input, setInput] = useState('')

  const sendMessage = async () => {
    if (!input.trim()) return
    const userMsg = { role: 'user', content: input }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    const { response } = await fetch('/api/memory/chat', {
      method: 'POST',
      body: JSON.stringify({ messages: [...messages, userMsg] }),
    }).then((r) => r.json())
    setMessages((prev) => [...prev, { role: 'assistant', content: response }])
  }

  return (
    <div className="flex flex-col h-screen">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn(
              'p-3 rounded-lg max-w-[80%]',
              msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted',
            )}>{msg.content}</div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
          className="min-h-[44px]"
        />
        <Button size="icon" onClick={sendMessage}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  )
}
```

---

## 10. 固定输出页面

```tsx
// packages/apps/gui/src/app/outputs/page.tsx
'use client'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Copy, X } from 'lucide-react'
import type { NodeDef } from '@flowcabal/engine'

export default function PinnedOutputsPage() {
  const { pinnedOutputs, activeWorkspace, togglePinOutput } = useStore()
  const outputs = activeWorkspace?.outputs

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-semibold mb-6">固定输出</h1>
      {pinnedOutputs.length === 0 && <p className="text-muted-foreground">暂无固定的输出。</p>}
      <div className="grid gap-4">
        {pinnedOutputs.map((nodeId) => {
          const node = activeWorkspace?.nodes.find((n: NodeDef) => n.id === nodeId)
          const output = outputs?.get(nodeId)
          return (
            <Card key={nodeId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{node?.label}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => togglePinOutput(nodeId)}>
                  <X className="w-4 h-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-[300px]">
                  {output || '（无输出）'}
                </pre>
                <Button variant="outline" size="sm" className="mt-2"
                  onClick={() => navigator.clipboard.writeText(output || '')}>
                  <Copy className="w-4 h-4" /> 复制
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
```

---

## 11. 性能优化

### 关键模式（优先级顺序）

| 优先级 | 模式 | 示例 |
|----------|---------|---------|
| 1 | **消除瀑布流** | `Promise.all()` 处理独立操作 |
| 2 | **包体积** | `next/dynamic` 加载重型组件 |
| 3 | **Memo** | `memo(Component, areEqual)` |
| 4 | **细粒度 Selectors** | `useStore((s) => s.nodes)` |
| 5 | **避免内联组件** | 在渲染外定义组件 |

### 消除瀑布流

```typescript
// 错误 - 顺序 await（瀑布流）
const user = await fetchUser()
const posts = await fetchPosts(user.id)
const comments = await fetchComments(posts[0].id)

// 正确 - 独立操作并行执行
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])

// 更好 - 部分依赖时尽早启动 Promise
const userPromise = fetchUser()
const postsPromise = userPromise.then(u => fetchPosts(u.id))
const commentsPromise = postsPromise.then(p => fetchComments(p[0].id))
```

### localStorage 模式（仅用于 UI 设置）

localStorage 只持久化非 workspace 的 UI 状态（如 `pinnedOutputs`）。
Workspace 数据（含 `Map` 字段）通过 API route 持久化到文件系统。

```typescript
const VERSION = 'v1'

function saveSetting(key: string, data: any) {
  try {
    localStorage.setItem(`${key}:${VERSION}`, JSON.stringify(data))
  } catch {}
}

function loadSetting(key: string) {
  try {
    const raw = localStorage.getItem(`${key}:${VERSION}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}
```

### 动态导入

```tsx
import dynamic from 'next/dynamic'

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <Skeleton />,
})
```

### 渲染规则

```tsx
// 使用三元表达式而非 &&（防止 0/false 显示为内容）
{isLoading ? <Skeleton /> : <Content />}

// startTransition 用于非紧急更新
startTransition(() => setFilter(filterValue))

// useDeferredValue 用于昂贵渲染
const deferredFilter = useDeferredValue(filterValue)

// 避免内联组件定义
// 错误：每次父组件渲染都创建新函数
const Parent = () => <Child onClick={() => handleClick()} />

// 正确：在外部定义或使用 useCallback
const handleClick = useCallback(() => {}, [])
const Parent = () => <Child onClick={handleClick} />
```

### 持久化策略

**本地开发 & 生产环境：** 统一通过 API route 持久化到文件系统（`.flowcabal-project-cache/<workspaceId>/workspace.json`）。
Zustand `persist` 的 `partialize` 选项只持久化 UI 设置（`pinnedOutputs`），不存储 workspace 数据。
支持 JSON 导出/导入用于调试。

---

## 12. 代码模式

### 转换：Engine ↔ xyflow

参见 [状态管理](#7-状态管理) 中的 `switchWorkspace` 获取完整实现。提取为工具函数：

```typescript
// packages/apps/gui/src/lib/engine-to-flow.ts
export function workspaceToFlow(ws: Workspace) {
  // 参见 store/useStore.ts 中的 switchWorkspace 实现
}
```

### 自动布局（Dagre）

```typescript
import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph().setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 })
  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 100 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return {
    nodes: nodes.map((n) => ({ ...n, position: { x: g.node(n.id).x - 100, y: g.node(n.id).y - 50 } })),
    edges,
  }
}
```

### React 19 组合模式

```tsx
// 不再需要 forwardRef - ref 是普通 prop
export function Button({ ref, className, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={className} {...props} />
}

// use() 替代 useContext()（React 19+）
const theme = use(ThemeContext)

// startTransition 用于非紧急更新
startTransition(() => { setState(newState) })

// useCallback 用于稳定的回调
const handleClick = useCallback(() => {
  doSomething(value)
}, [value])

// useDeferredValue 用于昂贵渲染
const deferredFilter = useDeferredValue(filterValue)
```

### 其他 React 组合模式

```tsx
// Compound Component 模式
<Select>
  <SelectGroup>
    <SelectItem value="1">选项 1</SelectItem>
    <SelectItem value="2">选项 2</SelectItem>
  </SelectGroup>
</Select>

// 避免 Boolean Props 泛滥
// 错误：<Button primary secondary large small />
// 正确：<Button variant="primary" size="large" />
```

---

## 13. 视图过渡

### Next.js 配置

```ts
// packages/apps/gui/next.config.ts
const nextConfig = { experimental: { viewTransition: true } }
```

> **注意:** 不要安装 `react@canary`——Next.js App Router 内部已经捆绑了它。

### 核心 API（来自 'react'）

```tsx
import { ViewTransition, startTransition, addTransitionType } from 'react'
```

| API | 用途 |
|-----|---------|
| `ViewTransition` | 包装要动画化的元素（自动分配 view-transition-name） |
| `startTransition` | 包装状态变化以触发动画 |
| `addTransitionType` | 用上下文标记过渡（'nav-forward', 'nav-back'） |

### CSS 动画配方

```css
/* 从右滑入 */
::view-transition-old(root) {
  animation: 0.3s ease-out both slide-out-right;
}
::view-transition-new(root) {
  animation: 0.3s ease-out both slide-in-right;
}

@keyframes slide-in-right {
  from { transform: translateX(30px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
@keyframes slide-out-right {
  from { transform: translateX(0); opacity: 1; }
  to { transform: translateX(-30px); opacity: 0; }
}
```

### 关键规则

| 规则 | 原因 |
|------|--------|
| **始终使用 `default="none"`** | 防止每次过渡都出现交叉淡入淡出（Suspense 解析、重新验证） |
| **VT 放在 DOM 节点前** | `<ViewTransition><div>` 有效，`<div><ViewTransition>` 无效 |
| **`router.back()` 不触发 VT** | 使用 `router.push()` 加显式 URL 替代 |
| **`enter` 与 `exit` 成对出现** | 始终动画化两个方向 |
| **方向性 VT 放在页面中而非布局中** | 布局会持久化，enter/exit 不会触发 |
| **命名 VT 必须唯一** | 使用 `name={`item-${id}`}` 避免冲突 |

### 动画优先级（按顺序实现）

| 优先级 | 模式 | 传达的信息 |
|----------|---------|---------|
| 1 | 共享元素（`name`） | "同一个东西——进入更深层" |
| 2 | Suspense 揭示 | "数据已加载" |
| 3 | 列表标识（每个项目的 `key`） | "相同的项目，新的排列" |
| 4 | 路由变更（布局级别） | "前往新地方" |

---

## 14. 网页设计指南

### 核心原则

| 原则 | 实现方式 |
|-----------|---------------|
| **可见的暗示** | 交互元素显示其状态（悬停、激活、禁用、聚焦） |
| **键盘导航** | 完整键盘支持，可见的焦点指示器（`focus-visible:ring`） |
| **触摸目标** | 移动端最小 44x44px |
| **对比度** | 文本 4.5:1，UI 元素 3:1 |
| **错误预防** | 确认破坏性操作，提交前验证 |
| **运动** | 尊重 `prefers-reduced-motion` |
| **颜色独立** | 不单纯依赖颜色传达信息 |
| **输入方式** | 同等支持鼠标、触摸和键盘 |
| **延迟处理** | 显示加载状态，使用乐观更新 |
| **信任与安全** | 确认不可逆操作，尽量提供撤销功能 |

### 可访问性检查清单

- [ ] 所有交互元素都可通过键盘访问
- [ ] 焦点顺序符合逻辑且可见
- [ ] 触摸目标 ≥ 44x44px
- [ ] 颜色对比度符合 WCAG AA（文本 4.5:1，UI 3:1）
- [ ] 错误消息通过屏幕阅读器播报（`role="alert"`）
- [ ] 动画可通过 `prefers-reduced-motion` 禁用
- [ ] 表单验证错误与输入关联（`aria-describedby`）

---

## 15. 实施计划

| 阶段 | 任务 | 优先级 |
|-------|------|----------|
| 1 | Next.js + shadcn/ui 基础搭建 | P0 |
| 2 | API 路由（Engine + Workspace） | P0 |
| 3 | Zustand store（多 Workspace） | P0 |
| 4 | xyflow 集成 + 自定义节点 | P0 |
| 5 | 节点 CRUD 操作 | P0 |
| 6 | 浮动面板（编辑器/输出/配置） | P0 |
| 7 | 多 Workspace 切换 + 并行运行 | P0 |
| 8 | 自动布局（dagre） | P2 |
| 9 | Workspace 持久化 | P1 |

## 16. 未来扩展

- 节点模板预设
- 历史记录（撤销/重做）
- 导出为 Markdown/PDF
- 多用户协作（保留接口）

---

## 参考资料

### 核心技术

- [xyflow 文档](https://reactflow.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs/upgrade-guide)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Next.js](https://nextjs.org/docs)

### Skills（详细模式在各个 skill 中）

| Skill | 重点领域 |
|-------|-------------|
| **xyflow-react** | AI 工作流节点、性能、子流程 |
| **shadcn** | 表单、组合、CLI、验证 |
| **zustand** | Class actions、乐观更新、slices |
| **vercel-react-best-practices** | 瀑布流、包体积、重新渲染 |
| **vercel-composition-patterns** | Boolean props、复合组件、React 19 |
| **vercel-react-view-transitions** | CSS 配方、共享元素、Suspense |
| **tailwind-design-system** | v4 主题、动画、深色模式 |
| **web-design-guidelines** | 可访问性、最佳实践 |

### 重要命令

```bash
npx shadcn@latest info --json        # 获取项目配置
npx shadcn@latest docs <component>   # 获取组件文档
npx shadcn@latest add <component>    # 添加组件
npm info @xyflow/react               # 查看最新版本
```
