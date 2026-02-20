import { readFile } from "fs/promises";
import { existsSync } from "fs";
import { indexPath } from "../store/paths.js";
import { readStoreEntry } from "../store/store.js";

/**
 * Assemble context for an LLM call:
 * - L0: index.md (always injected)
 * - L1: on-demand full file reads
 */
export async function loadL0(rootDir: string): Promise<string> {
  const idx = indexPath(rootDir);
  if (!existsSync(idx)) return "";
  return await readFile(idx, "utf-8");
}

/**
 * Load full content of specific store entries (L1/L2).
 */
export async function loadEntries(
  rootDir: string,
  paths: string[]
): Promise<string> {
  const parts: string[] = [];
  for (const p of paths) {
    const entry = await readStoreEntry(rootDir, p);
    if (entry) {
      parts.push(`--- ${p} ---\n${entry.content}`);
    }
  }
  return parts.join("\n\n");
}

/**
 * Build a full context string with L0 + optional L1 entries.
 */
export async function assembleContext(
  rootDir: string,
  extraPaths: string[] = []
): Promise<string> {
  const l0 = await loadL0(rootDir);
  if (extraPaths.length === 0) return l0;
  const l1 = await loadEntries(rootDir, extraPaths);
  return `${l0}\n\n${l1}`;
}
