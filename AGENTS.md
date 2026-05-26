# FlowCabal Agent Guide

**Current Focus**: GUI release packaging —— Next.js standalone + Node 22 SEA 单二进制 + Windows MSI。GUI 内核稳定中。

---

## Quick Start

```bash
bun dev              # 启动 GUI 开发服务器 (http://localhost:3000)
bun run typecheck    # 验证 engine + cli 代码
bun run typecheck:gui # 验证 GUI 代码

# release 构建（本地验证用，CI 自动跑）
cd packages/apps/gui
bun run build
cp -r .next/static .next/standalone/packages/apps/gui/.next/static
tar -cf build/gui-assets.tar --dereference -C . .next/standalone
bun run sea:build                                              # esbuild bundle + node SEA blob
cp $(which node) build/flowcabal-local && chmod +w build/flowcabal-local
codesign --remove-signature build/flowcabal-local              # macOS only
npx postject build/flowcabal-local NODE_SEA_BLOB build/sea-prep.blob \
  --sentinel-fuse NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2 \
  --macho-segment-name NODE_SEA                                # macOS only flag
codesign --sign - build/flowcabal-local                        # macOS only
```

⚠️ 本地 node 必须是 v22.20.0 或更新（旧版 SEA BlobDeserializer 在 >200MB blob 上 segfault）。Homebrew 的 `/opt/homebrew/bin/node` 是 split-build stub，没 SEA fuse，要从 nodejs.org 下载官方预编译版。

---

## 迭代历史（最新优先）

| 日期 | 内容 | spec | plan |
|------|------|------|------|
| 2026-05-26 | **G 期**：GUI release packaging（弃 Bun --compile 改用 Node 22.20 LTS SEA；launcher 子进程化 + FLOWCABAL_PROJECT_ROOT env 隔离 cwd；5 平台 native build matrix；Windows MSI） | [spec](docs/superpowers/specs/2026-05-26-gui-release-packaging.md) | [plan](docs/superpowers/plans/2026-05-26-gui-release-packaging.md) |
| 2026-05-24 | **F 期**：stale 闭环（eager 扩散 + direct/propagated 双色 ✱）+ error 闭环（errors.log NDJSON + 节点尾栏文字 + tooltip）+ runAll 图原生并行（Kahn 运行时变体 + 不限并发 + error 不传染） | [spec](docs/superpowers/specs/2026-05-24-stale-error-parallel-design.md) | [plan](docs/superpowers/plans/2026-05-24-stale-error-parallel.md) |
| 2026-05-24 | **B+C+D+E 期**：节点 4 态视觉、双尺度 stream（节点级 + token 级）、连线只读化、EditorPanel ref picker、RunButton dag 进度 | [spec](docs/superpowers/specs/2026-05-24-bcde-node-interaction.md) | [plan](docs/superpowers/plans/2026-05-24-bcde-node-interaction.md) |
| 2026-05-23 | **A 期**：视觉统一（paper / clay / ink + Source Serif），所有面板迁到新调性 | [spec](docs/superpowers/specs/2026-05-23-gui-visual-unification-design.md) | [plan](docs/superpowers/plans/2026-05-23-gui-visual-unification.md) |

下期议题（已在 BCDE spec 留接入点）：
- stale 视觉 + tooltip + 「加入 target 重跑」
- error 视觉 + runtimeErrors + runAll catch
- 「移出 target」入口 + 草稿态
- 键盘整层（方向 / Tab / Enter / Esc / cmd+R / Backspace 同步）
- 复制粘贴 / undo/redo

---

## GUI 开发指南

所有 GUI 相关规范详见：

| 文档 | 用途 |
|------|------|
| `docs/GUI_DEVELOPMENT_ZH.md` | 开发指南（中文，含完整代码和模式） |

