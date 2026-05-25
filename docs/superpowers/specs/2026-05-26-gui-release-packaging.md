# GUI Release Packaging — 单二进制 + Windows MSI

**日期**：2026-05-26
**分支**：GUI_support
**状态**：spec drafted

---

## 背景

`GUI_support` 分支的功能开发告一段落，进入收尾。
当前 release artifact 仍是 CLI 二进制（`packages/cli/src/index.ts` 经 `bun build --compile`），
但项目重心已是 GUI。本期目标是：

1. **release 二进制改为 GUI**：用户下载即可双击 / 终端运行启动 GUI，自动开浏览器
2. **Windows 提供 MSI 安装包**：开始菜单 / 桌面快捷方式 / 加 PATH / 装机范围可选
3. **文档（README、AGENTS.md）同步更新**

CLI 源码保留在 `packages/cli/`，仅供 agent 自动化通过 `bun run flowcabal <cmd>` 使用，
不再进入 release。

---

## 决策汇总

| 维度 | 选择 |
|---|---|
| Release 内容 | 仅 GUI 二进制，CLI 完全移除 |
| 端口策略 | 默认 3737；被占 fallback 到 OS 高位端口（`listen(0)`） |
| 浏览器 | 默认自动开（`--no-open` 可关） |
| 进程模型 | 前台进程；Ctrl+C 优雅退出 |
| 打包方案 | 单二进制内嵌 `.next/standalone` tarball，首次运行 extract 到 cache dir |
| Windows MSI 范围 | 仅 windows-x64；保留 `.exe` 裸二进制并行 |
| MSI 内容 | 开始菜单（必选）+ 桌面快捷方式（可选勾）+ PATH + 装机范围选项 |
| 文档 | README 重写 GUI 优先；AGENTS.md 加迭代历史；不新建 CLAUDE.md |

---

## 整体架构

### Release artifacts（每打 `v*` tag 产）

| 平台 | 文件 |
|---|---|
| Linux x64 | `flowcabal-linux-x64` |
| Linux arm64 | `flowcabal-linux-arm64` (cross, best-effort) |
| macOS arm64 | `flowcabal-darwin-arm64` |
| macOS x64 | `flowcabal-darwin-x64` (cross, best-effort) |
| Windows x64 | `flowcabal-windows-x64.exe` |
| Windows x64 | `flowcabal-windows-x64.msi`（新增） |

### 单二进制内部布局

```
flowcabal-{platform}-{arch}[.exe]
├── Bun runtime（被 --compile 自带）
├── bundled launcher 代码（packages/apps/gui/launcher.ts 编译）
└── 嵌入 asset: gui-assets.tar
    ├── .next/standalone/  (含最小化 node_modules + server.js)
    ├── .next/static/
    └── public/
```

### 运行时流程

```
flowcabal[.exe]   (在用户 cwd 跑)
    │
    ├─ parseArgs(process.argv)
    │     flags: --port=N, --no-open/-q, --help/-h
    │
    ├─ computeCacheDir(embeddedTarHash)
    │     macOS: ~/Library/Caches/FlowCabal/<hash>/
    │     Linux: $XDG_CACHE_HOME/flowcabal/<hash>/ 或 ~/.cache/flowcabal/<hash>/
    │     Win:   %LOCALAPPDATA%\FlowCabal\Cache\<hash>\
    │
    ├─ ensureExtracted(cacheDir)
    │     存在 .ready sentinel？跳过：流式 untar，最后写 sentinel
    │     首次输出："Extracting GUI assets (first run)..."
    │
    ├─ port = probePort(args.port ?? 3737)
    │     try listen(3737) → EADDRINUSE → listen(0) → close 后返回端口
    │     如 fallback 触发，打印实际端口
    │
    ├─ process.env.PORT = String(port)
    │   process.env.HOSTNAME = '127.0.0.1'
    │   process.chdir(join(cacheDir, '.next/standalone'))
    │
    ├─ installSignalHandlers()  // SIGINT/SIGTERM → graceful exit
    │
    ├─ serverImport = import('./server.js')   // Next 同进程起服务
    │
    ├─ await waitForReady(port, 10s)
    │     50ms 间隔 net.connect 探测；超时 → 报错退出
    │
    ├─ console.log(`FlowCabal running at http://127.0.0.1:${port}`)
    ├─ if (args.open) openBrowser(...)
    │
    └─ await serverImport   // 前台阻塞，直到 SIGINT
