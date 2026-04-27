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
  _deleting?: boolean
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

const statusConfig: Record<string, { bg: string; border: string; pulse: boolean }> = {
  pending:  { bg: 'bg-status-pending',   border: 'border-status-pending/40',   pulse: true },
  stale:    { bg: 'bg-status-stale',     border: 'border-status-stale/40',     pulse: false },
  completed:{ bg: 'bg-status-completed', border: 'border-status-completed/40', pulse: false },
  error:    { bg: 'bg-status-error',     border: 'border-status-error/40',     pulse: false },
}

function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const config = statusConfig[data.status] || statusConfig.pending
  const isDeleting = (data as unknown as Record<string, unknown>)._deleting === true

  return (
    <div
      className={`
        bg-card border-2 rounded-lg shadow-sm min-w-[200px]
        transition-all duration-300 ease-out
        animate-node-enter
        ${selected ? 'border-ring' : config.border}
        ${isDeleting ? 'opacity-40 scale-95' : 'opacity-100 scale-100'}
      `}
    >
      <div className={`h-1 rounded-t-md ${config.bg}`} />

      <div className="px-4 py-2.5">
        <Handle
          type="target"
          position={Position.Left}
          id="system"
          className="top-[30%]"
        />
        <Handle
          type="target"
          position={Position.Left}
          id="user"
          className="top-[70%]"
        />

        <div className="flex items-center gap-2 mb-2">
          <span
            className={`
              relative flex h-2.5 w-2.5
              ${config.pulse ? 'before:absolute before:inset-0 before:rounded-full before:bg-status-pending before:animate-pulse before:opacity-60' : ''}
            `}
          >
            <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${config.bg}`} />
          </span>
          <span className="font-medium text-sm text-card-foreground">{data.label}</span>
        </div>

        <div className="text-xs text-muted-foreground flex flex-col gap-0.5">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-secondary text-[10px] font-medium text-secondary-foreground">
              S
            </span>
            {data.systemPrompt?.length || 0} blocks
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded bg-secondary text-[10px] font-medium text-secondary-foreground">
              U
            </span>
            {data.userPrompt?.length || 0} blocks
          </div>
        </div>

        <Handle
          type="source"
          position={Position.Right}
          id="output"
          className="top-1/2"
        />
      </div>
    </div>
  )
}

function areEqual(prev: NodeProps<FlowNodeType>, next: NodeProps<FlowNodeType>) {
  return (
    prev.data.label === next.data.label &&
    prev.data.systemPrompt?.length === next.data.systemPrompt?.length &&
    prev.data.userPrompt?.length === next.data.userPrompt?.length &&
    prev.data.status === next.data.status &&
    prev.data.output === next.data.output &&
    prev.selected === next.selected &&
    (prev.data as unknown as Record<string, unknown>)._deleting ===
    (next.data as unknown as Record<string, unknown>)._deleting
  )
}

export default memo(FlowNode, areEqual)
