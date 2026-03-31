import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import {
  readLlmConfigs,
  getMemoryDir,
  getCacheDir,
  MEMORY_SEED_FILES,
  MEMORY_SEED_DIRS,
} from '@flowcabal/engine';

export async function initProject(rootDir: string): Promise<void> {
  const memoryDir = getMemoryDir(rootDir);
  const cacheDir = getCacheDir(rootDir);

  // 全部幂等：已存在则跳过
  mkdirSync(memoryDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  for (const dir of MEMORY_SEED_DIRS) {
    mkdirSync(join(memoryDir, dir), { recursive: true });
  }

  for (const file of [...MEMORY_SEED_FILES, "index.md"]) {
    const filePath = join(memoryDir, file);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, '', 'utf-8');
    }
  }

  // 全局配置：已有则跳过
  const existing = readLlmConfigs();
  if (Object.keys(existing).length === 0) {
    console.log('尚未配置 LLM，请运行: flowcabal llm add');
  }

  console.log('项目初始化完成');
}