```

---

## launcher.ts 模块拆解

**文件**：`packages/apps/gui/launcher.ts`（约 200 行）

### 模块表

| 模块 | 行数 | 关键决策 |
|---|---|---|
| `parseArgs` | 20 | 手写解析（不引 yargs，保持 launcher 瘦） |
| `computeCacheDir` | 25 | SHA-256 前 8 字节做目录名；按平台计算 cache-root |
| `ensureExtracted` | 50 | JS-only tar 流式解析（≈40 行），不调外部 `tar` 命令 |
| `probePort` | 20 | `net.createServer().listen()` + EADDRINUSE catch |
| `waitForReady` | 15 | 50ms 间隔 `net.connect`；10s 超时 |
| `openBrowser` | 20 | 跨平台 spawn `open`/`xdg-open`/`cmd /c start ""`；失败仅 warn |
| `installSignalHandlers` | 15 | SIGINT 第一次优雅退出，第二次强退 |
| `main` | 35 | 流程编排 |

### 关键技术决策

1. **同进程 `import('./server.js')`，不 fork 子进程**
   - 理由：Bun --compile 后自身就是 Bun runtime，自我 spawn 复杂；Next.js standalone server.js 是 listen-and-go 脚本，dynamic import 完全够用
2. **JS-only tar parser 内化（不调系统 `tar`）**
   - Windows 10 早期版本无 `tar.exe`；外部命令的引号/路径/编码跨平台麻烦
   - tar 格式简单：512 字节 header + 文件 payload + 512 字节对齐 padding；40 行能写完只读 parser
3. **embedded asset 用 `import x from './path.tar' with { type: 'file' }`**
   - bun --compile 时自动嵌入；运行时 `Bun.file(x).arrayBuffer()` 拿到全部内容
   - tar 不再 gzip 包一层（Bun --compile 已对二进制压缩，gzip 仅增加运行时开销）
4. **cache dir hash 由 tar 内容决定（不依赖手动版本号）**
   - 升级二进制时，新 tar 内容变 → 新 hash → 新 cache 目录
   - 旧 cache 残留：launcher 不主动清理，用户自行清；后续可加 `--clear-cache` flag

### 用户视角

```
$ ./flowcabal
Extracting GUI assets (first run)...
FlowCabal running at http://127.0.0.1:3737
  Network: http://127.0.0.1:3737
[Next.js server logs...]
^C
Shutting down...
$
```

`--help` 输出：

```
flowcabal — local GUI for FlowCabal

Usage: flowcabal [options]

Options:
  --port=N      监听端口（默认 3737，被占自动 fallback 到 OS 高位）
  --no-open     不自动开浏览器
  -h, --help    显示帮助

工作目录即项目根；GUI 在 cwd 下读/写 .flowcabal-project-cache/ 和 memory/。
```

---

## CI Workflow 改造

`.github/workflows/release.yml` 从单 job 矩阵改成 4 job 链。

```
build-assets   →   build-binary (matrix 5)   →   build-msi (windows only)
       (1×)                                              ↘
                                                      release
```

### Job 1：`build-assets`（ubuntu-latest）

```yaml
build-assets:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
      with:
        bun-version: latest
    - run: bun install
    - name: Build Next.js standalone
      run: cd packages/apps/gui && bun next build
    - name: Pack gui-assets.tar
      run: |
        cd packages/apps/gui
        mkdir -p build
        # --dereference 把 node_modules 的 symlink 展开为实际文件，避免 Windows 端
        # 解压时 symlink 失效
        tar -cf build/gui-assets.tar --dereference .next/standalone .next/static public
    - uses: actions/upload-artifact@v4
      with:
        name: gui-assets
        path: packages/apps/gui/build/gui-assets.tar
