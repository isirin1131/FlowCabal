'use client'
import { useState, useRef, useEffect, useCallback } from 'react'
import { useStore, toRoman } from '@/store/useStore'
import type { TextBlock, NodeDef, Workspace } from '@flowcabal/engine'

function AutoSaveTextarea({
  defaultValue,
  onSave,
  className,
  placeholder,
  style,
}: {
  defaultValue: string
  onSave: (value: string) => void
  className?: string
  placeholder?: string
  style?: React.CSSProperties
}) {
  const [draft, setDraft] = useState(defaultValue)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null)
  const draftRef = useRef(defaultValue)
  const defaultValueRef = useRef(defaultValue)
  const onSaveRef = useRef(onSave)

  useEffect(() => {
    onSaveRef.current = onSave
  })

  useEffect(() => {
    // 只在用户没有正在编辑的脏数据时吸收外部变化；否则只更新水位，不动 draft
    if (draftRef.current === defaultValueRef.current) {
      setDraft(defaultValue)
      draftRef.current = defaultValue
    }
    defaultValueRef.current = defaultValue
  }, [defaultValue])

  const dirty = () => draftRef.current !== defaultValueRef.current

  const flush = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (!dirty()) return
    onSaveRef.current(draftRef.current)
  }

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const v = e.target.value
    draftRef.current = v
    setDraft(v)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 800)
  }

  useEffect(() => {
    return () => {
      flush()
    }
  }, [])

  return (
    <textarea
      value={draft}
      onChange={handleChange}
      onBlur={flush}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  )
}

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

function AddMenu({ onPick, onClose, ws, currentNodeId }: {
  onPick: (block: TextBlock) => void
  onClose: () => void
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
        />
      )}
    </div>
  )
}

function RefPicker({ candidates, onPick }: {
  candidates: Array<{ node: NodeDef; index: number; canRef: boolean }>
  onPick: (nodeId: string) => void
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
      {candidates.map((c) => {
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
            <AutoSaveTextarea
              defaultValue={block.content}
              onSave={(v) => updateBlock(nodeId, isSystem, i, { kind: 'literal', content: v })}
              className="block w-full bg-transparent outline-none resize-none border-0 font-display text-[15px] text-ink leading-[1.65] min-h-[80px]"
              style={{ fieldSizing: 'content' } as React.CSSProperties}
            />
          )}
          {block.kind === 'agent-inject' && (
            <AutoSaveTextarea
              defaultValue={block.hint}
              onSave={(v) => updateBlock(nodeId, isSystem, i, { kind: 'agent-inject', hint: v })}
              placeholder="向 agent 描述要注入的内容…"
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
