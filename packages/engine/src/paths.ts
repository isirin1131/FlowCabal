import { join } from "path";
import { homedir } from "os";

// ──────────────────────────────────────────────────────────────
// 路径分两层：
//
// 全局配置 ~/.config/flowcabal/
// ├── llm-configs.json               # LLM 配置池（多套，按名引用，一套 default）
// ├── workflows/
// │   └── <workflow-id>.json         # 纯模板，用于分享
// └── preferences/
//     └── <workflow-id>.json         # 用户对模板的个性化配置（per-node LLM 覆盖等）
//
// 项目本地 <project-root>/.flowcabal/
// ├── memory/                         # Agent 记忆
// │   ├── index.md                   # L0 导航（自动生成）
// │   ├── voice.md                   # 文体约束 + 类型叙事约束
// │   ├── characters/                # 角色（Agent 按需创建，一角色一文件）
// │   ├── world/                     # 世界观（Agent 按需创建，一概念一文件）
// │   └── manuscripts/               # L2 完整信息源（定稿章节）
// └── runner-cache/                   # 工作区（删除即释放全部缓存）
//     └── <workspace-id>/
//         ├── meta.json              # { projectId, createdAt }
//         ├── nodes.json             # NodeDef[]（workspace 的真实节点来源）
//         └── outputs/
//             └── <node-id>.json     # { versions: NodeVersion[], currentId }
// ──────────────────────────────────────────────────────────────

// ── 全局配置（~/.config/flowcabal/） ──

export function globalConfigPath(): string {
  return join(homedir(), ".config", "flowcabal");
}

export function globalLlmConfigsPath(): string {
  return join(globalConfigPath(), "llm-configs.json");
}

// ── 项目本地（<project-root>/.flowcabal/） ──

export function dotFlowcabalPath(rootDir: string): string {
  return join(rootDir, ".flowcabal");
}

// ── memory/：Agent 记忆 ──

export function memoryPath(rootDir: string): string {
  return join(dotFlowcabalPath(rootDir), "memory");
}

export function memoryIndexPath(rootDir: string): string {
  return join(memoryPath(rootDir), "index.md");
}

export function manuscriptsPath(rootDir: string): string {
  return join(memoryPath(rootDir), "manuscripts");
}

// ── current-workspace：lock 文件（纯文本，只存 workspace ID） ──

export function currentWorkspacePath(rootDir: string): string {
  return join(dotFlowcabalPath(rootDir), "current-workspace");
}

// ── runner-cache/：工作区（按 workspace 隔离，删除即释放） ──

export function runnerCachePath(rootDir: string): string {
  return join(dotFlowcabalPath(rootDir), "runner-cache");
}

export function workspacePath(rootDir: string, workspaceId: string): string {
  return join(runnerCachePath(rootDir), workspaceId);
}

export function workspaceMetaPath(
  rootDir: string,
  workspaceId: string,
): string {
  return join(workspacePath(rootDir, workspaceId), "meta.json");
}

export function workspaceNodesPath(
  rootDir: string,
  workspaceId: string,
): string {
  return join(workspacePath(rootDir, workspaceId), "nodes.json");
}

export function nodeOutputPath(
  rootDir: string,
  workspaceId: string,
  nodeId: string,
): string {
  return join(workspacePath(rootDir, workspaceId), "outputs", `${nodeId}.json`);
}

export function workspacePreferencesPath(
  rootDir: string,
  workspaceId: string,
): string {
  return join(workspacePath(rootDir, workspaceId), "preferences.json");
}

// ── 初始化时创建的种子文件和目录 ──

/** init 时创建的种子 .md 文件（相对于 memoryPath） */
export const MEMORY_SEED_FILES = [
  "index.md",
  "voice.md",
] as const;

/** init 时创建的种子目录（相对于 memoryPath） */
export const MEMORY_SEED_DIRS = [
  "characters",
  "world",
  "manuscripts",
] as const;
