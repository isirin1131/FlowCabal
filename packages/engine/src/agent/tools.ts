import { z } from "zod";
import { tool } from "ai";
import type { RuntimeContext } from "../types.js";
import {
  listMemoryFiles,
  readMemoryFile,
  writeMemoryFile,
  deleteMemoryFile,
  generateMemoryIndex,
} from "./memory.js";

/**
 * 创建 Agent 工具集。
 * 通过闭包绑定 rootDir，工具函数内部直接使用。
 */
export function createTools(
  rootDir: string,
  runtimeCtx?: RuntimeContext,
) {
  return {
    list_memory: tool({
      description: "列出项目的所有 memory 文件（排除 index.md），包括 manuscripts/ 下的手稿",
      parameters: z.object({}),
      execute: async () => {
        const files = await listMemoryFiles(rootDir);
        return { files };
      },
    }),

    read_memory: tool({
      description: "读取指定的 memory 文件内容（包括 manuscripts/ 下的手稿，如 manuscripts/chapter-01.md）",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径，如 characters/张三.md 或 manuscripts/chapter-01.md"),
      }),
      execute: async ({ path }) => {
        const entry = await readMemoryFile(rootDir, path);
        if (!entry) return { error: `文件不存在: ${path}` };
        return { path: entry.relativePath, content: entry.content };
      },
    }),

    write_memory: tool({
      description: "写入或更新 memory 文件",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径"),
        content: z.string().describe("文件内容"),
      }),
      execute: async ({ path, content }) => {
        await writeMemoryFile(rootDir, path, content);
        return { success: true, path };
      },
    }),

    delete_memory: tool({
      description: "删除指定的 memory 文件",
      parameters: z.object({
        path: z.string().describe("相对于 memory 目录的文件路径"),
      }),
      execute: async ({ path }) => {
        await deleteMemoryFile(rootDir, path);
        return { success: true, path };
      },
    }),

    update_index: tool({
      description: "重新生成 memory 的 index.md（L0 导航索引）",
      parameters: z.object({}),
      execute: async () => {
        const content = await generateMemoryIndex(rootDir);
        return { success: true, content };
      },
    }),

    ...(runtimeCtx
      ? {
          query_runtime: tool({
            description: "查询工作流运行时状态（节点输出等）",
            parameters: z.object({
              nodeId: z.string().optional().describe("要查询输出的节点 ID，不传则返回所有节点列表"),
            }),
            execute: async ({ nodeId }) => {
              if (nodeId) {
                const output = runtimeCtx.getNodeOutput(nodeId);
                if (output === null) return { error: `节点 ${nodeId} 无输出` };
                return { nodeId, output };
              }
              const nodes = runtimeCtx.getWorkflowNodes();
              return { nodes: nodes.map((n) => ({ id: n.id, label: n.label })) };
            },
          }),
        }
      : {}),
  };
}
