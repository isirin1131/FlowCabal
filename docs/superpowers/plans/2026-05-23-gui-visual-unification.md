# GUI 视觉统一（A 期）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把所有剩余面板（FloatingPanel/EditorPanel/OutputsPanel/manuscripts/SettingsDialog）迁到 paper+clay+ink 调性，清掉 /outputs 死页与 ConfigPanel，统一节点弹窗 chrome。

**Architecture:** 视觉迁移项目。结构不动、业务逻辑不动，仅替换 className 与 chrome 元素。所有视觉令牌已在 `globals.css @theme` 中定义并通过映射兼容 shadcn 默认。本期不抽视觉原子组件，所有面板内 inline className。

**Tech Stack:** Next.js 15（packages/apps/gui 是定制 Next.js，避免假设 API 与训练数据一致）、React、Tailwind v4、shadcn/ui、zustand、xyflow、sonner 2.0.7、Lucide。

**Spec:** `docs/superpowers/specs/2026-05-23-gui-visual-unification-design.md`

**测试策略说明：** 本项目纯视觉迁移，无视觉回归测试基础设施。每个 Task 的"测试"步骤是：①`bun run typecheck:gui` 通过；②手动 `bun dev` 在浏览器验证视觉。Plan 不让 executor 启动 dev server（会阻塞）；executor 推进每个 Task 至 typecheck 通过 + commit 即可。最终 Task 给出手动验收 checklist，由用户在浏览器逐项核对。

---

## File Structure

**修改**
- `src/components/Header.tsx` — 移除 outputs 导航链接
- `src/store/useStore.ts` — 移除 pinnedOutputs 字段、togglePinOutput action、partialize 项；导出 toRoman 函数
- `src/app/manuscripts/page.tsx` — 整文件重写
- `src/components/OutputsPanel.tsx` — 整文件重写
- `src/components/EditorPanel.tsx` — 整文件重写
- `src/components/FloatingPanel.tsx` — 整文件重写
- `src/components/SettingsDialog.tsx` — 视觉迁移（业务逻辑不动）
- `src/components/ui/sonner.tsx` — 补 success/error/title/description classNames

**删除**
- `src/app/outputs/` 整目录（含 page.tsx）
- `src/components/ConfigPanel.tsx`

**不动**
- `src/components/Canvas.tsx`、`src/components/FlowNode.tsx`、`src/app/page.tsx`
- `src/app/memory/page.tsx`、`src/components/ui/*`（除 sonner）
- 所有 API routes、`src/lib/*`、engine、cli

---

## Task 1: 清理 — 删除 /outputs、ConfigPanel、Header 链接、store pinnedOutputs

**Files:**
- Delete: `src/app/outputs/page.tsx` (and the empty `outputs/` directory)
- Delete: `src/components/ConfigPanel.tsx`
- Modify: `src/components/Header.tsx` (lines 89-94)
- Modify: `src/store/useStore.ts` (multiple locations)

---

- [ ] **Step 1.1: 删除 /outputs 目录**

Run from repo root:
```bash
rm -rf packages/apps/gui/src/app/outputs
```

Expected: directory `packages/apps/gui/src/app/outputs/` no longer exists.

- [ ] **Step 1.2: 删除 ConfigPanel.tsx**

Run from repo root:
```bash
rm packages/apps/gui/src/components/ConfigPanel.tsx
```

Expected: file no longer exists.

- [ ] **Step 1.3: 从 Header 移除 outputs 导航**

Open `packages/apps/gui/src/components/Header.tsx`. Find lines 89-95:

```tsx
      <nav className="ml-auto flex items-center gap-[14px] font-body text-[13px] text-ink-soft">
        <NavLink href="/outputs">outputs</NavLink>
        <Sep />
        <NavLink href="/memory">memory</NavLink>
        <Sep />
        <NavLink href="/manuscripts">manuscripts</NavLink>
        <Sep />
```

Replace with:

```tsx
      <nav className="ml-auto flex items-center gap-[14px] font-body text-[13px] text-ink-soft">
        <NavLink href="/memory">memory</NavLink>
        <Sep />
        <NavLink href="/manuscripts">manuscripts</NavLink>
        <Sep />
```

- [ ] **Step 1.4: 从 useStore 移除 pinnedOutputs / togglePinOutput**

Open `packages/apps/gui/src/store/useStore.ts`.

(a) Remove `pinnedOutputs: string[]` from the `GuiState` type (line 16):

Old:
```ts
  selectedNodeId: string | null
  floatingPanelOpen: boolean
  pinnedOutputs: string[]
  isLoading: boolean
```

New:
```ts
  selectedNodeId: string | null
  floatingPanelOpen: boolean
  isLoading: boolean
```

(b) Remove `togglePinOutput: (id: string) => void` from the actions section (line 34):

Old:
```ts
  renameNode: (nodeId: string, label: string) => Promise<void>
  togglePinOutput: (id: string) => void
}
```

New:
```ts
  renameNode: (nodeId: string, label: string) => Promise<void>
}
```

(c) Remove `pinnedOutputs: []` from initial state (line 341):

Old:
```ts
      workspaces: [], activeWorkspace: null, nodes: [], edges: [],
      selectedNodeId: null, floatingPanelOpen: false, pinnedOutputs: [], isLoading: false,
```

New:
```ts
      workspaces: [], activeWorkspace: null, nodes: [], edges: [],
      selectedNodeId: null, floatingPanelOpen: false, isLoading: false,
```

(d) Remove the `togglePinOutput` action implementation (lines 387-392):

Old:
```ts
      selectNode: (id: string | null) => set({ selectedNodeId: id, floatingPanelOpen: id !== null }),

      togglePinOutput: (id: string) => set((s: any) => {
        const pinned = s.pinnedOutputs.includes(id)
          ? s.pinnedOutputs.filter((i: string) => i !== id)
          : [...s.pinnedOutputs, id]
        return { pinnedOutputs: pinned }
      }),
    }
```

New:
```ts
      selectNode: (id: string | null) => set({ selectedNodeId: id, floatingPanelOpen: id !== null }),
    }
```

(e) Replace the `partialize` config (lines 396-398) to drop the `pinnedOutputs` partialize. Since persist no longer has anything to save, remove the whole `persist` wrapper:

