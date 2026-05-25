import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { readLlmFile, writeLlmFile, getActiveLlmConfig } from './paths';
import type { LlmConfig, LlmFile } from './types';

describe('paths/llm-file', () => {
  let dir: string;
  let file: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'fc-paths-'));
    file = join(dir, 'llm-configs.json');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const sampleConfig: LlmConfig = {
    provider: 'openai',
    apiKey: 'sk-test',
    model: 'gpt-4o',
  };

  test('readLlmFile: 文件不存在返回空 envelope', () => {
    expect(readLlmFile(file)).toEqual({ active: '', configs: {} });
  });

  test('readLlmFile: 文件 JSON 损坏返回空 envelope', () => {
    writeFileSync(file, '{not json', 'utf-8');
    expect(readLlmFile(file)).toEqual({ active: '', configs: {} });
  });

  test('readLlmFile: 合法 envelope 正确 parse', () => {
    const env: LlmFile = { active: 'foo', configs: { foo: sampleConfig } };
    writeFileSync(file, JSON.stringify(env), 'utf-8');
    expect(readLlmFile(file)).toEqual(env);
  });

  test('writeLlmFile: 缺 active 字段抛 zod 错', () => {
    expect(() =>
      writeLlmFile({ configs: {} } as any, file)
    ).toThrow();
  });

  test('writeLlmFile: 写完再读得到同样 envelope', () => {
    const env: LlmFile = { active: 'foo', configs: { foo: sampleConfig } };
    writeLlmFile(env, file);
    expect(readLlmFile(file)).toEqual(env);
  });

  test('getActiveLlmConfig: 空 envelope 返 null', () => {
    expect(getActiveLlmConfig(file)).toBeNull();
  });

  test('getActiveLlmConfig: active 指向不存在的 key 返 null', () => {
    writeLlmFile({ active: 'ghost', configs: { foo: sampleConfig } }, file);
    expect(getActiveLlmConfig(file)).toBeNull();
  });

  test('getActiveLlmConfig: 命中返对应 config', () => {
    writeLlmFile({ active: 'foo', configs: { foo: sampleConfig } }, file);
    expect(getActiveLlmConfig(file)).toEqual(sampleConfig);
  });
});
