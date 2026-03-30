import { mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { readLlmConfigs } from '@flowcabal/engine';

export async function initProject(rootDir: string): Promise<void> {
  const flowcabalDir = join(rootDir, '.flowcabal');
  const memoryDir = join(flowcabalDir, 'memory');
  const cacheDir = join(flowcabalDir, 'runner-cache');

  if (existsSync(flowcabalDir)) {
    console.log('项目已初始化');
    return;
  }

  mkdirSync(memoryDir, { recursive: true });
  mkdirSync(cacheDir, { recursive: true });

  // 全局配置：已有则跳过
  const existing = readLlmConfigs();
  if (Object.keys(existing).length === 0) {
    console.log('尚未配置 LLM，请运行: flowcabal llm add');
  }

  console.log('项目初始化完成');
}
