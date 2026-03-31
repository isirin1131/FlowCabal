import { Workflow, NodeDef, Workspace, TextBlock } from '../types';
import { newId } from './utils';
import { readWorkflow } from '../paths';


// =============== for init ========================

function buildDependencies(nodes: NodeDef[]): { upstream: Map<string, string[]>, downstream: Map<string, string[]> } {
    const upstream = new Map<string, string[]>();
    const downstream = new Map<string, string[]>();

    for (const node of nodes) {
        const refs: string[] = [];
        
        for (const block of [...node.systemPrompt, ...node.userPrompt]) {
            if (block.kind === 'ref') {
                refs.push(block.nodeId);
            }
        }

        for (const refNodeId of refs) {
            if (!upstream.has(node.id)) upstream.set(node.id, []);
            upstream.get(node.id)!.push(refNodeId);

            if (!downstream.has(refNodeId)) downstream.set(refNodeId, []);
            downstream.get(refNodeId)!.push(node.id);
        }
    }

    return { upstream, downstream };
}

export function initFromEmpty(name: string): Workspace {
    return {
        id: newId(),
        name: name,
        nodes: [],
        outputs: new Map(),
        upstream: new Map(),
        downstream: new Map(),
        target_nodes: [],
        stale_nodes: []
    };
}

export function initFromWorkflow(workflowName: string): Workspace {
    const workflow = readWorkflow(workflowName);
    if (!workflow) {
        throw new Error(`Workflow not found: ${workflowName}`);
    }
    const ws = workflowToWorkspace(workflow);
    const { upstream, downstream } = buildDependencies(ws.nodes);
    ws.upstream = upstream;
    ws.downstream = downstream;
    return ws;
}

export function workflowToWorkspace(workflow: Workflow): Workspace {
    const idMap = new Map<string, string>();
    
    // 为每个节点生成新的 nanoid
    const newNodes = workflow.nodes.map(node => {
        const newIdValue = newId();
        idMap.set(node.id, newIdValue);
        return {
            ...node,
            id: newIdValue
        };
    });
    
    // 更新所有 TextBlock 中的引用
    const updatedNodes = newNodes.map(node => {
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
            systemPrompt: updateTextBlocks(node.systemPrompt),
            userPrompt: updateTextBlocks(node.userPrompt)
        };
    });
    
    const allNodeIds = workflow.nodes.map(node => idMap.get(node.id)!).filter(Boolean);
    
    return {
        id: newId(),
        name: workflow.name,
        nodes: updatedNodes,
        outputs: new Map<string, string>,
        upstream: new Map<string, string[]>,
        downstream: new Map<string, string[]>,
        target_nodes: allNodeIds,
        stale_nodes: []
    };
}


