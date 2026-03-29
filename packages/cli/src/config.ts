import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import type { LlmConfig } from '@flowcabal/engine';

const CONFIG_FILE = 'llm-configs.json';
const GLOBAL_CONFIG_DIR = join(process.env.HOME || '', '.config', 'flowcabal');

export function findProjectRoot(cwd: string): string | null {
  let dir = cwd;
  while (dir !== '/') {
    const configPath = join(dir, '.flowcabal');
    if (existsSync(configPath)) {
      return dir;
    }
    dir = dirname(dir);
  }
  return null;
}

export function loadLlmConfigs(projectRoot: string): Record<string, LlmConfig> {
  const configPath = join(projectRoot, '.flowcabal', CONFIG_FILE);
  if (existsSync(configPath)) {
    try {
      const content = readFileSync(configPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  const globalPath = join(GLOBAL_CONFIG_DIR, CONFIG_FILE);
  if (existsSync(globalPath)) {
    try {
      const content = readFileSync(globalPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }

  return {};
}

export function listWorkspaces(projectRoot: string): string[] {
  const runnerCache = join(projectRoot, '.flowcabal', 'runner-cache');
  if (!existsSync(runnerCache)) return [];
  
  return readdirSync(runnerCache).filter(name => {
    const stat = statSync(join(runnerCache, name));
    return stat.isDirectory();
  });
}

export function resolveWorkspace(projectRoot: string, workspaceId?: string): string | null {
  const workspaces = listWorkspaces(projectRoot);
  if (workspaces.length === 0) return null;
  
  if (!workspaceId) return workspaces[0];
  
  const matched = workspaces.find(w => w.startsWith(workspaceId));
  return matched || null;
}
