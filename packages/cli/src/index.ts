#!/usr/bin/env bun
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { existsSync, readdirSync, statSync } from 'fs';
import { dirname, join } from 'path';
import { getCacheDir, readLlmConfigs } from '@flowcabal/engine';

// ── helpers ──────────────────────────────────────────────

function findProjectRoot(cwd: string): string | null {
  if (existsSync(getCacheDir(cwd))) return cwd;
  return null;
}

function resolveWorkspace(rootDir: string, workspaceId?: string): string | null {
  const cacheDir = getCacheDir(rootDir);
  if (!existsSync(cacheDir)) return null;

  const ids = readdirSync(cacheDir).filter(name =>
    statSync(join(cacheDir, name)).isDirectory()
  );
  if (ids.length === 0) return null;
  if (!workspaceId) return ids[0];
  return ids.find(id => id.startsWith(workspaceId)) ?? null;
}

function requireRoot(): string {
  const root = findProjectRoot(process.cwd());
  if (!root) {
    console.error('请先运行 flowcabal init');
    process.exit(1);
  }
  return root;
}

async function requireWorkspace(argv: Record<string, any>): Promise<{ rootDir: string; workspaceId: string }> {
  const rootDir = requireRoot();
  const { getCurrentWorkspace } = await import('./commands/workspace.js');
  const workspaceId = argv.workspace || getCurrentWorkspace(rootDir) || resolveWorkspace(rootDir);
  if (!workspaceId) {
    console.error('请先创建 workspace: flowcabal workspace create <name>');
    process.exit(1);
  }
  return { rootDir, workspaceId };
}

// ── yargs ────────────────────────────────────────────────

