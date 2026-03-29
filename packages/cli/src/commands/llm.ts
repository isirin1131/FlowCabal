import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import type { LlmConfig } from '@flowcabal/engine';

export function llmList(rootDir: string): void {
  const configPath = join(rootDir, '.flowcabal', 'llm-configs.json');
  
  if (!existsSync(configPath)) {
    console.log('No LLM configs found');
    return;
  }

  const configs = JSON.parse(readFileSync(configPath, 'utf-8'));
  const names = Object.keys(configs);
  
  if (names.length === 0) {
    console.log('No LLM configs found');
    return;
  }

  console.log('LLM Configs:');
  for (const name of names) {
    const config = configs[name] as LlmConfig;
    console.log(`  ${name}:`);
    console.log(`    provider: ${config.provider}`);
    console.log(`    model: ${config.model}`);
    console.log(`    baseURL: ${config.baseURL || '(default)'}`);
    console.log(`    apiKey: ${config.apiKey ? '***' : '(not set)'}`);
    if (config.temperature) console.log(`    temperature: ${config.temperature}`);
    if (config.maxTokens) console.log(`    maxTokens: ${config.maxTokens}`);
  }
}

export async function llmAdd(rootDir: string): Promise<void> {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const ask = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(question, (answer) => {
        resolve(answer);
      });
    });
  };

  console.log('Add LLM Config');
  console.log('==============');
  
  const name = await ask('Name: ');
  if (!name.trim()) {
    console.log('Cancelled');
    rl.close();
    return;
  }

  const provider = await ask('Provider (openai/anthropic/google/openai-compatible): ');
  const model = await ask('Model: ');
  const baseURL = await ask('Base URL (optional): ');
  const apiKey = await ask('API Key: ');
  const temperature = await ask('Temperature (optional): ');
  const maxTokens = await ask('Max Tokens (optional): ');

  const configPath = join(rootDir, '.flowcabal', 'llm-configs.json');
  let configs: Record<string, LlmConfig> = {};
  
  if (existsSync(configPath)) {
    configs = JSON.parse(readFileSync(configPath, 'utf-8'));
  }

  const config: LlmConfig = {
    provider: provider as LlmConfig['provider'],
    model: model.trim(),
    apiKey: apiKey.trim(),
  };

  if (baseURL.trim()) config.baseURL = baseURL.trim();
  if (temperature.trim()) config.temperature = parseFloat(temperature.trim());
  if (maxTokens.trim()) config.maxTokens = parseInt(maxTokens.trim());

  configs[name.trim()] = config;
  
  writeFileSync(configPath, JSON.stringify(configs, null, 2));
  
  console.log(`Config "${name}" added`);
  rl.close();
}

export function llmSetDefault(rootDir: string, name: string): void {
  const configPath = join(rootDir, '.flowcabal', 'llm-configs.json');
  
  if (!existsSync(configPath)) {
    console.error('No LLM configs found');
    return;
  }

  const configs = JSON.parse(readFileSync(configPath, 'utf-8'));
  
  if (!configs[name]) {
    console.error(`Config "${name}" not found`);
    return;
  }

  configs.default = configs[name];
  writeFileSync(configPath, JSON.stringify(configs, null, 2));
  
  console.log(`Default set to: ${name}`);
}
