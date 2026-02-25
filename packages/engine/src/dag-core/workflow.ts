import type { Workflow, NodeDef, TextBlock } from "../types.js";

/**
 * 从 workflow 的 TextBlock ref 隐式推导邻接表。
 * 返回 Map<nodeId, Set<被依赖的 nodeId>>
 */
export function extractDeps(workflow: Workflow): Map<string, Set<string>> {
  const deps = new Map<string, Set<string>>();

  for (const node of workflow.nodes) {
    deps.set(node.id, new Set<string>());
  }

  for (const node of workflow.nodes) {
    const refs = collectRefs([...node.systemPrompt, ...node.userPrompt]);
    for (const refId of refs) {
      deps.get(node.id)!.add(refId);
    }
  }

  return deps;
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
export function topoSort(workflow: Workflow): NodeDef[] {
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
