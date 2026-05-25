# GUI Release Packaging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 release artifact 从 CLI 二进制改成 GUI 单二进制（内嵌 Next.js standalone，自动开浏览器），Windows 额外产 MSI 安装包，README / AGENTS.md 同步更新。

**Architecture:** `packages/apps/gui/launcher.ts` 是 Bun TS 入口；用 `import x from './build/gui-assets.tar' with { type: 'file' }` 把 Next.js standalone 构建产物作为 binary asset 嵌入；运行时 sha256 算 hash 决定 cache dir，首次解压、二次跳过；通过 `process.env.PORT` + `process.chdir` + 动态 `import(absPath)` 同进程拉起 Next server。CI 拆 4 job 链：build-assets（一次）→ build-binary（5 平台 matrix）→ build-msi（windows）→ release。Windows MSI 用 WiX 4 + dotnet tool，支持装机范围选择与桌面快捷方式勾选。

**Tech Stack:** Bun 1.x (`bun build --compile`)、Next.js 16 (`output: 'standalone'`)、Node `node:net`/`node:crypto`/`node:fs` (cross-platform IO)、WiX 4 (`dotnet tool install --global wix`)、GitHub Actions。

参考 spec：`docs/superpowers/specs/2026-05-26-gui-release-packaging.md`。

---

## File Structure

**新建文件**：

| 文件 | 责任 |
|---|---|
| `packages/apps/gui/launcher.ts` | GUI 启动入口（嵌 tar、extract、起 Next server、开浏览器、信号处理） |
| `packaging/windows/flowcabal.wxs` | WiX 4 MSI 配置（安装路径、PATH、快捷方式、UI） |
| `packaging/windows/license.rtf` | MSI 安装向导显示的 MIT EULA |

**修改文件**：

| 文件 | 改动 |
|---|---|
| `packages/apps/gui/next.config.ts` | 加 `output: 'standalone'` |
| `.github/workflows/release.yml` | 全量重写为 4 job 链 |
| `README.md` | 重写：GUI 安装/快速开始优先；CLI 缩成开发者模式一节 |
| `AGENTS.md` | Current Focus + Quick Start + 迭代历史 |

**不动**：
- `packages/engine/` 全部
- `packages/cli/` 全部（仍可 `bun run flowcabal <cmd>`）
- `packages/apps/gui/src/` 业务代码（app/components/store/lib）
- `packages/apps/gui/AGENTS.md`（实施踩到坑再补陷阱）
- `packages/apps/gui/CLAUDE.md`（透传不动）

---

## Stage 1：Launcher 本地能跑出 GUI 二进制

### Task 1：next.config 加 standalone

**Files:**
- Modify: `packages/apps/gui/next.config.ts`

- [ ] **Step 1：加 `output: 'standalone'`**

编辑 `packages/apps/gui/next.config.ts`：

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    viewTransition: true,
  },
};

export default nextConfig;
```

- [ ] **Step 2：验证 standalone 构建产物**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun run build
```

期望：构建完成，产出 `packages/apps/gui/.next/standalone/server.js` 与 `packages/apps/gui/.next/standalone/node_modules/`。运行 `ls .next/standalone | head` 确认。

- [ ] **Step 3：commit**

```bash
git add packages/apps/gui/next.config.ts
git commit -m "$(cat <<'EOF'
build(gui): 启用 Next.js standalone output

为后续 launcher.ts 嵌入静态 tarball 做准备。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 2：launcher.ts 骨架（parseArgs + computeCacheDir + placeholder tar）

**Files:**
- Create: `packages/apps/gui/launcher.ts`
- Create: `packages/apps/gui/build/gui-assets.tar`（1024 字节零字节占位 = 合法空 tar）

**注**：placeholder tar 会被**提交进仓库**，让 fresh clone 能 typecheck/compile。CI 在 build 时 download artifact 会覆盖它（不入 commit）。⚠️ 本地 dev 跑 `next build` + `tar -cf build/gui-assets.tar ...` 后会把这个文件膨胀到 ~50MB；**测完务必不要 `git add` 这个文件**。可在 commit 前查 `git diff --stat build/gui-assets.tar` 确认。

- [ ] **Step 1：建 build 目录与占位 tar**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
mkdir -p build
# 1024 字节全零 = tar end-of-archive 标记 = 合法空 tar archive
dd if=/dev/zero of=build/gui-assets.tar bs=512 count=2 2>/dev/null
ls -la build/gui-assets.tar   # 应是 1024 字节
```

- [ ] **Step 2：写 launcher.ts 第一部分（types + parseArgs + HELP + computeCacheDir + main stub）**

创建 `packages/apps/gui/launcher.ts`，写入：

```ts
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
```

