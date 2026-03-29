import { loadLlmConfig } from '@flowcabal/engine';
import { runMemoryAgent } from '@flowcabal/engine';

export async function memoryChat(
  rootDir: string,
  llmConfigName: string = 'default'
): Promise<void> {
  const config = loadLlmConfig(rootDir, llmConfigName);
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

  const messages: { role: 'user' | 'assistant'; content: string }[] = [];

  const ask = () => {
    rl.question('> ', async (input) => {
      if (!input.trim()) {
        ask();
        return;
      }

      messages.push({ role: 'user', content: input });
      
      try {
        const response = await runMemoryAgent(
          rootDir,
          config,
          input,
          { readonly: false }
        );
        
        console.log('');
        console.log(response);
        console.log('');
        
        messages.push({ role: 'assistant', content: response });
      } catch (e) {
        console.error('Error:', e);
      }
      
      ask();
    });
  };

  ask();
}
