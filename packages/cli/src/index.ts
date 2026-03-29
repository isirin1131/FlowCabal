#!/usr/bin/env bun
import { findProjectRoot, resolveWorkspace } from './config.js';

const HELP = `# flowcabal — 小说创作工作流引擎

## 概览
flowcabal 是一个支持记忆管理和 DAG 执行的 AI 辅助写作工具。

## 命令分类

### Agent 工具（推荐 AI agent 使用）

#### 项目
- init             初始化项目

#### Workspace 管理
- create <name>   创建新 workspace
- workspace list  列出所有 workspace
- workspace switch <id>  切换当前 workspace
- workspace delete <id>   删除 workspace
- status          查看整体状态
- show            查看 workspace 详情
- log             执行日志
- lock            锁定版本

#### LLM 配置
- llm list        列出所有配置（隐藏 apikey）
- llm add         交互式添加配置
- llm set-default <name>  设置默认

#### 节点操作
- node add <label>           创建节点
- node rm <id>               删除节点
- node rename <id> <label>   重命名
- node list                  列出节点
- node show <id>             显示节点详情
- node status <id>           查看节点状态
- node add-ref <id> <upstream>     添加引用
- node add-literal <id> [index] <content>  添加 literal
- node add-inject <id> [index] <hint>     添加 agent-inject
- node rm-block <id> <index>   删除 block
- node target <id>            加入 target
- node untarget <id>          移出 target

#### 执行
- run              执行全部
- run single       执行单个
- run preview      预览执行顺序 + stale nodes

#### 记忆管理
- memory chat      交互式对话

## 使用示例

# 初始化项目
flowcabal init

# 创建 workspace
flowcabal create "我的小说"

# 添加节点
flowcabal node add "第一章初稿"

# 添加引用
flowcabal node add-ref node-1 node-0

# 执行
flowcabal run
flowcabal run preview

# 记忆对话
flowcabal memory chat

# 查看帮助
flowcabal --help
flowcabal <command> --help
`;

const COMMAND_HELP: Record<string, string> = {
  init: `# flowcabal init

初始化项目，会在当前目录创建 .flowcabal/ 目录结构。`,
  
  create: `# flowcabal create <name>

创建新的 workspace。

参数：
- name: workspace 名称`,
  
  'workspace list': `# flowcabal workspace list

列出所有 workspace。`,
  
  'workspace switch': `# flowcabal workspace switch <id>

切换当前 workspace。`,
  
  'workspace delete': `# flowcabal workspace delete <id>

删除 workspace。`,
  
  node: `# 节点操作

- node add <label>           创建节点
- node rm <id>               删除节点
- node rename <id> <label>   重命名
- node list                  列出节点
- node show <id>             显示节点详情
- node status <id>           查看节点状态
- node add-ref <id> <upstream>     添加引用
- node add-literal <id> [index] <content>  添加 literal
- node add-inject <id> [index] <hint>     添加 agent-inject
- node rm-block <id> <index>   删除 block
- node target <id>            加入 target
- node untarget <id>          移出 target`,
  
  run: `# 执行

- run              执行全部 todo 节点（按拓扑序）
- run single       只执行第一个
- run preview      预览执行顺序和 stale nodes（不执行）`,
  
  memory: `# 记忆管理

- memory chat      交互式对话

记忆系统存储角色设定、世界观、手稿等。
文件结构：
- characters/: 角色
- world/: 世界观
- manuscripts/: 章节手稿`,
  
  llm: `# LLM 配置管理

- llm list           列出所有配置（隐藏 apikey）
- llm add            交互式添加配置
- llm set-default <name>  设置默认`,
};

