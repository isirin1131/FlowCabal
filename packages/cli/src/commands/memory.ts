import { readLlmConfigs, conversationalMemoryAgent, getMemoryDir } from '@flowcabal/engine';
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { basename, join } from 'path';
import type { CoreMessage } from 'ai';

export async function memoryChat(
  rootDir: string,
  llmConfigName: string = 'default'
): Promise<void> {
  const configs = readLlmConfigs();
  const config = configs[llmConfigName];
  if (!config) {
    console.error(`LLM config not found: ${llmConfigName}`);
    return;
  }

  console.log('Memory chat (Ctrl+C to exit)');
  console.log('');
  
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const messages: CoreMessage[] = [];

  const ask = () => {
    rl.question('> ', async (input) => {
      if (!input.trim()) {
        ask();
        return;
      }

      messages.push({ role: 'user', content: input });
      
      try {
        const stream = conversationalMemoryAgent(
          rootDir,
          config,
          messages,
          { readonly: false }
        );
        
        console.log('');
        let full = '';
        for await (const chunk of stream) {
          process.stdout.write(chunk);
          full += chunk;
        }
        console.log('');
        
        messages.push({ role: 'assistant', content: full });
      } catch (e) {
        console.error('Error:', e);
      }
      
      ask();
    });
  };

  ask();
}

export async function addManuscript(
  rootDir: string,
  mdFilePath: string
): Promise<void> {
  if (!mdFilePath.endsWith('.md')) {
    console.error('错误：只支持 .md 文件');
    return;
  }

  if (!existsSync(mdFilePath)) {
    console.error(`错误：文件不存在: ${mdFilePath}`);
    return;
  }

  const memoryDir = getMemoryDir(rootDir);
  const manuscriptsDir = join(memoryDir, 'manuscripts');
  
  if (!existsSync(manuscriptsDir)) {
    mkdirSync(manuscriptsDir, { recursive: true });
  }

  const destPath = join(manuscriptsDir, basename(mdFilePath));
  copyFileSync(mdFilePath, destPath);
  console.log(`已复制到: ${destPath}`);
}
