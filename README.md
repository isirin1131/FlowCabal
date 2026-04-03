# FlowCabal

AI 辅助小说创作 DAG 工作流引擎

核心功能：用 agent 管理手稿和在其基础上生成的各类自定义记忆文件，用 DAG 式的工作流基于自定义内容和向 agent 的提问注入项拼接提示词，调用 LLM api 以生成新内容。

可以将想要运行的节点加入 target_nodes，软件会自动解析依赖的上游节点。

stale_nodes 仅作为提醒，这些节点输出结果可能不是最新的。

目前软件为 beta 版本，主要目的为验证软件定义的 AI 辅助创作范式的效果是否达到预期，GUI 和多 agent 功能的支持尚在路上。

ps：请关注 [LINUX DO](https://linux.do/) 社区 owo

## 技术栈

### 核心依赖

- **[ai](https://github.com/vercel/ai)** - AI SDK，用于调用各类 LLM API
- **[yargs](https://github.com/yargs/yargs)** - CLI 参数解析
- **[zod](https://github.com/colinhacks/zod)** - TypeScript 数据校验
- **[nanoid](https://github.com/adjust/nanoid)** - 唯一 ID 生成

### LLM Provider

- `@ai-sdk/openai` - OpenAI 兼容
- `@ai-sdk/anthropic` - Anthropic (Claude)
- `@ai-sdk/google` - Google (Gemini)
- `@ai-sdk/mistral` - Mistral
- `@ai-sdk/xai` - xAI (Grok)
- `@ai-sdk/cohere` - Cohere

### 工具

- **[@clack/prompts](https://github.com/nickcis/clack)** - 终端交互提示
- **[Bun](https://bun.sh)** - 运行时

---

## 安装

### 从 Release 下载（推荐）

去 [GitHub Releases](https://github.com/isirin1131/FlowCabal/releases) 下载对应平台的二进制文件：

- Linux: `flowcabal-linux-x64`
- macOS (Apple Silicon): `flowcabal-darwin-arm64`
- macOS (Intel): `flowcabal-darwin-x64`
- Windows: `flowcabal-windows-x64.exe`

下载后赋予执行权限（Linux/macOS），然后使用：

```bash
./flowcabal init
./flowcabal workspace create my-novel
```

### 源码运行

需要先安装 [Bun](https://bun.sh)。

```bash
git clone <repo-url>
cd FlowCabal
bun install
bun run flowcabal <command>
```

---

## 快速开始

```bash
# 1. 初始化项目
./flowcabal init

# 2. 创建 workspace
./flowcabal workspace create my-novel

# 3. 添加 LLM 配置
./flowcabal llm add my-config
# 按提示选择供应商、输入 API Key 和 model

# 4. 创建节点
./flowcabal node add chapter-1

# 5. 添加内容
./flowcabal node ins-literal chapter-1 --content "第一章：深夜的雨声"

# 6. 执行
./flowcabal run
```

---

## 命令

### init
初始化项目，在当前目录创建 `.flowcabal/` 目录。

```bash
./flowcabal init
```

### workspace
workspace 管理。

```bash
# 创建 workspace
./flowcabal workspace create <name>

# 列出所有 workspace
./flowcabal workspace list

# 切换当前 workspace
./flowcabal workspace switch <id>

# 查看状态
./flowcabal workspace status [id]

# 删除 workspace
./flowcabal workspace delete <id>
```

### llm
LLM 配置管理（全局 `~/.config/flowcabal/llm-configs.json`）。

```bash
# 列出所有配置
./flowcabal llm list

# 添加配置（交互式）
./flowcabal llm add <name>

# 删除配置
./flowcabal llm remove <name>

# 设为默认
./flowcabal llm set-default <name>
```

### node
节点编排（DAG 结构管理）。

```bash
# 创建节点
./flowcabal node add <label>

# 删除节点
./flowcabal node rm <id>

# 重命名节点
./flowcabal node rename <id> <label>

# 列出所有节点
./flowcabal node list

# 查看节点详情
./flowcabal node cat <id>

# 插入 ref block（建立 DAG 连接）
./flowcabal node ins-ref <id> <upstream>

# 插入 literal block（静态文本）
./flowcabal node ins-literal <id> --content "文本内容"

# 插入 inject block（Agent 按 hint 注入内容）
./flowcabal node ins-inject <id> --hint "注入提示"

# 删除 block
./flowcabal node rm-block <id> <index>

# 将节点加入执行目标
./flowcabal node target <id>

# 将节点移出执行目标
./flowcabal node untarget <id>
```

### run
执行 DAG。

```bash
# 执行全部 todo 节点
./flowcabal run

# 预览执行顺序（不执行）
./flowcabal run preview
```

### memory
记忆管理（角色/世界观/手稿）。

```bash
# 交互式对话
./flowcabal memory chat

# 添加手稿（复制 .md 文件到 memory/manuscripts）
./flowcabal memory add-manuscript <path>
```

---

## 选项

```bash
# 指定 workspace
./flowcabal run --workspace <id>
./flowcabal node list -w <id>
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

```
.flowcabal/                      # 项目缓存目录
├── <workspace-id>/              # workspace 目录
│   └── workspace.json           # workspace 数据
└── current/                    # 当前 workspace
    └── workspace.json

memory/                          # 记忆目录
├── index.md                     # 记忆索引
└── manuscripts/                 # 手稿目录
```

---

## 配置

LLM 配置存储在 `~/.config/flowcabal/llm-configs.json`，支持以下供应商：
- OpenAI
- Anthropic
- Google
- Mistral
- xAI
- Cohere
- OpenAI 兼容

```json
{
  "default": {
    "provider": "anthropic",
    "apiKey": "sk-...",
    "model": "claude-3-5-sonnet-20241022"
  }
}
```