Find lines 337-400 (entire `create<GuiState>()(persist((set, get) => {...}, { name: ..., partialize: ... }))` block).

Replace this:
```ts
export const useStore = create<GuiState>()(
  persist((set, get) => {
    const actions = new WorkspaceActions(set, get)
    return {
      ...
    }
  }, {
    name: 'flowcabal-gui-storage',
    partialize: (state: any) => ({
      pinnedOutputs: state.pinnedOutputs,
    }),
  })
)
```

with this:
```ts
export const useStore = create<GuiState>()((set, get) => {
  const actions = new WorkspaceActions(set, get)
  return {
    ...
  }
})
```

(Preserve all the action wiring between `return {` and `}` exactly as-is from current source — only the persist envelope changes.)

(f) Remove the persist import. Find line 2:

Old:
```ts
import { persist } from 'zustand/middleware'
```

New: delete this line entirely.

(g) Export `toRoman` for FloatingPanel to use later. Find line 42:

Old:
```ts
function toRoman(n: number): string {
```

New:
```ts
export function toRoman(n: number): string {
```

- [ ] **Step 1.5: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0, no errors.

If there are errors about `togglePinOutput` or `pinnedOutputs` referenced elsewhere, search the repo: `grep -rn "pinnedOutputs\|togglePinOutput" packages/apps/gui/src/` — and remove those references too. The only known consumer was `app/outputs/page.tsx` (just deleted).

- [ ] **Step 1.6: commit**

```bash
git add packages/apps/gui/src/app/outputs packages/apps/gui/src/components/ConfigPanel.tsx packages/apps/gui/src/components/Header.tsx packages/apps/gui/src/store/useStore.ts
git commit -m "$(cat <<'EOF'
chore(gui): 清理 outputs 死页与 ConfigPanel

- 删除 /outputs 整目录与 Header 中的导航链接
- 删除 ConfigPanel.tsx（节点 name+ID 将在下个 task 中合入 FloatingPanel chrome）
- 移除 store 中的 pinnedOutputs 字段、togglePinOutput action、persist 包装
- 导出 toRoman 函数供 FloatingPanel 复用

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: /manuscripts 页重画

**Files:**
- Modify: `packages/apps/gui/src/app/manuscripts/page.tsx`

---

- [ ] **Step 2.1: 整文件重写 /manuscripts 页**

Replace `packages/apps/gui/src/app/manuscripts/page.tsx` entirely with:

```tsx
'use client'
import { useState, useEffect } from 'react'

