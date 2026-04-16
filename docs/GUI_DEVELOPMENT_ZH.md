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
# 使用 shadcn 初始化 Next.js
bunx --bun create-next-app@latest flowcabal-gui --typescript --tailwind --eslint
cd flowcabal-gui

# 初始化 shadcn（根据 packageManager 选择 npx/pnpm/bunx）
npx --bun shadcn@latest init --preset nova

# 添加 shadcn 组件
npx --bun shadcn@latest add button card dialog dropdown-menu textarea separator scroll-area badge

# 安装依赖
bun add @xyflow/react zustand nanoid zod dagre

# 添加图标库（使用项目中 shadcn info 的 iconLibrary）
bun add lucide-react
```

### Tailwind CSS v4 主题配置

```css
/* src/app/globals.css - Tailwind v4 CSS-first 配置 */
@import "tailwindcss";

@theme {
  /* 语义化颜色令牌 */
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

  /* 节点状态颜色 */
  --color-status-pending: oklch(55% 0.02 264);
  --color-status-stale: oklch(72% 0.15 40);
  --color-status-completed: oklch(72% 0.15 170);
  --color-status-error: oklch(62% 0.18 27);

  /* 圆角令牌 */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* 动画令牌 */
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
  /* ... 深色模式变量 */
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
│          Header                                           │
│  [Logo] [workspace ▼] [+ New] [Outputs] [Memory] [Manuscripts]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                   xyflow Canvas                            │
│                               ┌──────────────────┐         │
│                               │  ▶ Run (floating) │          │
│                               └──────────────────┘         │
│                    [Floating Panel]                        │
└─────────────────────────────────────────────────────────────┘
```

### 文件结构

```
src/
├── app/
│   ├── layout.tsx              # 根布局，包含 providers
│   ├── page.tsx                # 主画布（启用 ViewTransition）
│   ├── outputs/page.tsx        # 固定输出页面
│   ├── memory/page.tsx         # 记忆聊天页面
│   └── manuscripts/page.tsx    # 手稿管理
├── components/
│   ├── ui/                     # shadcn 组件
│   ├── Header.tsx
│   ├── Canvas.tsx              # xyflow 包装器（已 memo）
│   ├── FlowNode.tsx            # 自定义节点（已 memo，包含 areEqual）
│   ├── FloatingPanel.tsx       # 编辑器/输出/配置面板（Dialog）
│   └── RunButton.tsx           # 浮动运行按钮
├── store/
│   └── useStore.ts             # Zustand store（class-based actions）
└── lib/
    ├── api.ts                  # Engine API 客户端
    └── utils.ts                # cn() 工具函数
```

### 关键依赖

| 包 | 用途 | 备注 |
|---------|---------|------|
| `@xyflow/react` | 图形 UI | 使用 `import '@xyflow/react/dist/style.css'` |
| `zustand` | 状态管理 | Class-based actions 模式 |
| `shadcn` | UI 组件 | 运行 `npx shadcn@latest info` 获取项目配置 |
| `tailwindcss` | 样式 | v4 使用 CSS-first `@theme` |
| `dagre` | 自动布局 | 用于节点定位 |

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

```tsx
// 无效状态
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>无效的邮箱地址。</FieldDescription>
</Field>

// 禁用状态
<Field data-disabled>
  <FieldLabel htmlFor="name">姓名</FieldLabel>
  <Input id="name" disabled />
</Field>

// 带搜索按钮的 InputGroup（正确写法）
<InputGroup>
  <InputGroupInput placeholder="搜索..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>

// FieldSet 用于分组的复选框
<FieldSet>
  <FieldLegend variant="label">偏好设置</FieldLegend>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">深色模式</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

### ToggleGroup 用于选项集

```tsx
// 使用 ToggleGroup，不用 Button 循环
<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">每日</ToggleGroupItem>
  <ToggleGroupItem value="weekly">每周</ToggleGroupItem>
  <ToggleGroupItem value="monthly">每月</ToggleGroupItem>
</ToggleGroup>
```

### Button 组件（CVA）

```tsx
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'
import { Spinner } from '@/components/ui/spinner'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:bg-primary/90',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        outline: 'border border-border bg-background hover:bg-accent hover:text-accent-foreground',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        run: 'bg-emerald-600 text-white hover:bg-emerald-700 rounded-full size-12',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'size-10',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

// React 19: ref 是普通 prop
export function Button({
  className,
  variant,
  size,
  asChild = false,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp
      className={cn(buttonVariants({ variant, size, className }))}
      ref={ref}
      {...props}
    />
  )
}

// 加载状态：用 Spinner 组合，不用 isPending prop
export function LoadingButton({ isLoading, children, ...props }: ButtonProps & { isLoading?: boolean }) {
  return (
    <Button disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  )
}
```

### Card 组合

```tsx
// 完整组合 - 使用所有子组件
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述</CardDescription>
  </CardHeader>
  <CardContent>
    <form>...</form>
  </CardContent>
  <CardFooter className="flex justify-end">
    <Button>保存</Button>
  </CardFooter>
</Card>

// 不要把所有内容都放在 CardContent 里
```

### Dialog 结构

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>确认操作</DialogTitle>    // 必须有！
    <DialogDescription>确定要继续吗？</DialogDescription>
  </DialogHeader>
  {/* 内容 */}
  <DialogFooter>
    <Button variant="outline">取消</Button>
    <Button>确认</Button>
  </DialogFooter>
</Dialog>
```

---

## 4. xyflow 集成

### Canvas 组件（已 Memo）

```tsx
// components/Canvas.tsx
'use client'

import { useCallback, memo } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  type OnConnect,
  type NodeChange,
  type EdgeChange,
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { FlowNode } from './FlowNode'

const nodeTypes = { flowNode: FlowNode }

interface CanvasProps {
  nodes: Node[]
  edges: Edge[]
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: OnConnect
  onNodeClick: (event: React.MouseEvent, node: Node) => void
}

const _Canvas = ({ nodes, edges, onNodesChange, onEdgesChange, onConnect, onNodeClick }: CanvasProps) => {
  const handleNodesChange = useCallback((changes: NodeChange[]) => onNodesChange(changes), [onNodesChange])
  const handleEdgesChange = useCallback((changes: EdgeChange[]) => onEdgesChange(changes), [onEdgesChange])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={handleNodesChange}
      onEdgesChange={handleEdgesChange}
      onConnect={onConnect}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      fitView
      snapToGrid
      snapGrid={[16, 16]}
      proOptions={{ hideAttribution: true }}
    >
      <Background gap={16} size={1} />
      <Controls className="bg-background border border-border rounded-lg" />
      <MiniMap
        nodeColor={(node) => {
          const status = node.data?.status
          if (status === 'completed') return 'var(--color-status-completed)'
          if (status === 'stale') return 'var(--color-status-stale)'
          if (status === 'error') return 'var(--color-status-error)'
          return 'var(--color-status-pending)'
        }}
        maskColor="oklch(0.98 0 264 / 0.8)"
        className="bg-background"
      />
    </ReactFlow>
  )
}

