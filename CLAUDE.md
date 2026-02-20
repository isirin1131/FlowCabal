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

## 代码规范
- 中文提示词、中文 UI 文案
- 用户默认 LLM 是 DeepSeek（openai-compatible provider）
- 不用向量搜索，Agent 驱动的 L0 索引 + 按需加载
- 不要过度工程化，保持简洁
