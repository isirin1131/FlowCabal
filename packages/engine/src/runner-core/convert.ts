import { newId } from "../id.js";
import type { Workflow, NodeDef, TextBlock } from "../types.js";

/**
 * 重写 TextBlock 数组中所有 ref 的 nodeId。
 */
function remapBlocks(
  blocks: TextBlock[],
  idMap: Map<string, string>,
): TextBlock[] {
  return blocks.map((block) => {
    if (block.kind === "ref") {
      const mapped = idMap.get(block.nodeId);
      if (mapped === undefined) {
        throw new Error(`ref 引用了未知节点: ${block.nodeId}`);
      }
      return { kind: "ref", nodeId: mapped };
    }
    return block;
  });
}

/**
 * 导入 workflow：数字字符串 ID → nanoid，返回新 NodeDef[]。
 */
export function importWorkflow(workflow: Workflow): NodeDef[] {
  // 1. 为每个节点生成新 nanoid
  const idMap = new Map<string, string>();
  for (const node of workflow.nodes) {
    idMap.set(node.id, newId());
  }

  // 2. 重写所有节点
  return workflow.nodes.map((node) => ({
    id: idMap.get(node.id)!,
    label: node.label,
    systemPrompt: remapBlocks(node.systemPrompt, idMap),
    userPrompt: remapBlocks(node.userPrompt, idMap),
  }));
}

/**
 * 导出为 workflow：nanoid → 按序编号 "0","1","2",...，refs 重映射。
 */
export function exportWorkflow(nodes: NodeDef[], name: string): Workflow {
  // 1. 按数组序给节点编号
  const idMap = new Map<string, string>();
  for (let i = 0; i < nodes.length; i++) {
    idMap.set(nodes[i].id, String(i));
  }

  // 2. 重写所有节点
  const exported = nodes.map((node, i) => ({
    id: String(i),
    label: node.label,
    systemPrompt: remapBlocks(node.systemPrompt, idMap),
    userPrompt: remapBlocks(node.userPrompt, idMap),
  }));

  return { id: newId(), name, nodes: exported };
}
