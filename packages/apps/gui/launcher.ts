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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const cacheDir = await computeCacheDir(assetsTar);
  console.log('cacheDir =', cacheDir);
  console.log('TODO: extract, probe port, start server');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
