import { create } from 'zustand'
import { applyNodeChanges, applyEdgeChanges, type Node, type Edge } from '@xyflow/react'
import type { Workspace, NodeDef, TextBlock, DataflowEvent, ErrorEntry } from '@flowcabal/engine'
import { recordToWorkspace, workspaceToRecord } from '@/lib/serialization'
import { getLayoutedElements } from '@/lib/engine-to-flow'
import { toast } from 'sonner'

type GuiState = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  selectedNodeIds: Set<string>
  floatingPanelOpen: boolean
  isLoading: boolean
  runningOutput: Map<string, string>
  runningNodeId: string | null
  dagProgress: { current: number; total: number } | null
  runtimeErrors: Map<string, ErrorEntry>
} & {
  switchWorkspace: (id: string) => void
  loadWorkspace: (id: string) => Promise<void>
  saveActiveWorkspace: () => Promise<void>
  runAll: () => Promise<void>
  createNode: (label: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  addToTarget: (nodeId: string) => Promise<void>
  updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) => Promise<void>
  addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) => Promise<void>
  removeBlock: (nodeId: string, isSystem: boolean, index: number) => Promise<void>
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  selectNode: (id: string | null) => void
  setSelectedNodeIds: (ids: Set<string>) => void
  renameNode: (nodeId: string, label: string) => Promise<void>
}

