import type { CommandModule } from "yargs";
import { readFile } from "fs/promises";
import * as p from "@clack/prompts";
import {
  createWorkspace,
  importWorkflow,
  writeWorkspaceNodes,
  WorkflowSchema,
} from "@flowcabal/engine";
import { findProjectRoot, loadConfig } from "../config.js";

export const createCommand: CommandModule = {
  command: "create",
  describe: "创建 workspace",
  builder: (yargs) =>
    yargs.version(false).option("from", {
      type: "string",
      describe: "从 workflow JSON 文件导入节点",
    }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const config = await loadConfig(rootDir);
    const wsId = await createWorkspace(rootDir, config.name);

    const fromPath = argv.from as string | undefined;
    if (fromPath) {
      const raw = await readFile(fromPath, "utf-8");
      const workflow = WorkflowSchema.parse(JSON.parse(raw));
      const nodes = importWorkflow(workflow);
      await writeWorkspaceNodes(rootDir, wsId, nodes);
      p.log.success(`已从 ${fromPath} 导入 ${nodes.length} 个节点`);
    }

    p.log.success(`workspace 已创建: ${wsId.slice(0, 12)}`);
  },
};
