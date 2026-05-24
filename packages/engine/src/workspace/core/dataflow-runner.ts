import { Workspace, LlmConfig, TextBlock } from '../../types';
import { createStream } from '../../llm/generate.js';
import { runMemoryAgent } from '../../agent/memory-agent.js';
import { todoList } from './graph.js';
import { getNode } from './node.js';
import { clearOnRun } from './stale-tracker.js';
import { appendError } from './error-log.js';
import { EventChannel } from './event-channel.js';

export type DataflowEvent =
  | { type: 'dag-start'; total: number; nodeIds: string[] }
  | { type: 'node-start'; nodeId: string }
  | { type: 'node-token'; nodeId: string; chunk: string }
  | { type: 'node-complete'; nodeId: string; output: string }
  | { type: 'node-error'; nodeId: string; message: string }
  | { type: 'dag-done'; done: string[]; failed: string[]; stuck: string[] };

async function resolvePrompt(
  ws: Workspace,
  blocks: TextBlock[],
  rootDir: string,
  llmConfig: LlmConfig,
): Promise<string> {
  const parts: string[] = [];
  for (const block of blocks) {
    if (block.kind === 'literal') {
      parts.push(block.content);
    } else if (block.kind === 'ref') {
      const output = ws.outputs.get(block.nodeId);
      if (output) parts.push(output);
    } else if (block.kind === 'agent-inject') {
      const injected = await runMemoryAgent(
        rootDir,
        llmConfig,
        block.hint,
        { readonly: true },
      );
      if (injected) parts.push(injected);
    }
  }
  return parts.join('\n\n');
}

export async function* runAllDataflow(
  ws: Workspace,
  config: LlmConfig,
  rootDir: string,
  abortSignal?: AbortSignal,
): AsyncGenerator<DataflowEvent> {
  const todo = new Set(todoList(ws));

  if (todo.size === 0) {
    yield { type: 'dag-done', done: [], failed: [], stuck: [] };
    return;
  }

  // 初始 in-degree：只数 todo 内的 upstream
  const inDeg = new Map<string, number>();
  for (const id of todo) {
    const ups = ws.upstream.get(id) || [];
    inDeg.set(id, ups.filter(u => todo.has(u)).length);
  }

  const channel = new EventChannel<DataflowEvent>();
  const done = new Set<string>();
  const failed = new Set<string>();
  const running = new Set<string>();

  const finalizeIfDone = () => {
    if (running.size === 0) {
      const stuck = [...todo].filter(id => !done.has(id) && !failed.has(id));
      channel.push({ type: 'dag-done', done: [...done], failed: [...failed], stuck });
      channel.close();
    }
  };

  const launchReady = () => {
    for (const id of todo) {
      if (running.has(id) || done.has(id) || failed.has(id)) continue;
      if (inDeg.get(id) === 0) {
        running.add(id);
        // fire-and-forget；fireNode 完成时自动调 onSettle
        fireNode(id);
      }
    }
  };

  const onSettle = (nodeId: string) => {
    running.delete(nodeId);
    launchReady();
    finalizeIfDone();
  };

  const fireNode = async (nodeId: string): Promise<void> => {
    channel.push({ type: 'node-start', nodeId });
    const node = getNode(ws, nodeId);
    if (!node) {
      failed.add(nodeId);
      channel.push({ type: 'node-error', nodeId, message: 'node not found' });
      onSettle(nodeId);
      return;
    }
    try {
      const system = await resolvePrompt(ws, node.systemPrompt, rootDir, config);
      const user = await resolvePrompt(ws, node.userPrompt, rootDir, config);
      let accumulated = '';
      const stream = createStream(config, system, user, abortSignal);
      for await (const chunk of stream.textStream) {
        accumulated += chunk;
        channel.push({ type: 'node-token', nodeId, chunk });
      }
      ws.outputs.set(nodeId, accumulated);
      ws.target_nodes = ws.target_nodes.filter(t => t !== nodeId);
      clearOnRun(ws, nodeId);
      done.add(nodeId);
      channel.push({ type: 'node-complete', nodeId, output: accumulated });
      for (const ds of ws.downstream.get(nodeId) || []) {
        if (todo.has(ds) && inDeg.has(ds)) inDeg.set(ds, inDeg.get(ds)! - 1);
      }
    } catch (err) {
      const message = (err as Error).message;
      channel.push({ type: 'node-error', nodeId, message });
      try { appendError(rootDir, ws.id, nodeId, message); } catch {}
      failed.add(nodeId);
      // 不动 target_nodes / 不动 downstream inDeg
    }
    onSettle(nodeId);
  };

  channel.push({ type: 'dag-start', total: todo.size, nodeIds: [...todo] });
  launchReady();

  // 兜底：如果一开始就没 ready
  if (running.size === 0) {
    const stuck = [...todo];
    channel.push({ type: 'dag-done', done: [], failed: [], stuck });
    channel.close();
  }

  while (true) {
    const event = await channel.next();
    if (event === null) break;
    yield event;
  }
}
