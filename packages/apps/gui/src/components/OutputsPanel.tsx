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
  const status: 'pending' | 'completed' = output ? 'completed' : 'pending'

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
      <div className="text-center mb-3 select-none">
        <span className="font-mono text-[10.5px] text-ink-faint tracking-[0.18em] lowercase">
          <span className="text-rule mr-[18px] tracking-[-1px]">— —</span>
          output · {roman} · {node?.label || '未知节点'}
          <span className="text-rule ml-[18px] tracking-[-1px]">— —</span>
        </span>
      </div>

      <div className="text-center mb-8 flex items-baseline justify-center gap-3 font-mono text-[10.5px] text-ink-faint tracking-[0.14em] lowercase">
        <span>
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
