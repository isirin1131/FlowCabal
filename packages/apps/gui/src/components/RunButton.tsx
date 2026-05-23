'use client'
import { useCallback } from 'react'
import { useStore, todoListCount, toRoman } from '@/store/useStore'

export function RunButton() {
  const runAll = useStore((s) => s.runAll)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const dagProgress = useStore((s) => s.dagProgress)
  const runningNodeId = useStore((s) => s.runningNodeId)

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