export default function ManuscriptsPage() {
  const [files, setFiles] = useState<string[] | null>(null)
  const [editorName, setEditorName] = useState<string>('')
  const [opening, setOpening] = useState(false)

  useEffect(() => {
    fetch('/api/manuscripts')
      .then(r => r.json())
      .then(d => setFiles(d.files))
      .catch(() => setFiles([]))

    fetch('/api/editor/config')
      .then(r => r.json())
      .then(d => {
        const id = d.config?.default || 'vscode'
        const all = [...d.builtins, ...(d.config?.custom || [])]
        const editor = all.find((e: { id: string }) => e.id === id)
        if (editor) setEditorName(editor.name)
      })
      .catch(() => {})
  }, [])

  const openInEditor = async () => {
    setOpening(true)
    try {
      await fetch('/api/editor/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: 'manuscripts' }),
      })
    } catch {
      // ignore
    } finally {
      setOpening(false)
    }
  }

  const openLabel = opening
    ? 'opening...'
    : editorName
      ? `open in ${editorName.toLowerCase()} ↗`
      : 'open in editor ↗'

  return (
    <div className="h-full overflow-y-auto bg-paper">
      {/* 右上 open-in-editor 按钮：fixed-position 与 memory 页一致 */}
      <div className="relative">
        <div className="absolute top-6 right-8 z-10">
          <button
            type="button"
            onClick={openInEditor}
            disabled={opening}
            className="font-mono text-[10.5px] text-ink-faint hover:text-clay transition-colors disabled:opacity-50 cursor-pointer tracking-[0.14em] lowercase"
          >
            {openLabel}
          </button>
        </div>

        <section className="pt-24 pb-20 px-6">
          {/* scene-label */}
          <div className="text-center mb-12 select-none">
            <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
              <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
              manuscripts
              <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
            </span>
          </div>

          {/* 内容容器 */}
          <div className="max-w-[720px] mx-auto">
            {/* hairline well: 路径栏 + 文件列表 */}
            <div className="bg-paper-deep border border-rule rounded-md">
              <div className="px-4 py-2 border-b border-rule-soft">
                <span className="font-mono text-[11px] text-ink-soft tracking-wide">
                  memory/manuscripts/
                </span>
              </div>
              <div className="px-4 py-3">
                {files === null ? (
                  <div className="font-display italic text-[14px] text-ink-faint">
                    — 加载文件列表… —
                  </div>
                ) : files.length === 0 ? (
                  <div className="py-2 text-center font-display italic text-[14px] text-ink-soft">
                    — 尚无手稿，到编辑器中新建 —
                  </div>
                ) : (
                  <ul className="flex flex-col gap-1">
                    {files.map(f => (
                      <li key={f} className="flex items-baseline gap-3 py-1">
                        <span className="text-clay" aria-hidden="true">·</span>
                        <span className="font-display text-[15px] text-ink-soft">
                          {f}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {/* 简介 + 总数 */}
            <div className="mt-8 text-center">
              <p className="font-display italic text-[14.5px] text-ink-soft leading-[1.65]">
                手稿目录，存放小说、剧本、世界观等参考材料。
              </p>
              {files !== null && files.length > 0 && (
                <p className="mt-2 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
                  共 {files.length} 个文件
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 2.3: commit**

```bash
git add packages/apps/gui/src/app/manuscripts/page.tsx
git commit -m "$(cat <<'EOF'
feat(gui): 重画 /manuscripts 页为档案柜风

scene-label + hairline well + 文件列表（display 衬线）
右上 open-in-editor 复用 memory 页同款 mono lowercase 风
不再使用 shadcn Card / Lucide 图标

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: OutputsPanel 重画

**Files:**
- Modify: `packages/apps/gui/src/components/OutputsPanel.tsx`

---

- [ ] **Step 3.1: 整文件重写 OutputsPanel**

Replace `packages/apps/gui/src/components/OutputsPanel.tsx` entirely with:

```tsx
'use client'
import { useState, useCallback } from 'react'
import { useStore, toRoman } from '@/store/useStore'
import type { NodeDef } from '@flowcabal/engine'

const STATUS_LABEL: Record<string, string> = {
  pending: 'pending',
  stale: '需校对',
  completed: 'completed',
  error: '拒稿',
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

export function OutputsPanel() {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectedNodeId = useStore((s) => s.selectedNodeId)
  const [copied, setCopied] = useState(false)

  if (!selectedNodeId || !activeWorkspace) {
    return (
      <div className="max-w-[680px] mx-auto text-center py-12">
        <p className="font-display italic text-[14.5px] text-ink-soft">— 未选择节点 —</p>
      </div>
    )
  }

  const idx = activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === selectedNodeId)
  const node = idx >= 0 ? activeWorkspace.nodes[idx] : null
  const output = activeWorkspace.outputs.get(selectedNodeId) ?? null
  const status: 'pending' | 'completed' | 'error' | 'stale' = output ? 'completed' : 'pending'

  const handleCopy = useCallback(() => {
    if (!output) return
    navigator.clipboard.writeText(output).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    }).catch(() => {})
  }, [output])

  const roman = idx >= 0 ? toRoman(idx + 1) : '—'
  const wordCount = output ? estimateWords(output) : 0

  return (
    <div className="max-w-[680px] mx-auto">
      {/* scene-label: output · Roman · label */}
      <div className="text-center mb-3 select-none">
        <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
          <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
          output · {roman} · {node?.label || '未知节点'}
          <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
        </span>
      </div>

      {/* meta line: status · 字数 · 复制按钮 */}
      <div className="text-center mb-8 flex items-baseline justify-center gap-3 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
        <span className={status === 'error' ? 'text-error' : ''}>
          {STATUS_LABEL[status] || status}
        </span>
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

      {/* 正文 / 空态 */}
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

- [ ] **Step 3.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 3.3: commit**

```bash
git add packages/apps/gui/src/components/OutputsPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): 重画 OutputsPanel 为衬线正文排印

scene-label + meta-line（status/字数/复制）+ display 16px 1.7 行高
复制按钮 300ms 反馈
正文用 display serif 而非 mono pre

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: EditorPanel 重画

**Files:**
- Modify: `packages/apps/gui/src/components/EditorPanel.tsx`

---

- [ ] **Step 4.1: 整文件重写 EditorPanel**

Replace `packages/apps/gui/src/components/EditorPanel.tsx` entirely with:

```tsx
'use client'
import { useStore, toRoman } from '@/store/useStore'
import type { TextBlock, NodeDef } from '@flowcabal/engine'

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

export function EditorPanel({ nodeId }: { nodeId: string }) {
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const updateBlock = useStore((s) => s.updateBlock)
  const addBlock = useStore((s) => s.addBlock)
  const removeBlock = useStore((s) => s.removeBlock)

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

  const renderBlock = (block: TextBlock, i: number, isSystem: boolean) => {
    const kindLabel =
      block.kind === 'ref'
        ? `ref → ${upstreamRoman(block.nodeId)}`
        : block.kind
    return (
      <div
        key={i}
        className="bg-paper-deep border border-rule rounded-md mb-3 last:mb-0"
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
      {/* system prompt */}
      <section>
        <SceneLabel text="system prompt" />
        <div>
          {node.systemPrompt.map((b, i) => renderBlock(b, i, true))}
        </div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, true)}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
        </div>
      </section>

      {/* user prompt */}
      <section>
        <SceneLabel text="user prompt" />
        <div>
          {node.userPrompt.map((b, i) => renderBlock(b, i, false))}
        </div>
        <div className="mt-3 text-right">
          <button
            type="button"
            onClick={() => addBlock(nodeId, { kind: 'literal', content: '' }, false)}
            className="font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer"
          >
            + 添加段落
          </button>
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 4.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 4.3: commit**

```bash
git add packages/apps/gui/src/components/EditorPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): 重画 EditorPanel 为 hairline block list

每个 block 是 paper-deep + rule hairline well：
顶条 mono "n · kind" + 删除 ×
内容区裸 textarea，literal display 衬线、agent-inject italic
ref block 只读显示 "引自 II · 上游 label"
段落底部 "+ 添加段落" 文字按钮

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: FloatingPanel chrome 重画

**Files:**
- Modify: `packages/apps/gui/src/components/FloatingPanel.tsx`

---

- [ ] **Step 5.1: 整文件重写 FloatingPanel**

Replace `packages/apps/gui/src/components/FloatingPanel.tsx` entirely with:

```tsx
'use client'
import { useState, useRef, useEffect } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { EditorPanel } from './EditorPanel'
import { OutputsPanel } from './OutputsPanel'
import { useStore, toRoman } from '@/store/useStore'
import type { NodeDef } from '@flowcabal/engine'

export function FloatingPanel({ nodeId, open, onOpenChange }: {
  nodeId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [tab, setTab] = useState<'editor' | 'output'>('editor')
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const renameNode = useStore((s) => s.renameNode)

  const idx = activeWorkspace && nodeId
    ? activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === nodeId)
    : -1
  const node = idx >= 0 ? activeWorkspace!.nodes[idx] : null
  const roman = idx >= 0 ? toRoman(idx + 1) : '—'

  // ─── inline editable label ───
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(node?.label || '')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDraft(node?.label || '')
    setEditing(false)
  }, [nodeId, node?.label])

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [editing])

  const commitLabel = () => {
    if (!nodeId) { setEditing(false); return }
    const t = draft.trim()
    if (t && node && t !== node.label) {
      renameNode(nodeId, t)
    }
    setEditing(false)
  }
  const cancelLabel = () => {
    setDraft(node?.label || '')
    setEditing(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-paper border border-rule shadow-lift rounded-md
          max-w-[820px] sm:max-w-[820px]! w-[92vw]
          max-h-[78vh] p-0 gap-0
          flex flex-col
          [&>button:last-child]:hidden
        "
      >
        <DialogTitle className="sr-only">节点面板</DialogTitle>

        {/* ── 顶部 chrome ── */}
        <div className="shrink-0 px-7 py-4 border-b border-rule-soft flex items-baseline gap-5">
          {/* Roman */}
          <span className="font-display text-[20px] text-clay leading-none tabular-nums">
            {roman}
          </span>

          {/* inline editable label */}
          {editing ? (
            <input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onBlur={commitLabel}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitLabel() }
                else if (e.key === 'Escape') { cancelLabel() }
              }}
              className="bg-transparent border-b border-clay outline-none font-display text-[16px] text-ink pb-0.5 w-full max-w-[320px]"
            />
          ) : (
            <button
              type="button"
              onDoubleClick={() => { setDraft(node?.label || ''); setEditing(true) }}
              className="font-display text-[16px] text-ink leading-tight tracking-[-0.01em] cursor-text text-left truncate max-w-[320px]"
              title="双击编辑节点名称"
            >
              {node?.label || '未知节点'}
            </button>
          )}

          {/* tab toggle */}
          <div className="ml-auto flex items-baseline gap-3 font-body text-[13px]">
            <button
              type="button"
              onClick={() => setTab('editor')}
              className={[
                'relative pb-[2px] cursor-pointer transition-colors',
                tab === 'editor'
                  ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                  : 'text-ink-faint hover:text-ink',
              ].join(' ')}
            >
              editor
            </button>
            <span className="text-rule select-none">·</span>
            <button
              type="button"
              onClick={() => setTab('output')}
              className={[
                'relative pb-[2px] cursor-pointer transition-colors',
                tab === 'output'
                  ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                  : 'text-ink-faint hover:text-ink',
              ].join(' ')}
            >
              output
            </button>
          </div>

          {/* 自定义关闭 × */}
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer ml-3"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* ── 内容区 ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
          {tab === 'editor' && nodeId && <EditorPanel nodeId={nodeId} />}
          {tab === 'output' && <OutputsPanel />}
        </div>

        {/* ── 底部 mono id ── */}
        <div className="shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
          id: {nodeId || '—'}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Notes on the implementation:**
- `[&>button:last-child]:hidden` hides shadcn Dialog's built-in close button (last child of DialogContent), since we provide our own `×`.
- Tab state reset: by leaving `useState<'editor' | 'output'>('editor')` as-is (no useEffect to reset on nodeId change), the tab will persist across node switches, matching current behavior. (Current source also doesn't reset.)
- The "config" tab is gone. Node name editing is via inline-editable label in chrome. Node ID is in the footer.

- [ ] **Step 5.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 5.3: commit**

```bash
git add packages/apps/gui/src/components/FloatingPanel.tsx
git commit -m "$(cat <<'EOF'
feat(gui): 重画 FloatingPanel chrome 并合入节点 name/id

- 顶部 chrome：Roman + 双击 editable label + tab 文字开关 + 自定义 ×
- 底部：mono id 微注
- Tabs 从 3 减到 2（editor / output）
- 隐藏 shadcn Dialog 内置 close 按钮，改用文字 ×

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: SettingsDialog 重画

**Files:**
- Modify: `packages/apps/gui/src/components/SettingsDialog.tsx`

---

整文件重写。业务逻辑（state、fetchEditorConfig、fetchLlmConfigs、saveLlmConfig、deleteLlmConfig、formToConfig、PROVIDER_OPTIONS、LlmFormData 等）保留原样不动；只换 chrome、容器、表单视觉。

- [ ] **Step 6.1: 整文件重写 SettingsDialog**

Replace `packages/apps/gui/src/components/SettingsDialog.tsx` entirely with:

```tsx
'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { EditorDef, EditorConfigData } from '@/lib/editors'
import type { LlmConfig } from '@flowcabal/engine'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const PROVIDER_OPTIONS = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google AI' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'xai', label: 'xAI (Grok)' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'openai-compatible', label: 'OpenAI Compatible' },
]

const PROVIDER_LABELS: Record<string, string> = Object.fromEntries(
  PROVIDER_OPTIONS.map(o => [o.value, o.label])
)

interface LlmFormData {
  name: string
  provider: string
  baseURL: string
  apiKey: string
  model: string
  temperature: string
  maxTokens: string
  topP: string
  frequencyPenalty: string
  presencePenalty: string
}

const EMPTY_FORM: LlmFormData = {
  name: '',
  provider: 'openai',
  baseURL: '',
  apiKey: '',
  model: '',
  temperature: '',
  maxTokens: '',
  topP: '',
  frequencyPenalty: '',
  presencePenalty: '',
}

function formToConfig(data: LlmFormData): LlmConfig {
  const config: LlmConfig = {
    provider: data.provider as LlmConfig['provider'],
    apiKey: data.apiKey.trim(),
    model: data.model.trim(),
  }
  if (data.baseURL.trim()) config.baseURL = data.baseURL.trim()
  const t = parseFloat(data.temperature)
  if (!isNaN(t)) config.temperature = t
  const mt = parseInt(data.maxTokens, 10)
  if (!isNaN(mt)) config.maxTokens = mt
  const tp = parseFloat(data.topP)
  if (!isNaN(tp)) config.topP = tp
  const fp = parseFloat(data.frequencyPenalty)
  if (!isNaN(fp)) config.frequencyPenalty = fp
  const pp = parseFloat(data.presencePenalty)
  if (!isNaN(pp)) config.presencePenalty = pp
  return config
}

// ───────────────────────────────────────────────────────────────
//  Labels / Inputs / Buttons —— 局部小组件复用一致 className
// ───────────────────────────────────────────────────────────────
function FieldLabel({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <label
      className={[
        'block font-mono text-[10.5px] tracking-[0.14em] lowercase mb-1.5',
        muted ? 'text-ink-faint/80' : 'text-ink-faint',
      ].join(' ')}
    >
      {children}
    </label>
  )
}

const inputCls =
  'block w-full bg-paper-deep border border-rule rounded-md px-3 py-2 ' +
  'font-mono text-[13px] text-ink ' +
  'outline-none focus:border-clay transition-colors ' +
  'disabled:opacity-60 placeholder:text-ink-faint'

const textBtnClay =
  'font-display italic text-[14px] text-clay hover:text-clay-deep transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const textBtnInk =
  'font-display italic text-[14px] text-ink-soft hover:text-ink transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'
const textBtnError =
  'font-display italic text-[14px] text-ink-faint hover:text-error transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed'

// ───────────────────────────────────────────────────────────────
export function SettingsDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<'editor' | 'llm'>('editor')

  // ── Editor state ──
  const [builtins, setBuiltins] = useState<EditorDef[]>([])
  const [editorConfig, setEditorConfig] = useState<EditorConfigData | null>(null)
  const [editorLoading, setEditorLoading] = useState(true)
  const [editorSaving, setEditorSaving] = useState(false)

  const fetchEditorConfig = async () => {
    setEditorLoading(true)
    try {
      const res = await fetch('/api/editor/config')
      if (res.ok) {
        const data = await res.json()
        setBuiltins(data.builtins)
        setEditorConfig(data.config)
      }
    } catch {
      // ignore
    } finally {
      setEditorLoading(false)
    }
  }

  const saveEditorConfig = async () => {
    if (!editorConfig) return
    setEditorSaving(true)
    try {
      await fetch('/api/editor/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editorConfig),
      })
    } catch {
      // ignore
    } finally {
      setEditorSaving(false)
    }
  }

  // ── LLM state ──
  const [llmConfigs, setLlmConfigs] = useState<Record<string, LlmConfig> | null>(null)
  const [llmLoading, setLlmLoading] = useState(true)
  const [llmMode, setLlmMode] = useState<'list' | 'add' | 'edit'>('list')
  const [llmEditingName, setLlmEditingName] = useState('')
  const [llmForm, setLlmForm] = useState<LlmFormData>(EMPTY_FORM)
  const [llmSaving, setLlmSaving] = useState(false)
  const [llmDeleting, setLlmDeleting] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showPasswordEdited, setShowPasswordEdited] = useState(false)

  const fetchLlmConfigs = async () => {
    setLlmLoading(true)
    try {
      const res = await fetch('/api/llm-configs')
      if (res.ok) {
        const data = await res.json()
        setLlmConfigs(data.configs)
      }
    } catch {
      // ignore
    } finally {
      setLlmLoading(false)
    }
  }

  useEffect(() => {
    if (open) {
      fetchEditorConfig()
      fetchLlmConfigs()
      setTab('editor')
    }
  }, [open])

  const allEditors = editorConfig
    ? [...builtins, ...editorConfig.custom]
    : builtins

  // ── LLM actions ──

  const startAdd = () => {
    setLlmForm(EMPTY_FORM)
    setShowPassword(true)
    setShowPasswordEdited(false)
    setShowAdvanced(false)
    setLlmMode('add')
  }

  const startEdit = (name: string) => {
    const cfg = llmConfigs?.[name]
    if (!cfg) return
    setLlmForm({
      name,
      provider: cfg.provider,
      baseURL: cfg.baseURL || '',
      apiKey: cfg.apiKey,
      model: cfg.model,
      temperature: cfg.temperature?.toString() || '',
      maxTokens: cfg.maxTokens?.toString() || '',
      topP: cfg.topP?.toString() || '',
      frequencyPenalty: cfg.frequencyPenalty?.toString() || '',
      presencePenalty: cfg.presencePenalty?.toString() || '',
    })
    setShowPassword(false)
    setShowPasswordEdited(false)
    setShowAdvanced(!!(cfg.topP || cfg.frequencyPenalty || cfg.presencePenalty))
    setLlmEditingName(name)
    setLlmMode('edit')
  }

  const cancelForm = () => {
    setLlmMode('list')
    setShowPassword(false)
    setShowPasswordEdited(false)
  }

  const saveLlmConfig = async () => {
    const name = llmForm.name.trim()
    if (!name || !llmForm.apiKey.trim() || !llmForm.model.trim()) return
    setLlmSaving(true)
    try {
      const config = formToConfig(llmForm)
      await fetch('/api/llm-configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, config }),
      })
      await fetchLlmConfigs()
      setLlmMode('list')
    } catch {
      // ignore
    } finally {
      setLlmSaving(false)
    }
  }

  const deleteLlmConfig = async (name: string) => {
    setLlmDeleting(name)
    try {
      await fetch(`/api/llm-configs/${encodeURIComponent(name)}`, { method: 'DELETE' })
      await fetchLlmConfigs()
    } catch {
      // ignore
    } finally {
      setLlmDeleting(null)
    }
  }

  // ── Helpers ──

  const passwordValue = llmMode === 'edit' && !showPasswordEdited
    ? (llmForm.apiKey ? '••••••••' : '')
    : llmForm.apiKey

  const formValid = llmForm.name.trim() && llmForm.apiKey.trim() && llmForm.model.trim()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-paper border border-rule shadow-lift rounded-md
          max-w-[720px] sm:max-w-[720px]! w-[92vw]
          max-h-[82vh] p-0 gap-0
          flex flex-col
          [&>button:last-child]:hidden
        "
      >
        <DialogTitle className="sr-only">设置</DialogTitle>

        {/* ── 顶部 chrome ── */}
        <div className="shrink-0 px-7 py-4 border-b border-rule-soft relative">
          <div className="text-center select-none">
            <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
              <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
              settings
              <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-6 top-1/2 -translate-y-1/2 font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* ── tab toggle ── */}
        <div className="shrink-0 px-7 py-3 border-b border-rule-soft flex items-baseline gap-3 font-body text-[13px]">
          <button
            type="button"
            onClick={() => setTab('editor')}
            className={[
              'relative pb-[2px] cursor-pointer transition-colors',
              tab === 'editor'
                ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                : 'text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            editor
          </button>
          <span className="text-rule select-none">·</span>
          <button
            type="button"
            onClick={() => setTab('llm')}
            className={[
              'relative pb-[2px] cursor-pointer transition-colors',
              tab === 'llm'
                ? 'text-ink after:content-[\'\'] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-px after:bg-clay'
                : 'text-ink-faint hover:text-ink',
            ].join(' ')}
          >
            llm
          </button>
        </div>

        {/* ── 内容区 ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
          {tab === 'editor' && (
            <div>
              <div className="mb-2 font-display italic text-[16px] text-ink">默认编辑器</div>
              <p className="font-body text-[13px] text-ink-soft mb-5 leading-[1.55]">
                在本地打开文件时使用的编辑器。
              </p>
              {editorLoading ? (
                <div className="font-display italic text-[14px] text-ink-faint">— 加载中… —</div>
              ) : (
                <>
                  <FieldLabel>当前默认</FieldLabel>
                  <Select
                    value={editorConfig?.default || 'vscode'}
                    onValueChange={(value) =>
                      setEditorConfig(prev => prev ? { ...prev, default: value } : null)
                    }
                  >
                    <SelectTrigger className="!h-auto bg-paper-deep border border-rule rounded-md px-3 py-2 font-mono text-[13px] text-ink !ring-0 focus:border-clay">
                      <SelectValue placeholder="选择编辑器" />
                    </SelectTrigger>
                    <SelectContent className="bg-paper border-rule font-mono text-[13px]">
                      {allEditors.map((editor) => (
                        <SelectItem key={editor.id} value={editor.id}>
                          {editor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <div className="mt-6 flex justify-end">
                    <button
                      type="button"
                      onClick={saveEditorConfig}
                      disabled={editorSaving}
                      className={textBtnClay}
                    >
                      {editorSaving ? '保存中…' : '保存 →'}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {tab === 'llm' && (
            <div>
              {llmMode === 'list' ? (
                <>
                  <div className="mb-2 font-display italic text-[16px] text-ink">LLM 配置</div>
                  <p className="font-body text-[13px] text-ink-soft mb-5 leading-[1.55]">
                    命名为 <span className="font-mono text-[12px]">default</span> 的配置将作为默认 LLM。
                  </p>

                  {llmLoading ? (
                    <div className="font-display italic text-[14px] text-ink-faint">— 加载中… —</div>
                  ) : !llmConfigs || Object.keys(llmConfigs).length === 0 ? (
                    <div className="text-center py-6 font-display italic text-[14px] text-ink-soft">
                      — 暂无 LLM 配置 —
                    </div>
                  ) : (
                    <ul className="flex flex-col">
                      {Object.entries(llmConfigs).map(([name, cfg]) => (
                        <li
                          key={name}
                          className="px-2 py-3 border-b border-rule-soft last:border-b-0 flex items-baseline gap-3"
                        >
                          <span className="font-display text-[14.5px] text-ink shrink-0">
                            {name}
                          </span>
                          {name === 'default' && (
                            <span className="font-display italic text-[12.5px] shrink-0">
                              <span className="text-clay">〔</span>
                              <span className="text-ink-soft mx-0.5">default</span>
                              <span className="text-clay">〕</span>
                            </span>
                          )}
                          <span className="font-display italic text-[12.5px] shrink-0">
                            <span className="text-clay">〔</span>
                            <span className="text-ink-soft mx-0.5">
                              {PROVIDER_LABELS[cfg.provider] || cfg.provider}
                            </span>
                            <span className="text-clay">〕</span>
                          </span>
                          <span className="font-mono text-[11px] text-ink-faint truncate flex-1 min-w-0">
                            {cfg.model}
                          </span>
                          <button
                            type="button"
                            onClick={() => startEdit(name)}
                            className={`${textBtnInk} shrink-0`}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteLlmConfig(name)}
                            disabled={llmDeleting === name}
                            className={`${textBtnError} shrink-0`}
                          >
                            {llmDeleting === name ? '删除中…' : '删除'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="mt-5">
                    <button type="button" onClick={startAdd} className={textBtnClay}>
                      + 添加配置
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-5">
                  <div className="font-display italic text-[16px] text-ink">
                    {llmMode === 'add' ? '添加 LLM 配置' : `编辑 "${llmEditingName}"`}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>名称</FieldLabel>
                      <input
                        type="text"
                        value={llmForm.name}
                        onChange={e => setLlmForm(p => ({ ...p, name: e.target.value }))}
                        disabled={llmMode === 'edit'}
                        placeholder="如 default"
                        className={inputCls}
                      />
                      {llmMode === 'add' && (
                        <p className="mt-1.5 font-mono text-[10.5px] text-ink-faint tracking-wide lowercase">
                          命名为 default 即为默认
                        </p>
                      )}
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>提供商</FieldLabel>
                      <Select
                        value={llmForm.provider}
                        onValueChange={v => setLlmForm(p => ({ ...p, provider: v }))}
                      >
                        <SelectTrigger className="!h-auto bg-paper-deep border border-rule rounded-md px-3 py-2 font-mono text-[13px] text-ink !ring-0 focus:border-clay">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-paper border-rule font-mono text-[13px]">
                          {PROVIDER_OPTIONS.map(o => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {llmForm.provider === 'openai-compatible' && (
                      <div className="col-span-2">
                        <FieldLabel>Base URL</FieldLabel>
                        <input
                          type="text"
                          value={llmForm.baseURL}
                          onChange={e => setLlmForm(p => ({ ...p, baseURL: e.target.value }))}
                          placeholder="如 https://api.deepseek.com/v1"
                          className={inputCls}
                        />
                      </div>
                    )}

                    <div className="col-span-2">
                      <FieldLabel>API Key</FieldLabel>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={passwordValue}
                          onChange={e => {
                            setLlmForm(p => ({ ...p, apiKey: e.target.value }))
                            if (llmMode === 'edit') setShowPasswordEdited(true)
                          }}
                          placeholder="sk-..."
                          className={`${inputCls} pr-16`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[11px] text-ink-faint hover:text-clay transition-colors tracking-wide cursor-pointer"
                        >
                          {showPassword ? '隐藏' : '显示'}
                        </button>
                      </div>
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel>模型</FieldLabel>
                      <input
                        type="text"
                        value={llmForm.model}
                        onChange={e => setLlmForm(p => ({ ...p, model: e.target.value }))}
                        placeholder="如 gpt-4o"
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel muted>温度</FieldLabel>
                      <input
                        type="number"
                        min="0"
                        max="2"
                        step="0.1"
                        value={llmForm.temperature}
                        onChange={e => setLlmForm(p => ({ ...p, temperature: e.target.value }))}
                        placeholder="0.7"
                        className={inputCls}
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-1">
                      <FieldLabel muted>Max Tokens</FieldLabel>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={llmForm.maxTokens}
                        onChange={e => setLlmForm(p => ({ ...p, maxTokens: e.target.value }))}
                        placeholder="4096"
                        className={inputCls}
                      />
                    </div>
                  </div>

                  {/* 高级 */}
                  <button
                    type="button"
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className="self-start font-mono text-[11px] text-ink-faint hover:text-ink transition-colors tracking-wide lowercase cursor-pointer"
                  >
                    {showAdvanced ? '▾ 高级参数' : '▸ 高级参数'}
                  </button>

                  {showAdvanced && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <FieldLabel muted>Top P</FieldLabel>
                        <input
                          type="number"
                          min="0"
                          max="1"
                          step="0.1"
                          value={llmForm.topP}
                          onChange={e => setLlmForm(p => ({ ...p, topP: e.target.value }))}
                          placeholder="1.0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <FieldLabel muted>Frequency Penalty</FieldLabel>
                        <input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.frequencyPenalty}
                          onChange={e => setLlmForm(p => ({ ...p, frequencyPenalty: e.target.value }))}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <FieldLabel muted>Presence Penalty</FieldLabel>
                        <input
                          type="number"
                          min="-2"
                          max="2"
                          step="0.1"
                          value={llmForm.presencePenalty}
                          onChange={e => setLlmForm(p => ({ ...p, presencePenalty: e.target.value }))}
                          placeholder="0"
                          className={inputCls}
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex gap-6 justify-end mt-2">
                    <button type="button" onClick={cancelForm} className={textBtnInk}>
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={saveLlmConfig}
                      disabled={!formValid || llmSaving}
                      className={textBtnClay}
                    >
                      {llmSaving ? '保存中…' : '保存 →'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
```

**Implementation notes:**
- `[&>button:last-child]:hidden` hides shadcn Dialog's built-in close button (we provide our own `×` in chrome).
- Form input now uses native `<input>` instead of shadcn `<Input>`, but `<Select>` is kept (shadcn Select handles popover behavior; we just override trigger className).
- All business logic (state, fetch/save/delete handlers, `formToConfig`, `EMPTY_FORM`, `PROVIDER_OPTIONS`) is preserved byte-for-byte from the original.
- Lucide icons (Pencil, Trash2, Plus, Eye, EyeOff, ChevronDown, ChevronRight) and shadcn `<Input>`, `<Button>`, `<Badge>`, `<DialogHeader>`, `<DialogFooter>`, `<TabsList>`, `<TabsTrigger>`, `<TabsContent>` are removed from imports.

- [ ] **Step 6.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 6.3: commit**

```bash
git add packages/apps/gui/src/components/SettingsDialog.tsx
git commit -m "$(cat <<'EOF'
feat(gui): 重画 SettingsDialog 视觉

- 顶部 scene-label "— — settings — —" + 自定义 ×
- tab 文字开关（editor / llm），取代 shadcn TabsList
- LLM 列表项用 hairline 列表 + 〔 provider 〕文字标签
- 表单字段用裸 input + paper-deep + rule，FieldLabel 是 mono lowercase
- "显示/隐藏" 文字代替 Lucide Eye 图标
- "▸/▾ 高级参数" 代替 Chevron 图标
- 操作按钮全文字风（clay 主、ink-soft 次、error 危险）
- 业务逻辑完全不动

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Toast (sonner) classNames 补全

**Files:**
- Modify: `packages/apps/gui/src/components/ui/sonner.tsx`

---

- [ ] **Step 7.1: 在 Toaster 中补 classNames**

Replace `packages/apps/gui/src/components/ui/sonner.tsx` entirely with:

```tsx
"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-paper)",
          "--normal-text": "var(--color-ink)",
          "--normal-border": "var(--color-rule)",
          "--border-radius": "6px",
          fontFamily: "var(--font-body)",
          fontSize: "13px",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "!bg-paper !border !border-rule !shadow-paper !rounded-md " +
            "!font-display !text-[14px] !text-ink",
          title: "!text-ink",
          description: "!text-ink-soft",
          actionButton: "!text-clay",
          cancelButton: "!text-ink-faint",
          error: "!border-error !text-error",
          success: "!border-clay !text-ink",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
```

**Notes:**
- `!` Tailwind important modifiers override sonner's internal class merging.
- success: uses clay border + ink text (not green).
- error: uses error red border + error text.
- If sonner 2.x renames any of these keys, executor should check `node_modules/sonner/dist/index.d.ts` for current ToasterProps classNames keys and adjust.

- [ ] **Step 7.2: typecheck**

Run from repo root:
```bash
bun run typecheck:gui
```

Expected: exit code 0.

- [ ] **Step 7.3: commit**

```bash
git add packages/apps/gui/src/components/ui/sonner.tsx
git commit -m "$(cat <<'EOF'
feat(gui): Toaster 视觉补全（success/error/title/description）

延续 paper + rule + display 衬线调性
success 用 clay 边，不再绿色；error 用 error 红

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: 最终 typecheck + 全栈手动验收

**Files:** （无修改，仅验证）

---

- [ ] **Step 8.1: 全量 typecheck**

Run from repo root:
```bash
bun run typecheck:gui && bun run typecheck
```

Expected: 两条都 exit code 0。

- [ ] **Step 8.2: 启动 dev server（用户手动）**

This step is for the **user** to perform — not the executor. Tell the user:

> "现在请在终端运行 `bun dev`，然后在浏览器打开 `http://localhost:3000` 逐项验收下面的 checklist。"

- [ ] **Step 8.3: 手动验收 checklist**

User performs in browser:

**画布主页（视觉不变）**
- [ ] FlowNode、Header 顶栏、ZoomReadout（zoom XX% / ⌘0 fit）、LayoutButton（— 自动排版）样式与本期前相同
- [ ] Header 导航中没有 `outputs` 链接，剩 `memory · manuscripts · ⋯`
- [ ] 直接访问 `http://localhost:3000/outputs` 应得到 Next.js 404 页

**节点弹窗（点击任意节点）**
- [ ] Dialog 容器是 paper 底 + rule 边 + shadow-lift，无裸 shadcn 圆角 xl
- [ ] 顶部 chrome 单行 baseline：Roman 数字（clay 色）+ 节点 label + 右侧 tab 切换 + 自定义 `×`
- [ ] 双击 label 进入编辑态（clay 下划线 input），Enter 提交、Esc 还原
- [ ] tab 切换文字风：选中态 ink + clay 下划线，未选 ink-faint，中间 `·` 分隔
- [ ] 自定义 `×` 在右上（不是 shadcn 的 lucide X）
- [ ] editor tab：两段 `— — system prompt — —` / `— — user prompt — —` scene-label；每个 block 是 paper-deep + rule hairline well；删除 `×`；底部 `+ 添加段落`
- [ ] output tab：scene-label `— — output · III · 节点名 — —`；meta line `completed · 1,247 字 · 复制 ↗`；正文衬线 16px 1.7 行高；空态显示 `— 此节点尚未付印 —`
- [ ] 底部一行 mono `id: nd_xxxxx`

**节点 CRUD（回归）**
- [ ] 双击空白处仍可创建节点
- [ ] 右键节点仍弹出 ContextMenu 「添加子节点 / 复制节点 / 删除节点」
- [ ] 拉线连接节点仍能成功（ref block 被加到目标节点的 systemPrompt）
- [ ] 删除连线后，对应 ref block 也从目标节点消失（已知行为；如本期前已破，本期不修）

**EditorPanel 编辑（回归）**
- [ ] literal block 内编辑文本，blur 后再次打开节点保留
- [ ] agent-inject 编辑同上
- [ ] `+ 添加段落` 能在对应段加 literal
- [ ] 删除 `×` 能删除 block
- [ ] 如该节点有 ref block（即来自连线），显示为 `引自 II · 上游节点名`（不可编辑），删除按钮可用

**运行（回归）**
- [ ] Header 「付印」按钮可点（前提是有 LLM 配置且有节点）
- [ ] 运行后 output tab 显示生成内容

**/manuscripts**
- [ ] 顶部居中 `— — manuscripts — —` scene-label
- [ ] 右上 `open in <editor> ↗` mono 风按钮
- [ ] 中间 hairline well：顶条 `memory/manuscripts/` mono，下方文件列表（`· filename`）
- [ ] 空目录时显示 `— 尚无手稿，到编辑器中新建 —`
- [ ] loading 时显示 `— 加载文件列表… —`
- [ ] 简介行 + `共 N 个文件` mono 元数据

**/memory（回归，不应受影响）**
- [ ] memory chat 视觉与本期前一致：scene label、衬线 prose、`〔 toolName · detail 〕`、reasoning 折叠、ToolDrawer、ConversationsSidebar

**SettingsDialog（Header `⋯` → 设置...）**
- [ ] 顶部 `— — settings — —` scene-label
- [ ] tab 文字开关 `editor · llm`
- [ ] editor tab：display heading「默认编辑器」+ 说明 + Select + 保存按钮（文字风）
- [ ] llm tab list 模式：display heading + 说明 + 列表项 `name 〔 default 〕 〔 anthropic 〕 model · 编辑 · 删除`
- [ ] 「+ 添加配置」文字按钮可点
- [ ] llm tab add/edit 模式：FieldLabel mono lowercase；input 是 paper-deep + rule mono；API Key 字段右侧「显示/隐藏」文字（不是 Eye 图标）
- [ ] 「▸ 高级参数」文字（不是 Chevron 图标），点击展开为 「▾」并显示三个高级字段
- [ ] 「取消 / 保存 →」底部右侧文字按钮
- [ ] LLM CRUD 全流程仍工作（增加一个测试配置 → 编辑它 → 删除它）

**Toast**
- [ ] 触发一个 toast（例如运行一个空 workspace 应看到 `引擎未返回结果` 提示）—— 视觉是 paper 底 + rule 边 + display 衬线
- [ ] 触发一个 error toast（例如创建 workspace 后立即网络断开，难制造；如果触发，看 border 是 error 红）

**全局**
- [ ] 任意页面切换不报 console 错误
- [ ] 视觉上没有再出现「shadcn 默认风格的 Card / Badge / 圆角 xl」的孤儿（除了已知不动的 ui/* 内部，如 Select 弹出菜单）

- [ ] **Step 8.4: 给用户报告**

If all checklist items pass, tell the user:

> "GUI 视觉统一（A 期）完成。所有 Tasks 已合到 GUI_support。下一步可进入 B+D 期（节点交互模型重做）或 C+E 期（target/stale/preview + 运行可视化）。"

If anything fails: report which checklist item failed, paste any console errors, and stop. Do not attempt to "fix" issues that look like spec gaps — escalate to user for guidance.

---

## Self-Review

**Spec coverage** — spec 各节是否都有任务覆盖：
- ✅ §2.1 重画 5 个面板 → Task 2-6
- ✅ §2.2 删除 3 项 → Task 1
- ✅ §2.3 结构变化（Tabs 3→2、name 上移、ID 下移）→ Task 5（FloatingPanel chrome）
- ✅ §3 视觉令牌（不动）→ 不需要任务
- ✅ §4 视觉约定（inline className）→ 各 Task 内 inline 实现
- ✅ §5.1 FloatingPanel → Task 5
- ✅ §5.2 EditorPanel → Task 4
- ✅ §5.3 OutputsPanel → Task 3
- ✅ §5.4 /manuscripts → Task 2
- ✅ §5.5 SettingsDialog → Task 6
- ✅ §5.6 Header → Task 1 Step 1.3
- ✅ §5.7 Toast → Task 7
- ✅ §6 后端不动 → 不需要任务
- ✅ §7 验收 → Task 8

**Placeholder scan** — 无 TBD / TODO / "略" / "类似" / "稍后" 等占位。所有代码块完整。

**Type consistency** —
- `toRoman` 在 Task 1.4 (g) 中 export，在 Task 3、4、5 中 `import { useStore, toRoman } from '@/store/useStore'`。✓
- `estimateWords` 在 Task 3 中本地定义（FlowNode.tsx 中原版未 export，按 spec §5.3 复制粘贴）。✓
- `FieldLabel`、`inputCls`、`textBtnClay`、`textBtnInk`、`textBtnError` 在 Task 6 整文件内一致引用。✓
- `Workspace.nodes` 数组上的 `findIndex`/`find` 使用：Task 3 与 Task 5 中 idx 计算保持相同模式。✓

---
