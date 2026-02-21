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

## 项目结构
- `packages/engine/src/` — 核心引擎（types, schema, dag, store, context, llm, agent）
- `packages/cli/src/` — CLI 入口 + 5 个 command（init, add-chapter, status, generate, store）
- `docs/` — 设计文档（保留，不要动）
- `backend/` — 旧代码 + 测试用样章（保留）

## 用户项目目录结构
```
project-root/
  flowcabal.json          # ProjectConfig（defaultLlm 等）
  manuscripts/            # 章节原文
  store/                  # 记忆（constraints + state + index.md）
  workflows/              # Workflow 模板（纯结构，跟着项目走）
  .flowcabal/             # core-runner 缓存（per-workflow 用户配置、运行状态）
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
- `ProjectConfig.defaultLlm` 提供全局默认
- per-node LLM 覆盖配置存在 core-runner 缓存中，不在 Workflow 元数据里

## 代码规范
- 中文提示词、中文 UI 文案
- 用户默认 LLM 是 DeepSeek（openai-compatible provider）
- 不用向量搜索，Agent 驱动的 L0 索引 + 按需加载
- 不要过度工程化，保持简洁
- types.ts 手写类型，schema.ts 手写 Zod schema（用于运行时校验），两份各自维护
