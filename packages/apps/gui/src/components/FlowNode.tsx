'use client'
import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { TextBlock } from '@flowcabal/engine'
import { useStore, getStaleKindForNode } from '@/store/useStore'

type FlowNodeData = {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'completed' | 'running'
  output: string | null
  roman: string
  refRomans: string[]
  _deleting?: boolean
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

function FlowNode({ id, data, selected }: NodeProps<FlowNodeType>) {
  const isDeleting = (data as unknown as Record<string, unknown>)._deleting === true
  const runningNodeId = useStore((s) => s.runningNodeId)
  const activeWorkspace = useStore((s) => s.activeWorkspace)

  const isRunning = runningNodeId === id
  const inTarget = activeWorkspace?.target_nodes.includes(id) ?? false
  const hasOutput = !!data.output
  const staleKind = getStaleKindForNode(activeWorkspace, id)

  // status 派生：running 优先 > target+pending/completed > completed
  let visualStatus: 'target-pending' | 'target-completed' | 'completed' | 'running'
  if (isRunning) visualStatus = 'running'
  else if (inTarget && !hasOutput) visualStatus = 'target-pending'
  else if (inTarget && hasOutput) visualStatus = 'target-completed'
  else visualStatus = 'completed'

  const sysCount = data.systemPrompt?.length ?? 0
  const usrCount = data.userPrompt?.length ?? 0
  const refs = data.refRomans ?? []

  const wordCount = data.output ? estimateWords(data.output) : null

  // 顶描边 + 尾栏色 + 背景
  const topBorderClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed')
    ? 'border-t-[1.5px] border-t-clay-deep'
    : 'border-t-[1px] border-t-rule'
  const footerColorClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed' || visualStatus === 'running')
    ? 'text-clay-deep'
    : 'text-ink-faint'
  const footerDotClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed' || visualStatus === 'running')
    ? 'bg-clay-deep'
    : 'bg-ink'
  const footerBorderClass = (visualStatus === 'target-pending' || visualStatus === 'target-completed')
    ? 'border-t border-t-clay-deep/30'
    : 'border-t border-t-rule-soft'

  // running 叠加层
  const runningClass = isRunning
    ? 'border-x-[1.5px] border-b-[1.5px] !border-clay-deep !border-t-[2.5px] bg-[#FAF3DD]'
    : ''
  const runningShadow = isRunning
    ? { boxShadow: '0 0 0 4px rgba(182,92,69,0.12), 0 0 18px rgba(182,92,69,0.25)' }
    : {}

  // 选中外环（ink box-shadow）
  const selectedShadow = selected
    ? { boxShadow: isRunning
        ? '0 0 0 1.5px #3F392C, 0 0 0 4px rgba(182,92,69,0.12), 0 0 18px rgba(182,92,69,0.25)'
        : '0 0 0 1.5px #3F392C' }
    : {}

  // status 文字 + 字数
  const statusText =
    visualStatus === 'target-pending' ? '待运行' :
    visualStatus === 'target-completed' ? '待重跑' :
    visualStatus === 'running' ? '正在生成…' :
    'completed'

  return (
    <article
      style={{ ...runningShadow, ...selectedShadow }}
      className={[
        'relative bg-paper-deep border-x border-b border-rule rounded-md',
        'min-w-[220px] max-w-[260px]',
        'transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out',
        'animate-node-enter',
        topBorderClass,
        runningClass,
        isDeleting ? 'opacity-40 scale-[0.97]' : 'opacity-100 scale-100',
      ].filter(Boolean).join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="t"
        className="!opacity-0 !pointer-events-none"
      />

      {staleKind && (
        <span
          className="absolute top-2 right-3 font-display italic text-[14px] leading-none z-10"
          style={{
            color: staleKind === 'direct'
              ? 'var(--color-clay-deep)'
              : 'rgba(182, 92, 69, 0.45)',
          }}
          aria-label={staleKind === 'direct' ? '已编辑，待重跑' : '上游已变，待重跑'}
        >
          ✱
        </span>
      )}

      <div className="px-[22px] pt-[16px] pb-[14px]">
        {/* Roman numeral */}
        <div className="font-display font-medium leading-none text-[28px] text-clay-deep">
          {data.roman || '—'}
        </div>

        {/* Title */}
        <h3 className="font-display text-[16px] font-medium text-ink leading-tight mt-[8px] tracking-[-0.01em]">
          {data.label}
        </h3>

        {/* Meta */}
        <div className="mt-[12px] font-body text-[11px] text-ink-faint leading-[1.7] tabular-nums">
          <div className="flex items-baseline gap-2">
            <span className="font-display italic text-[12px] text-ink-soft">系统</span>
            <span>
              {sysCount} 段
              {refs.length > 0 && (
                <> · 引自 {refs.join(', ')}</>
              )}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="font-display italic text-[12px] text-ink-soft">用户</span>
            <span>{usrCount} 段</span>
          </div>
        </div>

        {/* Foot */}
        <div
          className={[
            'mt-[14px] pt-[10px] flex items-center justify-between',
            'font-body text-[10.5px] tracking-wide lowercase',
            footerBorderClass,
          ].join(' ')}
        >
          <span className={`flex items-center gap-[6px] ${footerColorClass}`}>
            <span className={`inline-block w-[5px] h-[5px] rounded-full ${footerDotClass}`} aria-hidden="true" />
            <span>{statusText}</span>
          </span>
          <span className="text-ink-faint tabular-nums">
            {wordCount !== null ? `${wordCount.toLocaleString()} 字` : '—'}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="s"
        className="!opacity-0 !pointer-events-none"
      />
    </article>
  )
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

function areEqual(prev: NodeProps<FlowNodeType>, next: NodeProps<FlowNodeType>) {
  return (
    prev.id === next.id &&
    prev.data.label === next.data.label &&
    prev.data.systemPrompt?.length === next.data.systemPrompt?.length &&
    prev.data.userPrompt?.length === next.data.userPrompt?.length &&
    prev.data.status === next.data.status &&
    prev.data.output === next.data.output &&
    prev.data.roman === next.data.roman &&
    (prev.data.refRomans?.join(',') ?? '') === (next.data.refRomans?.join(',') ?? '') &&
    prev.selected === next.selected &&
    (prev.data as unknown as Record<string, unknown>)._deleting ===
    (next.data as unknown as Record<string, unknown>)._deleting
  )
}

export default memo(FlowNode, areEqual)
