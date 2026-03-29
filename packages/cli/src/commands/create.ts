import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'fs';
import { join } from 'path';
import { newId } from '@flowcabal/engine';
import type { LlmConfig } from '@flowcabal/engine';

export async function createWorkspace(
  name: string,
  rootDir: string,
  configs: Record<string, LlmConfig>
): Promise<void> {
  const id = newId();
  const workspaceDir = join(rootDir, '.flowcabal', 'runner-cache', id);
  
  if (existsSync(workspaceDir)) {
    console.error('Workspace 已存在');
    return;
  }

  mkdirSync(join(workspaceDir, 'outputs'), { recursive: true });

  const meta = {
    projectId: rootDir,
    name,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(
    join(workspaceDir, 'meta.json'),
    JSON.stringify(meta, null, 2)
  );

  writeFileSync(
    join(workspaceDir, 'nodes.json'),
    JSON.stringify([], null, 2)
  );

  const configName = 'default';
  const config = configs[configName];
  writeFileSync(
    join(workspaceDir, 'preferences.json'),
    JSON.stringify({ llmConfigName: configName, ...config }, null, 2)
  );

  console.log(`Created workspace: ${id} (${name})`);
}
