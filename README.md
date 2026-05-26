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

- **[Node.js 22+](https://nodejs.org)** - release binary 运行时（Node SEA 嵌入，用户机器无需预装）

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

1. 二进制解压内嵌 GUI 资源到平台 cache 目录（约 1-2 秒，仅首次）
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

需要先装 [Bun](https://bun.sh)（仅开发期；release binary 用 Node 22 SEA，用户机器无需 Bun）。

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
