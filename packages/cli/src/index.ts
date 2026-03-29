#!/usr/bin/env bun
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

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

async function main() {
  const args = hideBin(process.argv);
  
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
        const name = args[1];
        if (!name) {
          console.error('请指定 workspace 名称');
          process.exit(1);
        }
        const { findProjectRoot, loadLlmConfigs } = await import('./config.js');
        const rootDir = findProjectRoot(process.cwd());
        if (!rootDir) {
          console.error('请先运行 flowcabal init');
          process.exit(1);
        }
        await createWorkspace(name, rootDir, loadLlmConfigs(rootDir));
        break;
      }
      case 'workspace': {
        if (subcmd === 'list') {
          const { listWorkspaces } = await import('./commands/workspace.js');
          const { findProjectRoot } = await import('./config.js');
          const rootDir = findProjectRoot(process.cwd());
          if (!rootDir) {
            console.error('请先运行 flowcabal init');
            process.exit(1);
          }
          listWorkspaces(rootDir);
        }
        break;
      }
      case 'node':
      case 'run':
      case 'memory':
      case 'llm':
        console.log(`flowcabal ${cmd} 子命令请使用 --help 查看帮助`);
        break;
      default:
        console.log(`未知命令: ${cmd}`);
        console.log('使用 flowcabal --help 查看帮助');
    }
  } catch (e) {
    console.error('Error:', e);
  }
}

main();