function getWorkspaceId(args: string[]): string | null {
  const idx = args.findIndex(a => a.startsWith('--workspace='));
  if (idx >= 0) {
    return args[idx].replace('--workspace=', '');
  }
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    const cmd = args.find(a => !a.startsWith('-'));
    if (cmd && COMMAND_HELP[cmd]) {
      console.log(COMMAND_HELP[cmd]);
      return;
    }
    console.log(HELP);
    return;
  }

  if (args.length === 0 || args[0] === 'help') {
    console.log(HELP);
    return;
  }

  const rootDir = findProjectRoot(process.cwd());
  if (!rootDir) {
    console.error('请先运行 flowcabal init');
    process.exit(1);
  }

  const workspaceId = getWorkspaceId(args) || resolveWorkspace(rootDir);
  
  let cmd = args[0];
  let subcmd = args[1];
  
  if (args[0].includes(' ') && args[1]) {
    [cmd, subcmd] = [args[0], args[1]];
  }
  
  try {
    switch (cmd) {
      case 'init': {
        const { initProject } = await import('./commands/init.js');
        await initProject(process.cwd());
        break;
      }
      case 'create': {
        const { createWorkspace } = await import('./commands/create.js');
        const { loadLlmConfigs } = await import('./config.js');
        const name = args[1];
        if (!name) {
          console.error('请指定 workspace 名称');
          process.exit(1);
        }
        await createWorkspace(name, rootDir, loadLlmConfigs(rootDir));
        break;
      }
      case 'workspace': {
        const wsId = workspaceId ? `--workspace=${workspaceId}` : '';
        console.log(`使用: flowcabal ${subcmd} ${wsId}`);
        break;
      }
      case 'node': {
        if (!workspaceId) {
          console.error('请指定 workspace: --workspace=<id>');
          process.exit(1);
        }
        switch (subcmd) {
          case 'add': {
            const { nodeAdd } = await import('./commands/node.js');
            const label = args[2];
            if (!label) {
              console.error('请指定节点名称');
              process.exit(1);
            }
            await nodeAdd(label, rootDir, workspaceId);
            break;
          }
          case 'rm': {
            const { nodeRm } = await import('./commands/node.js');
            const nodeId = args[2];
            if (!nodeId) {
              console.error('请指定节点 ID');
              process.exit(1);
            }
            await nodeRm(nodeId, rootDir, workspaceId);
            break;
          }
          case 'rename': {
            const { nodeRename } = await import('./commands/node.js');
            const nodeId = args[2];
            const newLabel = args[3];
            if (!nodeId || !newLabel) {
              console.error('用法: node rename <id> <newLabel>');
              process.exit(1);
            }
            await nodeRename(nodeId, newLabel, rootDir, workspaceId);
            break;
          }
          case 'list': {
            const { nodeList } = await import('./commands/node.js');
            nodeList(rootDir, workspaceId);
            break;
          }
          case 'show': {
            const { nodeShow } = await import('./commands/node.js');
            const nodeId = args[2];
            if (!nodeId) {
              console.error('请指定节点 ID');
              process.exit(1);
            }
            nodeShow(nodeId, rootDir, workspaceId);
            break;
          }
          case 'status': {
            const { nodeStatus } = await import('./commands/node.js');
            const nodeId = args[2];
            if (!nodeId) {
              console.error('请指定节点 ID');
              process.exit(1);
            }
            nodeStatus(nodeId, rootDir, workspaceId);
            break;
          }
          case 'add-ref': {
            const { nodeAddRef } = await import('./commands/node.js');
            const nodeId = args[2];
            const upstreamId = args[3];
            if (!nodeId || !upstreamId) {
              console.error('用法: node add-ref <id> <upstream>');
              process.exit(1);
            }
            await nodeAddRef(nodeId, upstreamId, rootDir, workspaceId);
            break;
          }
          case 'add-literal': {
            const { nodeAddLiteral } = await import('./commands/node.js');
            const nodeId = args[2];
            const content = args.slice(3).join(' ');
            if (!nodeId || !content) {
              console.error('用法: node add-literal <id> <content>');
              process.exit(1);
            }
            await nodeAddLiteral(nodeId, content, rootDir, workspaceId);
            break;
          }
          case 'add-inject': {
            const { nodeAddInject } = await import('./commands/node.js');
            const nodeId = args[2];
            const hint = args.slice(3).join(' ');
            if (!nodeId || !hint) {
              console.error('用法: node add-inject <id> <hint>');
              process.exit(1);
            }
            await nodeAddInject(nodeId, hint, rootDir, workspaceId);
            break;
          }
          case 'rm-block': {
            const { nodeRmBlock } = await import('./commands/node.js');
            const nodeId = args[2];
            const blockIndex = parseInt(args[3]);
            if (!nodeId || isNaN(blockIndex)) {
              console.error('用法: node rm-block <id> <index>');
              process.exit(1);
            }
            await nodeRmBlock(nodeId, blockIndex, rootDir, workspaceId);
            break;
          }
          case 'target': {
            const { nodeTarget } = await import('./commands/node.js');
            const nodeId = args[2];
            if (!nodeId) {
              console.error('请指定节点 ID');
              process.exit(1);
            }
            await nodeTarget(nodeId, rootDir, workspaceId, true);
            break;
          }
          case 'untarget': {
            const { nodeTarget } = await import('./commands/node.js');
            const nodeId = args[2];
            if (!nodeId) {
              console.error('请指定节点 ID');
              process.exit(1);
            }
            await nodeTarget(nodeId, rootDir, workspaceId, false);
            break;
          }
          default:
            console.log(COMMAND_HELP.node);
        }
        break;
      }
      case 'run': {
        if (!workspaceId) {
          console.error('请指定 workspace: --workspace=<id>');
          process.exit(1);
        }
        switch (subcmd) {
          case 'single': {
            const { run } = await import('./commands/run.js');
            await run(rootDir, workspaceId, true);
            break;
          }
          case 'preview': {
            const { runPreview } = await import('./commands/run.js');
            runPreview(rootDir, workspaceId);
            break;
          }
          case undefined: {
            const { run } = await import('./commands/run.js');
            await run(rootDir, workspaceId, false);
            break;
          }
          default:
            console.log(COMMAND_HELP.run);
        }
        break;
      }
      case 'memory': {
        if (subcmd === 'chat') {
          const { memoryChat } = await import('./commands/memory.js');
          await memoryChat(rootDir);
        } else {
          console.log(COMMAND_HELP.memory);
        }
        break;
      }
      case 'llm': {
        switch (subcmd) {
          case 'list': {
            const { llmList } = await import('./commands/llm.js');
            llmList(rootDir);
            break;
          }
          case 'add': {
            const { llmAdd } = await import('./commands/llm.js');
            await llmAdd(rootDir);
            break;
          }
          case 'set-default': {
            const { llmSetDefault } = await import('./commands/llm.js');
            const name = args[2];
            if (!name) {
              console.error('请指定配置名称');
              process.exit(1);
            }
            llmSetDefault(rootDir, name);
            break;
          }
          default:
            console.log(COMMAND_HELP.llm);
        }
        break;
      }
      default:
        console.log(`未知命令: ${cmd}`);
        console.log('使用 flowcabal --help 查看帮助');
    }
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

main();
