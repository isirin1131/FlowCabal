import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { ProjectConfig, LlmConfig } from "@flowcabal/engine";
import { ProjectConfigSchema, LlmConfigsFileSchema, globalLlmConfigsPath } from "@flowcabal/engine";

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
