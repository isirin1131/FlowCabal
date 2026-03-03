import type { CommandModule } from "yargs";
import * as p from "@clack/prompts";
import type { NodeDef } from "@flowcabal/engine";
import { openWorkspace, extractNodeDeps } from "@flowcabal/engine";
import { findProjectRoot, resolveWorkspace, loadLlmConfigs } from "../config.js";
import { STATUS_ICON } from "../utils.js";

export const logCommand: CommandModule = {
  command: "log",
  describe: "节点概览（类似 git log --oneline）",
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
    const dashboard = ws.getDashboard();
    const nodes = ws.getNodes();

    console.log(`${wsId.slice(0, 12)}  ${dashboard.nodes.length} 个节点\n`);

    // 构建上游依赖映射
    const deps = extractNodeDeps(nodes);
    // 构建 id → label 映射
    const labelMap = new Map<string, string>();
    for (const n of nodes) {
      labelMap.set(n.id, n.label);
    }

    for (const node of dashboard.nodes) {
      const icon = STATUS_ICON[node.status] ?? "?";
      const upstream = deps.get(node.id);
      let depStr = "";
      if (upstream && upstream.size > 0) {
        const depIds = [...upstream].map((id) => id.slice(0, 8));
        depStr = `  ← ${depIds.join(", ")}`;
      }
      console.log(`${node.id.slice(0, 8)} ${icon} ${node.label}${depStr}`);
    }
  },
};
