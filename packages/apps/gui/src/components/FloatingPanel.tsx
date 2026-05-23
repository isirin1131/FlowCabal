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
        className="bg-paper border border-rule shadow-lift rounded-md max-w-[820px] sm:max-w-[820px]! w-[92vw] max-h-[78vh] p-0 gap-0 flex flex-col [&>button:last-child]:hidden"
      >
        <DialogTitle className="sr-only">节点面板</DialogTitle>

        {/* 顶部 chrome */}
        <div className="shrink-0 px-7 py-4 border-b border-rule-soft flex items-baseline gap-5">
          <span className="font-display text-[20px] text-clay leading-none tabular-nums">
            {roman}
          </span>

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

          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="font-display text-[18px] text-ink-faint hover:text-clay transition-colors leading-none cursor-pointer ml-3"
            aria-label="关闭"
          >
            ×
          </button>
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-7 py-6">
          {tab === 'editor' && nodeId && <EditorPanel nodeId={nodeId} />}
          {tab === 'output' && <OutputsPanel />}
        </div>

        {/* 底部 mono id */}
        <div className="shrink-0 px-7 py-3 border-t border-rule-soft font-mono text-[10.5px] text-ink-faint tracking-wide lowercase truncate">
          id: {nodeId || '—'}
        </div>
      </DialogContent>
    </Dialog>
  )
}
