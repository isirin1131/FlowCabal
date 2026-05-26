#!/usr/bin/env node
//
// FlowCabal GUI launcher.
//
// 三种运行模式：
//   - dev: `bun run launcher.ts` → 从 build/gui-assets.tar 读
//   - SEA: 嵌入 Node SEA binary，sea.getAsset() 读 tar
//   - server subprocess: 主 launcher spawn 自身 + --internal-server-entry=<abs>
//     → createRequire(abs) 加载 standalone server.js，立即返回（让 server.js
//     接管事件循环）。子进程的 cwd 会被 server.js 头部 chdir(__dirname) 改
//     成 standaloneDir；GUI API 通过 FLOWCABAL_PROJECT_ROOT env 拿用户 cwd。
//
import { createHash } from 'node:crypto';
import { createServer, connect } from 'node:net';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, chmodSync, readdirSync, symlinkSync, linkSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir, platform } from 'node:os';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { pathToFileURL, fileURLToPath } from 'node:url';

const __filename_self = (() => {
  // CJS bundle (esbuild --format=cjs) 或 SEA embedderRunCjs：__filename 是 global
  // ESM dev (bun run launcher.ts)：__filename 未定义，用 import.meta.url
  // @ts-ignore - __filename only exists in CJS runtime
  if (typeof __filename !== 'undefined') return __filename;
  try { return fileURLToPath(import.meta.url); }
  catch { return ''; }
})();
const localRequire = createRequire(__filename_self || pathToFileURL(process.cwd() + '/').href);

// node:sea 是 Node 22+ 模块；Bun 1.x 不支持 → static import 会爆。
// 用 createRequire 动态加载 + try/catch，让 dev 模式（Bun）也能跑。
type SeaModule = {
  isSea(): boolean;
  getAsset(key: string): ArrayBuffer;
};
let seaModule: SeaModule | null = null;
try {
  seaModule = localRequire('node:sea') as SeaModule;
} catch {
  // dev 模式 / Bun runtime / 老版 Node：fallback 到 fs 读 build/gui-assets.tar
}