- [ ] **Step 3：typecheck 通过**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bunx tsc --noEmit launcher.ts --module esnext --target es2022 --moduleResolution bundler --types bun
```

期望：无报错。如报缺 Bun 类型，先 `bun add -d @types/bun`。

- [ ] **Step 4：本地试跑 --help 与默认**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun run launcher.ts --help
```

期望：打印 HELP 文本，立刻退出。

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun run launcher.ts
```

期望：打印 `cacheDir = <平台 cache 路径>/<16 字符 hex>` 和 "TODO: ..."。

- [ ] **Step 5：commit（含 placeholder tar）**

```bash
git add packages/apps/gui/launcher.ts packages/apps/gui/build/gui-assets.tar
git commit -m "$(cat <<'EOF'
feat(gui/launcher): parseArgs + computeCacheDir 骨架 + placeholder tar

加 packages/apps/gui/launcher.ts，先实现命令行参数解析与 cache 目录
hash 计算。embedded tar 用 1024 字节零字节占位（tar end-of-archive
marker = 合法空 archive），CI 构建时由 download-artifact 覆盖。

⚠️ 注意：本地 dev 跑 next build + tar 后会膨胀此 placeholder 到 50MB；
不要 git add 真 tarball。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 3：tar parser + ensureExtracted

**Files:**
- Modify: `packages/apps/gui/launcher.ts`

- [ ] **Step 1：在 launcher.ts 加 tar parser**

把这块代码加到 `computeCacheDir` 函数后、`main` 函数前：

```ts
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
```

- [ ] **Step 2：把 main 改成调 ensureExtracted**

把 `main` 函数替换为：

```ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const cacheDir = await computeCacheDir(assetsTar);
  await ensureExtracted(cacheDir, assetsTar);
  console.log('extracted to:', cacheDir);
  console.log('TODO: probe port, start server');
}
```

- [ ] **Step 3：用真实 tar 测一遍 parser**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
# 重建 .next/standalone（如已构建可跳过 bun run build）
bun run build
# 打个真实 tar 替换空占位
tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public
ls -la build/gui-assets.tar
bun run launcher.ts
```

期望：
- 第一次输出 "Extracting GUI assets (first run)..." + "extracted to: ..."
- 检查 cache dir：`ls "<cacheDir>/.next/standalone/server.js"` 应存在
- 第二次跑：直接 "extracted to: ..."，无 "Extracting" 字样

```bash
bun run launcher.ts
```

期望：无 "Extracting" 输出（cache 命中）。

- [ ] **Step 4：清掉刚才本地生成的真实 tar，恢复占位**

避免提交大文件：

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
dd if=/dev/zero of=build/gui-assets.tar bs=512 count=2 2>/dev/null
# 同时清掉刚生成的 cache 目录（hash 跟真 tar 对应，下次不冲突）
rm -rf ~/Library/Caches/FlowCabal 2>/dev/null || rm -rf ~/.cache/flowcabal 2>/dev/null || true
```

- [ ] **Step 5：commit**

```bash
git add packages/apps/gui/launcher.ts
git commit -m "$(cat <<'EOF'
feat(gui/launcher): tar parser + ensureExtracted

POSIX ustar 只读 parser（regular file + directory），跨平台流式解压
到 cache dir，写 .ready sentinel 标记完整。Windows 跳过 chmod。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 4：probePort + waitForReady + openBrowser + installSignalHandlers

**Files:**
- Modify: `packages/apps/gui/launcher.ts`

- [ ] **Step 1：在 `ensureExtracted` 函数后加 4 个网络/进程模块**

```ts
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
function installSignalHandlers(): void {
  const handler = () => {
    if (shuttingDown) {
      console.error('Force exit.');
      process.exit(1);
    }
    shuttingDown = true;
    console.log('\nShutting down...');
    // Give Next server ~100ms to flush before exit
    setTimeout(() => process.exit(0), 100);
  };
  process.on('SIGINT', handler);
  process.on('SIGTERM', handler);
}
```

- [ ] **Step 2：typecheck**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bunx tsc --noEmit launcher.ts --module esnext --target es2022 --moduleResolution bundler --types bun
```

期望：无报错。

- [ ] **Step 3：单独测 probePort（不依赖 Next）**

把 `main` 临时改为只测网络：

```ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }
  const port = await probePort(args.port ?? 3737);
  console.log('got port:', port);
  // try again immediately to force fallback (port should now be free again because we closed)
  const port2 = await probePort(args.port ?? 3737);
  console.log('got port 2:', port2);
}
```

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun run launcher.ts
```

期望：两次都打印 `got port: 3737`（关掉的 listener 立即释放端口）。

测 fallback：先占用 3737：

```bash
# 终端 A
nc -l 3737
# 终端 B
cd /Users/zhecai/FlowCabal/packages/apps/gui && bun run launcher.ts
```

期望：打印 "Port 3737 is in use; falling back to OS-assigned port." 然后 `got port: <49000+>`。

- [ ] **Step 4：把 main 还原（占位 TODO，下个 task 接通 server）**

```ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const cacheDir = await computeCacheDir(assetsTar);
  await ensureExtracted(cacheDir, assetsTar);
  const port = await probePort(args.port ?? 3737);

  process.env.PORT = String(port);
  process.env.HOSTNAME = '127.0.0.1';

  console.log(`Would start server at port ${port} from ${cacheDir}`);
  console.log('TODO: chdir + import + waitForReady + openBrowser');
}
```

- [ ] **Step 5：commit**

```bash
git add packages/apps/gui/launcher.ts
git commit -m "$(cat <<'EOF'
feat(gui/launcher): probePort/waitForReady/openBrowser/signals

probePort 默认 3737，被占 fallback 到 OS 高位。waitForReady 50ms
轮询 TCP connect，10s 超时。openBrowser 跨平台 spawn open/xdg-open/
cmd start。SIGINT/SIGTERM 首次优雅退、二次强退。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 5：接通 main + 本地 compile 跑出 GUI 二进制

**Files:**
- Modify: `packages/apps/gui/launcher.ts`

- [ ] **Step 1：完整 main 函数（替换 Task 4 末尾的占位）**

```ts
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) { console.log(HELP); return; }

  const cacheDir = await computeCacheDir(assetsTar);
  await ensureExtracted(cacheDir, assetsTar);

  const port = await probePort(args.port ?? 3737);
  process.env.PORT = String(port);
  process.env.HOSTNAME = '127.0.0.1';

  const standaloneDir = join(cacheDir, '.next', 'standalone');
  process.chdir(standaloneDir);

  installSignalHandlers();

  // 必须用绝对路径：相对 import 解析的是 launcher.ts 文件自身位置，
  // 跟 process.chdir 无关
  const serverPath = join(standaloneDir, 'server.js');
  const serverImport = import(serverPath);

  try {
    await Promise.race([
      waitForReady(port, 10_000),
      // 如果 server import 失败，立即 reject；成功时永不 resolve（让 waitForReady 赢）
      serverImport.then(() => new Promise<never>(() => {})),
    ]);
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }

  const url = `http://127.0.0.1:${port}`;
  console.log(`FlowCabal running at ${url}`);
  if (args.open) openBrowser(url);

  // 保持前台
  await serverImport;
}
```

- [ ] **Step 2：用真实 tar 跑非 compile 模式**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
bun run build
tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public
# 在一个干净的项目目录运行
mkdir -p /tmp/fc-test && cd /tmp/fc-test
bun run /Users/zhecai/FlowCabal/packages/apps/gui/launcher.ts
```

期望：
1. （首次）"Extracting GUI assets (first run)..."
2. 几秒后 "FlowCabal running at http://127.0.0.1:3737"
3. 浏览器自动开（macOS 默认浏览器跳出）
4. GUI 显示空 workspace 列表 — 点新建能创建 workspace（创建后 `ls /tmp/fc-test/.flowcabal-project-cache/` 应见 workspace 子目录）
5. `Ctrl+C` 优雅退出，无 stack trace

- [ ] **Step 3：bun compile 产二进制**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
bun build --compile launcher.ts --outfile /tmp/flowcabal-local
ls -lh /tmp/flowcabal-local   # 应在 50-150 MB 范围
file /tmp/flowcabal-local     # 应是 Mach-O 64-bit executable (mac) / ELF (linux)
```

期望：`bun build` 完成，产出可执行 binary。

- [ ] **Step 4：跑 compile 后的二进制验证**

```bash
mkdir -p /tmp/fc-test2 && cd /tmp/fc-test2
/tmp/flowcabal-local
```

期望：
1. "Extracting GUI assets (first run)..."（新 cwd，cache 还在 ~/Library/Caches/FlowCabal 命中——也可能直接跳过）
2. "FlowCabal running at http://127.0.0.1:3737"
3. 浏览器开
4. Ctrl+C 退

测 flag：

```bash
/tmp/flowcabal-local --port=4321 --no-open
```

期望：在 4321 端口起，不开浏览器，等待 Ctrl+C。访问 `curl -I http://127.0.0.1:4321` 应 200。

```bash
/tmp/flowcabal-local --help
```

期望：打印 HELP，立退。

- [ ] **Step 5：清理本地真实 tar，还原占位**

```bash
cd /Users/zhecai/FlowCabal/packages/apps/gui
dd if=/dev/zero of=build/gui-assets.tar bs=512 count=2 2>/dev/null
rm -f /tmp/flowcabal-local
```

- [ ] **Step 6：commit**

