import {
  loadWorkspace,
  saveWorkspace,
  loadPreferences,
  loadLlmConfig,
} from '@flowcabal/engine';
import { runAll, runSingle, todoList, calcStale } from '@flowcabal/engine';

export async function run(
  rootDir: string,
  workspaceId: string,
  single: boolean = false
): Promise<void> {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  const prefs = loadPreferences(rootDir, workspaceId);
  if (!prefs) {
    console.error('No preferences found');
    return;
  }

  const config = loadLlmConfig(rootDir, prefs.llmConfigName);
  if (!config) {
    console.error(`LLM config not found: ${prefs.llmConfigName}`);
    return;
  }

  console.log('Running...');
  
  if (single) {
    const nodeId = await runSingle(ws, config, rootDir);
    if (nodeId) {
      saveWorkspace(rootDir, ws);
      console.log(`Executed: ${nodeId}`);
    } else {
      console.log('Nothing to run');
    }
  } else {
    const executed = await runAll(ws, config, rootDir);
    saveWorkspace(rootDir, ws);
    console.log(`Executed ${executed.length} nodes: ${executed.join(', ')}`);
  }
}

export function runPreview(rootDir: string, workspaceId: string): void {
  const ws = loadWorkspace(rootDir, workspaceId);
  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  calcStale(ws);
  const list = todoList(ws);

  console.log('=== Todo List (execution order) ===');
  if (list.length === 0) {
    console.log('(empty)');
  } else {
    for (let i = 0; i < list.length; i++) {
      const nodeId = list[i];
      const node = ws.nodes.find(n => n.id === nodeId);
      const label = node?.label || 'unknown';
      console.log(`  ${i + 1}. ${nodeId} — ${label}`);
    }
  }

  console.log('');
  console.log('=== Stale Nodes ===');
  if (ws.stale_nodes.length === 0) {
    console.log('(none)');
  } else {
    for (const nodeId of ws.stale_nodes) {
      const node = ws.nodes.find(n => n.id === nodeId);
      const label = node?.label || 'unknown';
      console.log(`  ${nodeId} — ${label}`);
    }
  }
}