export const Canvas = memo(_Canvas)
```

> **性能**: 始终用 `memo()` 包裹 Canvas。使用细粒度 selector 订阅 xyflow 状态，避免全量 store 订阅。

---

## 5. 自定义节点组件

### FlowNode（带自定义比较的 Memo）

```tsx
// components/FlowNode.tsx
'use client'

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { cn } from '@/lib/utils'

type FlowNodeData = {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'stale' | 'completed' | 'error'
  output?: string
}

const statusColors = {
  pending: 'var(--color-status-pending)',
  stale: 'var(--color-status-stale)',
  completed: 'var(--color-status-completed)',
  error: 'var(--color-status-error)',
}

// 自定义比较 - 只在这些变化时重新渲染
const areEqual = (prev: NodeProps<FlowNodeData>, next: NodeProps<FlowNodeData>) => {
  return (
    prev.data.label === next.data.label &&
    prev.data.systemPrompt.length === next.data.systemPrompt.length &&
    prev.data.userPrompt.length === next.data.userPrompt.length &&
    prev.data.status === next.data.status &&
    prev.data.output === next.data.output &&
    prev.selected === next.selected
  )
}

export const FlowNode = memo(
  ({ data, selected }: NodeProps<FlowNodeData>) => {
    const statusColor = statusColors[data.status] || statusColors.pending

    return (
      <>
        <Handle type="target" position={Position.Top} id="system" style={{ left: '25%' }} />
        <Handle type="target" position={Position.Top} id="user" style={{ left: '75%' }} />

        <div className={cn(
          'px-4 py-3 rounded-xl border-2 bg-card min-w-[180px]',
          'transition-shadow duration-200',
          selected ? 'border-primary ring-2 ring-primary ring-offset-2 shadow-lg' : 'border-border shadow-sm'
        )}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-sm">{data.label}</span>
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: statusColor }} />
          </div>
          <div className="text-xs text-muted-foreground">
            <div>system: {data.systemPrompt.length} blocks</div>
            <div>user: {data.userPrompt.length} blocks</div>
          </div>
        </div>

        <Handle type="source" position={Position.Bottom} id="output" />
      </>
    )
  },
  areEqual
)

