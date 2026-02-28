import type { CommandModule } from "yargs";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";
import {
  openWorkspace,
  writeWorkspaceNodes,
  validateWorkflow,
  newId,
  NodeDefSchema,
} from "@flowcabal/engine";
import type { NodeDef } from "@flowcabal/engine";
import { findProjectRoot, resolveWorkspace, loadLlmConfigs } from "../config.js";

export const editCommand: CommandModule = {
  command: "edit",
  describe: "编辑节点（打开 $EDITOR）",
  builder: (yargs) =>
    yargs.version(false).option("workspace", {
      alias: "w",
      type: "string",
      describe: "workspace ID",
    }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const llmConfigs = await loadLlmConfigs();
    const ws = await openWorkspace(rootDir, wsId, llmConfigs);
    const nodes = ws.getNodes();

    const editor = process.env.EDITOR || "vi";
    const tmpFile = join(tmpdir(), `flowcabal-edit-${wsId.slice(0, 8)}.json`);

    // 写入临时文件
    const json = JSON.stringify(nodes, null, 2);
    await writeFile(tmpFile, json, "utf-8");

    // 编辑循环
    while (true) {
      // 打开编辑器
      const result = spawnSync(editor, [tmpFile], {
        stdio: "inherit",
      });

      if (result.status !== 0) {
        p.cancel("编辑器异常退出");
        await cleanup(tmpFile);
        process.exit(1);
      }

      // 读取编辑后的内容
      const edited = await Bun.file(tmpFile).text();

      // 解析 JSON
      let parsed: unknown;
      try {
        parsed = JSON.parse(edited);
      } catch {
        p.log.error("JSON 解析失败");
        const retry = await askRetry();
        if (!retry) {
          await cleanup(tmpFile);
          return;
        }
        continue;
      }

      // Zod 校验
      const nodesResult = NodeDefSchema.array().safeParse(parsed);
      if (!nodesResult.success) {
        const msgs = nodesResult.error.issues.map((i: { message: string }) => i.message).join(", ");
        p.log.error(`节点校验失败: ${msgs}`);
        const retry = await askRetry();
        if (!retry) {
          await cleanup(tmpFile);
          return;
        }
        continue;
      }

      let validatedNodes: NodeDef[] = nodesResult.data;

      // 为缺失 id 的新节点生成 id
      validatedNodes = validatedNodes.map((n) => {
        if (!n.id) {
          return { ...n, id: newId() };
        }
        return n;
      });

      // DAG 校验
      try {
        validateWorkflow({
          id: "edit-validation",
          name: "edit-validation",
          nodes: validatedNodes,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        p.log.error(`DAG 校验失败: ${msg}`);
        const retry = await askRetry();
        if (!retry) {
          await cleanup(tmpFile);
          return;
        }
        continue;
      }

      // 写回 workspace
      await writeWorkspaceNodes(rootDir, wsId, validatedNodes);
      p.log.success(`已保存 ${validatedNodes.length} 个节点`);
      await cleanup(tmpFile);
      return;
    }
  },
};

async function askRetry(): Promise<boolean> {
  const retry = await p.confirm({ message: "重新编辑？" });
  if (p.isCancel(retry)) return false;
  return retry;
}

async function cleanup(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // ignore
  }
}
