import { existsSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';

const CURRENT_WORKSPACE_FILE = '.flowcabal/current-workspace';

export function workspaceSwitch(rootDir: string, workspaceId: string): void {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', workspaceId);
  
  if (!existsSync(workspaceDir)) {
    console.error('Workspace not found');
    return;
  }

  writeFileSync(join(rootDir, CURRENT_WORKSPACE_FILE), workspaceId);
  console.log(`Switched to workspace: ${workspaceId}`);
}

export function getCurrentWorkspace(rootDir: string): string | null {
  const currentPath = join(rootDir, CURRENT_WORKSPACE_FILE);
  if (!existsSync(currentPath)) return null;
  return readFileSync(currentPath, 'utf-8').trim();
}

export function workspaceStatus(rootDir: string, workspaceId: string): void {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', workspaceId);
  
  if (!existsSync(workspaceDir)) {
    console.error('Workspace not found');
    return;
  }

  const metaPath = join(workspaceDir, 'meta.json');
  const meta = existsSync(metaPath) 
    ? JSON.parse(readFileSync(metaPath, 'utf-8'))
    : {};

  const nodesPath = join(workspaceDir, 'nodes.json');
  const nodes = existsSync(nodesPath)
    ? JSON.parse(readFileSync(nodesPath, 'utf-8'))
    : [];

  const outputsPath = join(workspaceDir, 'outputs.json');
  const outputs = existsSync(outputsPath)
    ? JSON.parse(readFileSync(outputsPath, 'utf-8'))
    : {};

  const targetsPath = join(workspaceDir, 'targets.json');
  const targets = existsSync(targetsPath)
    ? JSON.parse(readFileSync(targetsPath, 'utf-8'))
    : [];

  const stalePath = join(workspaceDir, 'stale.json');
  const stale = existsSync(stalePath)
    ? JSON.parse(readFileSync(stalePath, 'utf-8'))
    : [];

  console.log(`Workspace: ${workspaceId}`);
  console.log(`  Name: ${meta.name || '(unnamed)'}`);
  console.log(`  Created: ${meta.createdAt || '(unknown)'}`);
  console.log(`  Nodes: ${nodes.length}`);
  console.log(`  Outputs: ${Object.keys(outputs).length}`);
  console.log(`  Targets: ${targets.length}`);
  console.log(`  Stale: ${stale.length}`);
}

export function workspaceShow(rootDir: string, workspaceId: string): void {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', workspaceId);
  
  if (!existsSync(workspaceDir)) {
    console.error('Workspace not found');
    return;
  }

  const metaPath = join(workspaceDir, 'meta.json');
  const meta = existsSync(metaPath) 
    ? JSON.parse(readFileSync(metaPath, 'utf-8'))
    : {};

  console.log(`# ${meta.name || workspaceId}`);
  console.log('');
  console.log(`Created: ${meta.createdAt || '(unknown)'}`);
}

export function workspaceDelete(rootDir: string, workspaceId: string): void {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', workspaceId);
  
  if (!existsSync(workspaceDir)) {
    console.error('Workspace not found');
    return;
  }

  rmSync(workspaceDir, { recursive: true });
  console.log(`Deleted workspace: ${workspaceId}`);
}

export function workspaceLog(rootDir: string, workspaceId: string): void {
  const logPath = join(rootDir, '.flowcabal', 'runner-cache', workspaceId, 'log.json');
  
  if (!existsSync(logPath)) {
    console.log('No log found');
    return;
  }

  const log = JSON.parse(readFileSync(logPath, 'utf-8'));
  console.log(JSON.stringify(log, null, 2));
}

export function workspaceLock(rootDir: string, workspaceId: string): void {
  const lockPath = join(rootDir, '.flowcabal', 'runner-cache', workspaceId, 'locked.json');
  
  if (existsSync(lockPath)) {
    console.log('Already locked');
    return;
  }

  writeFileSync(lockPath, JSON.stringify({ lockedAt: new Date().toISOString() }, null, 2));
  console.log('Workspace locked');
}
