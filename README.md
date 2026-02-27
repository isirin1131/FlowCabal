# FlowCabal

AI 辅助长篇小说创作工具——"ComfyUI, but for text"。

DAG workflow 引擎 + 交互式 TUI，通过节点图组合 prompt，Agent 自主管理记忆，增量构建只重跑变化的节点。

## 安装

### 下载预编译二进制（推荐）

从 [GitHub Releases](https://github.com/isirin1131/FlowWrite/releases) 下载对应平台的单文件可执行文件：

| 平台 | 文件 |
|------|------|
| Linux x64 | `flowcabal-linux-x64` |
| Linux arm64 | `flowcabal-linux-arm64` |
| macOS Intel | `flowcabal-darwin-x64` |
| macOS Apple Silicon | `flowcabal-darwin-arm64` |
| Windows x64 | `flowcabal-windows-x64.exe` |

```bash
# macOS / Linux
chmod +x flowcabal-*
mv flowcabal-darwin-arm64 /usr/local/bin/flowcabal

# 验证
flowcabal --help
```

### 从源码运行

```bash
git clone https://github.com/isirin1131/FlowWrite.git
cd FlowWrite
bun install
bun run flowcabal --help
```

## 快速开始

```bash
# 1. 初始化项目（配置 LLM、创建 memory 种子）
flowcabal init

# 2. 启动 TUI
flowcabal

# 3. 指定 workspace 启动
flowcabal --workspace <id>
```

### TUI 界面

启动后进入全屏交互界面，5 个视图通过数字键切换：

```
┌─[1:Dashboard]─[2:Node]─[3:Memory]─[4:Chat]─[5:Queue]──┐
│                                                          │
│  ┌─[Nodes]──────┬─[Overview]──────────────────┐         │
│  │ ● chapter-1  │  Workspace: ws-abc123        │         │
│  │ ◐ chapter-2  │  Targets: 3 / Subgraph: 5   │         │
│  │ ○ chapter-3  │  ● 2 cached ◐ 1 stale       │         │
│  │              │  ████████░░░░ 3/5             │         │
│  └──────────────┴──────────────────────────────┘         │
│                                                          │
│  NORMAL│my-novel│ws-abc│5 nodes│r:run s:step             │
└──────────────────────────────────────────────────────────┘
```

| 快捷键 | 操作 |
|--------|------|
| `1`-`5` | 切换视图 |
| `h`/`l`/`Tab` | 左右面板焦点 |
| `j`/`k` | 列表上下导航 |
| `r` | 运行（auto 模式） |
| `s` | 运行（step 模式，逐层执行） |
| `Space` | 切换 target |
| `Enter` | 选择/确认 |
| `:` | 命令模式 |
| `:q` | 退出 |

## 五个视图

1. **Dashboard** — 节点总览、状态着色、target 管理、运行进度
2. **Node Detail** — prompt 预览（literal/ref/agent-inject 着色）、版本切换、流式输出
3. **Memory Browser** — 文件树导航、查看/编辑记忆文件、重建索引
4. **Agent Chat** — 多轮对话、流式输出、tool call 可视化
5. **Todo Queue** — targets → 依赖解析 → 拓扑排序 → 按 level 渲染执行队列

## 项目结构

```
packages/
  engine/           核心无头引擎（纯库，零 IO 假设）
    src/
      types.ts      领域类型
      schema.ts     Zod schemas
      paths.ts      路径注册表
      llm/          Vercel AI SDK provider + generate/stream
      runner-core/  执行引擎（state、workspace、run、缓存、拓扑排序）
      agent/        Agent 子系统（tool-use loop、memory CRUD、prompt）
  tui/              交互式终端界面（OpenTUI + React）
    src/
      app.tsx       根组件 + 启动流程
      views/        5 个视图
      components/   8 个可复用组件
      hooks/        6 个 React hooks
      theme.ts      颜色 + 状态图标
```

## 核心概念

### Workflow / Workspace / Project

- **Workflow** — 纯模板，描述节点结构和 prompt 组合方式，可分享给他人
- **Project** — 小说项目，拥有独立的 Agent 记忆（角色、世界、文体、定稿章节）
- **Workspace** — workflow + project 的实例化运行环境，用户在其中反复调试，删除即释放缓存

### 记忆架构

Agent 记忆按项目隔离，三层加载：

- **L0**: `index.md` — Agent 导航入口（自动生成）
- **L1**: 各记忆文件 — Agent 按需加载（voice.md, characters/, world/）
- **L2**: `manuscripts/` — 定稿章节，通过跳转链接按需可达

其余记忆文件（事件梗概、伏笔追踪等）由 Agent 在写作过程中按需创建。

### 增量构建

以 node 为粒度缓存，自动跳过未变化的节点：

- **结构性失效**：literal + ref 的 prompt hash 变化 → 自动重跑并级联下游
- **上下文预警**：project 记忆变更 → agent-inject 缓存可能过期 → 预警用户

### TextBlock

节点 prompt 由 TextBlock 数组构成：

- `literal` — 静态文本
- `ref` — 引用上游节点输出（隐式定义 DAG 连接）
- `agent-inject` — Agent 注入点，Agent 根据 memory 自主决定注入内容

## 支持的 LLM

- OpenAI Compatible（DeepSeek 等）
- OpenAI
- Anthropic
- Google
- Mistral
- xAI
- Cohere

## 开发

```bash
bun install
bun run typecheck       # 类型检查（engine + tui）
bun run flowcabal init  # 初始化测试项目
bun run flowcabal       # 启动 TUI
```

## License

MIT
