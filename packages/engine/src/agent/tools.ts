import { z } from "zod";
import { tool } from "ai";
import {
  listStore,
  readStoreEntry,
  writeStoreEntry,
} from "../store/store.js";
import { generateIndex } from "../store/index-gen.js";
import { readFile } from "fs/promises";
import { join } from "path";
import { manuscriptsPath } from "../store/paths.js";
import { existsSync } from "fs";

/**
 * Create the 5 agent tools, bound to a project rootDir.
 */
export function createTools(rootDir: string) {
  return {
    list_store: tool({
      description: "列出 store 中所有条目的路径",
      parameters: z.object({}),
      execute: async () => {
        const paths = await listStore(rootDir);
        return paths.length > 0 ? paths.join("\n") : "(store 为空)";
      },
    }),

    read_store: tool({
      description: "读取 store 中指定条目的完整内容",
      parameters: z.object({
        path: z.string().describe("条目相对路径，如 constraints/characters/芙兰朵露.md"),
      }),
      execute: async ({ path }) => {
        const entry = await readStoreEntry(rootDir, path);
        if (!entry) return `未找到: ${path}`;
        return entry.content;
      },
    }),

    write_store: tool({
      description: "写入或更新 store 中的条目",
      parameters: z.object({
        path: z.string().describe("条目相对路径"),
        content: z.string().describe("Markdown 格式的完整内容"),
      }),
      execute: async ({ path, content }) => {
        await writeStoreEntry(rootDir, path, content);
        return `已写入: ${path}`;
      },
    }),

    read_manuscript: tool({
      description: "读取 manuscripts 目录下的手稿文件",
      parameters: z.object({
        filename: z.string().describe("文件名，如 chapter01.md"),
      }),
      execute: async ({ filename }) => {
        const fullPath = join(manuscriptsPath(rootDir), filename);
        if (!existsSync(fullPath)) return `未找到手稿: ${filename}`;
        return await readFile(fullPath, "utf-8");
      },
    }),

    update_index: tool({
      description: "重新生成 store/index.md（L0 索引）",
      parameters: z.object({}),
      execute: async () => {
        const content = await generateIndex(rootDir);
        return `索引已更新:\n${content}`;
      },
    }),
  };
}