FlowNode.displayName = 'FlowNode'
```

### TextBlock 类型（来自 @flowcabal/engine）

```typescript
type TextBlock =
  | { kind: 'literal'; content: string }
  | { kind: 'ref'; ref: string }
  | { kind: 'agent-inject'; hint: string }
```

---

## 6. 浮动面板

### 带标签页的浮动面板

```tsx
// components/FloatingPanel.tsx
'use client'
import { useState } from 'react'
import { Dialog, DialogContent, Tabs, TabsList, TabsTrigger } from '@/components/ui/dialog'
import { EditorPanel } from './EditorPanel'
import { OutputsPanel } from './OutputsPanel'
import { ConfigPanel } from './ConfigPanel'

export function FloatingPanel({ nodeId, open, onOpenChange }: any) {
  const [tab, setTab] = useState<'editor' | 'outputs' | 'config'>('editor')
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[70vh] p-0 gap-0">
        <div className="px-4 py-2 border-b">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList><TabsTrigger value="editor">编辑器</TabsTrigger>
              <TabsTrigger value="outputs">输出</TabsTrigger><TabsTrigger value="config">配置</TabsTrigger></TabsList>
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
// components/EditorPanel.tsx
'use client'
import { useStore } from '@/store/useStore'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Trash2, Plus } from 'lucide-react'
import type { TextBlock } from '@flowcabal/engine'

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const { activeWorkspace, updateBlock, addBlock, removeBlock } = useStore()
  const node = activeWorkspace?.nodes.find((n: any) => n.id === nodeId)
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
          {block.kind === 'literal' && <Textarea defaultValue={block.content} onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: e.target.value })} className="min-h-[80px]" />}
          {block.kind === 'agent-inject' && <Textarea defaultValue={block.hint} placeholder="提示..." onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })} className="min-h-[60px]" />}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between mb-3"><h3 className="font-semibold">系统提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}><Plus className="w-4 h-4" /> 添加</Button></div>
        {renderBlocks(node.systemPrompt, true)}
      </div>
      <div>
        <div className="flex justify-between mb-3"><h3 className="font-semibold">用户提示</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}><Plus className="w-4 h-4" /> 添加</Button></div>
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
// store/useStore.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges, addEdge } from '@xyflow/react'
import type { Workspace } from '@flowcabal/engine'

type GuiState = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  nodes: any[]
  edges: any[]
  selectedNodeId: string | null
  floatingPanelOpen: boolean
  pinnedOutputs: string[]
  // ... 其他状态
}

