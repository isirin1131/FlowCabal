import { join } from "path";

// ── .flowcabal/ 根目录（仓库根） ──

export function dotFlowcabalPath(rootDir: string): string {
  return join(rootDir, ".flowcabal");
}

// ── data/：types.ts 里定义的持久化配置 ──

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

// ── memory/：Agent 记忆（按小说项目隔离） ──

export function memoryPath(rootDir: string, project: string): string {
  return join(dotFlowcabalPath(rootDir), "memory", project);
}

export function memoryIndexPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "index.md");
}

export function charactersPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "characters");
}

export function worldRulesPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "world-rules");
}

export function plotPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "plot");
}

export function timelinePath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "timeline");
}

export function characterStatusPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "character-status");
}

export function manuscriptsPath(rootDir: string, project: string): string {
  return join(memoryPath(rootDir, project), "manuscripts");
}

// ── runner-cache/：运行时缓存（按小说项目隔离） ──

export function runnerCachePath(rootDir: string, project: string): string {
  return join(dotFlowcabalPath(rootDir), "runner-cache", project);
}

export function nodeOutputPath(
  rootDir: string,
  project: string,
  nodeId: string,
): string {
  return join(runnerCachePath(rootDir, project), "outputs", `${nodeId}.md`);
}

export function runnerStatePath(rootDir: string, project: string): string {
  return join(runnerCachePath(rootDir, project), "state.json");
}

// ── 初始化时需要创建的记忆子目录 ──

export const MEMORY_DIRS = [
  "characters",
  "world-rules",
  "plot",
  "timeline",
  "character-status",
  "manuscripts",
] as const;
