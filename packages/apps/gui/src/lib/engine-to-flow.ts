import dagre from 'dagre'
import type { Node, Edge } from '@xyflow/react'

export function getLayoutedElements(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph().setGraph({ rankdir: 'TB', ranksep: 100, nodesep: 80 })
  nodes.forEach((n) => g.setNode(n.id, { width: 200, height: 100 }))
  edges.forEach((e) => g.setEdge(e.source, e.target))
  dagre.layout(g)
  return {
    nodes: nodes.map((n) => ({
      ...n,
      position: { x: g.node(n.id).x - 100, y: g.node(n.id).y - 50 },
    })),
    edges,
  }
}