class WorkspaceActions {
  #set: any
  #get: any
  constructor(set: any, get: any) { this.#set = set; this.#get = get }

  internal_switchWorkspace = (id: string) => {
    const ws = this.#get().workspaces.find((w: any) => w.id === id)
    if (!ws) return

    const nodes = ws.nodes.map((n: any) => ({
      id: n.id, type: 'flowNode', position: { x: 0, y: 0 },
      data: { label: n.label, systemPrompt: n.systemPrompt, userPrompt: n.userPrompt,
        status: ws.outputs.has(n.id) ? 'completed' : 'pending', output: ws.outputs.get(n.id) },
    }))

    const edges: any[] = []
    for (const [targetId, sources] of ws.upstream) {
      for (const sourceId of sources) {
        edges.push({ id: `e-${sourceId}-${targetId}`, source: sourceId, target: targetId, type: 'smoothstep', animated: ws.outputs.has(sourceId) })
      }
    }
    this.#set({ activeWorkspace: ws, nodes, edges })
  }

  internal_runAll = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return

    // 1. 乐观更新 - 标记所有为 pending
    this.#set((s: any) => ({ nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'pending' } })) }))

    try {
      const { outputs } = await fetch('/api/engine/run-all', { method: 'POST', body: JSON.stringify({ workspace: ws }) }).then(r => r.json())
      // 2. 成功 - 用实际输出更新
      this.#set((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: outputs[n.id] ? 'completed' : 'pending', output: outputs[n.id] } })),
      }))
    } catch {
      // 3. 错误 - 标记为 error
      this.#set((s: any) => ({ nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'error' } })) }))
    }
  }
}

