import { readFile, writeFile, readdir } from "fs/promises";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import * as p from "@clack/prompts";
import type { ProjectConfig, LlmConfig, LlmConfigsFile, WorkspaceMeta } from "@flowcabal/engine";
import {
  ProjectConfigSchema,
  LlmConfigsFileSchema,
  globalLlmConfigsPath,
  runnerCachePath,
  currentWorkspacePath,
  readWorkspaceMeta,
} from "@flowcabal/engine";

/**
 * Find flowcabal.json, searching upward from cwd.
 */
export function findProjectRoot(from: string = process.cwd()): string | null {
  let dir = from;
  while (true) {
    if (existsSync(join(dir, "flowcabal.json"))) return dir;
    const parent = join(dir, "..");
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function loadConfig(rootDir?: string): Promise<ProjectConfig> {
  const root = rootDir ?? findProjectRoot();
  if (!root) {
    throw new Error("找不到 flowcabal.json，请先运行 flowcabal init");
  }
  const raw = await readFile(join(root, "flowcabal.json"), "utf-8");
  const parsed = JSON.parse(raw);
  return ProjectConfigSchema.parse(parsed);
}

/**
 * 从全局 ~/.config/flowcabal/llm-configs.json 读取 "default" LLM 配置。
 */
export async function loadDefaultLlmConfig(): Promise<LlmConfig> {
  const configPath = globalLlmConfigsPath();
  if (!existsSync(configPath)) {
    throw new Error("找不到 LLM 配置，请先运行 flowcabal init");
  }
  const raw = await readFile(configPath, "utf-8");
  const configs = LlmConfigsFileSchema.parse(JSON.parse(raw));
  const defaultConfig = configs["default"];
  if (!defaultConfig) {
    throw new Error("llm-configs.json 中缺少 \"default\" 配置");
  }
  return defaultConfig;
}

/**
 * 加载全部 LLM 配置（Record<name, LlmConfig>）。
 */
export async function loadLlmConfigs(): Promise<LlmConfigsFile> {
  const configPath = globalLlmConfigsPath();
  if (!existsSync(configPath)) {
    throw new Error("找不到 LLM 配置，请先运行 flowcabal init");
  }
  const raw = await readFile(configPath, "utf-8");
  return LlmConfigsFileSchema.parse(JSON.parse(raw));
}

/**
 * 列出项目下所有 workspace（扫描 .flowcabal/runner-cache/）。
 */
export async function listWorkspaces(
  rootDir: string,
): Promise<{ id: string; meta: WorkspaceMeta }[]> {
  const cacheDir = runnerCachePath(rootDir);
  if (!existsSync(cacheDir)) return [];

  const entries = await readdir(cacheDir, { withFileTypes: true });
  const results: { id: string; meta: WorkspaceMeta }[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const meta = await readWorkspaceMeta(rootDir, entry.name);
    if (meta) {
      results.push({ id: entry.name, meta });
    }
  }

  return results;
}

/**
 * 读取 lock 文件（.flowcabal/current-workspace）。
 */
export function readLockedWorkspace(rootDir: string): string | null {
  const lockPath = currentWorkspacePath(rootDir);
  if (!existsSync(lockPath)) return null;
  const content = readFileSync(lockPath, "utf-8").trim();
  return content || null;
}

/**
 * 写入 lock 文件。
 */
export async function writeLockFile(rootDir: string, wsId: string): Promise<void> {
  const lockPath = currentWorkspacePath(rootDir);
  await writeFile(lockPath, wsId, "utf-8");
}

/**
 * 解析 workspace：
 * 1. --workspace 命令行参数
 * 2. .flowcabal/current-workspace（lock 的结果）
 * 3. 唯一 workspace 自动选
 * 4. 多个则交互选择
 */
export async function resolveWorkspace(
  rootDir: string,
  wsFlag?: string,
): Promise<string | null> {
  if (wsFlag) return wsFlag;

  // 检查 lock 文件
  const locked = readLockedWorkspace(rootDir);
  if (locked) return locked;

  const workspaces = await listWorkspaces(rootDir);
  if (workspaces.length === 0) {
    p.log.warn("没有找到 workspace，请先运行 flowcabal create");
    return null;
  }
  if (workspaces.length === 1) {
    return workspaces[0].id;
  }

  const selected = await p.select({
    message: "选择 workspace",
    options: workspaces.map((ws) => ({
      label: ws.id.slice(0, 12),
      value: ws.id,
      hint: ws.meta.createdAt,
    })),
  });

  if (p.isCancel(selected)) return null;
  return selected as string;
}