```

理由：`.next/standalone` 输出的 JS 平台无关，5 个二进制共用一份；
Next build 单次 ~30s，避免 5x 浪费 ~2min。

### Job 2：`build-binary`（matrix 5，依赖 Job 1）

```yaml
build-binary:
  needs: build-assets
  strategy:
    fail-fast: false
    matrix:
      include:
        - os: ubuntu-latest, artifact: flowcabal-linux-x64, cross: ""
        - os: macos-latest, artifact: flowcabal-darwin-arm64, cross: ""
        - os: windows-latest, artifact: flowcabal-windows-x64.exe, cross: ""
        - os: ubuntu-latest, artifact: flowcabal-linux-arm64, cross: "--target=bun-linux-arm64"
        - os: macos-latest, artifact: flowcabal-darwin-x64, cross: "--target=bun-darwin-x64"
  runs-on: ${{ matrix.os }}
  continue-on-error: ${{ matrix.cross != '' }}
  steps:
    - uses: actions/checkout@v4
    - uses: oven-sh/setup-bun@v2
    - run: bun install
    - uses: actions/download-artifact@v4
      with:
        name: gui-assets
        path: packages/apps/gui/build/
    - name: Compile binary
      run: |
        cd packages/apps/gui
        bun build --compile launcher.ts \
          --outfile ${{ matrix.artifact }} \
          ${{ matrix.cross }}
    - uses: actions/upload-artifact@v4
      with:
        name: ${{ matrix.artifact }}
        path: packages/apps/gui/${{ matrix.artifact }}
```

### Job 3：`build-msi`（windows-latest，依赖 windows-x64 binary）

```yaml
build-msi:
  needs: build-binary
  runs-on: windows-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/download-artifact@v4
      with:
        name: flowcabal-windows-x64.exe
        path: dist/
    - name: Install WiX 4
      run: dotnet tool install --global wix --version 4.0.4
    - name: Build MSI
      run: |
        wix build packaging\windows\flowcabal.wxs `
          -define Version=${{ github.ref_name }} `
          -define ExePath=dist\flowcabal-windows-x64.exe `
          -out flowcabal-windows-x64.msi
    - uses: actions/upload-artifact@v4
      with:
        name: flowcabal-windows-x64.msi
        path: flowcabal-windows-x64.msi
```

### Job 4：`release`

```yaml
release:
  needs: [build-binary, build-msi]
  if: always() && !cancelled()
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/download-artifact@v4
      with:
        path: dist/
        merge-multiple: true
    - name: Make binaries executable
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

### 细节

| 关注点 | 方案 |
|---|---|
| `packages/apps/gui/build/gui-assets.tar` | 加入 `.gitignore` 不入库；只在 CI 生成 |
| Next build 跨平台 native deps | `.next/standalone` 中的 `node_modules` 在 Linux x64 host 上 hoist；GUI 未用 `next/image`，无 sharp 等原生依赖。CI 若失败再补 |
| Tar 内 symlink 跨平台 | Linux host 打 tar 时用 `--dereference` 展开 symlink 为实文件，避免 Windows 端解压时 symlink 失效 |
| Bun `bun next build` | 通过 `bun` 调 `next` CLI；Next.js 标准产出，无 Bun-specific 改造 |
| `next.config.ts` | 增加 `output: 'standalone'` |

---

## Windows MSI / WiX 配置

`packaging/windows/flowcabal.wxs`（WiX 4 格式，约 100 行）。

### 对话框流

```
Welcome
   ↓
EULA（MIT，packaging/windows/license.rtf）
   ↓
Install Scope（仅当前用户 / 全用户，默认前者）
   ↓
