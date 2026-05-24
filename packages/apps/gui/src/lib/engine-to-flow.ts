import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

export function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  if (nodes.length === 0) return { nodes, edges }

  const nodeIds = new Set(nodes.map((n) => n.id))
  const validEdges = edges.filter(
    (e) => !!e.source && !!e.target && nodeIds.has(e.source) && nodeIds.has(e.target)
  )
  if (validEdges.length !== edges.length) {
    const dropped = edges.filter(
      (e) => !e.source || !e.target || !nodeIds.has(e.source) || !nodeIds.has(e.target)
    )
    console.warn('[layout] dropped invalid edges', dropped, 'nodes:', [...nodeIds])
  }

  const g = new dagre.graphlib.Graph().setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 })
  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 100 }))
  validEdges.forEach((e) => g.setEdge(e.source, e.target, {}))
  dagre.layout(g)
  return {
    nodes: nodes.map((n) => {
      const laid = g.node(n.id)
      if (!laid) return n
      return { ...n, position: { x: laid.x - 100, y: laid.y - 50 } }
    }),
    edges,
  }
}
