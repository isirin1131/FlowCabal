# CLAUDE.md

## 技术栈
- **纯 TypeScript + Bun**，monorepo（`packages/engine` + `packages/tui`）
- LLM 集成：Vercel AI SDK（`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`）
- Schema 校验：Zod
- TUI：OpenTUI（`@opentui/core` + `@opentui/react`）
- CLI：yargs + @clack/prompts
- 分发：`bun build --compile` 单文件二进制，GitHub Actions 多平台编译

## 常用命令
- `bun install` — 安装依赖
- `bun run typecheck` — 类型检查（engine + tui + cli）
- `bun run flowcabal init` — 初始化项目（@clack/prompts 交互）
- `bun run flowcabal` — 启动 TUI
- `bun run flowcabal --workspace <id>` — 指定 workspace 启动
- `bun run flowcabal node add <label>` — 创建节点
- `bun run flowcabal node connect <nodeId> <upstreamId>` — 连接节点
- `bun run flowcabal edit <nodeId> [blockIndex]` — 编辑 block 文本
- `bun run flowcabal run` — 执行 DAG

## 目录结构
- `packages/engine/src/` — 核心引擎（纯库，零 IO 假设）
  - `types.ts` / `schema.ts` — 领域类型 + Zod schema（手写，各自维护）
  - `paths.ts` — 路径注册表（全局 `~/.config/flowcabal/` + 项目本地 `.flowcabal/`）
  - `llm/` — Vercel AI SDK provider + generate/stream（共享基础设施）
  - `runner-core/` — 执行引擎
    - `state.ts` — 唯一内存模型，workspace 和 run 都读写它
    - `workspace.ts` — 薄 API 层，委托 state，查询全同步
    - `run.ts` — 执行循环，通过 state 读写版本
    - `cache.ts` — workspace 生命周期 + JSON helpers
    - `workflow.ts` — 校验、拓扑排序、子图计算
    - `resolve.ts` — TextBlock 解析 + prompt hash
    - `budget.ts` — token 估算
    - `convert.ts` — workflow ↔ nodes 转换
  - `agent/` — Agent 子系统
    - `agent.ts` — runAgent + conversationalAgent + conversationalAgentEvents（结构化事件流）
    - `tools.ts` — Agent 工具集（memory CRUD + query_runtime）
    - `memory.ts` — Memory 文件 CRUD + index 生成
    - `assembler.ts` — L0 加载
    - `prompts.ts` — 系统提示词
- `packages/tui/src/` — 交互式终端界面（OpenTUI + React）
  - `index.ts` — yargs 入口（init → legacy, 默认 → launchTui）
  - `init.ts` — flowcabal init（@clack/prompts 交互）
  - `config.ts` — findProjectRoot, loadLlmConfigs, listWorkspaces
  - `app.tsx` — 根组件 + launchTui 启动流程
  - `theme.ts` — 颜色常量、状态图标/颜色映射、视图标签
  - `hooks/` — 6 个 React hooks（useWorkspace, useFocus, useKeybindings, useRun, useMemory, useAgentChat）
  - `views/` — 5 个视图（dashboard, node-detail, memory-browser, agent-chat, todo-queue）
  - `components/` — 8 个可复用组件（status-bar, command-input, node-list, progress-bar, text-block-renderer, version-list, streaming-output, file-tree）
- `packages/cli/` — 命令行界面（yargs + @clack/prompts）
  - `src/index.ts` — yargs 入口
  - `src/config.ts` — findProjectRoot, loadLlmConfigs, resolveWorkspace
  - `src/commands/` — 11 个命令文件
    - `init.ts` — 项目初始化
    - `create.ts` — workspace 创建
    - `lock.ts` / `log.ts` / `show.ts` / `status.ts` — workspace 查询
    - `edit.ts` — 单 block 文本编辑（$EDITOR）
    - `node.ts` — 节点编排子命令组（add/rm/rename/connect/disconnect/add-literal/add-inject/rm-block）
    - `run.ts` — DAG 执行
    - `add-chapter.ts` — 章节添加 + Agent 记忆提取
    - `generate.ts` — 单节点生成
- `docs/` — 设计文档（保留，不要动）
- `backend/` — 旧代码 + 测试用样章（保留）
- `.github/workflows/release.yml` — 多平台编译 + GitHub Release 自动发布

## 路径分两层

**全局** `~/.config/flowcabal/`：
```
├── llm-configs.json       # LLM 配置池（多套，按名引用，一套 default）
├── workflows/             # Workflow 模板（纯蓝图，用于分享）
│   └── <workflow-id>.json
└── preferences/           # 用户对模板的个性化配置
    └── <workflow-id>.json # per-node LLM 覆盖等偏好
```

**项目本地** `<project>/.flowcabal/`：
```
├── memory/                # Agent 记忆（按项目隔离）
│   ├── index.md           # L0 导航（自动生成）
│   ├── voice.md           # 文体约束
│   ├── characters/        # 角色（一角色一文件）
│   ├── world/             # 世界观（一概念一文件）
│   └── manuscripts/       # L2 定稿章节
└── runner-cache/          # 工作区（删除即释放）
    └── <workspace-id>/
        ├── meta.json      # { projectId, createdAt }
        ├── nodes.json     # NodeDef[]
        ├── preferences.json
        └── outputs/
            └── <node-id>.json  # { versions, currentId }
```

