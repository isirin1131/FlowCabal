import { readLlmConfigs, writeLlmConfigs } from '@flowcabal/engine';
import type { LlmConfig, LlmProvider } from '@flowcabal/engine';
import * as p from '@clack/prompts';

const ALL_PROVIDERS: { value: LlmProvider; label: string }[] = [
  { value: 'openai', label: 'OpenAI' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google' },
  { value: 'mistral', label: 'Mistral' },
  { value: 'xai', label: 'xAI' },
  { value: 'cohere', label: 'Cohere' },
  { value: 'openai-compatible', label: 'OpenAI Compatible（DeepSeek 等）' },
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

export async function llmAdd(name: string): Promise<void> {
  p.intro('添加 LLM 配置');

  const provider = await p.select({
    message: '选择供应商',
    options: ALL_PROVIDERS,
  });
  if (p.isCancel(provider)) { p.cancel('已取消'); return; }

  const model = await p.text({
    message: 'Model',
    placeholder: 'deepseek-chat',
    validate: (v) => v?.trim() ? undefined : 'Model 不能为空',
  });
  if (p.isCancel(model)) { p.cancel('已取消'); return; }

  const apiKey = await p.password({
    message: 'API Key',
    validate: (v) => v?.trim() ? undefined : 'API Key 不能为空',
  });
  if (p.isCancel(apiKey)) { p.cancel('已取消'); return; }

  const baseURL = await p.text({
    message: 'Base URL',
    placeholder: '留空使用默认',
  });
  if (p.isCancel(baseURL)) { p.cancel('已取消'); return; }

  const config: LlmConfig = {
    provider: provider as LlmProvider,
    model: model.trim(),
    apiKey: apiKey.trim(),
  };
  if (baseURL.trim()) config.baseURL = baseURL.trim();

  const configs = readLlmConfigs();
  configs[name] = config;
  writeLlmConfigs(configs);

  p.outro(`配置 "${name}" 已添加`);
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
