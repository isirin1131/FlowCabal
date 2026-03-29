import { Workspace, LlmConfig, TextBlock } from '../../types';
import { generate } from '../../llm/generate.js';
import { todoList, calcStale } from './graph.js';
import { getNode } from './node.js';

function resolvePrompt(ws: Workspace, blocks: TextBlock[]): string {
    const parts: string[] = [];
    for (const block of blocks) {
        if (block.kind === 'literal') {
            parts.push(block.content);
        } else if (block.kind === 'ref') {
            const output = ws.outputs.get(block.nodeId);
            if (output) parts.push(output);
        }
    }
    return parts.join('\n\n');
}

async function runNode(ws: Workspace, nodeId: string, config: LlmConfig): Promise<void> {
    const node = getNode(ws, nodeId);
    if (!node) return;

    const system = resolvePrompt(ws, node.systemPrompt);
    const user = resolvePrompt(ws, node.userPrompt);

    const output = await generate(config, system, user);
    ws.outputs.set(nodeId, output);
    ws.stale_nodes = ws.stale_nodes.filter(id => id !== nodeId);
    ws.target_nodes = ws.target_nodes.filter(id => id !== nodeId);
}

export async function runSingle(ws: Workspace, config: LlmConfig): Promise<string | null> {
    calcStale(ws);
    const list = todoList(ws);
    if (list.length === 0) return null;

    const nodeId = list[0];
    await runNode(ws, nodeId, config);
    return nodeId;
}

export async function runAll(ws: Workspace, config: LlmConfig): Promise<string[]> {
    calcStale(ws);
    const list = todoList(ws);
    const executed: string[] = [];

    for (const nodeId of list) {
        await runNode(ws, nodeId, config);
        executed.push(nodeId);
    }

    return executed;
}
