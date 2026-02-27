import { readFile, readdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { LlmConfig, LlmConfigsFile, ProjectConfig, WorkspaceMeta } from "@flowcabal/engine";
import {
  ProjectConfigSchema,
  LlmConfigsFileSchema,
  WorkspaceMetaSchema,
  globalLlmConfigsPath,
  runnerCachePath,
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
 * 从全局 ~/.config/flowcabal/llm-configs.json 读取全部 LLM 配置。
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
 * 从全局 ~/.config/flowcabal/llm-configs.json 读取 "default" LLM 配置。
 */
export async function loadDefaultLlmConfig(): Promise<LlmConfig> {
  const configs = await loadLlmConfigs();
  const defaultConfig = configs["default"];
  if (!defaultConfig) {
    throw new Error('llm-configs.json 中缺少 "default" 配置');
  }
  return defaultConfig;
}

/**
 * 扫描 .flowcabal/runner-cache/ 下的 workspace 列表。
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
    const metaPath = join(cacheDir, entry.name, "meta.json");
    if (!existsSync(metaPath)) continue;
    try {
      const raw = await readFile(metaPath, "utf-8");
      const meta = WorkspaceMetaSchema.parse(JSON.parse(raw));
      results.push({ id: entry.name, meta });
    } catch {
      // skip invalid workspaces
    }
  }

  return results;
}
