import type { Workflow, NodeDef, TextBlock } from "../types.js";

/**
 * 从 workflow 的 TextBlock ref 隐式推导邻接表。
 * 返回 Map<nodeId, Set<被依赖的 nodeId>>
 */
function extractDeps(workflow: Workflow): Map<string, Set<string>> {
  return extractNodeDeps(workflow.nodes);
}

/**
 * 从 TextBlock 数组中提取所有 ref 的 nodeId。
 */
function collectRefs(blocks: TextBlock[]): string[] {
  return blocks
    .filter((b): b is TextBlock & { kind: "ref" } => b.kind === "ref")
    .map((b) => b.nodeId);
}

/**
 * Kahn 算法拓扑排序。
 * 返回拓扑序的 NodeDef[]，如果存在环则抛出错误。
 */
function topoSort(workflow: Workflow): NodeDef[] {
  const deps = extractDeps(workflow);
  const nodeMap = new Map(workflow.nodes.map((n) => [n.id, n]));

  // 计算入度
  const inDegree = new Map<string, number>();
  for (const node of workflow.nodes) {
    inDegree.set(node.id, 0);
  }
  for (const [nodeId, nodeDeps] of deps) {
    inDegree.set(nodeId, nodeDeps.size);
  }

  // 入度为 0 的节点入队
  const queue: string[] = [];
  for (const [nodeId, degree] of inDegree) {
    if (degree === 0) queue.push(nodeId);
  }

  const sorted: NodeDef[] = [];

  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(nodeMap.get(current)!);

    // 对所有以 current 为依赖的节点，减少入度
    for (const [nodeId, nodeDeps] of deps) {
      if (nodeDeps.has(current)) {
        nodeDeps.delete(current);
        const newDegree = nodeDeps.size;
        inDegree.set(nodeId, newDegree);
        if (newDegree === 0) queue.push(nodeId);
      }
    }
  }

  if (sorted.length !== workflow.nodes.length) {
    const remaining = workflow.nodes
      .filter((n) => !sorted.includes(n))
      .map((n) => n.id);
    throw new Error(`Workflow contains a cycle involving nodes: ${remaining.join(", ")}`);
  }

  return sorted;
}

/**
 * 从 NodeDef[] 推导依赖关系（无需完整 Workflow）。
 */
export function extractNodeDeps(nodes: NodeDef[]): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();
  for (const node of nodes) {
    deps.set(node.id, new Set<string>());
  }
  for (const node of nodes) {
    const refs = collectRefs([...node.systemPrompt, ...node.userPrompt]);
    for (const refId of refs) {
      deps.get(node.id)!.add(refId);
    }
  }
  return deps;
}

/**
 * 拓扑分层：返回 string[][]，每层内节点可并行执行。
 * nodes 必须是无环子图。
 */
export function topoLevels(nodes: NodeDef[]): string[][] {
  const deps = extractNodeDeps(nodes);
  const nodeSet = new Set(nodes.map((n) => n.id));

  // 过滤掉子图外的依赖
  for (const [nodeId, nodeDeps] of deps) {
    for (const dep of nodeDeps) {
      if (!nodeSet.has(dep)) nodeDeps.delete(dep);
    }
  }

  const remaining = new Set(nodeSet);
  const levels: string[][] = [];

  while (remaining.size > 0) {
    // 当前层：所有依赖已全部被之前层处理过的节点
    const level: string[] = [];
    for (const nodeId of remaining) {
      const nodeDeps = deps.get(nodeId)!;
      if (nodeDeps.size === 0) {
        level.push(nodeId);
      }
    }
    if (level.length === 0) {
      throw new Error("Cycle detected in subgraph");
    }
    levels.push(level);
    for (const id of level) {
      remaining.delete(id);
    }
    // 从剩余节点的依赖中移除本层节点
    for (const nodeId of remaining) {
      const nodeDeps = deps.get(nodeId)!;
      for (const id of level) {
        nodeDeps.delete(id);
      }
    }
  }

  return levels;
}

/**
 * 计算 targets 的最小依赖子图。
 * 返回子图内所有 nodeId（包括 targets 本身）。
 */
export function computeSubgraph(nodes: NodeDef[], targets: string[]): string[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const deps = extractNodeDeps(nodes);
  const visited = new Set<string>();

  function visit(nodeId: string) {
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    const nodeDeps = deps.get(nodeId);
    if (nodeDeps) {
      for (const dep of nodeDeps) {
        visit(dep);
      }
    }
  }

  for (const target of targets) {
    if (!nodeMap.has(target)) {
      throw new Error(`Target node "${target}" not found`);
    }
    visit(target);
  }

  return Array.from(visited);
}

/**
 * 校验 workflow：
 * 1. ref 引用的 nodeId 必须存在
 * 2. 不能有环
 */
export function validateWorkflow(workflow: Workflow): void {
  const nodeIds = new Set(workflow.nodes.map((n) => n.id));

  // 检查 ref 引用的 nodeId 存在
  for (const node of workflow.nodes) {
    const allBlocks = [...node.systemPrompt, ...node.userPrompt];
    for (const block of allBlocks) {
      if (block.kind === "ref" && !nodeIds.has(block.nodeId)) {
        throw new Error(
          `Node "${node.id}" references unknown node "${block.nodeId}"`,
        );
      }
    }
  }

  // 检查无环（topoSort 会抛出循环错误）
  topoSort(workflow);
}
