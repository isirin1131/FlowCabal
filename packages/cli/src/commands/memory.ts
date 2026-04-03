import { readLlmConfigs, conversationalMemoryAgent } from '@flowcabal/engine';
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
