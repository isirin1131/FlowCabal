import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { applyNodeChanges, applyEdgeChanges, addEdge, type Node, type Edge } from '@xyflow/react'
import type { Workspace, NodeDef, TextBlock } from '@flowcabal/engine'
import { recordToWorkspace, workspaceToRecord } from '@/lib/serialization'
import { getLayoutedElements } from '@/lib/engine-to-flow'
import { toast } from 'sonner'

type GuiState = {
  workspaces: Workspace[]
  activeWorkspace: Workspace | null
  nodes: Node[]
  edges: Edge[]
  selectedNodeId: string | null
  floatingPanelOpen: boolean
  pinnedOutputs: string[]
  isLoading: boolean
} & {
  switchWorkspace: (id: string) => void
  loadWorkspace: (id: string) => Promise<void>
  saveActiveWorkspace: () => Promise<void>
  runAll: () => Promise<void>
  createNode: (label: string) => Promise<void>
  deleteNode: (nodeId: string) => Promise<void>
  createWorkspace: (name: string) => Promise<void>
  updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) => Promise<void>
  addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) => Promise<void>
  removeBlock: (nodeId: string, isSystem: boolean, index: number) => Promise<void>
  onNodesChange: (changes: any) => void
  onEdgesChange: (changes: any) => void
  onConnect: (connection: any) => void
  selectNode: (id: string | null) => void
  renameNode: (nodeId: string, label: string) => Promise<void>
  togglePinOutput: (id: string) => void
}

function workspaceToFlowData(ws: Workspace) {
  const rawNodes: Node[] = ws.nodes.map((n: NodeDef) => ({
    id: n.id, type: 'flowNode', position: { x: 0, y: 0 },
    data: {
      label: n.label,
      systemPrompt: n.systemPrompt,
      userPrompt: n.userPrompt,
      status: ws.outputs.has(n.id) ? ('completed' as const) : ('pending' as const),
      output: ws.outputs.get(n.id) ?? null,
    },
  }))
  const edges: Edge[] = []
  for (const [targetId, sources] of ws.upstream) {
    for (const sourceId of sources) {
      edges.push({
        id: `e-${sourceId}-${targetId}`,
        source: sourceId,
        target: targetId,
        type: 'smoothstep',
        animated: ws.outputs.has(sourceId),
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
  return {
    ...node,
    data: {
      ...node.data,
      label: wsn.label,
      systemPrompt: wsn.systemPrompt,
      userPrompt: wsn.userPrompt,
      status: ws.outputs.has(node.id) ? 'completed' : 'pending',
      output: ws.outputs.get(node.id) ?? null,
    },
  }
}

class WorkspaceActions {
  #set: any
  #get: any
  constructor(set: any, get: any) { this.#set = set; this.#get = get }

  internal_switchWorkspace = (id: string) => {
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
    this.#set((s: any) => ({
      nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'pending' } }))
    }))
    try {
      const res = await fetch('/api/engine/run-all', {
        method: 'POST',
        body: JSON.stringify({ workspaceId: ws.id }),
      })
      const data = await res.json()
      if (!data.workspace) {
        toast.warning('引擎未返回结果')
        return
      }
      const updatedWs = recordToWorkspace(data.workspace)
      this.#set((s: any) => ({
        workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
        activeWorkspace: updatedWs,
        nodes: s.nodes.map((n: any) => ({
          ...n,
          data: {
            ...n.data,
            status: updatedWs.outputs.has(n.id) ? 'completed' : 'pending',
            output: updatedWs.outputs.get(n.id) ?? null,
          },
        })),
      }))
    } catch {
      this.#set((s: any) => ({
        nodes: s.nodes.map((n: any) => ({ ...n, data: { ...n.data, status: 'error' } }))
      }))
      toast.error('运行失败')
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
        this.#set((s: any) => ({
          workspaces: existing.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
          activeWorkspace: updatedWs,
          nodes: flow.nodes,
          edges: flow.edges,
        }))
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
    this.#set((s: any) => ({
      workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
      activeWorkspace: updatedWs,
      nodes: s.nodes.map((n: any) => syncNodeDataFromWorkspace(n, updatedWs)),
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

export const useStore = create<GuiState>()(
  persist((set, get) => {
    const actions = new WorkspaceActions(set, get)
    return {
      workspaces: [], activeWorkspace: null, nodes: [], edges: [],
      selectedNodeId: null, floatingPanelOpen: false, pinnedOutputs: [], isLoading: false,

      switchWorkspace: (id: string) => actions.internal_switchWorkspace(id),
      loadWorkspace: (id: string) => actions.internal_loadWorkspace(id),
      saveActiveWorkspace: () => actions.internal_saveActiveWorkspace(),
      runAll: () => actions.internal_runAll(),
      createNode: (label: string) => actions.internal_createNode(label),
      deleteNode: (nodeId: string) => actions.internal_deleteNode(nodeId),
      createWorkspace: (name: string) => actions.internal_createWorkspace(name),

      renameNode: (nodeId: string, label: string) => actions.internal_renameNode(nodeId, label),
      updateBlock: (nodeId: string, isSystem: boolean, index: number, block: TextBlock) =>
        actions.internal_updateBlock(nodeId, isSystem, index, block),
      addBlock: (nodeId: string, block: TextBlock, isSystem: boolean) =>
        actions.internal_addBlock(nodeId, block, isSystem),
      removeBlock: (nodeId: string, isSystem: boolean, index: number) =>
        actions.internal_removeBlock(nodeId, isSystem, index),

      onNodesChange: (c: any) => set((s: any) => ({ nodes: applyNodeChanges(c, s.nodes) })),
      onEdgesChange: (c: any) => set((s: any) => ({ edges: applyEdgeChanges(c, s.edges) })),
      onConnect: (c: any) => {
        set((s: any) => ({ edges: addEdge({ ...c, type: 'smoothstep', animated: true }, s.edges) }))
        const ws = get().activeWorkspace
        if (!ws) return
        fetch(`/api/workspaces/${ws.id}/blocks`, {
          method: 'POST',
          body: JSON.stringify({
            nodeId: c.target, action: 'insert', isSystem: true,
            block: { kind: 'ref', nodeId: c.source },
          }),
        }).then(r => r.json()).then(data => {
          if (data.workspace) {
            const updatedWs = recordToWorkspace(data.workspace)
            set((s: any) => ({
              workspaces: s.workspaces.map((w: Workspace) => w.id === updatedWs.id ? updatedWs : w),
              activeWorkspace: updatedWs,
            }))
          }
        }).catch(() => {
          set((s: any) => ({ edges: s.edges.filter((e: any) => e.id !== `e-${c.source}-${c.target}`) }))
          toast.error('连接失败')
        })
      },
      selectNode: (id: string | null) => set({ selectedNodeId: id, floatingPanelOpen: id !== null }),

      togglePinOutput: (id: string) => set((s: any) => {
        const pinned = s.pinnedOutputs.includes(id)
          ? s.pinnedOutputs.filter((i: string) => i !== id)
          : [...s.pinnedOutputs, id]
        return { pinnedOutputs: pinned }
      }),
    }
  }, {
    name: 'flowcabal-gui-storage',
    partialize: (state: any) => ({
      pinnedOutputs: state.pinnedOutputs,
    }),
  })
)
