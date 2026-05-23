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

const nodeTypes: NodeTypes = { flowNode: FlowNode }
const edgeTypes: EdgeTypes = { custom: CustomEdge }

function ContextMenuPanel({ x, y, nodeId, selectedIds, onClose }: {
  x: number
  y: number
  nodeId: string | null
  selectedIds: Set<string>
  onClose: () => void
}) {
  const createNode = useStore((s) => s.createNode)
  const deleteNode = useStore((s) => s.deleteNode)
  const addToTarget = useStore((s) => s.addToTarget)
  const activeWorkspace = useStore((s) => s.activeWorkspace)
  const selectNode = useStore((s) => s.selectNode)
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

  let items: Item[] = []

  if (nodeId === null) {
    // 空白处
    items = [{ label: '添加节点', onClick: () => { createNode(`节点 ${nanoid(4)}`); onClose() } }]
  } else {
    const isMulti = selectedIds.size >= 2 && selectedIds.has(nodeId)
    if (isMulti) {
      const ids = [...selectedIds]
      const someNotTarget = activeWorkspace
        ? ids.some(id => !activeWorkspace.target_nodes.includes(id))
        : false
      items = [
        { label: `删除 ${ids.length} 个节点`, onClick: () => {
          for (const id of ids) deleteNode(id)
          onClose()
        }, danger: true },
      ]
      if (someNotTarget) {
        items.unshift({ label: '加入 target', onClick: () => {
          for (const id of ids) {
            if (!activeWorkspace?.target_nodes.includes(id)) addToTarget(id)
          }
          onClose()
        }})
      }
    } else {
      // 单选节点（如果右键的节点不在选中集，先单选它）
      if (!selectedIds.has(nodeId)) selectNode(nodeId)
      const inTarget = activeWorkspace?.target_nodes.includes(nodeId) ?? false
      items = [
        { label: '重命名', onClick: () => {
          selectNode(nodeId)
          window.dispatchEvent(new CustomEvent('flowcabal:rename-node', { detail: { nodeId } }))
          onClose()
        }},
        { label: '删除', onClick: () => { deleteNode(nodeId); onClose() }, danger: true },
      ]
      if (!inTarget) {
        items.push({ label: '加入 target', onClick: () => { addToTarget(nodeId); onClose() } })
      }
    }
  }

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
  const setSelectedNodeIds = useStore((s) => s.setSelectedNodeIds)
  const selectedNodeIds = useStore((s) => s.selectedNodeIds)
  const createNode = useStore((s) => s.createNode)

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
          selectedIds={selectedNodeIds}
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
