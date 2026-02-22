# CLAUDE.md

## 技术栈
- **纯 TypeScript + Bun**，monorepo（`packages/engine` + `packages/cli`）
- LLM 集成：Vercel AI SDK（`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`, `@ai-sdk/google`）
- Schema 校验：Zod
- CLI：yargs + @clack/prompts

## 常用命令
- `bun install` — 安装依赖
- `bun run typecheck` — 类型检查
- `bun run flowcabal <command>` — 运行 CLI

## 目录结构
- `packages/engine/src/` — 核心引擎（types, schema, dag, store, context, llm, agent）
- `packages/cli/src/` — CLI 入口 + 5 个 command（init, add-chapter, status, generate, store）
- `docs/` — 设计文档（保留，不要动）
- `backend/` — 旧代码 + 测试用样章（保留）

## `.flowcabal/` 状态目录
唯一一个，位于仓库根目录（免安装分发，不污染用户 home 空间）：
```
.flowcabal/
├── data/                              # 持久化配置（跨项目、跨工作区共享）
│   ├── llm-configs.json               # LLM 配置池（多套，按名引用，一套 default）
│   ├── workflows/                     # Workflow 模板（纯蓝图，用于分享）
│   │   └── <workflow-id>.json
│   └── preferences/                   # 用户对模板的个性化配置
│       └── <workflow-id>.json         # per-node LLM 覆盖等偏好，跨工作区生效
├── memory/                            # Agent 记忆（按小说项目隔离）
│   └── <project>/
│       ├── index.md                   # L0 导航
│       ├── characters.md              # 角色生成性事实
│       ├── world.md                   # 世界硬规则 + 类型设定约束
│       ├── voice.md                   # 文体约束 + 类型叙事约束
│       └── manuscripts/               # L2 完整信息源（定稿章节）
└── runner-cache/                      # 工作区（按 workspace 隔离，删除即释放）
    └── <workspace-id>/
        ├── meta.json                  # { workflowId, projectId, createdAt }
        └── outputs/
            └── <node-id>.json         # { promptHash, agentInjects, output }
```

## 架构要点

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
- 用户 LLM 配置存在 `.flowcabal/data/llm-configs.json`，支持多套配置按名引用，其中一套为 default
- per-node LLM 覆盖存在 `data/preferences/<workflow-id>.json`，跨工作区生效

### 缓存二维失效
- **结构性失效（自动）**：节点的 literal+ref prompt hash 变化 → 必须重跑，自动级联下游
- **上下文过期（预警）**：project memory/manuscripts 被修改 → agent-inject 缓存可能过期 → 预警用户

## 代码规范
- 中文提示词、中文 UI 文案
- 用户默认 LLM 是 DeepSeek（openai-compatible provider）
- 不用向量搜索，Agent 驱动的 L0 索引 + 按需加载
- 不要过度工程化，保持简洁
- types.ts 手写类型，schema.ts 手写 Zod schema（用于运行时校验），两份各自维护
