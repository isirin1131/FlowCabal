import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';

export function listWorkspaces(rootDir: string): void {
  const cacheDir = join(rootDir, '.flowcabal', 'runner-cache');
  
  if (!existsSync(cacheDir)) {
    console.log('No workspaces found');
    return;
  }

  const workspaces = readdirSync(cacheDir).filter(name => {
    const stat = statSync(join(cacheDir, name));
    return stat.isDirectory();
  });

  if (workspaces.length === 0) {
    console.log('No workspaces found');
    return;
  }

  console.log('Workspaces:');
  for (const id of workspaces) {
    const metaPath = join(cacheDir, id, 'meta.json');
    if (existsSync(metaPath)) {
      const meta = JSON.parse(readFileSync(metaPath, 'utf-8'));
      console.log(`  ${id} — ${meta.name || 'unnamed'}`);
    } else {
      console.log(`  ${id}`);
    }
  }
}
