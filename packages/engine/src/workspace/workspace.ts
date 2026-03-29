import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { Workspace, NodeDef, LlmConfig } from '../types.js';

export interface WorkspaceMeta {
  projectId: string;
  name: string;
  createdAt: string;
}

export interface WorkspacePreferences {
  llmConfigName: string;
}

function reviveMap<T>(obj: Record<string, T[]>): Map<string, T[]> {
  return new Map(Object.entries(obj));
}

export function loadWorkspace(rootDir: string, workspaceId: string): Workspace | null {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', workspaceId);
  const nodesPath = join(workspaceDir, 'nodes.json');
  
  if (!existsSync(nodesPath)) {
    return null;
  }

  const nodesData = JSON.parse(readFileSync(nodesPath, 'utf-8')) as NodeDef[];
  
  const metaPath = join(workspaceDir, 'meta.json');
  const meta = existsSync(metaPath) 
    ? JSON.parse(readFileSync(metaPath, 'utf-8')) as WorkspaceMeta
    : { projectId: rootDir, name: 'unnamed', createdAt: '' };

  const upstreamPath = join(workspaceDir, 'upstream.json');
  const upstream = existsSync(upstreamPath)
    ? reviveMap<string>(JSON.parse(readFileSync(upstreamPath, 'utf-8')))
    : new Map<string, string[]>();

  const downstreamPath = join(workspaceDir, 'downstream.json');
  const downstream = existsSync(downstreamPath)
    ? reviveMap<string>(JSON.parse(readFileSync(downstreamPath, 'utf-8')))
    : new Map<string, string[]>();

  const outputsPath = join(workspaceDir, 'outputs.json');
  const outputs = existsSync(outputsPath)
    ? new Map<string, string>(Object.entries(JSON.parse(readFileSync(outputsPath, 'utf-8'))))
    : new Map<string, string>();

  const targetsPath = join(workspaceDir, 'targets.json');
  const target_nodes = existsSync(targetsPath)
    ? JSON.parse(readFileSync(targetsPath, 'utf-8')) as string[]
    : [];

  const stalePath = join(workspaceDir, 'stale.json');
  const stale_nodes = existsSync(stalePath)
    ? JSON.parse(readFileSync(stalePath, 'utf-8')) as string[]
    : [];

  return {
    id: workspaceId,
    name: meta.name,
    nodes: nodesData,
    outputs,
    upstream,
    downstream,
    target_nodes,
    stale_nodes,
  };
}

export function saveWorkspace(rootDir: string, ws: Workspace): void {
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', ws.id);
  
  if (!existsSync(workspaceDir)) {
    mkdirSync(join(workspaceDir, 'outputs'), { recursive: true });
  }

  writeFileSync(
    join(workspaceDir, 'nodes.json'),
    JSON.stringify(ws.nodes, null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'upstream.json'),
    JSON.stringify(Object.fromEntries(ws.upstream), null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'downstream.json'),
    JSON.stringify(Object.fromEntries(ws.downstream), null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'outputs.json'),
    JSON.stringify(Object.fromEntries(ws.outputs), null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'targets.json'),
    JSON.stringify(ws.target_nodes, null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'stale.json'),
    JSON.stringify(ws.stale_nodes, null, 2)
  );
}

export function loadPreferences(rootDir: string, workspaceId: string): WorkspacePreferences | null {
  const prefsPath = join(rootDir, '.flowcabal', 'runner-cache', workspaceId, 'preferences.json');
  if (!existsSync(prefsPath)) return null;
  return JSON.parse(readFileSync(prefsPath, 'utf-8'));
}

export function loadLlmConfig(rootDir: string, configName: string): LlmConfig | null {
  const configPath = join(rootDir, '.flowcabal', 'llm-configs.json');
  if (!existsSync(configPath)) return null;
  
  const configs = JSON.parse(readFileSync(configPath, 'utf-8'));
  return configs[configName] || null;
}
