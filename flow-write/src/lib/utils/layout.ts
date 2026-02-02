import dagre from 'dagre';
import ELK from 'elkjs/lib/elk.bundled';
import type { Node, Edge } from '@xyflow/svelte';

export type LayoutAlgorithm = 'dagre' | 'elk';

export interface LayoutOptions {
  algorithm?: LayoutAlgorithm;
  direction?: 'TB' | 'LR';
  nodeWidth?: number;
  nodeHeight?: number;
  rankSpacing?: number;
  nodeSpacing?: number;
}

const elk = new ELK();

const elkLayoutConfig = {
  'elk.algorithm': 'layered',
  'elk.direction': 'DOWN',
  'elk.nodePlacement.strategy': 'SIMPLE',
  'elk.layered.spacing.nodeNodeBetweenLayers': 100,
  'elk.layered.spacing.edgeEdgeBetweenLayers': 50,
};

export async function layoutGraph(
  nodes: Node[],
  edges: Edge[],
  options: LayoutOptions = {}
): Promise<Node[]> {
  const {
    algorithm = 'dagre',
    direction = 'TB',
    nodeWidth = 180,
    nodeHeight = 100,
    rankSpacing = 100,
    nodeSpacing = 50
  } = options;

  if (algorithm === 'elk') {
    return layoutWithElk(nodes, edges, direction);
  }

  return layoutWithDagre(nodes, edges, { direction, nodeWidth, nodeHeight, rankSpacing, nodeSpacing });
}

function layoutWithDagre(
  nodes: Node[],
  edges: Edge[],
  options: {
    direction: 'TB' | 'LR';
    nodeWidth: number;
    nodeHeight: number;
    rankSpacing: number;
    nodeSpacing: number;
  }
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
    rankdir: options.direction,
    nodesep: options.nodeSpacing,
    ranksep: options.rankSpacing,
    marginx: 20,
    marginy: 20,
  });

  g.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    g.setNode(node.id, {
      width: options.nodeWidth,
      height: options.nodeHeight,
    });
  }

  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  const newNodes = nodes.map(node => {
    const nodeData = g.node(node.id);
    return {
      ...node,
      position: {
        x: nodeData.x - options.nodeWidth / 2,
        y: nodeData.y - options.nodeHeight / 2,
      },
    };
  });

  return newNodes;
}

async function layoutWithElk(
  nodes: Node[],
  edges: Edge[],
  direction: 'TB' | 'LR'
): Promise<Node[]> {
  const elkNodes = nodes.map(node => ({
    id: node.id,
    width: 180,
    height: 100,
  }));

  const elkEdges = edges.map(edge => ({
    id: edge.id,
    sources: [edge.source],
    targets: [edge.target],
  }));

  const graph = {
    id: 'root',
    layoutOptions: {
      ...elkLayoutConfig,
      'elk.direction': direction === 'TB' ? 'DOWN' : 'RIGHT',
    },
    children: elkNodes,
    edges: elkEdges,
  };

  const layoutedGraph = await elk.layout(graph);

  const positionMap = new Map<string, { x: number; y: number }>();
  for (const node of layoutedGraph.children || []) {
    positionMap.set(node.id, { x: node.x || 0, y: node.y || 0 });
  }

  return nodes.map(node => {
    const pos = positionMap.get(node.id);
    return {
      ...node,
      position: pos || node.position,
    };
  });
}
