import { test, expect, describe, beforeEach, afterEach } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { appendError, readAllErrors, readLastErrorPerNode } from './error-log';
import { getWorkspaceDir } from '../../paths';

describe('error-log', () => {
  let rootDir: string;
  const wsId = 'test-ws';

  beforeEach(() => {
    rootDir = mkdtempSync(join(tmpdir(), 'fc-error-log-'));
    mkdirSync(getWorkspaceDir(rootDir, wsId), { recursive: true });
  });

  afterEach(() => {
    rmSync(rootDir, { recursive: true, force: true });
  });

  test('T17: appendError 后 readAllErrors 回读', async () => {
    appendError(rootDir, wsId, 'node1', 'oh no');
    appendError(rootDir, wsId, 'node2', 'also bad');
    const all = await readAllErrors(rootDir, wsId);
    expect(all.length).toBe(2);
    expect(all[0].nodeId).toBe('node1');
    expect(all[0].message).toBe('oh no');
    expect(all[1].nodeId).toBe('node2');
  });

  test('T18: readLastErrorPerNode 后覆盖前', async () => {
    appendError(rootDir, wsId, 'node1', 'first');
    appendError(rootDir, wsId, 'node1', 'second');
    appendError(rootDir, wsId, 'node2', 'other');
    const map = await readLastErrorPerNode(rootDir, wsId);
    expect(map.size).toBe(2);
    expect(map.get('node1')?.message).toBe('second');
    expect(map.get('node2')?.message).toBe('other');
  });

  test('T19: 坏行容错', async () => {
    const logPath = join(getWorkspaceDir(rootDir, wsId), 'errors.log');
    writeFileSync(logPath, '{"ts":"2026-05-24T00:00:00.000Z","nodeId":"a","message":"ok"}\n');
    writeFileSync(logPath, '{not-json-broken\n', { flag: 'a' });
    writeFileSync(logPath, '{"ts":"2026-05-24T00:00:01.000Z","nodeId":"b","message":"good"}\n', { flag: 'a' });
    const all = await readAllErrors(rootDir, wsId);
    expect(all.length).toBe(2);
    expect(all[0].nodeId).toBe('a');
    expect(all[1].nodeId).toBe('b');
  });

  test('T20: appendError 写盘失败不抛', () => {
    expect(() => appendError('/nonexistent/path', wsId, 'a', 'msg')).not.toThrow();
  });

  test('T20b: errors.log 不存在时 readAllErrors 返回 []', async () => {
    const all = await readAllErrors(rootDir, 'never-existed');
    expect(all).toEqual([]);
  });
});
