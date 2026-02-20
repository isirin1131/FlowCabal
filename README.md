# FlowCabal

AI 辅助长篇小说创作工具——"ComfyUI, but for text"。

## 快速开始

```bash
bun install
bun run flowcabal init mynovel
bun run flowcabal add-chapter chapter.md
bun run flowcabal status
bun run flowcabal generate
```

## 项目结构

```
packages/
  engine/         核心无头引擎
    src/
      types.ts    领域类型
      schema.ts   Zod schemas
      dag/        Workflow DAG + 拓扑排序 + 执行器
      store/      文件系统 store CRUD + L0 索引生成
      context/    上下文组装（L0/L1）+ token 估算
      llm/        Vercel AI SDK provider + generate/stream
      agent/      Agent（单次/对话）+ 5 个工具 + 中文提示词
  cli/            TUI 命令行
    src/
      commands/
        init.ts         初始化项目
        add-chapter.ts  添加章节 + Agent 分析
        status.ts       项目状态
        generate.ts     对话式创作 REPL
        store.ts        store 管理（ls/read/write/index）
```

## 记忆架构

三角度切片：
- **characters/** — 角色卡（含语癖）
- **timeline/** — 按时间序记事件
- **world-rules/** — 世界观设定清单

两类信息：
- **规约 (prescriptive)** — 创作前已存在的约束，人维护
- **状态 (descriptive)** — 从定稿章节提取

上下文加载：
- **L0**: `store/index.md`，每条一行摘要，始终注入
- **L1/L2**: Agent 读 L0 后按需加载完整文件

## 支持的 LLM

- OpenAI
- Anthropic
- Google
- OpenAI Compatible（DeepSeek 等）

## License

MIT
