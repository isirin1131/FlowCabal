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
├── data/                        # 持久化配置（跨项目共享）
│   ├── llm-configs.json         # 用户 LLM 配置（多套，按名引用）
│   └── workflows/               # Workflow 模板
│       └── <workflow-id>.json
├── memory/                      # Agent 记忆（按小说项目隔离）
│   └── <project>/
│       ├── index.md             # L0 索引（Agent 导航入口）
│       ├── premise.md           # 梗概、类型、主题内核
│       ├── characters.md        # 角色：背景因果→性格→动机→关系
│       ├── world.md             # 世界：硬规则、体系原理、边界
│       ├── voice.md             # 叙事：POV、时态、文体锚点
│       ├── outline.md           # 大纲 + 作者设想/创意笔记
│       ├── chronicle.md         # 已发生事件梗概（中观粒度）
│       ├── threads.md           # 伏笔/悬念追踪
│       └── manuscripts/         # 定稿章节
└── runner-cache/                # 运行时缓存（按小说项目隔离）
    └── <project>/
        ├── state.json           # 节点执行状态
        └── outputs/
            └── <node-id>.md     # 节点输出缓存
```

## 架构要点

### Workflow 与 Core-runner 分层
- **Workflow** = 纯模板/蓝图，只描述节点结构和 prompt 组合方式，不含 LLM 配置和运行参数
- **Core-runner** = 运行时引擎，读蓝图 + 读缓存配置拼出完整执行计划，有自己的持久化存储（`.flowcabal/`），文件级，不需要 db

### DAG 连接关系
- 没有显式 edges —— 从 TextBlock 的 `kind: "ref"` 隐式推导
- Agent 动态修改 workflow 时能 O(1) 得知连接变化

### TextBlock 三种类型
- `literal` — 静态文本
- `ref` — 引用上游节点输出
- `agent-inject` — Agent 注入点，带 hint 告诉 Agent 方向，Agent 读 L0 自主决定注入什么内容；一个节点可以有多个注入点，出现在 prompt 的不同位置

### LLM 配置
- 用户 LLM 配置存在 `.flowcabal/data/llm-configs.json`，支持多套配置按名引用，其中一套为 default
- per-node LLM 覆盖配置存在 runner-cache 中，不在 Workflow 元数据里

## 代码规范
- 中文提示词、中文 UI 文案
- 用户默认 LLM 是 DeepSeek（openai-compatible provider）
- 不用向量搜索，Agent 驱动的 L0 索引 + 按需加载
- 不要过度工程化，保持简洁
- types.ts 手写类型，schema.ts 手写 Zod schema（用于运行时校验），两份各自维护
