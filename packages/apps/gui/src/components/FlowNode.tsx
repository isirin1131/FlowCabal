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
}

type FlowNodeType = Node<FlowNodeData, 'flowNode'>

function FlowNode({ data, selected }: NodeProps<FlowNodeType>) {
  const statusColor: Record<string, string> = {
    pending: 'bg-status-pending',
    stale: 'bg-status-stale',
    completed: 'bg-status-completed',
    error: 'bg-status-error',
  }

  return (
    <div className={`px-4 py-3 bg-card border-2 rounded-lg shadow-sm min-w-[200px] ${selected ? 'border-ring' : 'border-border'}`}>
      <Handle type="target" position={Position.Left} id="system" style={{ top: '25%' }} />
      <Handle type="target" position={Position.Left} id="user" style={{ top: '75%' }} />
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${statusColor[data.status] || 'bg-status-pending'}`} />
        <span className="font-medium text-sm">{data.label}</span>
      </div>
      <div className="text-xs text-muted-foreground flex flex-col gap-1">
        <div>系统: {data.systemPrompt?.length || 0} blocks</div>
        <div>用户: {data.userPrompt?.length || 0} blocks</div>
      </div>
      <Handle type="source" position={Position.Right} id="output" />
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
    prev.selected === next.selected
  )
}

export default memo(FlowNode, areEqual)
