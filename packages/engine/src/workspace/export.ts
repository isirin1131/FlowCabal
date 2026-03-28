import { Workflow, NodeDef, Workspace, TextBlock } from '../types';
import { writeWorkflow } from '../paths';

// =============== export to a workflow.json =============
//
export function workspaceToWorkflow(workspace: Workspace): Workflow {
    const idMap = new Map<string, string>();
    let counter = 1;
    
    // 为每个节点生成紧凑的 id（从1开始）
    workspace.nodes.forEach(node => {
        idMap.set(node.id, counter.toString());
        counter++;
    });
    
    // 创建新节点并更新引用
    const newNodes = workspace.nodes.map(node => {
        const updateTextBlocks = (blocks: TextBlock[]): TextBlock[] => {
            return blocks.map(block => {
                if (block.kind === 'ref') {
                    const newRefId = idMap.get(block.nodeId);
                    if (newRefId) {
                        return { ...block, nodeId: newRefId };
                    }
                }
                return block;
            });
        };
        
        return {
            ...node,
            id: idMap.get(node.id)!,
            systemPrompt: updateTextBlocks(node.systemPrompt),
            userPrompt: updateTextBlocks(node.userPrompt)
        };
    });
    
    return {
        name: workspace.name,
        nodes: newNodes
    };
}

export function exportWorkspaceAsWorkflow(workspace: Workspace): void {
    const workflow = workspaceToWorkflow(workspace);
    writeWorkflow(workflow);
}


