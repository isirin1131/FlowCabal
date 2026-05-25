'use client'
import { memo, useCallback, useState, useRef, useEffect } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Panel,
  useViewport,
  useReactFlow,
  type NodeTypes,
  type EdgeTypes,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useStore } from '@/store/useStore'
import FlowNode from './FlowNode'
import { CustomEdge } from './CustomEdge'
import { nanoid } from 'nanoid'
import { getLayoutedElements } from '@/lib/engine-to-flow'
import { toast } from 'sonner'

const nodeTypes: NodeTypes = { flowNode: FlowNode }
const edgeTypes: EdgeTypes = { custom: CustomEdge }

function ContextMenuPanel({ x, y, nodeId, onClose }: {
  x: number
  y: number
  nodeId: string | null
  onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
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

  if (nodeId !== null) return null  // 节点不再走菜单；防回归挡板

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] bg-paper border border-rule rounded-md shadow-lift py-1 animate-slide-in font-body text-[13px]"
      style={{ left: x, top: y }}
    >
      <button
        className="w-full text-left px-3 py-1.5 cursor-pointer transition-colors duration-150 hover:bg-clay-faint text-ink hover:text-clay-deep"
        onClick={() => { createNode(`节点 ${nanoid(4)}`); onClose() }}
      >
        添加节点
      </button>
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
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds)
  const selectedNodeIds = useStore((s) => s.selectedNodeIds)
  const createNode = useStore((s) => s.createNode)
  const dagProgress = useStore((s) => s.dagProgress)
  const toggleTarget = useStore((s) => s.toggleTarget)

  const [contextMenu, setContextMenu] = useState<{
    x: number; y: number; nodeId: string | null
  } | null>(null)

  const onNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (event.shiftKey) {
      const next = new Set(selectedNodeIds)
      next.add(node.id)
      setSelectedNodeIds(next)
    } else if (event.metaKey || event.ctrlKey) {
      const next = new Set(selectedNodeIds)
      if (next.has(node.id)) next.delete(node.id)
      else next.add(node.id)
      setSelectedNodeIds(next)
    } else {
      selectNode(node.id)
    }
  }, [selectNode, setSelectedNodeIds, selectedNodeIds])

  const onPaneClick = useCallback(() => {
    selectNode(null)
  }, [selectNode])

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault()
    if (dagProgress !== null) {
      toast.warning('运行中无法修改 target')
      return
    }
    toggleTarget(node.id)
  }, [dagProgress, toggleTarget])

  const onPaneContextMenu = useCallback((event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    const e = 'clientX' in event ? event : event
    setContextMenu({ x: e.clientX - 10, y: e.clientY - 10, nodeId: null })
  }, [])

  const onPaneDoubleClick = useCallback(() => {
    createNode(`节点 ${nanoid(4)}`)
  }, [createNode])

  const decoratedNodes = nodes.map(n => ({
    ...n,
    selected: selectedNodeIds.has(n.id),
  }))

  return (
    <div className="w-full h-full relative select-none bg-paper">
      <ReactFlow
        nodes={decoratedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onNodeContextMenu={onNodeContextMenu}
        onPaneContextMenu={onPaneContextMenu}
        onDoubleClick={onPaneDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        nodesConnectable={false}
        fitView
        fitViewOptions={{ padding: 0.25, duration: 0 }}
        defaultEdgeOptions={{ type: 'custom' }}
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
