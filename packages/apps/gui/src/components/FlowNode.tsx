'use client'
import { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { TextBlock } from '@flowcabal/engine'

type FlowNodeData = {
  label: string
  systemPrompt: TextBlock[]
  userPrompt: TextBlock[]
  status: 'pending' | 'stale' | 'completed' | 'error'
  output: string | null
  roman: string
  refRomans: string[]
  _deleting?: boolean
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

const STATUS_LABEL: Record<string, string> = {
  pending:   'pending',
  stale:     '需校对',
  completed: 'completed',
  error:     '拒稿',
}

function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const isDeleting = (data as unknown as Record<string, unknown>)._deleting === true
  const status = data.status

  const sysCount = data.systemPrompt?.length ?? 0
  const usrCount = data.userPrompt?.length ?? 0
  const refs = data.refRomans ?? []

  const wordCount = data.output ? estimateWords(data.output) : null

  return (
    <article
      className={[
        'relative bg-paper-deep border rounded-md',
        'min-w-[220px] max-w-[260px]',
        'transition-[border-color,box-shadow,opacity,transform] duration-200 ease-out',
        'animate-node-enter',
        selected ? 'border-clay shadow-paper' : 'border-rule shadow-paper hover:border-[#C9BFAA]',
        status === 'completed' ? 'border-t-clay' : '',
        status === 'error' ? 'border-error' : '',
        isDeleting ? 'opacity-40 scale-[0.97]' : 'opacity-100 scale-100',
      ].filter(Boolean).join(' ')}
    >
      <Handle
        type="target"
        position={Position.Top}
        id="system"
        className="!left-[35%]"
      />
      <Handle
        type="target"
        position={Position.Top}
        id="user"
        className="!left-[65%]"
      />

      <div className="px-[22px] pt-[16px] pb-[14px]">
        {/* Roman numeral */}
        <div
          className={[
            'font-display font-medium leading-none',
            'text-[28px]',
            status === 'error' ? 'text-error' :
            status === 'stale' ? 'text-clay-deep italic border-b border-dashed border-clay inline-block pb-px' :
            'text-clay',
          ].join(' ')}
        >
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
            'border-t',
            status === 'completed' ? 'border-clay' : 'border-rule-soft',
          ].join(' ')}
        >
          <span className="flex items-center gap-[6px] text-ink-faint">
            <StatusDot status={status} />
            <span className={
              status === 'error' ? 'text-error' :
              status === 'completed' ? 'text-ink-soft' :
              'text-ink-faint'
            }>{STATUS_LABEL[status] || status}</span>
          </span>
          <span className="text-ink-faint tabular-nums">
            {wordCount !== null ? `${wordCount.toLocaleString()} 字` : '—'}
          </span>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        id="output"
        className="!left-1/2"
      />
    </article>
  )
}

function StatusDot({ status }: { status: string }) {
  const base = 'inline-block rounded-full'
  if (status === 'pending') {
    return <span className={`${base} w-[5px] h-[5px] border border-ink-faint`} aria-hidden="true" />
  }
  if (status === 'completed') {
    return <span className={`${base} w-[5px] h-[5px] bg-ink`} aria-hidden="true" />
  }
  if (status === 'stale') {
    return <span className={`${base} w-[5px] h-[5px] bg-clay`} aria-hidden="true" />
  }
  if (status === 'error') {
    return <span className={`${base} w-[5px] h-[5px] bg-error`} aria-hidden="true" />
  }
  return <span className={`${base} w-[5px] h-[5px] bg-ink-faint`} aria-hidden="true" />
}

function estimateWords(text: string): number {
  // 中英混合粗估：中文字符按 1，连续英文单词按 1
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
