import { writeFile } from "fs/promises";
import { indexPath } from "./paths.js";
import { listStore, readStoreEntry } from "./store.js";

/**
 * Generate index.md (L0) — one-line summary per store entry.
 * Format: `- [relative/path] summary text`
 */
export async function generateIndex(rootDir: string): Promise<string> {
  const paths = await listStore(rootDir);
  paths.sort();
  const lines: string[] = ["# Store Index", ""];
  for (const p of paths) {
    const entry = await readStoreEntry(rootDir, p);
    if (entry) {
      lines.push(`- [${p}] ${entry.summary}`);
    }
  }
  const content = lines.join("\n") + "\n";
  await writeFile(indexPath(rootDir), content, "utf-8");
  return content;
}
