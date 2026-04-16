# FlowCabal GUI Agent Guide

**Version 2.0.0** | FlowCabal GUI Agent | April 2026

> This document guides agents in building FlowCabal GUI with Next.js, @xyflow/react, shadcn/ui, Zustand, and Tailwind CSS v4.

---

## Table of Contents

1. [Project Setup](#1-project-setup)
2. [Architecture](#2-architecture)
3. [UI Components](#3-ui-components)
4. [xyflow Integration](#4-xyflow-integration)
5. [Custom Node Components](#5-custom-node-components)
6. [Floating Panels](#6-floating-panels)
7. [State Management](#7-state-management)
8. [API Routes](#8-api-routes)
9. [Memory & Manuscripts](#9-memory--manuscripts)
10. [Pinned Outputs Page](#10-pinned-outputs-page)
11. [Performance Optimization](#11-performance-optimization)
12. [Code Patterns](#12-code-patterns)
13. [View Transitions](#13-view-transitions)
14. [Web Design Guidelines](#14-web-design-guidelines)

---

## 1. Project Setup

### Tech Stack

- **Framework**: Next.js (App Router)
- **Graph UI**: @xyflow/react
- **State**: Zustand (class-based actions)
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Build**: Bun

### Installation

```bash
# Initialize Next.js with shadcn
bunx --bun create-next-app@latest flowcabal-gui --typescript --tailwind --eslint
cd flowcabal-gui

# Initialize shadcn (use npx/pnpm/bunx based on packageManager)
npx --bun shadcn@latest init --preset nova

# Add shadcn components
npx --bun shadcn@latest add button card dialog dropdown-menu textarea separator scroll-area badge

# Install dependencies
bun add @xyflow/react zustand nanoid zod dagre

# Add icons (use project's iconLibrary from shadcn info)
bun add lucide-react
```

### Tailwind CSS v4 Theme

```css
/* src/app/globals.css - Tailwind v4 CSS-first config */
@import "tailwindcss";

@theme {
  /* Semantic color tokens */
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

  /* Status colors for nodes */
  --color-status-pending: oklch(55% 0.02 264);
  --color-status-stale: oklch(72% 0.15 40);
  --color-status-completed: oklch(72% 0.15 170);
  --color-status-error: oklch(62% 0.18 27);

  /* Radius tokens */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;

  /* Animation tokens */
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
  /* ... dark variants */
}

@layer base {
  * { @apply border-border; }
  body { @apply bg-background text-foreground antialiased; }
}
```

---

## 2. Architecture

### Page Layout

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

### File Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout with providers
│   ├── page.tsx                # Main canvas (ViewTransition enabled)
│   ├── outputs/page.tsx        # Pinned Outputs page
│   ├── memory/page.tsx         # Memory chat page
│   └── manuscripts/page.tsx    # Manuscripts management
├── components/
│   ├── ui/                     # shadcn components
│   ├── Header.tsx
│   ├── Canvas.tsx              # xyflow wrapper (memoized)
│   ├── FlowNode.tsx            # Custom node (memoized with areEqual)
│   ├── FloatingPanel.tsx       # Editor/Outputs/Config (Dialog)
│   └── RunButton.tsx           # Floating Run button
├── store/
│   └── useStore.ts             # Zustand store (class-based actions)
└── lib/
    ├── api.ts                  # Engine API client
    └── utils.ts                # cn() utility
```

### Key Dependencies

| Package | Purpose | Note |
|---------|---------|------|
| `@xyflow/react` | Graph UI | Use `import '@xyflow/react/dist/style.css'` |
| `zustand` | State management | Class-based actions pattern |
| `shadcn` | UI components | Run `npx shadcn@latest info` for project config |
| `tailwindcss` | Styling | v4 uses CSS-first `@theme` |
| `dagre` | Auto-layout | For node positioning |

---

## 3. UI Components

### shadcn Critical Rules

| Category | Rule |
|----------|------|
| **Styling** | `className` for layout, not styling. Use semantic colors (`bg-primary`, never `bg-blue-500`). Use `gap-*` not `space-y-*`. Use `size-*` for equal dimensions. |
| **Forms** | Use `FieldGroup` + `Field`. Validation: `data-invalid` on Field, `aria-invalid` on control. Disabled: `data-disabled` on Field, `disabled` on control. |
| **ToggleGroups** | For 2–7 options, use `ToggleGroup` + `ToggleGroupItem` instead of looping Button with active state. |
| **InputGroups** | Always use `InputGroupInput` (not raw `Input`) and `InputGroupAddon` (not positioned Button). |
| **Composition** | Items always inside their Group (`SelectItem` → `SelectGroup`, `CommandItem` → `CommandGroup`). Use full Card composition. Dialog always needs `DialogTitle`. |
| **Icons in Button** | Use `data-icon="inline-start"` or `data-icon="inline-end"` on the icon. No sizing classes on icons. |
| **Button Loading** | Compose with `Spinner` + `data-icon` + `disabled`. No `isPending` prop. |
| **Z-index** | Never set z-index on overlay components (Dialog, Sheet, Popover). |
| **Components** | Use existing: `Alert` for callouts, `Empty` for empty states, `sonner` toast, `Skeleton` for loading, `Separator` for dividers, `Badge` for tags. |
| **FieldSet** | Use `FieldSet` + `FieldLegend` for grouping related checkboxes/radios, not `div` with heading. |

### Form Validation Pattern

```tsx
// Invalid state
<Field data-invalid>
  <FieldLabel htmlFor="email">Email</FieldLabel>
  <Input id="email" aria-invalid />
  <FieldDescription>Invalid email address.</FieldDescription>
</Field>

// Disabled state
<Field data-disabled>
  <FieldLabel htmlFor="name">Name</FieldLabel>
  <Input id="name" disabled />
</Field>

// InputGroup with search button (correct)
<InputGroup>
  <InputGroupInput placeholder="Search..." />
  <InputGroupAddon>
    <Button size="icon">
      <SearchIcon data-icon="inline-start" />
    </Button>
  </InputGroupAddon>
</InputGroup>

// FieldSet for grouped checkboxes
<FieldSet>
  <FieldLegend variant="label">Preferences</FieldLegend>
  <FieldGroup className="gap-3">
    <Field orientation="horizontal">
      <Checkbox id="dark" />
      <FieldLabel htmlFor="dark" className="font-normal">Dark mode</FieldLabel>
    </Field>
  </FieldGroup>
</FieldSet>
```

### ToggleGroup for Option Sets

```tsx
// Use ToggleGroup, not Button loops
<ToggleGroup spacing={2}>
  <ToggleGroupItem value="daily">Daily</ToggleGroupItem>
  <ToggleGroupItem value="weekly">Weekly</ToggleGroupItem>
  <ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
</ToggleGroup>
```

### Button Component (CVA)

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

// React 19: ref is regular prop
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

// Loading state: compose with Spinner, not isPending prop
export function LoadingButton({ isLoading, children, ...props }: ButtonProps & { isLoading?: boolean }) {
  return (
    <Button disabled={isLoading || props.disabled} {...props}>
      {isLoading && <Spinner data-icon="inline-start" />}
      {children}
    </Button>
  )
}
```

### Card Composition

```tsx
// Full composition - use all sub-components
<Card>
  <CardHeader>
    <CardTitle>Title</CardTitle>
    <CardDescription>Description</CardDescription>
  </CardHeader>
  <CardContent>
    <form>...</form>
  </CardContent>
  <CardFooter className="flex justify-end">
    <Button>Save</Button>
  </CardFooter>
</Card>

// Never dump everything in CardContent
```

### Dialog Structure

```tsx
<Dialog>
  <DialogHeader>
    <DialogTitle>Confirm Action</DialogTitle>    // Required!
    <DialogDescription>Are you sure?</DialogDescription>
  </DialogHeader>
  {/* Content */}
  <DialogFooter>
    <Button variant="outline">Cancel</Button>
    <Button>Confirm</Button>
  </DialogFooter>
</Dialog>
```

---

## 4. xyflow Integration

### Canvas Component (Memoized)

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

> **Performance**: Always wrap Canvas in `memo()`. Use granular selectors for xyflow state to avoid full store subscriptions.

---

## 5. Custom Node Components

### FlowNode (Memoized with Custom Comparison)

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

// Custom comparison - only re-render when these change
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

### TextBlock Type (from @flowcabal/engine)

```typescript
type TextBlock =
  | { kind: 'literal'; content: string }
  | { kind: 'ref'; ref: string }
  | { kind: 'agent-inject'; hint: string }
```

---

## 6. Floating Panels

### Floating Panel with Tabs

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
            <TabsList><TabsTrigger value="editor">Editor</TabsTrigger>
              <TabsTrigger value="outputs">Outputs</TabsTrigger><TabsTrigger value="config">Config</TabsTrigger></TabsList>
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

### Editor Panel with Block Management

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
          {block.kind === 'agent-inject' && <Textarea defaultValue={block.hint} placeholder="Hint..." onBlur={(e) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: e.target.value })} className="min-h-[60px]" />}
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div>
        <div className="flex justify-between mb-3"><h3 className="font-semibold">System Prompt</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}><Plus className="w-4 h-4" /> Add</Button></div>
        {renderBlocks(node.systemPrompt, true)}
      </div>
      <div>
        <div className="flex justify-between mb-3"><h3 className="font-semibold">User Prompt</h3>
          <Button variant="outline" size="sm" onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}><Plus className="w-4 h-4" /> Add</Button></div>
        {renderBlocks(node.userPrompt, false)}
      </div>
    </div>
  )
}
```

---

## 7. State Management

### Zustand Store (Class-based Actions Pattern)

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
  // ... other state
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

    // 1. Optimistic update - mark all as pending
    this.#set((s: any) => ({ nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'pending' } })) }))

    try {
      const { outputs } = await fetch('/api/engine/run-all', { method: 'POST', body: JSON.stringify({ workspace: ws }) }).then(r => r.json())
      // 2. Success - update with actual outputs
      this.#set((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: outputs[n.id] ? 'completed' : 'pending', output: outputs[n.id] } })),
      }))
    } catch {
      // 3. Error - mark as error
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
      // Public actions (no prefix) call internal actions
      switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
      runAll: () => actions.internal_runAll(),
      // Direct actions
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

### Optimistic Update Patterns

```typescript
// Create operations - use optimistic update with temp ID
internal_createNode: async (params) => {
  const tmpId = `temp-${Date.now()}`
  // 1. Immediately add to state
  this.#set((s: any) => ({ nodes: [...s.nodes, { id: tmpId, ...params, status: 'pending' }] }))
  try {
    // 2. Call backend
    const result = await api.createNode(params)
    // 3. Refresh to sync with server state
    await this.internal_refreshNodes()
    return result.id
  } catch {
    // 4. Remove temp on failure
    this.#set((s: any) => ({ nodes: s.nodes.filter((n: any) => n.id !== tmpId) }))
  }
}

// Delete operations - do NOT use optimistic update (destructive, hard to recover)
// Instead show loading state and refresh
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

### Class-Based Actions with flattenActions

Use `flattenActions` to merge class instances — don't spread class objects:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { flattenActions } from '@/store/utils'

// Slice class with private fields
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
      // Add more slices as needed
    ]),
  }), { name: 'storage' })
)
```

### Granular Store Selectors (Critical for Performance)

```tsx
// Bad - re-renders on any store change
const { nodes, addNode } = useStore()

// Good - only re-renders when specific state changes
const nodes = useStore((state) => state.nodes)
const addNode = useStore((state) => state.addNode)

// Best - useShallow for multiple values
import { useShallow } from 'zustand/react/shallow'
const { nodes, edges } = useStore(useShallow((state) => ({
  nodes: state.nodes,
  edges: state.edges,
})))
```

---

## 8. API Routes

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

## 9. Memory & Manuscripts

### Memory Chat Page

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

## 10. Pinned Outputs Page

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
      <h1 className="text-2xl font-semibold mb-6">Pinned Outputs</h1>
      {pinnedOutputs.length === 0 && <p className="text-muted-foreground">No outputs pinned.</p>}
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
                <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-3 rounded-lg max-h-[300px]">{output || '(no output)'}</pre>
                <Button variant="outline" size="sm" className="mt-2" onClick={() => navigator.clipboard.writeText(output || '')}><Copy className="w-4 h-4" /> Copy</Button>
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

## 11. Performance Optimization

### Critical Patterns (Priority Order)

| Priority | Pattern | Example |
|----------|---------|---------|
| 1 | **Eliminate Waterfalls** | `Promise.all()` for independent operations |
| 2 | **Bundle Size** | `next/dynamic` for heavy components |
| 3 | **Memoize** | `memo(Component, areEqual)` |
| 4 | **Granular Selectors** | `useStore((s) => s.nodes)` |
| 5 | **Avoid Inline Components** | Define outside render |

### Waterfall Elimination

```typescript
// Bad - sequential awaits (waterfall)
const user = await fetchUser()
const posts = await fetchPosts(user.id)
const comments = await fetchComments(posts[0].id)

// Good - parallel execution for independent operations
const [user, posts, comments] = await Promise.all([
  fetchUser(),
  fetchPosts(),
  fetchComments()
])

// Better for partial dependencies - start promises early
const userPromise = fetchUser()
const postsPromise = userPromise.then(u => fetchPosts(u.id))
const commentsPromise = postsPromise.then(p => fetchComments(p[0].id))
```

### localStorage Patterns

```typescript
// Always version and handle errors
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

// Migration example
function migrateData(raw: string | null, fromVersion: number): any | null {
  if (!raw) return null
  try {
    const data = JSON.parse(raw)
    if (data._version < fromVersion) {
      // Apply migrations
      return { ...data, _version: fromVersion }
    }
    return data
  } catch {
    return null
  }
}
```

### Dynamic Imports

```tsx
// For heavy components like Canvas
const Canvas = dynamic(() => import('./Canvas'), { ssr: false })

// For conditional imports
if (isEditorOpen) {
  import('./Editor').then(m => setEditor(m.Editor))
}
```

### Rendering Rules

```tsx
// Use ternary, not && for conditionals (prevents 0/false showing as content)
{isLoading ? <Skeleton /> : <Content />}

// startTransition for non-urgent updates
startTransition(() => setFilter(filterValue))

// useDeferredValue for expensive renders
const deferredFilter = useDeferredValue(filterValue)

// Avoid inline component definitions
// Bad: renders new function on every parent render
const Parent = () => <Child onClick={() => handleClick()} />

// Good: define outside or use useCallback
const handleClick = useCallback(() => {}, [])
const Parent = () => <Child onClick={handleClick} />
```

---

## 12. Code Patterns

### Conversion: Engine ↔ xyflow

See `switchWorkspace` in [State Management](#7-state-management) for the full implementation. Extract to a utility:

```typescript
// lib/engine-to-flow.ts
export function workspaceToFlow(ws: Workspace) {
  // See switchWorkspace implementation in store/useStore.ts
}
```

### Auto Layout (Dagre)

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

### React Composition Patterns

```tsx
// Compound components - avoid boolean props
<Dialog>
  <DialogHeader><TabsList><TabsTrigger value="editor"/><TabsTrigger value="outputs"/></TabsList></DialogHeader>
  <DialogContent><TabsContent value="editor"/><TabsContent value="outputs"/></DialogContent>
</Dialog>

// React 19: ref as regular prop, use() instead of useContext()
function Button({ ref, ...props }: ButtonProps & { ref?: Ref<HTMLButtonElement> }) { return <button ref={ref} {...props} /> }
const value = use(MyContext)

// Avoid boolean prop proliferation
// Bad: <Panel open={true} closable={false} collapsible={true} />
// Good: Use compound components or variant components
```

### React 19 APIs

```tsx
// No forwardRef needed - ref is a regular prop
export function Button({ ref, className, ...props }: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  return <button ref={ref} className={className} {...props} />
}

// use() instead of useContext() (React 19+)
const theme = use(ThemeContext)

// startTransition for non-urgent updates
startTransition(() => { setState(newState) })

// useCallback for stable callbacks
const handleClick = useCallback(() => {
  doSomething(value)
}, [value])

// useDeferredValue for expensive renders
const deferredFilter = useDeferredValue(filterValue)
```

---

## 13. View Transitions

### Next.js Setup

```js
// next.config.js
const nextConfig = { experimental: { viewTransition: true } }
```

> **Note:** Do NOT install `react@canary` — Next.js App Router bundles it internally.

### CSS Animation Recipes

Add these to your global CSS (globals.css):

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

/* Fade */
::view-transition-old(.fade-out) { animation: var(--duration-exit) ease-in fade reverse; }
::view-transition-new(.fade-in) { animation: var(--duration-enter) ease-out var(--duration-exit) both fade; }

/* Directional Navigation */
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

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  ::view-transition-old(*), ::view-transition-new(*), ::view-transition-group(*) {
    animation-duration: 0s !important;
  }
}
```

### Core API (from 'react')

```tsx
import { ViewTransition, startTransition, addTransitionType } from 'react'
```

| API | Purpose |
|-----|---------|
| `ViewTransition` | Wrap elements to animate (auto-assigns view-transition-name) |
| `startTransition` | Wrap state changes to trigger animations |
| `addTransitionType` | Tag transitions with context ('nav-forward', 'nav-back') |

### Usage Patterns

```tsx
// Directional page transitions - tag with addTransitionType
startTransition(() => {
  addTransitionType('nav-forward')
  router.push(path)
})

// Wrap page content with type-keyed VT
<ViewTransition
  enter={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
  exit={{ 'nav-forward': 'nav-forward', 'nav-back': 'nav-back', default: 'none' }}
  default="none"
>
  <Canvas />
</ViewTransition>

// Suspense reveal with slide animation
<Suspense fallback={<ViewTransition exit="slide-down"><Skeleton /></ViewTransition>}>
  <ViewTransition enter="fade-in" default="none"><Content /></ViewTransition>
</Suspense>

// Shared element morph (same name on two views)
<ViewTransition name={`node-${nodeId}`} share="morph">
  <NodeCard />
</ViewTransition>
```

### Critical Rules

| Rule | Reason |
|------|--------|
| **Always use `default="none"`** | Prevents cross-fade on every transition (Suspense resolves, revalidations) |
| **Place VT before DOM nodes** | `<ViewTransition><div>` works, `<div><ViewTransition>` doesn't |
| **`router.back()` doesn't trigger VTs** | Use `router.push()` with explicit URL instead |
| **Pair `enter` with `exit`** | Always animate both directions |
| **Place directional VTs in pages, not layouts** | Layouts persist, enter/exit won't fire |
| **Named VTs must be unique** | Use `name={`item-${id}`}` to avoid conflicts |

### Animation Priority (implement in order)

| Priority | Pattern | What it communicates |
|----------|---------|---------------------|
| 1 | Shared element (`name`) | "Same thing — going deeper" |
| 2 | Suspense reveal | "Data loaded" |
| 3 | List identity (per-item `key`) | "Same items, new arrangement" |
| 4 | Route change (layout-level) | "Going to a new place" |

---

## 14. Web Design Guidelines

### Fetching Latest Guidelines

```bash
# Fetch latest from source
https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md
```

### Core Principles

| Principle | Implementation |
|-----------|---------------|
| **Visible affordances** | Interactive elements show their state (hover, active, disabled, focus) |
| **Keyboard navigation** | Full keyboard support, visible focus indicators (`focus-visible:ring`) |
| **Touch targets** | Minimum 44x44px for mobile |
| **Contrast ratios** | 4.5:1 for text, 3:1 for UI elements |
| **Error prevention** | Confirm destructive actions, validate before submit |
| **Motion** | Respect `prefers-reduced-motion` |
| **Color independence** | Don't rely solely on color to convey information |
| **Input modalities** | Support mouse, touch, and keyboard equally |
| **Latency handling** | Show loading states, use optimistic updates |
| **Trust & safety** | Confirm irreversible actions, provide undo when possible |

### Accessibility Checklist

- [ ] All interactive elements are keyboard accessible
- [ ] Focus order is logical and visible
- [ ] Touch targets ≥ 44x44px
- [ ] Color contrast meets WCAG AA (4.5:1 text, 3:1 UI)
- [ ] Error messages are announced to screen readers (`role="alert"`)
- [ ] Animations can be disabled via `prefers-reduced-motion`
- [ ] Form validation errors are associated with inputs (`aria-describedby`)

---

## References

### Core Technologies

- [xyflow Documentation](https://reactflow.dev)
- [shadcn/ui](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs/upgrade-guide)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Next.js](https://nextjs.org/docs)

### Skills (detailed patterns in each skill)

| Skill | Focus Areas |
|-------|-------------|
| **xyflow-react** | AI workflow nodes, performance, subflows |
| **shadcn** | Forms, composition, CLI, validation |
| **zustand** | Class actions, optimistic updates, slices |
| **vercel-react-best-practices** | Waterfalls, bundle size, re-renders |
| **vercel-composition-patterns** | Boolean props, compound components, React 19 |
| **vercel-react-view-transitions** | CSS recipes, shared elements, Suspense |
| **tailwind-design-system** | v4 theme, animations, dark mode |
| **web-design-guidelines** | Accessibility, best practices |

### Important Commands

```bash
# shadcn
npx shadcn@latest info --json        # Get project config
npx shadcn@latest docs <component>   # Get component docs
npx shadcn@latest add <component>    # Add component

# xyflow
npm info @xyflow/react              # Check latest version
```