const ROMAN: [number, string][] = [
  [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
  [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
  [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I'],
]
export function toRoman(n: number): string {
  let result = ''
  for (const [value, numeral] of ROMAN) {
    while (n >= value) { result += numeral; n -= value }
  }
  return result
}

function todoListCount(ws: Workspace): number {
  const todo = new Set<string>()
  const visit = (id: string) => {
    if (todo.has(id)) return
    todo.add(id)
    for (const dep of ws.upstream.get(id) || []) {
      if (!ws.outputs.has(dep)) visit(dep)
    }
  }
  ws.target_nodes.forEach(visit)
  return todo.size
}

export { todoListCount }

function refLabelsForNode(ws: Workspace, nodeId: string): string[] {
  const sources = ws.upstream.get(nodeId) || []
  if (sources.length === 0) return []
  const indexMap = new Map<string, number>()
  ws.nodes.forEach((n, i) => indexMap.set(n.id, i + 1))
  return sources
    .map(sid => indexMap.has(sid) ? toRoman(indexMap.get(sid)!) : null)
    .filter((x): x is string => x !== null)
}

function workspaceToFlowData(ws: Workspace) {
  const rawNodes: Node[] = ws.nodes.map((n: NodeDef, i: number) => ({
    id: n.id, type: 'flowNode', position: { x: 0, y: 0 },
    data: {
      label: n.label,
      systemPrompt: n.systemPrompt,
      userPrompt: n.userPrompt,
      status: ws.outputs.has(n.id) ? ('completed' as const) : ('pending' as const),
      output: ws.outputs.get(n.id) ?? null,
      roman: toRoman(i + 1),
      refRomans: refLabelsForNode(ws, n.id),
    },
  }))
  const edges: Edge[] = []
  for (const [targetId, sources] of ws.upstream) {
    for (const sourceId of sources) {
      edges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: 'custom',
        animated: false,
      })
    }
  }
  if (rawNodes.length > 0) {
    return getLayoutedElements(rawNodes, edges)
  }
  return { nodes: rawNodes, edges }
}

function syncNodeDataFromWorkspace(node: Node, ws: Workspace): Node {
  const wsn = ws.nodes.find((n: NodeDef) => n.id === node.id)
  if (!wsn) return node
  const idx = ws.nodes.indexOf(wsn)
  return {
    ...node,
    data: {
      ...node.data,
      label: wsn.label,
      systemPrompt: wsn.systemPrompt,
      userPrompt: wsn.userPrompt,
      status: ws.outputs.has(node.id) ? 'completed' : 'pending',
      output: ws.outputs.get(node.id) ?? null,
      roman: toRoman(idx + 1),
      refRomans: refLabelsForNode(ws, node.id),
    },
  }
}

class WorkspaceActions {
  #set: any
  #get: any
  constructor(set: any, get: any) { this.#set = set; this.#get = get }

  internal_switchWorkspace = (id: string) => {
    this.#set({ runtimeErrors: new Map() })
    const ws = this.#get().workspaces.find((w: Workspace) => w.id === id)
    if (!ws) return
    this.#set({ activeWorkspace: ws, ...workspaceToFlowData(ws) })
  }

  internal_loadWorkspace = async (workspaceId: string) => {
    this.#set({ isLoading: true })
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}`)
      const data = await res.json()
      if (!data.workspace) return
      const workspace = recordToWorkspace(data.workspace)
      const existing = this.#get().workspaces
      const idx = existing.findIndex((w: Workspace) => w.id === workspace.id)
      const updated = idx >= 0
        ? existing.map((w: Workspace) => w.id === workspace.id ? workspace : w)
        : [...existing, workspace]
      this.#set({ workspaces: updated })
      this.internal_switchWorkspace(workspace.id)
      try {
        const errRes = await fetch(`/api/workspaces/${workspaceId}/errors?per-node=last`)
        if (errRes.ok) {
          const errMap: Record<string, ErrorEntry> = await errRes.json()
          this.#set({ runtimeErrors: new Map(Object.entries(errMap)) })
        }
      } catch {
        // 加载错误日志失败不阻塞 workspace 加载
      }
    } finally {
      this.#set({ isLoading: false })
    }
  }

  internal_saveActiveWorkspace = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    await fetch(`/api/workspaces/${ws.id}`, {
      method: 'PUT',
      body: JSON.stringify({ workspace: workspaceToRecord(ws) }),
    })
  }

  internal_runAll = async () => {
    const ws = this.#get().activeWorkspace
    if (!ws) return

    this.#set({
      runningOutput: new Map(),
      runningNodeId: null,
      dagProgress: null,
    })

    try {
      const res = await fetch('/api/engine/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId: ws.id }),
      })

      if (!res.ok || !res.body) {
        const errText = await res.text().catch(() => 'unknown error')
        toast.error(`运行失败：${errText}`)
        return
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.trim()) continue
          try {
            this.#handleNodeEvent(JSON.parse(line) as DataflowEvent)
          } catch {
            // 跨 chunk 解析失败的行：忽略，下一轮 buffer 接住
          }
        }
      }

      await this.internal_loadWorkspace(ws.id)
    } catch {
      // dag-done 已承担运行失败 toast；此处仅吞网络异常之外的兜底
    } finally {
      this.#set({
        runningOutput: new Map(),
        runningNodeId: null,
        dagProgress: null,
      })
    }
  }

  internal_createNode = async (label: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    const tmpId = `tmp-${Date.now()}`
    this.#set((s: any) => ({
      nodes: [...s.nodes, { id: tmpId, type: 'flowNode', position: { x: 100, y: 100 },
        data: { label, systemPrompt: [], userPrompt: [], status: 'pending', output: null } }],
    }))
    try {
      const res = await fetch('/api/workspaces/nodes', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: ws.id, label }),
      })
      const data = await res.json()
      if (data.workspace) {
        const updatedWs = recordToWorkspace(data.workspace)
        const existing = this.#get().workspaces
        const flow = workspaceToFlowData(updatedWs)
        this.#set({
          workspaces: existing.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: flow.nodes,
          edges: flow.edges,
        })
        toast.success(`节点 "${label}" 已创建`)
      }
    } catch {
      this.#set((s: any) => ({ nodes: s.nodes.filter((n: any) => n.id !== tmpId) }))
      toast.error('创建节点失败')
    }
  }

  internal_deleteNode = async (nodeId: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    const node = this.#get().nodes.find((n: any) => n.id === nodeId)
    const nodeLabel = node?.data?.label || nodeId
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: { ...n.data, _deleting: true } } : n
      ),
    }))
    try {
      const res = await fetch('/api/workspaces/nodes', {
        method: 'DELETE',
        body: JSON.stringify({ workspaceId: ws.id, nodeId }),
      })
      const data = await res.json()
      if (data.workspace) {
        const updatedWs = recordToWorkspace(data.workspace)
        const flow = workspaceToFlowData(updatedWs)
        this.#set((s: any) => ({
          workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: flow.nodes,
          edges: flow.edges,
        }))
        toast.success(`节点 "${nodeLabel}" 已删除`)
      }
    } catch {
      this.#set((s: any) => ({
        nodes: s.nodes.map((n: any) =>
          n.id === nodeId ? { ...n, data: { ...n.data, _deleting: false } } : n
        ),
      }))
      toast.error('删除节点失败')
    }
  }

  internal_createWorkspace = async (name: string) => {
    this.#set({ isLoading: true })
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      const workspace = recordToWorkspace(data.workspace)
      this.#set((s: any) => ({
        workspaces: [...s.workspaces, workspace],
      }))
      this.internal_switchWorkspace(workspace.id)
      toast.success(`工作区 "${name}" 已创建`)
    } catch {
      toast.error('创建工作区失败')
    } finally {
      this.#set({ isLoading: false })
    }
  }

  #updateNodeDataFromWorkspace = (updatedWs: Workspace) => {
    const newEdges: Edge[] = []
    for (const [targetId, sources] of updatedWs.upstream) {
      for (const sourceId of sources) {
        newEdges.push({
          id: `e-${sourceId}-${targetId}`,
          source: sourceId,
          target: targetId,
          type: 'custom',
          animated: false,
        })
      }
    }
    this.#set((s: any) => ({
      workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
      activeWorkspace: updatedWs,
      nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
      edges: newEdges,
    }))
  }

  internal_updateBlock = async (nodeId: string, isSystem: boolean, index: number, block: TextBlock) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, action: 'update', isSystem, index, block }),
      })
      const data = await res.json()
      if (data.workspace) this.#updateNodeDataFromWorkspace(recordToWorkspace(data.workspace))
    } catch {}
  }

  internal_addBlock = async (nodeId: string, block: TextBlock, isSystem: boolean) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, action: 'insert', isSystem, block }),
      })
      const data = await res.json()
      if (data.workspace) this.#updateNodeDataFromWorkspace(recordToWorkspace(data.workspace))
    } catch {}
  }

  internal_renameNode = async (nodeId: string, label: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch('/api/workspaces/nodes', {
        method: 'PUT',
        body: JSON.stringify({ workspaceId: ws.id, nodeId, label }),
      })
      const data = await res.json()
      if (data.workspace) this.#updateNodeDataFromWorkspace(recordToWorkspace(data.workspace))
    } catch {}
  }

  #setNodeStatus = (nodeId: string, status: string) => {
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) =>
        n.id === nodeId ? { ...n, data: { ...n.data, status } } : n
      ),
    }))
  }

  #applyNodeComplete = (nodeId: string, output: string) => {
    this.#set((s: any) => {
      const ws = s.activeWorkspace
      if (!ws) return s
      const newOutputs = new Map(ws.outputs)
      newOutputs.set(nodeId, output)
      const newTarget = ws.target_nodes.filter((id: string) => id !== nodeId)
      const newStale = ws.stale_nodes.filter((e: { id: string }) => e.id !== nodeId)
      const newWs: Workspace = { ...ws, outputs: newOutputs, target_nodes: newTarget, stale_nodes: newStale }
      return {
        activeWorkspace: newWs,
        workspaces: s.workspaces.map((w: Workspace) => w.id === newWs.id ? newWs : w),
        nodes: s.nodes.map((n: any) =>
          n.id === nodeId
            ? { ...n, data: { ...n.data, status: 'completed', output } }
            : n
        ),
      }
    })
  }

  #handleNodeEvent = (event: DataflowEvent) => {
    switch (event.type) {
      case 'dag-start':
        this.#set({ dagProgress: { current: 0, total: event.total } })
        break
      case 'node-start':
        this.#set({ runningNodeId: event.nodeId })
        this.#setNodeStatus(event.nodeId, 'running')
        break
      case 'node-token':
        this.#set((s: any) => {
          const map = new Map(s.runningOutput)
          map.set(event.nodeId, (map.get(event.nodeId) ?? '') + event.chunk)
          return { runningOutput: map }
        })
        break
      case 'node-complete':
        this.#set((s: any) => {
          const map = new Map(s.runningOutput)
          map.delete(event.nodeId)
          const dp = s.dagProgress
          const errMap = new Map(s.runtimeErrors)
          errMap.delete(event.nodeId)
          return {
            runningOutput: map,
            runtimeErrors: errMap,
            dagProgress: dp ? { ...dp, current: dp.current + 1 } : null,
          }
        })
        this.#applyNodeComplete(event.nodeId, event.output)
        break
      case 'node-error':
        this.#set((s: any) => {
          const errMap = new Map(s.runtimeErrors)
          errMap.set(event.nodeId, {
            ts: new Date().toISOString(),
            nodeId: event.nodeId,
            message: event.message,
          })
          return { runtimeErrors: errMap }
        })
        break
      case 'dag-done':
        this.#set({ runningNodeId: null })
        if (event.failed.length > 0 || event.stuck.length > 0) {
          toast.warning(
            `跑完：成功 ${event.done.length}，失败 ${event.failed.length}` +
            (event.stuck.length > 0 ? `，未跑 ${event.stuck.length}` : '')
          )
        } else if (event.done.length > 0) {
          toast.success(`跑完 ${event.done.length} 个节点`)
        }
        break
    }
  }

  internal_addToTarget = async (nodeId: string) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/target`, {
        method: 'POST',
        body: JSON.stringify({ nodeId }),
      })
      const data = await res.json()
      if (data.workspace) {
        const updatedWs = recordToWorkspace(data.workspace)
        this.#set((s: any) => ({
          workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
        }))
        toast.success('已加入运行目标')
      }
    } catch {
      toast.error('操作失败')
    }
  }

  internal_removeBlock = async (nodeId: string, isSystem: boolean, index: number) => {
    const ws = this.#get().activeWorkspace
    if (!ws) return
    try {
      const res = await fetch(`/api/workspaces/${ws.id}/blocks`, {
        method: 'POST',
        body: JSON.stringify({ nodeId, action: 'remove', isSystem, index }),
      })
      const data = await res.json()
      if (data.workspace) this.#updateNodeDataFromWorkspace(recordToWorkspace(data.workspace))
    } catch {}
  }
}