**必读章节**：
- [项目初始化](#docs/GUI_DEVELOPMENT_ZH.md#1-项目初始化) — 技术栈和安装
- [shadcn 关键规则](#docs/GUI_DEVELOPMENT_ZH.md#3-ui-组件) — 样式、表单、组件
- [xyflow 集成](#docs/GUI_DEVELOPMENT_ZH.md#4-xyflow-集成) — Canvas 和自定义节点
- [状态管理](#docs/GUI_DEVELOPMENT_ZH.md#7-状态管理) — Zustand class-based actions

---

## 项目内已知陷阱

下面是这个 codebase 里**看代码完全发现不了 / 改某处会触发别处**的几条不变性，写代码或 review 时先扫一眼。

### dagre layout 必须给 edge 传 `{}` label

`packages/apps/gui/src/lib/engine-to-flow.ts` 里的 `getLayoutedElements` —— dagre 0.8.5 的 `g.setEdge(s, t)` 不传第三个 label 参数会让 layout 阶段崩 `undefined.points`。必须 `setEdge(s, t, {})`。**workspace 没 ref 时 edges 空数组不触发**，加 ref 后立刻死，整个 createNode / 自动排版都连锁失败。

### `#updateNodeDataFromWorkspace` 必须同步重算 edges

`packages/apps/gui/src/store/useStore.ts` 的 `#updateNodeDataFromWorkspace`（被 block CRUD 4 处调用）必须从 `updatedWs.upstream` 重新生成 store.edges。**只刷 nodes 不刷 edges** 会导致加 ref block 后画布不渲染新连线。

### CustomEdge 的 type 字段要显式设 `'custom'`

xyflow 的 `<ReactFlow defaultEdgeOptions={{ type: 'custom' }}>` 是 **fill-missing 不是 override**。所以 `workspaceToFlowData` 在构造 edge 时必须显式写 `type: 'custom'`，写成 `'default'` 会让 CustomEdge 完全不生效。

### 连线只读化的契约

- 节点上的 xyflow `<Handle>` 仍存在以保持 edge 路径计算，但视觉用 `!opacity-0 !pointer-events-none` 完全隐藏
- `nodesConnectable={false}` + 不传 `onConnect`：用户无法拖出连线
- `ref` 创建唯一入口是 **EditorPanel 的「+ 添加段落 → 引用上游」picker**；不要在任何 canvas 交互里建 ref block
- ref block 创建后只读：要换上游就删了重加，避免 `insertBlock` 的 `oldRef` 路径复杂化

### 节点视觉是 4 态派生，不读 `data.status`

`FlowNode.tsx` 里 `visualStatus` 从三个来源派生：`runningNodeId === id`（store）+ `activeWorkspace.target_nodes.includes(id)` + `!!data.output`。`data.status` 字段还在但是**信息性，不驱动视觉**。下期接 stale / error 时新增 store.runtimeErrors map 同维度派生。

### 流式协议 = NDJSON 不是 SSE

`/api/engine/run-all` 返回 `Content-Type: application/x-ndjson`，客户端用 `fetch + response.body.getReader() + TextDecoder` 解析行。**不用 EventSource**（不支持 POST body）。engine 的 `runAllStream` 是 async generator，旧 `runAll` 必须保留不动（CLI 还在用）。

### stale-tracker 必须在 block CRUD / removeNode **之后**调

`packages/apps/gui/src/app/api/workspaces/[id]/blocks/route.ts` 和
`.../nodes/route.ts` 的 DELETE handler 必须：先调 engine 旧函数
（insertBlock/removeNode 等），再调 stale-tracker 的
markBlockEdited / markRemovedNodeDownstream。**调前抓 downstream
snapshot** —— removeNode 会清掉 ws.downstream Map，调完再读会拿到空数组。

### dataflow-runner 的 inDeg 只数 todo 内的边

`packages/engine/src/workspace/core/dataflow-runner.ts` 的 inDeg 初始化
仅统计 todo 集内的 upstream。todo 外的节点 output 已是 cache 命中，
视为已 done —— 否则 inDeg 永远 > 0，全部节点卡在 pending。

### error 节点失败时 *不* push target_nodes

dataflow-runner 的 fireNode catch 分支只做 `failed.add` + appendError，
**不动** ws.target_nodes。该节点如果本来在 target_nodes 里就留着；
不在的话（它是 target 祖先才进的 todo）也不主动加 —— 下次 runAll 凭
"没 output 且是 target 或 target 祖先" 自然重试。

### errors.log 必须用 getWorkspaceDir 计算路径

`packages/engine/src/workspace/core/error-log.ts` 的 errors.log path
必须用 `getWorkspaceDir(rootDir, wsId)` 而非 hardcode `.flowcabal/cache/`。
真实 workspace 目录是 `.flowcabal-project-cache/<wsId>/`（paths.ts:18-24）。
errors.log 必须跟 workspace.json 同目录，否则 workspaceDelete rmSync
不能连带清除。spec 阶段的笔误已修正。

### Release 构建：tar 前必须 cp .next/static 到 standalone 子目录

Next 16 standalone 模式只自动复制 `public/` 到 `.next/standalone/<app>/`，
**不复制 `.next/static/`**。但 server.js 头部 chdir __dirname 后从
`<dir>/.next/static/` 找静态资源（CSS、JS chunks）—— 路径错位 →
浏览器 404 → 无样式无 JS hydration → UI 上"添加 LLM 配置"等控件根本
不渲染（看似配置读不到，其实是前端代码没跑起来）。

打 tar 前 release.yml 和本地都必须显式：

```bash
cp -r .next/static .next/standalone/packages/apps/gui/.next/static
```

### GUI API 必须用 getProjectRoot() 而非 process.cwd()

`packages/apps/gui/launcher.ts` spawn server 子进程时，server.js 头部
`process.chdir(__dirname)` 会让子进程 cwd 漂到 standalone 解压目录。
GUI API 不能直接用 `process.cwd()`，必须走 `getProjectRoot()` helper
（`packages/apps/gui/src/lib/project-root.ts`），优先读 FLOWCABAL_PROJECT_ROOT
env（launcher 启动子进程时注入），dev (bun dev) fallback 到 cwd 保持兼容。

### Bun standalone 必须运行时 fix .bun/ flat store

`bun next build` 产 standalone 时，把 `next` 真目录拷到
`standalone/packages/apps/gui/node_modules/next/`，但 transitive deps
（`@swc/helpers`、`react` 等）只在 `standalone/node_modules/.bun/<pkg>/`
里，没有传统 `standalone/node_modules/<pkg>/` 入口。Node 标准 require
walk-up 找不到。`packages/apps/gui/launcher.ts` 的 `fixStandaloneNodeModules`
在 ensureExtracted 之后从 `.bun/` 创建符号链接到传统位置（Windows 跳过
因为需要特权）。

### Node SEA binary 必须用 22.20+

Node 22.11 SEA `BlobDeserializer::ReadArithmetic` 在 >200MB blob 上
segfault。我们的 SEA blob 含 ~250MB 的 Next standalone tar，必须用
22.20.0 或更新。release.yml 已锁 `setup-node@v4` `node-version: '22.20.0'`，
不要降级。本地构建务必从 nodejs.org 下载官方 22.20+ 预编译包，
Homebrew 的 node 是 split-build stub，没 SEA fuse sentinel。

---

## Skills

加载以下 skills 获取详细模式：

| Skill | 触发场景 |
|-------|----------|
| **shadcn** | 使用 shadcn/ui 组件、表单、布局 |
| **xyflow-react** | DAG 编辑器、节点类型、性能优化 |
| **zustand** | 状态管理、actions、slices |
| **vercel-react-best-practices** | 性能优化（waterfalls、bundle、memo） |
| **vercel-react-view-transitions** | 页面动画、共享元素 |
| **tailwind-design-system** | Tailwind v4 主题、设计系统 |
| **web-design-guidelines** | 可访问性、用户体验 |

---

## 项目结构

```
packages/
├── engine/           # Core engine (workspace, nodes, LLM, runner)
├── cli/              # CLI 工具（用 engine 旧 sync API）
└── apps/
    └── gui/          # Next.js GUI 应用
```

---

## Engine 参考

Engine API 可通过 `@flowcabal/engine` 导入：

```typescript
import { Workspace, TextBlock, NodeEvent, runAllStream } from '@flowcabal/engine'
```

详细类型定义见 `packages/engine/src/types.ts`。`runAllStream` 在 `packages/engine/src/workspace/core/runner.ts`，与旧 `runAll` / `runSingle` 并列。
