import { readLlmConfigs, writeLlmConfigs } from '@flowcabal/engine';
import type { LlmConfig, LlmProvider } from '@flowcabal/engine';

const ALL_PROVIDERS: LlmProvider[] = [
  'openai', 'anthropic', 'google', 'mistral', 'xai', 'cohere', 'openai-compatible',
];

export function llmList(): void {
  const configs = readLlmConfigs();
  const names = Object.keys(configs);

  if (names.length === 0) {
    console.log('暂无 LLM 配置');
    return;
  }

  console.log('LLM 配置：');
  for (const name of names) {
    const c = configs[name];
    const tag = name === 'default' ? ' (默认)' : '';
    console.log(`  ${name}${tag}:`);
    console.log(`    provider: ${c.provider}`);
    console.log(`    model:    ${c.model}`);
    if (c.baseURL) console.log(`    baseURL:  ${c.baseURL}`);
    console.log(`    apiKey:   ${c.apiKey ? '***' : '(未设置)'}`);
    if (c.temperature != null) console.log(`    temperature: ${c.temperature}`);
    if (c.maxTokens != null) console.log(`    maxTokens:   ${c.maxTokens}`);
  }
}

export async function llmAdd(): Promise<void> {
  const readline = await import('readline');
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q: string): Promise<string> =>
    new Promise((resolve) => rl.question(q, resolve));

  console.log('添加 LLM 配置');
  console.log('==============');

  const name = (await ask('名称: ')).trim();
  if (!name) { console.log('已取消'); rl.close(); return; }

  console.log(`可选 provider: ${ALL_PROVIDERS.join(', ')}`);
  const providerInput = (await ask('Provider: ')).trim();
  if (!ALL_PROVIDERS.includes(providerInput as LlmProvider)) {
    console.error(`不支持的 provider: ${providerInput}`);
    rl.close();
    return;
  }
  const provider = providerInput as LlmProvider;

  const model = (await ask('Model: ')).trim();
  if (!model) { console.error('Model 不能为空'); rl.close(); return; }

  const apiKey = (await ask('API Key: ')).trim();
  if (!apiKey) { console.error('API Key 不能为空'); rl.close(); return; }

  const baseURL = (await ask('Base URL (可选): ')).trim();
  const temperatureStr = (await ask('Temperature (可选): ')).trim();
  const maxTokensStr = (await ask('Max Tokens (可选): ')).trim();
  rl.close();

  const config: LlmConfig = { provider, model, apiKey };
  if (baseURL) config.baseURL = baseURL;
  if (temperatureStr) {
    const t = parseFloat(temperatureStr);
    if (!isNaN(t)) config.temperature = t;
  }
  if (maxTokensStr) {
    const m = parseInt(maxTokensStr);
    if (!isNaN(m)) config.maxTokens = m;
  }

  const configs = readLlmConfigs();
  configs[name] = config;
  writeLlmConfigs(configs);

  console.log(`配置 "${name}" 已添加`);
}

export function llmRemove(name: string): void {
  const configs = readLlmConfigs();

  if (!configs[name]) {
    console.error(`配置 "${name}" 不存在`);
    return;
  }

  delete configs[name];
  writeLlmConfigs(configs);
  console.log(`配置 "${name}" 已删除`);
}

export function llmSetDefault(name: string): void {
  const configs = readLlmConfigs();

  if (!configs[name]) {
    console.error(`配置 "${name}" 不存在`);
    return;
  }

  if (name === 'default') {
    console.log('该配置已经是默认');
    return;
  }

  configs['default'] = { ...configs[name] };
  writeLlmConfigs(configs);
  console.log(`已将 "${name}" 设为默认`);
}