## 架构要点

### 模块职责与持久化边界
- **runner-core/** — 执行引擎，独占 `runner-cache/` 读写，读取全局配置
  - **state.ts** = 唯一内存模型；`loadState()` 一次性加载全部数据，查询全同步
  - **workspace.ts** = 薄 API 层，委托 state
  - **run.ts** = 执行循环，通过 state 读写版本，不持有私有 outputs Map
- **agent/** — Agent 子系统，独占 `memory/` 读写（人类也直接编辑 memory）
- **llm/** — 共享基础设施，runner-core 和 agent 都依赖
- **tui/** — engine API 的纯展示层，零领域逻辑
- **cli/** — engine API 的命令行界面，@clack/prompts 交互
  - `edit` 只编辑单个 block 的文本（literal→content, agent-inject→hint），ref 不可编辑
  - `node` 子命令组负责所有结构编排（增删节点、连接/断开 ref、管理 block）
  - nodeId 支持前缀匹配（复用 show.ts 模式）
- Agent 通过 RuntimeContext 接口查询运行时状态（从 state 实时读取），不直接读 runner-cache

### TUI 状态管理
- 零外部状态库，两层状态：
  - **Engine 状态**：Workspace 对象，同步查询 + 异步 mutation + StateEvent
  - **React 状态**：hooks 里的 useState/useReducer，通过订阅 engine 事件刷新
- `useWorkspace()` 提供 Context + revision 计数器：StateEvent → revision++ → React 重渲染 → ws.getDashboard() 等同步 API
- `useRun()` 订阅 RunHandle 的 RunEvent，分派到 reducer
- React hooks 从 `react` 导入，OpenTUI hooks（useKeyboard 等）从 `@opentui/react` 导入

### OpenTUI API 要点
- `border={true}` + `borderStyle="single"`（border 是 boolean，不是字符串）
- `<select>` options 用 `{ name, description, value }`（不是 label/value）
- `<select>` onChange 接收 `(index, option)` 而非 `(value)`
- `<box>` 背景用 `backgroundColor`，`<text>` 背景用 `bg`
- 加粗用 `<b>` 包裹，不用 `style={{ bold: true }}`
- `<input>` 无 `onKeyPress`，用 `useKeyboard` hook
- KeyEvent 用 `key.name` 检测字符输入（无 `input`/`char` 属性）
- `createCliRenderer({ exitOnCtrlC, useAlternateScreen, targetFps })`
- `renderer.destroy()` 关闭渲染器

### Workflow / Workspace / Project 三层解耦
- **Workflow** = 纯模板/蓝图，只描述节点结构和 prompt 组合方式，不含 LLM 配置，用于分享
- **Workspace** = workflow 的一次实例化，绑定 project，存执行缓存；用户在其中反复调试；删除即释放
- **Project** = 小说项目，拥有独立的 memory/ 目录
- **Core-runner** = 运行时引擎，增量构建系统，以 node 为粒度缓存

### DAG 连接关系
- 没有显式 edges —— 从 TextBlock 的 `kind: "ref"` 隐式推导

### TextBlock 三种类型
- `literal` — 静态文本
- `ref` — 引用上游节点输出
- `agent-inject` — Agent 注入点，带 hint 告诉 Agent 方向，Agent 读 L0 自主决定注入什么内容；一个节点可以有多个注入点，出现在 prompt 的不同位置

### LLM 配置
- 全局 `~/.config/flowcabal/llm-configs.json`，Record<name, LlmConfig>，"default" 为默认
- per-node LLM 覆盖存在 preferences.json（workspace 级别）
- init 时检测已有全局配置则跳过

### 缓存二维失效
- **结构性失效（自动）**：节点的 literal+ref prompt hash 变化 → 必须重跑，自动级联下游
- **上下文过期（预警）**：project memory/manuscripts 被修改 → agent-inject 缓存可能过期 → 预警用户

### Executor 事件模型
- 用 discriminated union（`RunEvent` + `StateEvent`）而非 callbacks
- `RunEvent`：run/level/node 生命周期事件，`node:done` 携带 output，`level:done`/`level:paused` 携带 results
- `StateEvent`：state.ts 变更通知（version:added/switched, nodes:changed, targets:changed, preferences:changed）
- 可序列化（直接 JSON.stringify 发 WebSocket）、可扩展（加事件不改签名）、可回放（测试/调试）
- `RunHandle.done`：可 await 的 Promise\<RunSummary | null\>，null 表示 aborted/error
- `AgentEvent`：text/tool-call/tool-result，`conversationalAgentEvents()` 返回 AsyncGenerator

### engine 是纯库
- 不 console.log、不假设 terminal
- Workflow 操作走 engine API，不直接操作文件
- 状态可序列化，类型保持 JSON-friendly
- executor 接受 AbortSignal，预留执行中断
- Workspace 查询全同步（getNodeStatus/getDashboard/previewNode 等），mutation 异步
- state.ts `onChange()` 提供 mutation 事件流，TUI 和未来 Web 前端都可监听

## 代码规范
- 中文提示词、中文 UI 文案
- 用户默认 LLM 是 DeepSeek（openai-compatible provider）
- 不用向量搜索，Agent 驱动的 L0 索引 + 按需加载
- 不要过度工程化，保持简洁
- types.ts 手写类型，schema.ts 手写 Zod schema（用于运行时校验），两份各自维护