export const useStore = create<GuiState>()((set, get) => {
  const actions = new WorkspaceActions(set, get)
  return {
    workspaces: [], activeWorkspace: null, nodes: [], edges: [],
    selectedNodeId: null, selectedNodeIds: new Set(), floatingPanelOpen: false, isLoading: false,
    runningOutput: new Map(), runningNodeId: null, dagProgress: null,
    runtimeErrors: new Map(),

    switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
    loadWorkspace: (id: string) => actions.internal_loadWorkspace(id),
    saveActiveWorkspace: () => actions.internal_saveActiveWorkspace(),
    runAll: () => actions.internal_runAll(),
    createNode: (label: string) => actions.internal_createNode(label),
    deleteNode: (nodeId: string) => actions.internal_deleteNode(nodeId),
    createWorkspace: (name: string) => actions.internal_createWorkspace(name),
    addToTarget: (nodeId: string) => actions.internal_addToTarget(nodeId),

    renameNode: (nodeId: string, label: string) => actions.internal_renameNode(nodeId, label),
    updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) =>
      actions.internal_updateBlock(nodeId, isSystem, index, block),
    addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) =>
      actions.internal_addBlock(nodeId, block, isSystem),
    removeBlock: (nodeId: string, isSystem: boolean, index: number) =>
      actions.internal_removeBlock(nodeId, isSystem, index),

    onNodesChange: (c: any) => set((s: any) => ({ nodes: applyNodeChanges(c, s.nodes) })),
    onEdgesChange: (c: any) => set((s: any) => ({ edges: applyEdgeChanges(c, s.edges) })),
    selectNode: (id: string | null) => set({
      selectedNodeId: id,
      selectedNodeIds: id ? new Set([id]) : new Set(),
      floatingPanelOpen: id !== null,
    }),
    setSelectedNodeIds: (ids: Set<string>) => set({
      selectedNodeIds: ids,
      selectedNodeId: ids.size === 1 ? [...ids][0] : null,
      floatingPanelOpen: ids.size === 1,
    }),
  }
})

export function getStaleKindForNode(ws: Workspace | null, nodeId: string): 'direct' | 'propagated' | null {
  if (!ws) return null
  const entry = ws.stale_nodes.find(e => e.id === nodeId)
  return entry?.kind ?? null
}

export function propagatedUpstreamRomans(ws: Workspace | null, nodeId: string): string[] {
  if (!ws) return []
  const directIds = new Set(
    ws.stale_nodes.filter(e => e.kind === 'direct').map(e => e.id)
  )
  const result: string[] = []
  const visited = new Set<string>()
  const queue = [...(ws.upstream.get(nodeId) || [])]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    if (directIds.has(id)) {
      const idx = ws.nodes.findIndex(n => n.id === id)
      if (idx >= 0) result.push(toRoman(idx + 1))
    }
    for (const u of ws.upstream.get(id) || []) queue.push(u)
  }
  return result
}