interface Args {
  port?: number;
  open: boolean;
  help: boolean;
  internalServerEntry?: string;
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
    } else if (a.startsWith('--internal-server-entry=')) {
      args.internalServerEntry = a.slice('--internal-server-entry='.length);
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

function loadTarBuffer(): Uint8Array {
  if (seaModule?.isSea()) {
    const ab = seaModule.getAsset('gui-assets.tar');
    return new Uint8Array(ab);
  }
  // dev: launcher.ts 在 packages/apps/gui/，tar 在 packages/apps/gui/build/
  const here = dirname(__filename_self);
  const tarPath = join(here, 'build', 'gui-assets.tar');
  const buf = readFileSync(tarPath);
  return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
}

function computeCacheDir(tarBuf: Uint8Array): string {
  const hash = createHash('sha256').update(tarBuf).digest('hex').slice(0, 16);
  return join(getCacheRoot(), hash);
}

// ── POSIX ustar / GNU / pax tar parser (read-only) ──
// 处理三种 entry：'0' 普通文件、'5' 目录、'1' hardlink。
// 长路径走 typeflag 'L' (GNU LongLink) 或 'x' (pax extended header) 的 path/linkpath
// 记录补在下一条 entry 上 —— 不补就会用截 100 字节的 ustar name 字段，
// 比如 @opentelemetry/api/build/src/* 全截成 .../build/sr → mkdir + writeFile 撞
// 同一路径，EISDIR 三平台齐爆。
interface TarEntry {
  name: string;
  size: number;
  mode: number;
  type: '0' | '5' | '1';   // '0' = file, '5' = directory, '1' = hardlink
  linkname?: string;        // hardlink 目标（archive-root 相对路径）
  data: Uint8Array;
}

function readCStr(buf: Uint8Array, start: number, len: number): string {
  const slice = buf.subarray(start, start + len);
  let end = slice.indexOf(0);
  if (end < 0) end = slice.length;
  return new TextDecoder('utf-8').decode(slice.subarray(0, end));
}

// pax extended header 内容是 "<len> <key>=<value>\n" 重复，len 是含 len 串自身的总字节数
function parsePaxRecords(buf: Uint8Array): Record<string, string> {
  const out: Record<string, string> = {};
  let p = 0;
  while (p < buf.length) {
    let spaceIdx = p;
    while (spaceIdx < buf.length && buf[spaceIdx] !== 0x20) spaceIdx++;
    if (spaceIdx >= buf.length) break;
    const lenStr = new TextDecoder('utf-8').decode(buf.subarray(p, spaceIdx));
    const recLen = parseInt(lenStr, 10);
    if (!Number.isFinite(recLen) || recLen <= 0 || p + recLen > buf.length) break;
    const kvStart = spaceIdx + 1;
    const kvEnd = p + recLen - 1;   // 去掉尾 \n
    if (kvEnd > kvStart) {
      const kv = new TextDecoder('utf-8').decode(buf.subarray(kvStart, kvEnd));
      const eqIdx = kv.indexOf('=');
      if (eqIdx > 0) out[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
    }
    p += recLen;
  }
  return out;
}

function parseTar(buf: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let pendingName: string | null = null;       // 来自 'L' 或 pax 'path'
  let pendingLinkname: string | null = null;   // 来自 'K' 或 pax 'linkpath'

  while (offset + 512 <= buf.length) {
    const header = buf.subarray(offset, offset + 512);
    // end-of-archive: two consecutive 512-byte zero blocks (we stop at first all-zero)
    if (header.every(b => b === 0)) break;

    const name = readCStr(header, 0, 100);
    const modeStr = readCStr(header, 100, 8).trim();
    const sizeStr = readCStr(header, 124, 12).trim();
    const typeFlag = String.fromCharCode(header[156]);
    const linkname = readCStr(header, 157, 100);
    const prefix = readCStr(header, 345, 155);

    const size = sizeStr ? parseInt(sizeStr, 8) : 0;
    const mode = modeStr ? parseInt(modeStr, 8) : 0o644;

    offset += 512;
    const contentStart = offset;
    offset += Math.ceil(size / 512) * 512;

    // 长路径扩展 —— 把内容当作下条 entry 的 name/linkname
    if (typeFlag === 'L') {
      pendingName = readCStr(buf, contentStart, size);
      continue;
    }
    if (typeFlag === 'K') {
      pendingLinkname = readCStr(buf, contentStart, size);
      continue;
    }
    if (typeFlag === 'x' || typeFlag === 'X') {
      const recs = parsePaxRecords(buf.subarray(contentStart, contentStart + size));
      if (recs.path) pendingName = recs.path;
      if (recs.linkpath) pendingLinkname = recs.linkpath;
      continue;
    }
    // 'g' (pax global), '2' (symlink), '3'/'4'/'6' (devices/fifo) 等：跳过，
    // 并清掉 pending —— 长名扩展只对紧邻下一条 entry 生效
    if (typeFlag !== '0' && typeFlag !== '' && typeFlag !== '5' && typeFlag !== '1') {
      pendingName = null;
      pendingLinkname = null;
      continue;
    }

    const ustarFullName = prefix ? `${prefix}/${name}` : name;
    const fullName = pendingName ?? ustarFullName;
    const fullLinkname = pendingLinkname ?? linkname;
    pendingName = null;
    pendingLinkname = null;

    if (typeFlag === '5') {
      entries.push({ name: fullName, size: 0, mode, type: '5', data: new Uint8Array(0) });
    } else if (typeFlag === '1') {
      entries.push({
        name: fullName, size: 0, mode, type: '1',
        linkname: fullLinkname, data: new Uint8Array(0),
      });
    } else {
      entries.push({
        name: fullName, size, mode, type: '0',
        data: buf.subarray(contentStart, contentStart + size),
      });
    }
  }
  return entries;
}

function ensureExtracted(cacheDir: string, tarBuf: Uint8Array): void {
  const sentinel = join(cacheDir, '.ready');
  if (existsSync(sentinel)) return;

  console.log('Extracting GUI assets (first run)...');

  // Clean any partial extract from a previous crash
  if (existsSync(cacheDir)) rmSync(cacheDir, { recursive: true, force: true });
  mkdirSync(cacheDir, { recursive: true });

  const entries = parseTar(tarBuf);
  for (const e of entries) {
    const out = join(cacheDir, e.name);
    if (e.type === '5') {
      mkdirSync(out, { recursive: true });
    } else if (e.type === '1') {
      // tar hardlink target 是 archive-root 相对路径；先 hardlink 省 ~100MB，
      // 失败（跨 mount / FAT 文件系统）再 fallback copy
      const target = join(cacheDir, e.linkname!);
      mkdirSync(dirname(out), { recursive: true });
      try { linkSync(target, out); }
      catch { copyFileSync(target, out); }
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

// ── Bun next build 把 standalone 的依赖压在 standalone/node_modules/.bun/
// flat store 里：next 真目录被 dereference 拷到 standalone/packages/apps/gui/
// node_modules/next/，但 transitive deps (@swc/helpers, react 等) 只在
// .bun/<pkg>/node_modules/<pkg>/ 下，没有传统 standalone/node_modules/<pkg>/
// 入口。Node 标准 walk-up 找不到。这里从 .bun/ 链接出传统 layout。
// Windows 走 NTFS junction (symlinkSync type='junction') —— 不需要 elevation，
// 只能 link 目录，正好符合需求（且 Node 自动把 target 规范为绝对路径）。
function fixStandaloneNodeModules(standaloneRoot: string): void {
  const isWin = platform() === 'win32';
  const linkType: 'junction' | 'dir' = isWin ? 'junction' : 'dir';
  const rootNm = join(standaloneRoot, 'node_modules');
  const bunDir = join(rootNm, '.bun');
  if (!existsSync(bunDir)) return;

  for (const entry of readdirSync(bunDir)) {
    if (entry === 'node_modules') continue;
    const innerNm = join(bunDir, entry, 'node_modules');
    if (!existsSync(innerNm)) continue;

    for (const first of readdirSync(innerNm)) {
      if (first.startsWith('@')) {
        const scopeDir = join(innerNm, first);
        if (!existsSync(scopeDir)) continue;
        for (const second of readdirSync(scopeDir)) {
          const targetDir = join(scopeDir, second);
          const linkDir = join(rootNm, first, second);
          if (!existsSync(linkDir)) {
            mkdirSync(join(rootNm, first), { recursive: true });
            try { symlinkSync(targetDir, linkDir, linkType); } catch { /* race-condition tolerant */ }
          }
        }
      } else {
        const targetDir = join(innerNm, first);
        const linkDir = join(rootNm, first);
        if (!existsSync(linkDir)) {
          try { symlinkSync(targetDir, linkDir, linkType); } catch { /* race-condition tolerant */ }
        }
      }
    }
  }
}

// ── Port probing & server readiness ──
function listenOn(port: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once('error', reject);
    srv.listen(port, '127.0.0.1', () => {
      const addr = srv.address();
      if (addr && typeof addr === 'object') {
        const got = addr.port;
        srv.close(() => resolve(got));
      } else {
        reject(new Error('listen returned non-object address'));
      }
    });
  });
}

async function probePort(initial: number): Promise<number> {
  try {
    return await listenOn(initial);
  } catch (e: any) {
    if (e.code !== 'EADDRINUSE') throw e;
    console.error(`Port ${initial} is in use; falling back to OS-assigned port.`);
    return await listenOn(0);
  }
}

function waitForReady(port: number, timeoutMs: number): Promise<void> {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const sock = connect(port, '127.0.0.1');
      sock.once('connect', () => { sock.destroy(); resolve(); });
      sock.once('error', () => {
        sock.destroy();
        if (Date.now() - start > timeoutMs) {
          reject(new Error(`Server not ready after ${timeoutMs}ms`));
        } else {
          setTimeout(tick, 50);
        }
      });
    };
    tick();
  });
}

