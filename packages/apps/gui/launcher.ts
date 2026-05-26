#!/usr/bin/env bun
//
// FlowCabal GUI launcher.
//
// ⚠️ build/gui-assets.tar 是占位文件（CI 会覆盖为真 tarball）。
//    本地跑 `tar -cf build/gui-assets.tar ...` 测试后，不要把真 tar
//    commit 进仓库 —— 真 tarball 约 50MB。
//
import { createHash } from 'node:crypto';
import { createServer, connect } from 'node:net';
import { existsSync, mkdirSync, writeFileSync, rmSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { spawn } from 'node:child_process';

import assetsTar from './build/gui-assets.tar' with { type: 'file' };

interface Args {
  port?: number;
  open: boolean;
  help: boolean;
}

const HELP = `flowcabal — local GUI for FlowCabal

Usage: flowcabal [options]

Options:
  --port=N      监听端口（默认 3737，被占自动 fallback 到 OS 高位）
  --no-open     不自动开浏览器
  -h, --help    显示帮助

工作目录即项目根；GUI 在 cwd 下读/写 .flowcabal-project-cache/ 和 memory/。
`;

function parseArgs(argv: string[]): Args {
  const args: Args = { open: true, help: false };
  for (const a of argv) {
    if (a === '-h' || a === '--help') {
      args.help = true;
    } else if (a === '--no-open' || a === '-q') {
      args.open = false;
    } else if (a.startsWith('--port=')) {
      const n = Number(a.slice('--port='.length));
      if (!Number.isInteger(n) || n < 0 || n > 65535) {
        console.error(`Invalid port: ${a.slice('--port='.length)}`);
        process.exit(2);
      }
      args.port = n;
    } else {
      console.error(`Unknown argument: ${a}\nUse --help for usage.`);
      process.exit(2);
    }
  }
  return args;
}

function getCacheRoot(): string {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Caches', 'FlowCabal');
    case 'win32': {
      const lad = process.env.LOCALAPPDATA;
      return lad ? join(lad, 'FlowCabal', 'Cache')
                 : join(home, 'AppData', 'Local', 'FlowCabal', 'Cache');
    }
    default: {
      const xdg = process.env.XDG_CACHE_HOME;
      return xdg ? join(xdg, 'flowcabal') : join(home, '.cache', 'flowcabal');
    }
  }
}

async function computeCacheDir(tarPath: string): Promise<string> {
  const buf = await Bun.file(tarPath).arrayBuffer();
  const hash = createHash('sha256').update(new Uint8Array(buf)).digest('hex').slice(0, 16);
  return join(getCacheRoot(), hash);
}

// ── POSIX ustar tar parser (read-only, regular files & directories only) ──
interface TarEntry {
  name: string;
  size: number;
  mode: number;
  type: '0' | '5';   // '0' = file, '5' = directory
  data: Uint8Array;
}

function readCStr(buf: Uint8Array, start: number, len: number): string {
  const slice = buf.subarray(start, start + len);
  let end = slice.indexOf(0);
  if (end < 0) end = slice.length;
  return new TextDecoder('utf-8').decode(slice.subarray(0, end));
}

function parseTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    // end-of-archive: two consecutive 512-byte zero blocks (we stop at first all-zero)
    if (header.every(b => b === 0)) break;

    const name = readCStr(header, 0, 100);
    const modeStr = readCStr(header, 100, 8).trim();
    const sizeStr = readCStr(header, 124, 12).trim();
    const typeFlag = String.fromCharCode(header[156]);
    const prefix = readCStr(header, 345, 155);

    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const mode = modeStr ? parseInt(modeStr, 8) : 0o644;
    const fullName = prefix ? `${prefix}/${name}` : name;

    offset += 512;

    // Only handle regular files ('0' or '') and directories ('5'); skip others
    if (typeFlag === '0' || typeFlag === '' || typeFlag === '5') {
      const isDir = typeFlag === '5';
      const data = isDir ? new Uint8Array(0) : buf.subarray(offset, offset + size);
      entries.push({
        name: fullName,
        size,
        mode,
        type: isDir ? '5' : '0',
        data,
      });
    }

    // Advance past content (512-aligned)
    offset += Math.ceil(size / 512) * 512;
  }
  return entries;
}

async function ensureExtracted(cacheDir: string, tarPath: string): Promise<void> {
  const sentinel = join(cacheDir, '.ready');
  if (existsSync(sentinel)) return;

  console.log('Extracting GUI assets (first run)...');

  // Clean any partial extract from a previous crash
  if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const buf = new Uint8Array(await Bun.file(tarPath).arrayBuffer());
  const entries = parseTar(buf);
  for (const e of entries) {
    const out = join(cacheDir, e.name);
    if (e.type === '5') {
      mkdirSync(out, { recursive: true });
    } else {
      mkdirSync(dirname(out), { recursive: true });
      writeFileSync(out, e.data);
      // chmod only on POSIX; Windows ignores
      if (platform() !== 'win32' && e.mode) {
        try { chmodSync(out, e.mode & 0o777); } catch { /* ignore */ }
      }
    }
  }
  writeFileSync(sentinel, '');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const cacheDir = await computeCacheDir(assetsTar);
  await ensureExtracted(cacheDir, assetsTar);
  console.log('extracted to:', cacheDir);
  console.log('TODO: probe port, start server');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
