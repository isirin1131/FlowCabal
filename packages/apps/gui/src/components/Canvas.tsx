'use client'
import { memo, useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type NodeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import FlowNode from './FlowNode'
import { Copy, Trash2, Plus, Workflow } from 'lucide-react'
import { nanoid } from 'nanoid'

const nodeTypes: NodeTypes = { flowNode: FlowNode }

function ContextMenuPanel({ x, y, nodeId, onClose }: {
  x: number; y: number; nodeId: string | null; onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as HTMLElement)) onClose()
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleEsc)
    }
  }, [onClose])

  const items = nodeId
    ? [
        { label: '添加子节点', icon: Plus, onClick: () => { createNode(`Child of ${nodeId}`); onClose() } },
        { label: '复制节点', icon: Copy, onClick: () => { createNode(`Copy of ${nodeId}`); onClose() } },
        { label: '删除节点', icon: Trash2, onClick: () => { deleteNode(nodeId); onClose() }, destructive: true as const },
      ]
    : [
        { label: '添加节点', icon: Workflow, onClick: () => { createNode(`Node ${nanoid(4)}`); onClose() } },
      ]

  return (
    <div
      ref={ref}
      className="fixed z-50 w-48 bg-popover border rounded-lg shadow-lg p-1"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={`w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-accent cursor-pointer ${item.destructive ? 'text-destructive hover:text-destructive' : ''}`}
          onClick={item.onClick}
        >
          <item.icon className="w-4 h-4 shrink-0" />
          {item.label}
        </button>
      ))}
    </div>
  )
}

function Canvas() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const onConnect = useStore((s) => s.onConnect)
  const selectNode = useStore((s) => s.selectNode)

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; nodeId: string | null
  } | null>(null)

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    selectNode(node.id)
  }, [selectNode])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    setContextMenu({ x: event.clientX - 10, y: event.clientY - 10, nodeId: node.id })
  }, [])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    const e = 'clientX' in event ? event : event
    setContextMenu({ x: e.clientX - 10, y: e.clientY - 10, nodeId: null })
  }, [])

  return (
    <div className="w-full h-full relative">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        nodeTypes={nodeTypes}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} />
        <Controls />
        <MiniMap
          nodeColor={(node: Node) => {
            const status = (node.data as Record<string, unknown>)?.status as string
            if (status === 'completed') return 'var(--color-status-completed)'
            if (status === 'error') return 'var(--color-status-error)'
            if (status === 'stale') return 'var(--color-status-stale)'
            return 'var(--color-status-pending)'
          }}
        />
      </ReactFlow>
      {contextMenu && (
        <ContextMenuPanel
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.nodeId}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}

export default memo(Canvas)
