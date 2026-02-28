# FlowCabal

AI 辅助长篇小说创作工具——"ComfyUI, but for text"。

DAG workflow 引擎，通过节点图组合 prompt，Agent 自主管理记忆，增量构建只重跑变化的节点。

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
# 初始化项目（配置 LLM、创建 memory 种子）
flowcabal init

# 创建 workspace
flowcabal create

# 锁定 workspace（后续命令无需 -w）
flowcabal lock

# 构建节点图
flowcabal node add "角色设定"
flowcabal node add "场景描写"
flowcabal node add "章节生成"

# 给节点添加 prompt 内容
flowcabal node add-literal <角色设定id>           # 打开 $EDITOR 编辑
flowcabal node add-literal <场景描写id>
flowcabal node add-inject <章节生成id> --hint "注入角色背景和世界观设定"

# 连接节点（建立 DAG 依赖）
flowcabal node connect <章节生成id> <角色设定id>   # 章节生成 ← 角色设定
flowcabal node connect <章节生成id> <场景描写id>   # 章节生成 ← 场景描写

# 添加写作指令
flowcabal node add-literal <章节生成id>           # 编辑具体写作要求

# 查看节点图
flowcabal log

# 查看单个节点详情
flowcabal show <nodeId>

# 编辑已有 block 的文本
flowcabal edit <nodeId> [blockIndex]

# 运行 DAG
flowcabal run
```

## 命令一览

所有 workspace 级命令支持 `--workspace, -w <id>`。nodeId 支持前缀匹配。未指定 workspace 时优先使用 `lock` 锁定的。

### 项目管理

| 命令 | 说明 |
|------|------|
| `init` | 初始化当前目录为 FlowCabal 项目，交互式配置 LLM |
| `create [--from file]` | 创建新 workspace，可从 workflow JSON 导入 |
| `lock [id]` | 锁定 workspace，类似 `git switch` |
| `status` | 项目总览：记忆条目、workspace 列表、节点状态 |

### 节点查看

| 命令 | 说明 |
|------|------|
| `log` | 节点概览，显示状态图标与上游依赖 |
| `show <nodeId>` | 节点详情：prompt 块列表、版本历史 |

### 节点编排（`node` 子命令组）

| 命令 | 说明 |
|------|------|
| `node add <label>` | 创建空节点，打印 ID |
| `node rm <nodeId>` | 删除节点（有下游 ref 则警告确认） |
| `node rename <nodeId> <newLabel>` | 重命名节点 |
| `node connect <nodeId> <upstreamId> [--system]` | 追加 ref block（建立 DAG 连接） |
| `node disconnect <nodeId> <upstreamId>` | 移除所有对上游节点的 ref |
| `node add-literal <nodeId> [--system]` | 追加 literal block（`$EDITOR` 编辑） |
| `node add-inject <nodeId> --hint "..." [--system]` | 追加 agent-inject block |
| `node rm-block <nodeId> <index> [--system]` | 移除指定索引的 block |

### 内容编辑

| 命令 | 说明 |
|------|------|
| `edit [nodeId] [blockIndex] [--system]` | 编辑单个 block 的文本内容（`$EDITOR`） |

`edit` 只修改文本（literal 的 content、agent-inject 的 hint）。ref block 不可编辑，提示用 `node connect/disconnect`。无参数时交互选择节点和 block。

### 执行与创作

| 命令 | 说明 |
|------|------|
| `run [--mode auto\|step]` | 执行 DAG。auto 全自动，step 逐层确认 |
| `add-chapter <file>` | 添加定稿章节并通过 Agent 提取记忆 |
| `agent` | 交互式 Agent 对话，多轮创作辅助 |

### 状态图标

```
✓ cached   该节点已有缓存输出
~ stale    上游变化或 prompt 结构变更，需要重跑
○ pending  尚未运行
```

## 核心概念

### Workflow / Workspace / Project

- **Workflow** — 纯模板，描述节点结构和 prompt 组合方式，可分享
- **Project** — 小说项目，拥有独立的 Agent 记忆（角色、世界、文体、定稿章节）
- **Workspace** — workflow + project 的实例化运行环境，反复调试，删除即释放缓存

### TextBlock

节点 prompt 由 TextBlock 数组构成，三种类型：

- `literal` — 静态文本（写作指令、背景信息等）
- `ref` — 引用上游节点输出（隐式定义 DAG 连接）
- `agent-inject` — Agent 注入点，带 hint 告诉 Agent 方向，Agent 读取项目记忆后自主决定注入什么内容

### 记忆架构

Agent 记忆按项目隔离（`.flowcabal/memory/`），三层加载：

- **L0**: `index.md` — Agent 导航入口（自动生成）
- **L1**: 各记忆文件 — Agent 按需加载（voice.md, characters/, world/）
- **L2**: `manuscripts/` — 定稿章节，通过跳转链接按需可达

其余记忆文件（事件梗概、伏笔追踪等）由 Agent 在写作过程中按需创建。

### 增量构建

以 node 为粒度缓存，自动跳过未变化的节点：

- **结构性失效**：literal + ref 的 prompt hash 变化 → 自动重跑并级联下游
- **上下文预警**：project 记忆变更 → agent-inject 缓存可能过期 → 预警用户

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
  cli/              命令行界面（yargs + @clack/prompts）
    src/
      index.ts      yargs 入口
      config.ts     项目/workspace 查找与配置加载
      commands/     11 个命令文件
```

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
bun run typecheck       # 类型检查（engine + tui + cli）
bun run flowcabal init  # 初始化测试项目
bun run flowcabal --help
```

## License

MIT
