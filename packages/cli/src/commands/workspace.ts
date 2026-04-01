import { existsSync, readdirSync, rmSync, statSync } from 'fs';
import { join } from 'path';
import { newId, getCacheDir, getWorkspaceDir, getCurrentWorkspaceFile, readCurrentWorkspace, writeCurrentWorkspace, readWorkspace, writeWorkspace, calcStale } from '@flowcabal/engine';
import type { Workspace } from '@flowcabal/engine';

import { initFromEmpty, initFromWorkflow, workspaceToWorkflow } from '@flowcabal/engine';
import { exportWorkspaceAsWorkflow } from '@flowcabal/engine';

// ── create ──────────────────────────────────────────────

export async function createWorkspace(
  name: string,
  rootDir: string,
  fromWorkflow?: string,
): Promise<void> {
  if (fromWorkflow) {
    const ws = initFromWorkflow(fromWorkflow);
    ws.name = name;
    writeWorkspace(rootDir, ws.id, ws);
    console.log(`Created workspace from workflow: ${ws.id} (${name})`);
    return;
  }

  const ws = initFromEmpty(name);
  writeWorkspace(rootDir, ws.id, ws);
  console.log(`Created workspace: ${ws.id} (${name})`);
}

// ── list ────────────────────────────────────────────────

export function listWorkspaces(rootDir: string): void {
  const cacheDir = getCacheDir(rootDir);

  if (!existsSync(cacheDir)) {
    console.log('No workspaces found');
    return;
  }

  const ids = readdirSync(cacheDir).filter(name => {
    const stat = statSync(join(cacheDir, name));
    return stat.isDirectory() && name !== 'current';
  });

  if (ids.length === 0) {
    console.log('No workspaces found');
    return;
  }

  console.log('Workspaces:');
  for (const id of ids) {
    const ws = readWorkspace(rootDir, id);
    if (ws) {
      console.log(`  ${id} — ${ws.name || 'unnamed'}`);
    } else {
      console.log(`  ${id}`);
    }
  }
}

// ── switch / current ────────────────────────────────────

export function workspaceSwitch(rootDir: string, workspaceId: string): void {
  if (!readWorkspace(rootDir, workspaceId)) {
    console.error('Workspace not found');
    return;
  }

  writeCurrentWorkspace(rootDir, workspaceId);
  console.log(`Switched to workspace: ${workspaceId}`);
}

export function getCurrentWorkspace(rootDir: string): string | null {
  return readCurrentWorkspace(rootDir);
}

// ── status / delete ──────────────────────────────

export function workspaceStatus(rootDir: string, workspaceId: string): void {
  const ws = readWorkspace(rootDir, workspaceId);

  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  calcStale(ws);

  console.log(`# ${ws.name || workspaceId}`);
  console.log(`Workspace ID: ${workspaceId}`);
  console.log(`  Nodes: ${ws.nodes.length}`);
  console.log(`  Targets: ${ws.target_nodes.join(', ') || '(none)'}`);
  console.log(`  Stale: ${ws.stale_nodes.join(', ') || '(none)'}`);
  console.log(`  Outputs: ${ws.outputs.size}`);
}

export function workspaceDelete(rootDir: string, workspaceId: string): void {
  const wsDir = getWorkspaceDir(rootDir, workspaceId);

  if (!existsSync(wsDir)) {
    console.error('Workspace not found');
    return;
  }

  rmSync(wsDir, { recursive: true });

  const current = readCurrentWorkspace(rootDir);
  if (current === workspaceId) {
    const currentDir = join(getCacheDir(rootDir), 'current');
    if (existsSync(currentDir)) {
      rmSync(currentDir, { recursive: true });
    }
  }

  console.log(`Deleted workspace: ${workspaceId}`);
}

// ── export ──────────────────────────────────────────────

export function workspaceExport(rootDir: string, workspaceId: string): void {
  const ws = readWorkspace(rootDir, workspaceId);

  if (!ws) {
    console.error('Workspace not found');
    return;
  }

  exportWorkspaceAsWorkflow(ws);
  console.log(`Exported workspace ${workspaceId} as workflow`);
}