yargs(hideBin(process.argv))
  .scriptName('flowcabal')
  .usage('flowcabal — AI 辅助小说创作 DAG 工作流引擎beta')
  .epilogue(`⚠️ Agent 注意事项：
- "memory chat" 是交互式命令，需要 stdin 输入
- "llm add" 需要终端交互（选择供应商、输入密码），不适合 agent 直接调用
- 其他命令均为单次执行，输出纯文本，适合 agent 使用
- node/run 命令需要 workspace，通过 --workspace=<id> 指定或先 workspace switch`)

  // ── init ───────────────────────────────────────────────
  .command('init', '初始化项目（在当前目录创建 .flowcabal/）', {}, async () => {
    const { initProject } = await import('./commands/init.js');
    await initProject(process.cwd());
  })

  // ── workspace ──────────────────────────────────────────
  .command('workspace', 'workspace 管理', (y) => y
    .command('create <name>', '创建新 workspace', (y) =>
      y.positional('name', { type: 'string', demandOption: true, describe: 'workspace 名称' })
        .option('from-workflow', { type: 'string', describe: '从 workflow 导入' }),
    async (argv) => {
      const rootDir = requireRoot();
      const { createWorkspace } = await import('./commands/workspace.js');
      await createWorkspace(argv.name!, rootDir, argv.fromWorkflow);
    })
    .command('list', '列出所有 workspace', {}, async () => {
      const rootDir = requireRoot();
      const { listWorkspaces } = await import('./commands/workspace.js');
      listWorkspaces(rootDir);
    })
    .command('switch <id>', '切换当前 workspace', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const rootDir = requireRoot();
      const { workspaceSwitch } = await import('./commands/workspace.js');
      workspaceSwitch(rootDir, argv.id!);
    })
    .command('status [id]', '查看 workspace 状态', (y) =>
      y.positional('id', { type: 'string' }),
    async (argv) => {
      const rootDir = requireRoot();
      const { workspaceStatus, getCurrentWorkspace } = await import('./commands/workspace.js');
      const wsId = argv.id || getCurrentWorkspace(rootDir) || resolveWorkspace(rootDir);
      if (!wsId) { console.error('没有可用的 workspace，请先创建'); process.exit(1); }
      workspaceStatus(rootDir, wsId);
    })
    .command('delete <id>', '删除 workspace', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const rootDir = requireRoot();
      const { workspaceDelete } = await import('./commands/workspace.js');
      workspaceDelete(rootDir, argv.id!);
    })
    .demandCommand(1, '请指定子命令，使用 --help 查看')
  , () => {})
  // ── llm ────────────────────────────────────────────────
  .command('llm', 'LLM 配置管理（全局 ~/.config/flowcabal/llm-configs.json）', (y) => y
    .command('list', '列出所有配置（隐藏 apikey）', {}, async () => {
      const { llmList } = await import('./commands/llm.js');
      llmList();
    })
    .command('add <name>', '交互式添加配置（选择供应商、填写 model 和 API Key）', (y) =>
      y.positional('name', { type: 'string', demandOption: true, describe: '配置名称' }),
    async (argv) => {
      const { llmAdd } = await import('./commands/llm.js');
      await llmAdd(argv.name!);
    })
    .command('remove <name>', '删除指定配置', (y) =>
      y.positional('name', { type: 'string', demandOption: true }),
    async (argv) => {
      const { llmRemove } = await import('./commands/llm.js');
      llmRemove(argv.name!);
    })
    .command('set-default <name>', '将指定配置复制为 default', (y) =>
      y.positional('name', { type: 'string', demandOption: true }),
    async (argv) => {
      const { llmSetDefault } = await import('./commands/llm.js');
      llmSetDefault(argv.name!);
    })
    .demandCommand(1, '请指定子命令，使用 --help 查看')
  , () => {})

  // ── node ───────────────────────────────────────────────
  .command('node', '节点编排（DAG 结构管理）', (y) => y
    .option('workspace', {
      alias: 'w',
      type: 'string',
      describe: '指定 workspace ID（可选，支持前缀匹配）',
    })
    .command('add <label>', '创建节点', (y) =>
      y.positional('label', { type: 'string', demandOption: true, describe: '节点标签' }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeAdd } = await import('./commands/node.js');
      nodeAdd(argv.label!, rootDir, workspaceId);
    })
    .command('rm <id>', '删除节点', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeRm } = await import('./commands/node.js');
      nodeRm(argv.id!, rootDir, workspaceId);
    })
    .command('rename <id> <label>', '重命名节点', (y) => y
      .positional('id', { type: 'string', demandOption: true })
      .positional('label', { type: 'string', demandOption: true }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeRename } = await import('./commands/node.js');
      nodeRename(argv.id!, argv.label!, rootDir, workspaceId);
    })
    .command('list', '列出所有节点', {}, async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeList } = await import('./commands/node.js');
      nodeList(rootDir, workspaceId);
    })
    .command('cat <id>', '显示节点详情（blocks + output）', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeCat } = await import('./commands/node.js');
      nodeCat(argv.id!, rootDir, workspaceId);
    })
    .command('ins-ref <id> <upstream>', '插入 ref block（建立 DAG 连接）', (y) => y
      .positional('id', { type: 'string', demandOption: true, describe: '目标节点' })
      .positional('upstream', { type: 'string', demandOption: true, describe: '上游节点' })
      .option('system', { type: 'boolean', describe: '插入到 systemPrompt（默认 userPrompt）' })
      .option('index', { type: 'number', describe: '插入位置（默认追加到末尾）' }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeInsRef } = await import('./commands/node.js');
      nodeInsRef(argv.id!, argv.upstream!, rootDir, workspaceId, argv.system, argv.index);
    })
    .command('ins-literal <id>', '插入 literal block（静态文本）', (y) => y
      .positional('id', { type: 'string', demandOption: true, describe: '目标节点' })
      .option('content', { type: 'string', demandOption: true, describe: '文本内容' })
      .option('system', { type: 'boolean', describe: '插入到 systemPrompt（默认 userPrompt）' })
      .option('index', { type: 'number', describe: '插入位置（默认追加到末尾）' }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeInsText } = await import('./commands/node.js');
      nodeInsText(argv.id!, argv.content!, rootDir, workspaceId, argv.system, argv.index);
    })
    .command('ins-inject <id>', '插入 inject block（Agent 按 hint 注入内容）', (y) => y
      .positional('id', { type: 'string', demandOption: true, describe: '目标节点' })
      .option('hint', { type: 'string', demandOption: true, describe: '注入提示' })
      .option('system', { type: 'boolean', describe: '插入到 systemPrompt（默认 userPrompt）' })
      .option('index', { type: 'number', describe: '插入位置（默认追加到末尾）' }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeInsInject } = await import('./commands/node.js');
      nodeInsInject(argv.id!, argv.hint!, rootDir, workspaceId, argv.system, argv.index);
    })
    .command('rm-block <id> <index>', '删除指定位置的 block', (y) => y
      .positional('id', { type: 'string', demandOption: true })
      .positional('index', { type: 'number', demandOption: true })
      .option('system', { type: 'boolean', describe: '从 systemPrompt 删除（默认 userPrompt）' }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeRmBlock } = await import('./commands/node.js');
      nodeRmBlock(argv.id!, rootDir, workspaceId, argv.system, argv.index!);
    })
    .command('target <id>', '将节点加入执行目标', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeTarget } = await import('./commands/node.js');
      nodeTarget(argv.id!, rootDir, workspaceId);
    })
    .command('untarget <id>', '将节点移出执行目标', (y) =>
      y.positional('id', { type: 'string', demandOption: true }),
    async (argv) => {
      const { rootDir, workspaceId } = await requireWorkspace(argv);
      const { nodeUntarget } = await import('./commands/node.js');
      nodeUntarget(argv.id!, rootDir, workspaceId);
    })
    .demandCommand(1, '请指定子命令，使用 --help 查看')
  , () => {})

  // ── run ────────────────────────────────────────────────
  .command('run [mode]', '执行 DAG（默认全部 todo 节点）', (y) => y
    .option('workspace', {
      alias: 'w',
      type: 'string',
      describe: '指定 workspace ID（可选，支持前缀匹配）',
    })
    .positional('mode', {
      type: 'string',
      choices: ['single', 'preview'] as const,
      describe: 'single=只执行一个, preview=预览执行顺序（不执行）',
    }),
  async (argv) => {
    const { rootDir, workspaceId } = await requireWorkspace(argv);
    if (argv.mode === 'preview') {
      const { runPreview } = await import('./commands/run.js');
      runPreview(rootDir, workspaceId);
    } else {
      const { run } = await import('./commands/run.js');
      await run(rootDir, workspaceId, argv.mode === 'single');
    }
  })

  // ── memory ─────────────────────────────────────────────
  .command('memory', '记忆管理（角色/世界观/手稿）', (y) => y
    .command('chat', '交互式对话（需要 stdin，Agent 慎用）', {}, async () => {
      const rootDir = requireRoot();
      const { memoryChat } = await import('./commands/memory.js');
      await memoryChat(rootDir);
    })
    .command('add-manuscript <path>', '将 .md 文件复制到 memory/manuscripts', (y) =>
      y.positional('path', { type: 'string', demandOption: true, describe: '.md 文件路径' }),
    async (argv) => {
      const rootDir = requireRoot();
      const { addManuscript } = await import('./commands/memory.js');
      await addManuscript(rootDir, argv.path!);
    })
    .demandCommand(1, '请指定子命令，使用 --help 查看')
  , () => {})

  // ── config ─────────────────────────────────────────────
  .demandCommand(1, '请指定命令，使用 --help 查看所有命令')
  .strict()
  .help()
  .version(false)
  .parse();