```bash
git add packages/apps/gui/launcher.ts
git commit -m "$(cat <<'EOF'
feat(gui/launcher): main 接通 Next server + 本地 compile 验证通过

dynamic import 用绝对路径载入 standalone server.js（同进程起服务）；
Promise.race 把 waitForReady 与 server 启动失败竞争，避免误判 timeout。
本地 bun build --compile 出二进制能跑、能开浏览器、能 Ctrl+C 退。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Stage 2：CI Workflow 改造

### Task 6：release.yml 全量重写为 4 job 链

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1：替换整个 release.yml 文件**

```yaml
name: Release

on:
  push:
    tags: ["v*"]

permissions:
  contents: write

jobs:
  build-assets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - name: Build Next.js standalone
        run: cd packages/apps/gui && bun run build

      - name: Pack gui-assets.tar
        run: |
          cd packages/apps/gui
          mkdir -p build
          # --dereference 把 node_modules 的 symlink 展开为实文件
          tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public
          ls -lh build/gui-assets.tar

      - uses: actions/upload-artifact@v4
        with:
          name: gui-assets
          path: packages/apps/gui/build/gui-assets.tar

  build-binary:
    needs: build-assets
    strategy:
      fail-fast: false
      matrix:
        include:
          - os: ubuntu-latest
            artifact: flowcabal-linux-x64
            cross: ""
          - os: macos-latest
            artifact: flowcabal-darwin-arm64
            cross: ""
          - os: windows-latest
            artifact: flowcabal-windows-x64.exe
            cross: ""
          - os: ubuntu-latest
            artifact: flowcabal-linux-arm64
            cross: "--target=bun-linux-arm64"
          - os: macos-latest
            artifact: flowcabal-darwin-x64
            cross: "--target=bun-darwin-x64"

    runs-on: ${{ matrix.os }}
    continue-on-error: ${{ matrix.cross != '' }}
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2
        with:
          bun-version: latest

      - name: Install dependencies
        run: bun install

      - uses: actions/download-artifact@v4
        with:
          name: gui-assets
          path: packages/apps/gui/build/

      - name: Compile binary
        shell: bash
        run: |
          cd packages/apps/gui
          bun build --compile launcher.ts \
            --outfile ${{ matrix.artifact }} \
            ${{ matrix.cross }}
          ls -lh ${{ matrix.artifact }}

      - uses: actions/upload-artifact@v4
        with:
          name: ${{ matrix.artifact }}
          path: packages/apps/gui/${{ matrix.artifact }}

  release:
    needs: build-binary
    if: always() && !cancelled()
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download all artifacts
        uses: actions/download-artifact@v4
        with:
          path: dist/
          merge-multiple: true

      - name: List artifacts
        run: ls -lh dist/

      - name: Make POSIX binaries executable
        run: chmod +x dist/flowcabal-linux-* dist/flowcabal-darwin-* 2>/dev/null || true

      - name: Create release
        env:
          GH_TOKEN: ${{ github.token }}
        run: |
          gh release create "${{ github.ref_name }}" \
            --title "${{ github.ref_name }}" \
            --generate-notes \
            dist/*
```

注意：MSI job 还没加；Stage 3 会插入。

- [ ] **Step 2：验证 YAML 语法**

```bash
cd /Users/zhecai/FlowCabal
bunx --bun js-yaml .github/workflows/release.yml > /dev/null
```

如未装 `js-yaml`：

```bash
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

期望：无输出（语法合法）；如报错则修。

- [ ] **Step 3：commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci(release): 改 release.yml 为 4 job 链（gui 二进制）

build-assets 跑一次 next build + tar，5 个 build-binary job 并发
download tar + bun build --compile 出对应平台二进制；release job
统一收集 artifact 发 GH release。继承现有 cross-compile 的
continue-on-error 策略。MSI job 留待后续 task 插入。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 4：触发 CI dry-run 验证**

⚠️ 不要直接打 `v*` 形式 tag —— 这会生成 release。改用临时分支 + 临时 tag 验证：

```bash
git tag v0.0.0-test-gui-binary
git push origin v0.0.0-test-gui-binary
# 用 gh CLI 监控
gh run watch
```

期望：4 个 job 顺序跑完；release 页 `v0.0.0-test-gui-binary` 含 5 个二进制（cross-compile 失败的会缺）。

如成功，**立即清理测试 release 与 tag**：

```bash
gh release delete v0.0.0-test-gui-binary --yes
git push --delete origin v0.0.0-test-gui-binary
git tag -d v0.0.0-test-gui-binary
```

如失败，根据 CI log 修，再 push 同名 tag（先删旧的再推）。

---

## Stage 3：Windows MSI

### Task 7：license.rtf + flowcabal.wxs

**Files:**
- Create: `packaging/windows/license.rtf`
- Create: `packaging/windows/flowcabal.wxs`

- [ ] **Step 1：建 packaging/windows 目录**

```bash
mkdir -p /Users/zhecai/FlowCabal/packaging/windows
```

- [ ] **Step 2：生成 license.rtf（MIT 短文本，RTF 1.x 格式）**

写入 `packaging/windows/license.rtf`：

```rtf
{\rtf1\ansi\ansicpg1252\deff0\nouicompat\deflang1033{\fonttbl{\f0\fnil\fcharset0 Calibri;}}
{\colortbl ;\red0\green0\blue0;}
\viewkind4\uc1
\pard\cf1\f0\fs22
MIT License\par
\par
Copyright (c) 2025 isirin1131\par
\par
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\par
\par
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\par
\par
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.\par
}
```

- [ ] **Step 3：生成 UpgradeCode GUID（一次性）**

```bash
# macOS / Linux
uuidgen | tr a-z A-Z
# 输出形如：4F8E2C9D-7A1B-4E3F-9C2A-1B2C3D4E5F6A
```

记下这个 GUID，下一步要写入 .wxs。

- [ ] **Step 4：写 flowcabal.wxs**

把上一步生成的 GUID 替换文中 `REPLACE_WITH_GENERATED_UPGRADECODE`。写入 `packaging/windows/flowcabal.wxs`：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Wix xmlns="http://wixtoolset.org/schemas/v4/wxs"
     xmlns:ui="http://wixtoolset.org/schemas/v4/wxs/ui">

  <Package Name="FlowCabal"
           Manufacturer="FlowCabal"
           Version="$(var.Version)"
           UpgradeCode="REPLACE_WITH_GENERATED_UPGRADECODE"
           Scope="perUserOrMachine">

    <MajorUpgrade DowngradeErrorMessage="已安装更新版本的 FlowCabal。" />
    <MediaTemplate EmbedCab="yes" />

    <!-- Main features -->
    <Feature Id="Main" Title="FlowCabal" Level="1" AllowAbsent="no">
      <ComponentRef Id="MainExe" />
      <ComponentRef Id="StartMenuShortcut" />
      <ComponentRef Id="PathEnv" />
    </Feature>

    <Feature Id="DesktopShortcut" Title="桌面快捷方式" Level="1">
      <ComponentRef Id="DesktopSC" />
    </Feature>

    <!-- Directories -->
    <StandardDirectory Id="ProgramFiles64Folder">
      <Directory Id="INSTALLFOLDER" Name="FlowCabal" />
    </StandardDirectory>
    <StandardDirectory Id="ProgramMenuFolder">
      <Directory Id="StartMenuFolder" Name="FlowCabal" />
    </StandardDirectory>
    <StandardDirectory Id="DesktopFolder" />

    <!-- Main exe -->
    <Component Id="MainExe" Directory="INSTALLFOLDER">
      <File Source="$(var.ExePath)" Name="flowcabal.exe" KeyPath="yes" />
    </Component>

    <!-- PATH (always HKCU — see spec for rationale) -->
    <Component Id="PathEnv" Directory="INSTALLFOLDER">
      <Environment Id="PathVar"
                   Name="PATH"
                   Action="set"
                   Part="last"
                   System="no"
                   Value="[INSTALLFOLDER]" />
      <RegistryValue Root="HKCU" Key="Software\FlowCabal"
                     Name="PathInstalled" Type="integer" Value="1"
                     KeyPath="yes" />
    </Component>

    <!-- Start menu shortcut -->
    <Component Id="StartMenuShortcut" Directory="StartMenuFolder">
      <Shortcut Id="StartSC" Name="FlowCabal"
                Target="[INSTALLFOLDER]flowcabal.exe"
                WorkingDirectory="INSTALLFOLDER" />
      <RemoveFolder Id="RemoveStartMenuFolder" On="uninstall" />
      <RegistryValue Root="HKMU" Key="Software\FlowCabal"
                     Name="StartMenu" Type="integer" Value="1"
                     KeyPath="yes" />
    </Component>

    <!-- Desktop shortcut (optional feature) -->
    <Component Id="DesktopSC" Directory="DesktopFolder">
      <Shortcut Id="DesktopSCShortcut" Name="FlowCabal"
                Target="[INSTALLFOLDER]flowcabal.exe"
                WorkingDirectory="INSTALLFOLDER" />
      <RegistryValue Root="HKMU" Key="Software\FlowCabal"
                     Name="DesktopShortcut" Type="integer" Value="1"
                     KeyPath="yes" />
    </Component>

    <!-- License -->
    <WixVariable Id="WixUILicenseRtf" Value="packaging\windows\license.rtf" />

    <!-- UI: Advanced 提供装机范围选择 -->
    <ui:WixUI Id="WixUI_Advanced" />
  </Package>
</Wix>
```

- [ ] **Step 5：commit**

```bash
git add packaging/windows/license.rtf packaging/windows/flowcabal.wxs
git commit -m "$(cat <<'EOF'
build(packaging): 加 Windows MSI 的 WiX 4 配置 + MIT RTF EULA

flowcabal.wxs 配置：
- Scope="perUserOrMachine"：同一 MSI 支持装机范围选择
- Main feature 必装：exe + 开始菜单快捷方式 + PATH 修改
- DesktopShortcut 可选 feature：默认勾上，可取消
- PATH 始终改 HKCU（System="no"），跨 scope 简化
- WixUI_Advanced 对话框集（welcome / license / scope / dir / install）
- MajorUpgrade 支持同 UpgradeCode 自动升级

UpgradeCode 已固定写入，永不变更。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 8：release.yml 加 build-msi job

**Files:**
- Modify: `.github/workflows/release.yml`

- [ ] **Step 1：在 `build-binary` job 之后、`release` job 之前插入 build-msi job**

把 `release.yml` 里 `release:` 那行之前插入：

```yaml
  build-msi:
    needs: build-binary
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4

      - name: Download windows-x64 binary
        uses: actions/download-artifact@v4
        with:
          name: flowcabal-windows-x64.exe
          path: dist/

      - name: Install WiX 4
        run: dotnet tool install --global wix --version 4.0.4

      - name: Build MSI
        shell: pwsh
        run: |
          $version = "${{ github.ref_name }}" -replace '^v',''
          wix build packaging\windows\flowcabal.wxs `
            -define Version=$version `
            -define ExePath=dist\flowcabal-windows-x64.exe `
            -ext WixToolset.UI.wixext `
            -out flowcabal-windows-x64.msi
          dir flowcabal-windows-x64.msi

      - uses: actions/upload-artifact@v4
        with:
          name: flowcabal-windows-x64.msi
          path: flowcabal-windows-x64.msi
```

- [ ] **Step 2：把 release job 的 needs 改成等 MSI**

把：

```yaml
  release:
    needs: build-binary
```

改为：

```yaml
  release:
    needs: [build-binary, build-msi]
```

- [ ] **Step 3：验证 YAML 合法**

```bash
cd /Users/zhecai/FlowCabal
python3 -c "import yaml; yaml.safe_load(open('.github/workflows/release.yml'))"
```

期望：无输出。

- [ ] **Step 4：commit**

```bash
git add .github/workflows/release.yml
git commit -m "$(cat <<'EOF'
ci(release): 加 build-msi job（WiX 4 产 Windows x64 .msi）

build-msi 依赖 build-binary 的 windows-x64.exe artifact，在
windows-latest 上用 dotnet tool 装 wix 4 构建 MSI；release job
改为同时等 build-binary 和 build-msi。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

- [ ] **Step 5：测试 tag 触发完整 CI（含 MSI）**

```bash
git tag v0.0.0-test-msi
git push origin v0.0.0-test-msi
gh run watch
```

期望：
1. build-assets 完成
2. 5 个 build-binary 并发完成（cross-compile 可能 fail，OK）
3. build-msi 完成
4. release 创建，含 `.exe` 和 `.msi`

验证 release：

```bash
gh release view v0.0.0-test-msi --json assets --jq '.assets[].name'
```

期望见 `flowcabal-windows-x64.msi`。

如可能，下载 MSI 到 Windows 机器双击装一遍：
- Welcome → License → Install scope（默认 Just me）→ Install dir → Customize（默认 ☑ 桌面快捷方式）→ Install → Finish
- 开始菜单见 FlowCabal；新开 cmd 跑 `flowcabal --help` 应见 HELP
- 控制面板卸载

清理：

```bash
gh release delete v0.0.0-test-msi --yes
git push --delete origin v0.0.0-test-msi
git tag -d v0.0.0-test-msi
```

---

## Stage 4：文档

### Task 9：重写 README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1：完整替换 README.md 内容**

```markdown
# FlowCabal

AI 辅助小说创作 DAG 工作流引擎

核心功能：用 agent 管理手稿和在其基础上生成的各类自定义记忆文件，用 DAG 式的工作流基于自定义内容和向 agent 的提问注入项拼接提示词，调用 LLM API 以生成新内容。

可以将想要运行的节点加入 target_nodes，软件会自动解析依赖的上游节点。

stale_nodes 仅作为提醒，这些节点输出结果可能不是最新的。

目前软件为 beta 版本，主要目的为验证软件定义的 AI 辅助创作范式的效果是否达到预期，多 agent 功能的支持尚在路上。

ps：请关注 [LINUX DO](https://linux.do/) 社区 owo

## 技术栈

### 核心依赖

- **[ai](https://github.com/vercel/ai)** - AI SDK，用于调用各类 LLM API
- **[next](https://nextjs.org)** 16 + **[react](https://react.dev)** 19 - GUI 框架
- **[@xyflow/react](https://reactflow.dev)** - DAG 编辑器
- **[zustand](https://github.com/pmndrs/zustand)** - GUI 状态管理
- **[zod](https://github.com/colinhacks/zod)** - TypeScript 数据校验
- **[nanoid](https://github.com/adjust/nanoid)** - 唯一 ID 生成

### LLM Provider

- `@ai-sdk/openai` - OpenAI 兼容
- `@ai-sdk/anthropic` - Anthropic (Claude)
- `@ai-sdk/google` - Google (Gemini)
- `@ai-sdk/mistral` - Mistral
- `@ai-sdk/xai` - xAI (Grok)
- `@ai-sdk/cohere` - Cohere

### 运行时

- **[Bun](https://bun.sh)** - 单二进制运行时（release binary 内嵌）

---

## 安装

去 [GitHub Releases](https://github.com/isirin1131/FlowCabal/releases) 下载对应平台。

### Windows

**方式一（推荐）：MSI 安装包**

下载 `flowcabal-windows-x64.msi`，双击安装。安装向导会：

- 让你选「仅当前用户」或「全用户」装机范围
- 把 `flowcabal` 加到 PATH（新开 cmd / PowerShell 即可调用）
- 在开始菜单加快捷方式
- 可选在桌面也加快捷方式

> ⚠️ 未签名提示：双击 MSI 时会弹 Windows SmartScreen 警告，点「更多信息」→「仍要运行」即可。

**方式二：裸 .exe**

下载 `flowcabal-windows-x64.exe`，放到任意目录。若双击 .exe 被 SmartScreen 拦下，右键 → 属性 → 解除锁定 → 确定。

### macOS

下载对应架构：
- Apple Silicon: `flowcabal-darwin-arm64`
- Intel: `flowcabal-darwin-x64`

```bash
chmod +x flowcabal-darwin-*
# 首次跑会撞 Gatekeeper（未签名），用 xattr 解掉 quarantine
xattr -d com.apple.quarantine flowcabal-darwin-*
```

### Linux

下载对应架构：
- x86_64: `flowcabal-linux-x64`
- ARM64: `flowcabal-linux-arm64`

```bash
chmod +x flowcabal-linux-*
```

---

## 快速开始

```bash
# 在你要存项目数据的目录跑
cd ~/my-novel-project
./flowcabal       # macOS / Linux
# 或者 Windows：flowcabal （MSI 装完已加 PATH；裸 .exe 用 .\flowcabal.exe）
```

首次运行：

1. 二进制解压内嵌 GUI 资源到平台 cache 目录（约 1s，仅首次）
2. 启动 GUI 服务，浏览器自动打开 `http://127.0.0.1:3737`
3. 在 GUI 里：
   - 新建 workspace（点左上 +）
   - 添加 LLM 配置（顶栏 Settings → LLM 加 API Key 和 model）
   - 拖节点 / 加 ref / 加 literal / 加 agent-inject
   - 节点右键加入 target → 点 Run

工作目录就是项目根：GUI 在 cwd 下读写 `.flowcabal-project-cache/`（workspace 数据）和 `memory/`（手稿）。换项目就 `cd` 到别的目录再跑。

### 命令行选项

```
flowcabal [options]

Options:
  --port=N      监听端口（默认 3737，被占自动 fallback 到 OS 高位）
  --no-open     不自动开浏览器
  -h, --help    显示帮助
```

---

## 工作原理

FlowCabal 是一个基于 DAG（有向无环图）的工作流引擎：

1. **节点 (Node)**：代表小说中的章节、场景或创作单元
2. **Block**：节点内的内容单元
   - `literal`：静态文本
   - `ref`：引用其他节点的内容
   - `agent-inject`：由 Agent 根据 hint 注入内容
3. **执行**：从 target_nodes 开始，按依赖顺序执行

---

## 目录结构

二进制在 cwd 下使用以下目录：

```
.flowcabal-project-cache/        # 项目缓存（GUI / CLI 自动创建）
├── <workspace-id>/              # 各 workspace 数据
│   ├── workspace.json
│   ├── outputs/<node-id>.json
│   └── errors.log               # 运行错误日志（NDJSON）
└── current/
    └── workspace.json           # 当前 workspace pointer

memory/                          # 手稿 / 设定（手动维护）
├── index.md                     # 记忆索引
└── manuscripts/                 # 手稿目录
```

LLM 配置全局存在 `~/.config/flowcabal/llm-configs.json`，所有项目共享：

```json
{
  "active": "default",
  "configs": {
    "default": {
      "provider": "anthropic",
      "apiKey": "sk-...",
      "model": "claude-3-5-sonnet-20241022"
    }
  }
}
```

支持供应商：OpenAI、Anthropic、Google、Mistral、xAI、Cohere、OpenAI 兼容（自定义 base URL）。

---

## 开发者模式 / 源码运行

需要先装 [Bun](https://bun.sh)。

```bash
git clone https://github.com/isirin1131/FlowCabal.git
cd FlowCabal
bun install
bun dev   # 启动 GUI dev server (http://localhost:3000)
```

CLI 命令仍可通过 `bun run flowcabal <cmd>` 使用（release binary 不再包含 CLI 入口）：

```bash
bun run flowcabal --help              # 总览
bun run flowcabal init                # init 当前目录
bun run flowcabal workspace create x  # 创建 workspace
bun run flowcabal node add chapter-1  # 加节点
bun run flowcabal run                 # 跑 target_nodes
```

CLI 详细命令见 `bun run flowcabal --help`。

## License

MIT
```

- [ ] **Step 2：commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs(readme): 重写为 GUI 优先

安装章节按平台分（Windows MSI/裸exe / macOS / Linux）；快速开始
从 CLI 命令清单改为 GUI flow（启动→浏览器→GUI 操作）；CLI 命令
缩成「开发者模式」一节里的指引（仅源码可用，release 不含）。
目录结构改用 .flowcabal-project-cache/（engine 实际路径）。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

### Task 10：更新 AGENTS.md

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1：改 Current Focus 行**

把第 3 行：

```markdown
**Current Focus**: FlowCabal GUI — Next.js 应用使用 @xyflow/react 构建 DAG 编辑器。
```

替换为：

```markdown
**Current Focus**: GUI release packaging —— Next.js standalone + bun --compile 单二进制 + Windows MSI。GUI 内核稳定中。
```

- [ ] **Step 2：Quick Start 加 release 构建指引**

在 Quick Start 代码块（`bun dev` / `bun run typecheck` / `bun run typecheck:gui` 那三行）之后追加：

```bash

# release 构建（本地验证用，CI 自动跑）
cd packages/apps/gui && bun run build
tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public
bun build --compile launcher.ts --outfile ../../flowcabal
```

- [ ] **Step 3：迭代历史表加一行**

在迭代历史表的 `| 2026-05-24 | **F 期** ...` 行之上插入：

```markdown
| 2026-05-26 | **G 期**：release packaging（CLI 从 release 移除，改产 GUI 单二进制 + Windows MSI；launcher 内嵌 Next standalone tarball + 端口 fallback + 自动开浏览器） | [spec](docs/superpowers/specs/2026-05-26-gui-release-packaging.md) | [plan](docs/superpowers/plans/2026-05-26-gui-release-packaging.md) |
```

- [ ] **Step 4：commit**

```bash
git add AGENTS.md
git commit -m "$(cat <<'EOF'
docs(agents): G 期 release packaging 迭代记录 + Current Focus 切换

Current Focus 从 GUI 功能开发切到 release packaging。Quick Start
加 launcher 本地构建指引。迭代历史加 2026-05-26 行。

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## 完成验收

实施完所有 task 后，本机能验证：

1. ✅ `cd packages/apps/gui && bun run build` 产出 `.next/standalone/server.js`
2. ✅ `cd packages/apps/gui && tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public` 产真实 tar
3. ✅ `cd packages/apps/gui && bun build --compile launcher.ts --outfile ../../flowcabal` 产单二进制
4. ✅ 二进制双击 / 终端跑：浏览器自动开 `http://127.0.0.1:3737`，能创建 workspace
5. ✅ `./flowcabal --port=4321` 用指定端口；`./flowcabal --no-open` 不开浏览器；`./flowcabal --help` 显示帮助
6. ✅ 二次跑无 extract 输出（cache 命中）
7. ✅ Ctrl+C 优雅退出
8. ✅ Push 真实 `v*` tag 触发 CI 产 5 binary + 1 MSI 的 release page
9. ✅ Windows 双击 MSI 走完安装；开始菜单出现入口；PATH 自动加；卸载干净

---

## 实施顺序与回退

- **Stage 1**（Task 1-5）：launcher 本地能跑。每个 task commit 独立可回退。
- **Stage 2**（Task 6）：CI 改造。任何阶段失败可 revert 单个 commit 回原 CLI workflow。
- **Stage 3**（Task 7-8）：MSI。MSI 失败不影响 binary release（release job 用 `if: always()`）。
- **Stage 4**（Task 9-10）：文档。零代码风险。

若 Stage 1 Task 5 发现 `bun --compile + Next standalone` 不兼容，按 spec 风险表退到方案 B（同目录 sidecar resources）—— 重做 launcher.ts 与 CI workflow，其他 task 不动。
