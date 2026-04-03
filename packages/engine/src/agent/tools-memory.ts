import { z } from "zod";
import { tool, type Tool } from "ai";
import {
  listMemoryFiles,
  listManuscriptsFiles,
  readMemoryFile,
  readManuscriptFile,
  writeMemoryFile,
  deleteMemoryFile,
  generateMemoryIndex,
} from "./memory.js";

export function createMemoryTools(rootDir: string, readonly = false): Record<string, Tool> {
  const tools: Record<string, Tool> = {
    list_memory: tool({
      description: "列出所有非手稿文件（排除 manuscripts/ 目录和 index.md），返回相对于 memory/ 的路径列表",
      parameters: z.object({}),
      execute: async () => {
        const files = await listMemoryFiles(rootDir);
        return { files };
      },
    }),

    list_manuscripts: tool({
      description: "列出所有手稿文件（manuscripts/*.md），返回相对于 memory/ 的路径列表",
      parameters: z.object({}),
      execute: async () => {
        const files = await listManuscriptsFiles(rootDir);
        return { files };
      },
    }),

    read_file: tool({
      description: "读取非手稿文件（排除 manuscripts/ 目录和 index.md）。路径相对于 memory 目录",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径，如 characters/张三.md"),
      }),
      execute: async ({ path }) => {
        const entry = await readMemoryFile(rootDir, path);
        if (!entry) return { error: `文件不存在: ${path}` };
        return { path: entry.relativePath, content: entry.content };
      },
    }),

    read_manuscript: tool({
      description: "读取手稿文件（manuscripts/*.md）",
      parameters: z.object({
        path: z.string().describe("手稿文件路径，如 manuscripts/chapter-01.md"),
      }),
      execute: async ({ path }) => {
        const entry = await readManuscriptFile(rootDir, path);
        if (!entry) return { error: `手稿不存在: ${path}` };
        return { path: entry.relativePath, content: entry.content };
      },
    }),
  };

  if (!readonly) {
    tools.write_file = tool({
      description: "写入或更新非手稿文件（全量覆写，排除 manuscripts/ 目录和 index.md）",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径"),
        content: z.string().describe("文件完整内容"),
      }),
      execute: async ({ path, content }) => {
        await writeMemoryFile(rootDir, path, content);
        return { success: true, path };
      },
    });

    tools.delete_file = tool({
      description: "删除非手稿文件（排除 manuscripts/ 目录和 index.md）",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径"),
      }),
      execute: async ({ path }) => {
        await deleteMemoryFile(rootDir, path);
        return { success: true, path };
      },
    });

    tools.update_index = tool({
      description: "重新生成 memory/index.md（包含所有非手稿文件的路径和首行摘要）",
      parameters: z.object({}),
      execute: async () => {
        const content = await generateMemoryIndex(rootDir);
        return { success: true, content };
      },
    });
  }

  return tools;
}
