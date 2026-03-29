import { mkdirSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

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

  const defaultConfig = {
    default: {
      provider: 'openai-compatible',
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: '',
      model: 'deepseek-chat',
    }
  };

  writeFileSync(
    join(flowcabalDir, 'llm-configs.json'),
    JSON.stringify(defaultConfig, null, 2)
  );

  console.log('项目初始化完成');
  console.log('请编辑 .flowcabal/llm-configs.json 配置 LLM');
}
