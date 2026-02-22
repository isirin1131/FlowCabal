# FlowCabal

AI 辅助长篇小说创作工具——"ComfyUI, but for text"。

## 快速开始

```bash
bun install
bun run flowcabal init mynovel
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
      store/      文件系统路径 + CRUD
      context/    上下文组装（L0/L1）+ token 估算
      llm/        Vercel AI SDK provider + generate/stream
      agent/      Agent + 工具 + 中文提示词
  cli/            TUI 命令行
    src/
      commands/
        init.ts         初始化项目
        add-chapter.ts  添加章节 + Agent 分析
        status.ts       项目状态
        generate.ts     对话式创作 REPL
        store.ts        store 管理
```

## 核心概念

### Workflow / Workspace / Project

- **Workflow** — 纯模板，描述节点结构和 prompt 组合方式，可分享给他人
- **Project** — 小说项目，拥有独立的 Agent 记忆（角色、世界、文体、定稿章节）
- **Workspace** — workflow + project 的实例化运行环境，用户在其中反复调试，删除即释放缓存

### 记忆架构

Agent 记忆按项目隔离，init 时创建种子文件：

- **index.md** — L0 导航入口
- **characters.md** — 角色生成性事实（背景因果→性格→动机→关系）
- **world.md** — 世界硬规则 + 类型设定约束
- **voice.md** — 文体约束 + 类型叙事约束
- **manuscripts/** — 定稿章节（L2 完整信息源）

其余记忆文件（事件梗概、伏笔追踪等）由 Agent 在写作过程中按需创建。

上下文加载：
- **L0**: `index.md`，Agent 导航入口
- **L1**: 各记忆文件，Agent 按需加载
- **L2**: `manuscripts/`，通过跳转链接按需可达

### 增量构建

Core-runner 以 node 为粒度缓存，自动跳过未变化的节点：
- literal + ref 部分的 prompt hash 变化 → 自动重跑并级联下游
- agent-inject 缓存独立追踪，project 记忆变更时预警用户

## 支持的 LLM

- OpenAI
- Anthropic
- Google
- OpenAI Compatible（DeepSeek 等）

## License

MIT
