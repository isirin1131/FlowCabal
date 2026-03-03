import { readFile, writeFile, readdir, mkdir, unlink, stat } from "fs/promises";
import { existsSync } from "fs";
import { join, relative, dirname, extname } from "path";
import {
  memoryPath,
  memoryIndexPath,
  MEMORY_SEED_FILES,
  MEMORY_SEED_DIRS,
} from "../paths.js";

// ── Types ──

interface MemoryEntry {
  /** 相对于 memoryPath 的路径，如 "characters/张三.md" */
  relativePath: string;
  content: string;
}

// ── Init ──

/**
 * 创建项目的 memory 种子文件和目录。
 * 幂等：已存在的文件/目录不覆盖。
 */
export async function initMemory(rootDir: string): Promise<void> {
  const base = memoryPath(rootDir);
  await mkdir(base, { recursive: true });

  for (const dir of MEMORY_SEED_DIRS) {
    await mkdir(join(base, dir), { recursive: true });
  }

  for (const file of MEMORY_SEED_FILES) {
    const filePath = join(base, file);
    if (!existsSync(filePath)) {
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, "", "utf-8");
    }
  }
}

// ── CRUD ──

/**
 * 遍历 memory 目录下所有 .md 文件，排除 index.md。
 * 返回相对于 memoryPath 的路径列表。
 */
export async function listMemoryFiles(rootDir: string): Promise<string[]> {
  const base = memoryPath(rootDir);
  if (!existsSync(base)) return [];

  const results: string[] = [];

  async function walk(dir: string) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && extname(entry.name) === ".md") {
        const rel = relative(base, full);
        if (rel !== "index.md") {
          results.push(rel);
        }
      }
    }
  }

  await walk(base);
  return results.sort();
}

/**
 * 读取指定 memory 文件。
 */
export async function readMemoryFile(
  rootDir: string,
  relativePath: string,
): Promise<MemoryEntry | null> {
  const filePath = join(memoryPath(rootDir), relativePath);
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath, "utf-8");
  return { relativePath, content };
}

/**
 * 写入/更新 memory 文件。自动创建父目录。
 */
export async function writeMemoryFile(
  rootDir: string,
  relativePath: string,
  content: string,
): Promise<void> {
  const filePath = join(memoryPath(rootDir), relativePath);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, content, "utf-8");
}

/**
 * 删除 memory 文件。
 */
export async function deleteMemoryFile(
  rootDir: string,
  relativePath: string,
): Promise<void> {
  const filePath = join(memoryPath(rootDir), relativePath);
  if (existsSync(filePath)) {
    await unlink(filePath);
  }
}

// ── Index 生成 ──

/**
 * 遍历所有 memory .md 文件，生成 index.md（L0 导航）。
 * index.md 内容 = 每个文件的路径 + 首行摘要。
 */
export async function generateMemoryIndex(rootDir: string): Promise<string> {
  const files = await listMemoryFiles(rootDir);
  const lines: string[] = ["# Memory Index", ""];

  for (const rel of files) {
    const entry = await readMemoryFile(rootDir, rel);
    if (!entry) continue;
    const firstLine = entry.content.split("\n").find((l) => l.trim()) ?? "";
    const summary = firstLine.slice(0, 80);
    lines.push(`- **${rel}**: ${summary}`);
  }

  const content = lines.join("\n") + "\n";
  const indexPath = memoryIndexPath(rootDir);
  await mkdir(dirname(indexPath), { recursive: true });
  await writeFile(indexPath, content, "utf-8");
  return content;
}