Install Directory（默认 %LOCALAPPDATA%\FlowCabal 或 %ProgramFiles%\FlowCabal）
   ↓
Customize Features（☑ 桌面快捷方式 可取消勾选）
   ↓
Confirm & Install
   ↓
Finish
```

### .wxs 关键结构

```xml
<Package Name="FlowCabal" Manufacturer="FlowCabal"
         Version="$(var.Version)"
         UpgradeCode="<固定 GUID 写在文件中>" Scope="perUserOrMachine">

  <MajorUpgrade DowngradeErrorMessage="已安装更新版本" />
  <MediaTemplate EmbedCab="yes" />

  <Property Id="ALLUSERS" Value="2" />
  <Property Id="MSIINSTALLPERUSER" Value="1" />

  <Feature Id="Main" Title="FlowCabal" Level="1" AllowAbsent="no">
    <ComponentRef Id="MainExe" />
    <ComponentRef Id="StartMenuShortcut" />
    <ComponentRef Id="PathEnv" />
  </Feature>

  <Feature Id="DesktopShortcut" Title="桌面快捷方式" Level="1">
    <ComponentRef Id="DesktopSC" />
  </Feature>

  <StandardDirectory Id="ProgramFiles64Folder">
    <Directory Id="INSTALLFOLDER" Name="FlowCabal" />
  </StandardDirectory>
  <StandardDirectory Id="ProgramMenuFolder">
    <Directory Id="StartMenuFolder" Name="FlowCabal" />
  </StandardDirectory>
  <StandardDirectory Id="DesktopFolder" />

  <Component Id="MainExe" Directory="INSTALLFOLDER">
    <File Source="$(var.ExePath)" Name="flowcabal.exe" KeyPath="yes" />
  </Component>

  <!-- PATH 始终改 HKCU（System="no"）—— 简化跨装机范围逻辑；
       per-machine 装的话另一个用户登录后需手动加 PATH。 -->
  <Component Id="PathEnv" Directory="INSTALLFOLDER">
    <Environment Id="PathVar" Name="PATH" Action="set" Part="last"
                 System="no" Value="[INSTALLFOLDER]" />
    <RegistryValue Root="HKCU" Key="Software\FlowCabal" Name="PathInstalled"
                   Type="integer" Value="1" KeyPath="yes" />
  </Component>

  <Component Id="StartMenuShortcut" Directory="StartMenuFolder">
    <Shortcut Id="StartSC" Name="FlowCabal"
              Target="[INSTALLFOLDER]flowcabal.exe"
              WorkingDirectory="INSTALLFOLDER" />
    <RemoveFolder Id="RemoveStartMenuFolder" On="uninstall" />
    <RegistryValue Root="HKMU" Key="Software\FlowCabal" Name="StartMenu"
                   Type="integer" Value="1" KeyPath="yes" />
  </Component>

  <Component Id="DesktopSC" Directory="DesktopFolder">
    <Shortcut Id="DesktopSCShortcut" Name="FlowCabal"
              Target="[INSTALLFOLDER]flowcabal.exe"
              WorkingDirectory="INSTALLFOLDER" />
    <RegistryValue Root="HKMU" Key="Software\FlowCabal" Name="DesktopShortcut"
                   Type="integer" Value="1" KeyPath="yes" />
  </Component>

  <!-- UI: 需要既支持「装机范围选择」（Advanced 系列特性）
       又支持「Customize Features 勾选桌面快捷方式」。
       具体 dialog set 在实施时定 —— 可选：
         (a) WixUI_Advanced，把桌面快捷方式 Property + UI checkbox
         (b) 自定义组合 dialog sequence
       spec 阶段不锁定。 -->
  <ui:WixUI Id="WixUI_Advanced" />
