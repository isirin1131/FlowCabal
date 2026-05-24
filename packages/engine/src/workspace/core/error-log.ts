import { appendFileSync, existsSync, createReadStream, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { createInterface } from 'readline';

export interface ErrorEntry {
  ts: string; // ISO8601
  nodeId: string;
  message: string;
}

function getErrorLogPath(rootDir: string, wsId: string): string {
  return join(rootDir, '.flowcabal', 'cache', wsId, 'errors.log');
}

export function appendError(rootDir: string, wsId: string, nodeId: string, message: string): void {
  try {
    const path = getErrorLogPath(rootDir, wsId);
    mkdirSync(dirname(path), { recursive: true });
    const entry: ErrorEntry = { ts: new Date().toISOString(), nodeId, message };
    appendFileSync(path, JSON.stringify(entry) + '\n', { flag: 'a' });
  } catch (err) {
    console.warn(`[error-log] failed to append:`, (err as Error).message);
  }
}

export async function readAllErrors(rootDir: string, wsId: string): Promise<ErrorEntry[]> {
  const path = getErrorLogPath(rootDir, wsId);
  if (!existsSync(path)) return [];

  const result: ErrorEntry[] = [];
  const stream = createReadStream(path);
  const rl = createInterface({ input: stream, crlfDelay: Infinity });
  for await (const line of rl) {
    if (!line.trim()) continue;
    try {
      result.push(JSON.parse(line) as ErrorEntry);
    } catch {
      // skip malformed line
    }
  }
  return result;
}

export async function readLastErrorPerNode(
  rootDir: string,
  wsId: string,
): Promise<Map<string, ErrorEntry>> {
  const all = await readAllErrors(rootDir, wsId);
  const map = new Map<string, ErrorEntry>();
  for (const e of all) map.set(e.nodeId, e);
  return map;
}
