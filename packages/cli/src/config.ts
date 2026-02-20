import { readFile } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import type { ProjectConfig } from "@flowcabal/engine";
import { ProjectConfigSchema } from "@flowcabal/engine";

/**
 * Find and load flowcabal.json, searching upward from cwd.
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