export const useStore = create<GuiState>()(
  persist((set, get) => {
    const actions = new WorkspaceActions(set, get)
    return {
      workspaces: [], activeWorkspace: null, nodes: [], edges: [],
      selectedNodeId: null, floatingPanelOpen: false, pinnedOutputs: [],
      // 公开 actions（无前缀）调用内部 actions
      switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
      runAll: () => actions.internal_runAll(),
      // 直接 actions
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
  }, { name: 'flowcabal-gui-storage' })
)
```

### 乐观更新模式

```typescript
// 创建操作 - 使用临时 ID 进行乐观更新
internal_createNode: async (params) => {
  const tmpId = `temp-${Date.now()}`
  // 1. 立即添加到状态
  this.#set((s: any) => ({ nodes: [...s.nodes, { id: tmpId, ...params, status: 'pending' }] }))
  try {
    // 2. 调用后端
    const result = await api.createNode(params)
    // 3. 刷新以与服务器状态同步
    await this.internal_refreshNodes()
    return result.id
  } catch {
    // 4. 失败时移除临时项
    this.#set((s: any) => ({ nodes: s.nodes.filter((n: any) => n.id !== tmpId) }))
  }
}

// 删除操作 - 不要使用乐观更新（破坏性操作，难以恢复）
// 改为显示加载状态并刷新
internal_deleteNode: async (id) => {
  this.#set((s: any) => ({ nodes: s.nodes.map((n: any) => n.id === id ? { ...n, _deleting: true } : n) }))
  try {
    await api.deleteNode(id)
    await this.internal_refreshNodes()
  } finally {
    this.#set((s: any) => ({ nodes: s.nodes.map((n: any) => n.id === id ? { ...n, _deleting: false } : n) }))
  }
}
```

### 使用 flattenActions 的 Class-based Actions

使用 `flattenActions` 合并类实例——不要展开类对象：

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { flattenActions } from '@/store/utils'

// 带私有字段的 Slice 类
class NodeSlice {
  #set: any
  #get: any
  constructor(set: any, get: any) { this.#set = set; this.#get = get }
  internal_addNode = (params: any) => { /* ... */ }
}

export const useStore = create()(
  persist((set, get) => ({
    ...flattenActions<NodeSlice>([
      new NodeSlice(set, get),
      // 按需添加更多 slices
    ]),
  }), { name: 'storage' })
)
```

### 细粒度 Store Selectors（性能关键）

```tsx
// 不好 - 任何 store 变化都会重新渲染
const { nodes, addNode } = useStore()

// 好 - 只在特定状态变化时重新渲染
const nodes = useStore((state) => state.nodes)
const addNode = useStore((state) => state.addNode)

// 最佳 - 需要多个值时使用 useShallow
import { useShallow } from 'zustand/react/shallow'
const { nodes, edges } = useStore(useShallow((state) => ({
  nodes: state.nodes,
  edges: state.edges,
})))
```

---

## 8. API 路由

```typescript
// app/api/workspaces/route.ts
import { NextResponse } from 'next/server'
import { listWorkspaces, createWorkspace } from '@flowcabal/engine'

export async function GET() {
  return NextResponse.json({ workspaces: await listWorkspaces(rootDir()) })
}

export async function POST(request: Request) {
  const { name } = await request.json()
  return NextResponse.json({ workspace: await createWorkspace(rootDir(), name) })
}

// app/api/engine/run-all/route.ts
export async function POST(request: Request) {
  const { workspace } = await request.json()
  try {
    const executed = await runAll(workspace, config, process.cwd())
    return NextResponse.json({ executed, outputs: Object.fromEntries(workspace.outputs) })
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 })
  }
}
```

---

## 9. 记忆与手稿

### 记忆聊天页面

```tsx
// app/memory/page.tsx
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
    const { response } = await fetch('/api/memory/chat', { method: 'POST', body: JSON.stringify({ messages: [...messages, userMsg] }) }).then((r) => r.json())
    setMessages((prev) => [...prev, { role: 'assistant', content: response }])
  }

  return (
    <div className="flex flex-col h-screen">
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={cn('p-3 rounded-lg max-w-[80%]', msg.role === 'user' ? 'bg-primary text-primary-foreground ml-auto' : 'bg-muted')}>{msg.content}</div>
          ))}
        </div>
      </ScrollArea>
      <div className="p-4 border-t flex gap-2">
        <Textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} className="min-h-[44px]" />
        <Button size="icon" onClick={sendMessage}><Send className="w-4 h-4" /></Button>
      </div>
    </div>
  )
}
```

---

## 10. 固定输出页面

```tsx
// app/outputs/page.tsx
'use client'
import { useStore } from '@/store/useStore'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Copy, X } from 'lucide-react'

export default function PinnedOutputsPage() {
  const { pinnedOutputs, activeWorkspace, unpinOutput } = useStore()
  const outputs = activeWorkspace?.outputs

  return (
    <div className="container py-6">
      <h1 className="text-2xl font-semibold mb-6">固定输出</h1>
      {pinnedOutputs.length === 0 && <p className="text-muted-foreground">暂无固定的输出。</p>}
      <div className="grid gap-4">
        {pinnedOutputs.map((nodeId) => {
          const node = activeWorkspace?.nodes.find((n: any) => n.id === nodeId)
          const output = outputs?.get(nodeId)
          return (
            <Card key={nodeId}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{node?.label}</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => unpinOutput(nodeId)}><X className="w-4 h-4" /></Button>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-[300px]">{output || '（无输出）'}</pre>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(output || '')}><Copy className="w-4 h-4" /> 复制</Button>
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
// 不好 - 顺序 await（瀑布流）
const user = await fetchUser()
const posts = await fetchPosts(user.id)
const comments = await fetchComments(posts[0].id)

// 好 - 独立操作并行执行
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])

// 部分依赖时的更好做法 - 尽早开始 promises
const userPromise = fetchUser()
const postsPromise = userPromise.then(u => fetchPosts(u.id))
const commentsPromise = postsPromise.then(p => fetchComments(p[0].id))
```

### localStorage 模式

```typescript
// 始终添加版本号并处理错误
const VERSION = 'v1'

function saveData(key: string, data: any) {
  try {
    localStorage.setItem(`${key}:${VERSION}`, JSON.stringify(data))
  } catch {}
}

function loadData(key: string) {
  try {
    const raw = localStorage.getItem(`${key}:${VERSION}`)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// 数据迁移示例
function migrateData(raw: string | null, fromVersion: number): any | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data._version < fromVersion) {
      // 应用迁移
      return { ...data, _version: fromVersion }
    }
    return data
  } catch {
    return null
  }
}
```

### 动态导入

```tsx
// 对于重型组件如 Canvas
const Canvas = dynamic(() => import('./Canvas'), { ssr: false })

// 条件导入
if (isEditorOpen) {
  import('./Editor').then(m => setEditor(m.Editor))
}
```

### 渲染规则

```tsx
// 使用三元运算符，不用 && 做条件判断（避免 0/false 显示为内容）
{isLoading ? <Skeleton /> : <Content />}

// startTransition 处理非紧急更新
startTransition(() => setFilter(filterValue))

// useDeferredValue 处理昂贵渲染
const deferredFilter = useDeferredValue(filterValue)

// 避免内联组件定义
// 不好：每次父组件渲染都创建新函数
const Parent = () => <Child onClick={() => handleClick()} />

// 好：在外部定义或使用 useCallback
const handleClick = useCallback(() => {}, [])
const Parent = () => <Child onClick={handleClick} />
```

---

## 12. 代码模式

### 转换：Engine ↔ xyflow

参见 [状态管理](#7-状态管理) 中的 `switchWorkspace` 获取完整实现。提取为工具函数：

```typescript
// lib/engine-to-flow.ts
export function workspaceToFlow(ws: Workspace) {
  // 参见 store/useStore.ts 中的 switchWorkspace 实现
}
```

### 自动布局（Dagre）

```typescript
import dagre from 'dagre'
function getLayoutedElements(nodes: any[], edges: any[]) {
  const g = new dagre.graphlib.Graph().setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 })
  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 100 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return { nodes: nodes.map((n) => ({ ...n, position: { x: g.node(n.id).x - 100, y: g.node(n.id).y - 50 } })), edges }
}
```

### React 组合模式

```tsx
// 复合组件 - 避免 boolean props
<Dialog>
  <DialogHeader><TabsList><TabsTrigger value="editor"/><TabsTrigger value="outputs"/></TabsList></DialogHeader>
  <DialogContent><TabsContent value="editor"/><TabsContent value="outputs"/></DialogContent>
</Dialog>

// React 19: ref 作为普通 prop，用 use() 替代 useContext()
function Button({ ref, ...props }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) { return <button ref={ref} {...props} /> }
const value = use(MyContext)

// 避免 boolean prop 泛滥
// 不好: <Panel open={true} closable={false} collapsible={true} />
// 好: 使用复合组件或 variant 组件
```

### React 19 API

```tsx
// 不需要 forwardRef - ref 是普通 prop
export function Button({ ref, className, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={className} {...props} />
}

// 用 use() 替代 useContext()（React 19+）
const theme = use(ThemeContext)

// startTransition 处理非紧急更新
startTransition(() => { setState(newState) })

// useCallback 稳定回调
const handleClick = useCallback(() => {
  doSomething(value)
}, [value])

// useDeferredValue 处理昂贵渲染
const deferredFilter = useDeferredValue(filterValue)
```

---

## 13. 视图过渡

### Next.js 配置

```js
// next.config.js
const nextConfig = { experimental: { viewTransition: true } }
```

> **注意:** 不要安装 `react@canary`——Next.js App Router 内部已经捆绑了它。

### CSS 动画配方

添加到全局 CSS（globals.css）：

```css
:root {
  --duration-exit: 150ms;
  --duration-enter: 210ms;
  --duration-move: 400ms;
}

@keyframes fade {
  from { filter: blur(3px); opacity: 0; }
  to { filter: blur(0); opacity: 1; }
}

@keyframes slide {
  from { translate: var(--slide-offset); }
  to { translate: 0; }
}

/* 淡入淡出 */
::view-transition-old(.fade-out) { animation: var(--duration-exit) ease-in fade reverse; }
::view-transition-new(.fade-in) { animation: var(--duration-enter) ease-out var(--duration-exit) both fade; }

/* 方向性导航 */
::view-transition-old(.nav-forward) {
  --slide-offset: -60px;
  animation: var(--duration-exit) ease-in both fade reverse, var(--duration-move) ease-in-out both slide reverse;
}
::view-transition-new(.nav-forward) {
  --slide-offset: 60px;
  animation: var(--duration-enter) ease-out var(--duration-exit) both fade, var(--duration-move) ease-in-out both slide;
}
::view-transition-old(.nav-back) {
  --slide-offset: 60px;
  animation: var(--duration-exit) ease-in both fade reverse, var(--duration-move) ease-in-out both slide reverse;
}
::view-transition-new(.nav-back) {
  --slide-offset: -60px;
  animation: var(--duration-enter) ease-out var(--duration-exit) both fade, var(--duration-move) ease-in-out both slide;
}

/* 减少动画 */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
    animation-duration: 0s !important;
  }
}
```

### 核心 API（来自 'react'）

```tsx
import { ViewTransition, startTransition, addTransitionType } from 'react'
```

| API | 用途 |
|-----|---------|
| `ViewTransition` | 包装要动画化的元素（自动分配 view-transition-name） |
| `startTransition` | 包装状态变化以触发动画 |
| `addTransitionType` | 用上下文标记过渡（'nav-forward', 'nav-back'） |

### 使用模式

```tsx
// 方向性页面过渡 - 用 addTransitionType 标记
startTransition(() => {
  addTransitionType('nav-forward')
  router.push(path)
})

// 用类型键控的 VT 包装页面内容
<ViewTransition
  enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
  exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
  default="none"
>
  <Canvas />
</ViewTransition>

// Suspense 揭示带滑动动画
<Suspense fallback={<ViewTransition exit="slide-down"><Skeleton /></ViewTransition>}>
  <ViewTransition enter="fade-in" default="none"><Content /></ViewTransition>
</Suspense>

// 共享元素变形（两个视图上使用相同 name）
<ViewTransition name={`node-${nodeId}`} share="morph">
  <NodeCard />
</ViewTransition>
```

### 关键规则

| 规则 | 原因 |
|------|--------|
| **始终使用 `default="none"`** | 防止每次过渡都交叉淡入（Suspense 解决、重新验证等） |
| **VT 放在 DOM 节点之前** | `<ViewTransition><div>` 有效，`<div><ViewTransition>` 无效 |
| **`router.back()` 不触发 VT** | 使用带明确 URL 的 `router.push()` |
| **`enter` 和 `exit` 配对** | 始终双向动画化 |
| **方向性 VT 放在页面而非布局** | 布局持久化，enter/exit 不会触发 |
| **命名 VT 必须唯一** | 使用 `name={`item-${id}`}` 避免冲突 |

### 动画优先级（按顺序实现）

| 优先级 | 模式 | 传达的信息 |
|----------|---------|---------------------|
| 1 | 共享元素（`name`） | "同一个东西——深入了" |
| 2 | Suspense 揭示 | "数据加载完成" |
| 3 | 列表身份（per-item `key`） | "相同项，新排列" |
| 4 | 路由变化（布局级别） | "去新地方了" |

---

## 14. 网页设计指南

### 获取最新指南

```bash
# 从源获取最新版本
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

### 核心原则

| 原则 | 实现 |
|-----------|---------------|
| **可见的可用性暗示** | 交互元素显示状态（hover、active、disabled、focus） |
| **键盘导航** | 完全键盘支持，可见焦点指示器（`focus-visible:ring`） |
| **触摸目标** | 移动端最小 44x44px |
| **对比度** | 文本 4.5:1，UI 元素 3:1 |
| **错误预防** | 确认破坏性操作，提交前验证 |
| **动画** | 尊重 `prefers-reduced-motion` |
| **颜色独立** | 不要仅依赖颜色传达信息 |
| **输入方式** | 同等支持鼠标、触摸和键盘 |
| **延迟处理** | 显示加载状态，使用乐观更新 |
| **信任与安全** | 确认不可逆操作，提供撤销可能 |

### 可访问性检查清单

- [ ] 所有交互元素可通过键盘访问
- [ ] 焦点顺序逻辑且可见
- [ ] 触摸目标 ≥ 44x44px
- [ ] 颜色对比度符合 WCAG AA（文本 4.5:1，UI 3:1）
- [ ] 错误消息向屏幕阅读器宣布（`role="alert"`）
- [ ] 可通过 `prefers-reduced-motion` 禁用动画
- [ ] 表单验证错误与输入关联（`aria-describedby`）

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
# shadcn
npx shadcn@latest info --json        # 获取项目配置
npx shadcn@latest docs <component>   # 获取组件文档
npx shadcn@latest add <component>    # 添加组件

# xyflow
npm info @xyflow/react              # 查看最新版本
```

（文档结束 - 共 1268 行）