</Package>
```

### 决策点

| 项 | 决定 |
|---|---|
| WiX 版本 | WiX 4（`dotnet tool install --global wix`） |
| 装机范围 | 同一份 MSI 双模支持；UI 让用户选；默认 per-user（不需 admin） |
| PATH 修改 | 始终改 HKCU（`System="no"`），简化跨 scope 逻辑；per-machine 装时其他用户不会自动获得 PATH（需手动加），README 写明 |
| 桌面快捷方式 | 作为可选 Feature；UI 默认勾上 |
| 开始菜单快捷方式 | 主 Feature 内；无可选 |
| UI dialog set | 既需装机范围选择又需 Feature 勾选；具体走 `WixUI_Advanced` 加 checkbox 还是自定义 sequence，实施时定 |
| 图标 | 复用 `packages/apps/gui/public/favicon.ico` |
| UpgradeCode | 固定 GUID 写入 .wxs（实施时一次性生成；写入后永不变） |
| Code sign | 暂不签；README 写明 SmartScreen 绕过方式 |
| EULA | MIT 短文本 → `packaging/windows/license.rtf` |

### MSI 用户视角

1. 双击 `flowcabal-windows-x64.msi`
2. SmartScreen 警告 → "更多信息" → "仍要运行"
3. Welcome → Next → License → Accept → Next
4. Install Scope: ⊙ Just me / ○ All users → Next
5. Install Location → Next
6. Customize: ☑ 桌面快捷方式（可取消）→ Next
7. Install（per-user 不需 UAC；per-machine 弹 UAC）
8. Finish

装完后：
- 开始菜单有 FlowCabal 入口
- 桌面（若勾选）有快捷方式
- 新开 cmd / PowerShell 能直接 `flowcabal`（PATH 已加；老窗口需重开）
- 控制面板 → 程序和功能 有"FlowCabal"卸载项

---

## 文档更新

### README.md（重写）

新结构：

```
FlowCabal                                  # 介绍保留
技术栈                                     # 加 Next.js 16 / xyflow / Bun runtime
安装                                       # 重写
  Windows
    方式一（推荐）: 下载 .msi 双击安装
    方式二: 下载 .exe 直接跑
    SmartScreen 警告？右键 → 属性 → 解除锁定
  macOS
    下载 darwin-arm64 / darwin-x64
    chmod +x flowcabal-darwin-*
    macOS quarantine: xattr -d com.apple.quarantine flowcabal-*
  Linux
    下载 linux-x64 / linux-arm64 → chmod +x → 跑
快速开始                                   # GUI 优先
  cd ~/my-novel-project
  ./flowcabal
  → 浏览器自动开 http://localhost:3737
  → GUI 里：新建 workspace → 添加 LLM 配置 → 拖节点 → 点 Run
工作原理                                   # 保留 DAG / Block 概念
目录结构                                   # 修正为 .flowcabal-project-cache/
配置                                       # LLM configs 路径不变
开发者模式 / 源码运行                      # 新增章节
  git clone → bun install → bun dev
  CLI 仍可通过 bun run flowcabal <cmd> 使用（仅源码，release 不含）
