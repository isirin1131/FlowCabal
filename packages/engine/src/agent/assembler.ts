import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { memoryIndexPath } from "../paths.js";

/**
 * 加载 L0 索引（index.md），始终注入到 Agent 上下文。
 */
export async function loadL0(rootDir: string): Promise<string> {
  const idx = memoryIndexPath(rootDir);
  if (!existsSync(idx)) return "";
  return await readFile(idx, "utf-8");
}
