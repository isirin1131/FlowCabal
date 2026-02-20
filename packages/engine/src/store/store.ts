import { join } from "path";
import { readdir, readFile, writeFile, unlink, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { storePath, STORE_DIRS } from "./paths.js";
import type { StoreEntry } from "../types.js";

/** Initialize store directory structure */
export async function initStore(rootDir: string): Promise<void> {
  for (const dir of STORE_DIRS) {
    await mkdir(join(storePath(rootDir), dir), { recursive: true });
  }
}

/** List all markdown files in store, recursively */
export async function listStore(rootDir: string): Promise<string[]> {
  const base = storePath(rootDir);
  if (!existsSync(base)) return [];
  return await walkDir(base, base);
}

async function walkDir(dir: string, base: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const results: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await walkDir(full, base)));
    } else if (entry.name.endsWith(".md") && entry.name !== "index.md") {
      results.push(full.slice(base.length + 1)); // relative path
    }
  }
  return results;
}

/** Read a store entry */
export async function readStoreEntry(
  rootDir: string,
  relativePath: string
): Promise<StoreEntry | null> {
  const fullPath = join(storePath(rootDir), relativePath);
  if (!existsSync(fullPath)) return null;
  const content = await readFile(fullPath, "utf-8");
  const firstLine = content.split("\n").find((l) => l.trim().length > 0) ?? "";
  return {
    path: relativePath,
    summary: firstLine.replace(/^#\s*/, "").trim(),
    content,
  };
}

/** Write a store entry (creates parent dirs) */
export async function writeStoreEntry(
  rootDir: string,
  relativePath: string,
  content: string
): Promise<void> {
  const fullPath = join(storePath(rootDir), relativePath);
  await mkdir(join(fullPath, ".."), { recursive: true });
  await writeFile(fullPath, content, "utf-8");
}

/** Delete a store entry */
export async function deleteStoreEntry(
  rootDir: string,
  relativePath: string
): Promise<boolean> {
  const fullPath = join(storePath(rootDir), relativePath);
  if (!existsSync(fullPath)) return false;
  await unlink(fullPath);
  return true;
}