function openBrowser(url: string): void {
  try {
    const opts = { detached: true, stdio: 'ignore' as const };
    if (platform() === 'darwin') {
      spawn('open', [url], opts).unref();
    } else if (platform() === 'win32') {
      // empty "" title is required because start treats first quoted arg as title
      spawn('cmd', ['/c', 'start', '""', url], opts).unref();
    } else {
      spawn('xdg-open', [url], opts).unref();
    }
  } catch {
    console.warn(`Couldn't auto-open browser; open ${url} manually.`);
  }
}

let shuttingDown = false;
function installSignalHandlers(killChild?: () => void): void {
  const handler = () => {
    if (shuttingDown) {
      console.error('Force exit.');
      process.exit(1);
    }
    shuttingDown = true;
    console.log('\nShutting down...');
    killChild?.();
    // Give Next server ~100ms to flush before exit
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}

// ── Server subprocess mode：被自身 spawn 的 child 进入这里 ──
function runServerInline(serverAbsPath: string): void {
  // createRequire 以 server.js 自身 URL 为锚点，Node 走标准 fs walk-up 解析
  // require('next') 等。server.js 头部会 process.chdir(__dirname) —— 这里
  // 是子进程，cwd 漂移不影响 launcher 父进程；GUI API 用 FLOWCABAL_PROJECT_ROOT
  // env 拿原始 cwd。
  const req = createRequire(pathToFileURL(serverAbsPath).href);
  req(serverAbsPath);
  // require 完返回；server.js 的 startServer({...}) 已 schedule 在事件循环上
  // 跑（异步），子进程不会退出。
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  // ── 子进程模式 ──
  if (args.internalServerEntry) {
    runServerInline(args.internalServerEntry);
    return;
  }

  // ── 主模式 ──
  // GUI API 用 FLOWCABAL_PROJECT_ROOT env 找用户项目目录（getProjectRoot
  // helper 在 src/lib/project-root.ts）；server 子进程跑起来后 cwd 会被
  // server.js 头部 chdir(__dirname) 改掉，所以不能依赖 cwd。
  const userCwd = process.cwd();
  const tarBuf = loadTarBuffer();
  const cacheDir = computeCacheDir(tarBuf);
  ensureExtracted(cacheDir, tarBuf);
  // Bun standalone 的 .bun/ flat store 不是传统 node_modules layout；
  // 在 cache 解压后建符号链接，让 server.js 的 require('@swc/helpers') 等能找到
  fixStandaloneNodeModules(join(cacheDir, '.next', 'standalone'));

  const port = await probePort(args.port ?? 3737);
  const standaloneDir = join(cacheDir, '.next', 'standalone', 'packages', 'apps', 'gui');
  const serverPath = join(standaloneDir, 'server.js');

  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    FLOWCABAL_PROJECT_ROOT: userCwd,
    PORT: String(port),
    HOSTNAME: '127.0.0.1',
    NODE_ENV: 'production',
  };

  // SEA 模式 process.argv[0] 是 binary 自身；非 SEA (dev) 是 'bun'/'node'，
  // 需要先传脚本路径（process.argv[1]）再传 flag
  const childArgs = seaModule?.isSea()
    ? [`--internal-server-entry=${serverPath}`]
    : [process.argv[1], `--internal-server-entry=${serverPath}`];

  const child = spawn(process.execPath, childArgs, {
    env: childEnv,
    stdio: 'inherit',
  });

  installSignalHandlers(() => child.kill('SIGTERM'));

  child.on('exit', (code) => process.exit(code ?? 0));

  try {
    await waitForReady(port, 30_000);
  } catch (e) {
    console.error('Server not ready:', e);
    child.kill('SIGTERM');
    process.exit(1);
  }

  const url = `http://127.0.0.1:${port}`;
  console.log(`FlowCabal running at ${url}`);
  if (args.open) openBrowser(url);

  // 父进程保持前台直到子进程 exit handler 触发 process.exit
  await new Promise(() => { /* never resolves */ });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
