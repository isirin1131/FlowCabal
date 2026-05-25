'use client'
import { useState, useCallback, useEffect, useRef } from 'react'
import { useStore, toRoman } from '@/store/useStore'
import { Prose } from './Prose'
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

  const idx = activeWorkspace && selectedNodeId
    ? activeWorkspace.nodes.findIndex((n: NodeDef) => n.id === selectedNodeId)
    : -1
  const node = idx >= 0 && activeWorkspace ? activeWorkspace.nodes[idx] : null
  const roman = idx >= 0 ? toRoman(idx + 1) : '—'

  const isRunning = !!selectedNodeId && runningNodeId === selectedNodeId
  const runningChunks = selectedNodeId ? (runningOutput.get(selectedNodeId) ?? '') : ''
  const output = activeWorkspace && selectedNodeId ? (activeWorkspace.outputs.get(selectedNodeId) ?? null) : null

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

  if (!selectedNodeId || !activeWorkspace) {
    return (
      <div className="max-w-[680px] mx-auto text-center py-12">
        <p className="font-display italic text-[14.5px] text-ink-soft">— 未选择节点 —</p>
      </div>
    )
  }

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
        <Prose>{runningChunks}</Prose>
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
          <Prose>{output}</Prose>
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