```

CLI 命令清单**不**整段保留。给一句指引：「CLI 详细命令见 `bun run flowcabal --help`」。

### AGENTS.md（增量）

修改：
- `Current Focus` 改为：`GUI release packaging —— Next.js standalone + bun --compile 单二进制 + Windows MSI。GUI 内核稳定中。`
- Quick Start 加 release 构建指引（本地验证用）
- 迭代历史新增一行：

  ```
  | 2026-05-26 | **G 期**：release packaging（CLI 从 release 移除，改产 GUI 单二进制 + Windows MSI；launcher 内嵌 Next standalone + 端口 fallback + 自动开浏览器） | [spec](docs/superpowers/specs/2026-05-26-gui-release-packaging.md) | [plan](docs/superpowers/plans/2026-05-26-gui-release-packaging.md) |
  ```

### gui/AGENTS.md（实施时按需补陷阱）

启动过程踩到的坑（`process.chdir` 时机、Next standalone server.js 启动语义、`import()` 路径解析等）—— 实施时若踩到再写入。spec 阶段不预写。

### CLAUDE.md

根目录无 CLAUDE.md。`packages/apps/gui/CLAUDE.md` 是 `@AGENTS.md` 透传，不动。
不新建根 CLAUDE.md（AGENTS.md 已是事实主文档，Claude Code 兼容认）。

---

## 文件改动清单

### 新增

- `packages/apps/gui/launcher.ts` — launcher 主文件
- `packaging/windows/flowcabal.wxs` — WiX 4 配置
- `packaging/windows/license.rtf` — MIT EULA RTF
- `docs/superpowers/specs/2026-05-26-gui-release-packaging.md` — 本文档

### 修改

- `.github/workflows/release.yml` — 4 job 链改造
- `packages/apps/gui/next.config.ts` — 加 `output: 'standalone'`
- `packages/apps/gui/package.json` — 可能加 launcher 相关 devDeps（如有）
- `.gitignore` — 加 `packages/apps/gui/build/`
- `README.md` — 重写 GUI 优先
- `AGENTS.md` — Current Focus + Quick Start + 迭代历史

### 不动

- `packages/cli/` 全部源码
- `packages/engine/` 全部
- `packages/apps/gui/` 业务代码（仅启动入口和 next.config 改）
- `packages/apps/gui/AGENTS.md`（实施踩坑时再补）
- `packages/apps/gui/CLAUDE.md`

---

## 风险与回退

| 风险 | 缓解 |
|---|---|
| Bun --compile + Next standalone 跑不起来 | CI 上先用 ubuntu-x64 验证 main path；不通过则退化为方案 B（二进制 + sidecar resources 目录） |
| 跨编译的 Linux ARM64 / macOS Intel 二进制 Next 跑不起来 | 保留 `continue-on-error`；release notes 标"best-effort" |
| Next.js standalone 含 native deps（sharp 等） | 当前 GUI 未使用 next/image；若 CI 中发现 native deps，重新评估 |
| WiX 4 在 Windows runner 上的 dotnet tool 安装失败 | 退到 WiX 3.11 (`choco install wixtoolset`) |
| MSI SmartScreen 阻挡严重影响新用户 | README 写绕过指引；远期考虑买 EV cert |
| 首次启动 extract 时间过长（>5s） | 改用 gzip 压缩 tar 牺牲 extract 速度换体积；或换 zstd |
| 老 cache 目录残留累积 | 加 `--clear-cache` flag；或 launcher 启动时清理 7 天前的旧 hash 目录（暂不做） |

---

## 验收标准

实施完成后，本机能验证：

1. `bun run --filter gui next build` 不报错
2. 本地 `bun build --compile packages/apps/gui/launcher.ts --outfile flowcabal` 出二进制
3. `./flowcabal` 跑起，浏览器自动开 `http://127.0.0.1:3737`，可创建 workspace
4. `./flowcabal --port=4000` 监听 4000
5. `./flowcabal --no-open` 不开浏览器
6. 二次跑无 extract 输出（cache 命中）
7. Ctrl+C 优雅退出，无僵尸进程

CI 上：

8. `gh workflow run release` 触发的 dry-run（用 test tag）能产出所有 5 个二进制 + MSI + release page
9. Windows 上双击 MSI 走完安装流；装完开始菜单出现 FlowCabal；新开 cmd `flowcabal` 能跑
10. 卸载 MSI 后开始菜单/桌面/PATH 全清

---

## 实施顺序建议（留给 writing-plans 阶段细化）

按风险从小到大递增，分阶段做：

1. **Stage 1**：next.config 加 standalone + 写 launcher.ts + 本地 `bun --compile` 跑通
2. **Stage 2**：CI 改造 build-assets + build-binary，本地用 `act` 或 push test tag 验证
3. **Stage 3**：WiX .wxs + build-msi job + 本地 Windows 验证 MSI 走完安装/卸载
4. **Stage 4**：文档更新（README、AGENTS.md）

每个 stage 都可独立 PR 或 commit，便于回退。
