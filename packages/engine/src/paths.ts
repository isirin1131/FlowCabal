import { join } from "path";

// ──────────────────────────────────────────────────────────────
// .flowcabal/ 路径树
//
// .flowcabal/
// ├── data/                              # 持久化配置（跨项目、跨工作区）
// │   ├── llm-configs.json               # LLM 配置池（多套，按名引用，一套 default）
// │   ├── workflows/
// │   │   └── <workflow-id>.json         # 纯模板，用于分享
// │   └── preferences/
// │       └── <workflow-id>.json         # 用户对模板的个性化配置（per-node LLM 覆盖等）
// ├── memory/<project>/                  # Agent 记忆（按项目隔离，种子文件 init 时创建）
// │   ├── index.md                       # L0 导航
// │   ├── characters.md                  # 角色生成性事实
// │   ├── world.md                       # 世界硬规则 + 类型设定约束
// │   ├── voice.md                       # 文体约束 + 类型叙事约束
// │   └── manuscripts/                   # L2 完整信息源（定稿章节）
// └── runner-cache/                      # 工作区（删除即释放全部缓存）
//     └── <workspace-id>/
//         ├── meta.json                  # { workflowId, projectId, createdAt }
//         └── outputs/
//             └── <node-id>.json         # { promptHash, agentInjects, output }
// ──────────────────────────────────────────────────────────────

// ── .flowcabal/ 根目录（仓库根） ──

export function dotFlowcabalPath(rootDir: string): string {
  return join(rootDir, ".flowcabal");
}

// ── data/：持久化配置（跨项目、跨工作区） ──

export function dataPath(rootDir: string): string {
  return join(dotFlowcabalPath(rootDir), "data");
}

export function workflowsPath(rootDir: string): string {
  return join(dataPath(rootDir), "workflows");
}

export function workflowFilePath(rootDir: string, workflowId: string): string {
  return join(workflowsPath(rootDir), `${workflowId}.json`);
}

export function llmConfigsPath(rootDir: string): string {
  return join(dataPath(rootDir), "llm-configs.json");
}

export function preferencesPath(rootDir: string): string {
  return join(dataPath(rootDir), "preferences");
}

export function workflowPreferencesPath(
  rootDir: string,
  workflowId: string,
): string {
  return join(preferencesPath(rootDir), `${workflowId}.json`);
}

// ── memory/：Agent 记忆（按项目隔离） ──

export function memoryPath(rootDir: string, project: string): string {
  return join(dotFlowcabalPath(rootDir), "memory", project);
}

export function memoryIndexPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "index.md");
}

export function charactersPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "characters.md");
}

export function worldPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "world.md");
}

export function voicePath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "voice.md");
}

export function manuscriptsPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "manuscripts");
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

export function nodeOutputPath(
  rootDir: string,
  workspaceId: string,
  nodeId: string,
): string {
  return join(workspacePath(rootDir, workspaceId), "outputs", `${nodeId}.json`);
}

// ── 初始化时创建的种子文件和目录 ──

/** init 时创建的种子 .md 文件（相对于 memoryPath） */
export const MEMORY_SEED_FILES = [
  "index.md",
  "characters.md",
  "world.md",
  "voice.md",
] as const;

/** init 时创建的种子目录（相对于 memoryPath） */
export const MEMORY_SEED_DIRS = ["manuscripts"] as const;
