'use client'
import { memo, useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useViewport,
  useReactFlow,
  type NodeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import FlowNode from './FlowNode'
import { nanoid } from 'nanoid'
import { getLayoutedElements } from '@/lib/engine-to-flow'

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

  type Item = { label: string; onClick: () => void; danger?: boolean }
  const items: Item[] = nodeId
    ? [
        { label: '添加子节点', onClick: () => { createNode(`Child of ${nodeId}`); onClose() } },
        { label: '复制节点', onClick: () => { createNode(`Copy of ${nodeId}`); onClose() } },
        { label: '删除节点', onClick: () => { deleteNode(nodeId); onClose() }, danger: true },
      ]
    : [
        { label: '添加节点', onClick: () => { createNode(`节点 ${nanoid(4)}`); onClose() } },
      ]

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-paper border border-rule rounded-md shadow-lift py-1 animate-slide-in font-body text-[13px]"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          className={[
            'w-full text-left px-3 py-1.5 cursor-pointer transition-colors duration-150',
            'hover:bg-clay-faint',
            item.danger ? 'text-error hover:!text-error' : 'text-ink hover:text-clay-deep',
          ].join(' ')}
          onClick={item.onClick}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

function ZoomReadout() {
  const { zoom } = useViewport()
  const { fitView } = useReactFlow()
  const pct = Math.round(zoom * 100)
  return (
    <Panel position="bottom-right" className="!m-0">
      <div className="font-mono text-[10.5px] text-ink-faint tracking-wide px-4 py-3 pointer-events-auto select-none">
        <span className="tabular-nums">zoom {pct}%</span>
        <span className="text-rule mx-3">·</span>
        <button
          type="button"
          onClick={() => fitView({ duration: 240 })}
          className="hover:text-ink transition-colors cursor-pointer"
        >
          <kbd className="font-mono not-italic">⌘0</kbd> fit
        </button>
      </div>
    </Panel>
  )
}

function LayoutButton() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const handleLayout = useCallback(() => {
    if (nodes.length === 0) return
    const { nodes: laid, edges: laidE } = getLayoutedElements(nodes, edges)
    useStore.setState({ nodes: laid, edges: laidE })
  }, [nodes, edges])

  return (
    <Panel position="top-left" className="!m-0">
      <button
        type="button"
        onClick={handleLayout}
        className="font-display italic text-[13px] text-ink-soft hover:text-clay transition-colors px-4 py-3 pointer-events-auto cursor-pointer"
      >
        — 自动排版
      </button>
    </Panel>
  )
}

function EmptyState() {
  return (
    <Panel position="top-center" className="!mt-24">
      <div className="text-center pointer-events-none select-none">
        <div className="font-display italic text-ink-soft text-[18px] mb-1">
          画布为空
        </div>
        <div className="font-body text-[13px] text-ink-faint">
          双击画布添加节点，或在空白处右键
        </div>
      </div>
    </Panel>
  )
}

function CanvasInner() {
  const nodes = useStore((s) => s.nodes)
  const edges = useStore((s) => s.edges)
  const onNodesChange = useStore((s) => s.onNodesChange)
  const onEdgesChange = useStore((s) => s.onEdgesChange)
  const selectNode = useStore((s) => s.selectNode)
  const createNode = useStore((s) => s.createNode)

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

  const onPaneDoubleClick = useCallback(() => {
    createNode(`节点 ${nanoid(4)}`)
  }, [createNode])

  return (
    <div className="w-full h-full relative select-none bg-paper">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 0 }}
        connectionLineStyle={{ stroke: 'var(--color-clay)', strokeWidth: 1.5 }}
        defaultEdgeOptions={{
          type: 'default',
          animated: false,
          style: { strokeWidth: 1 },
        }}
        deleteKeyCode={['Backspace', 'Delete']}
        proOptions={{ hideAttribution: true }}
      >
        <LayoutButton />
        <ZoomReadout />
        {nodes.length === 0 && <EmptyState />}
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

function Canvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  )
}

export default memo(Canvas)
