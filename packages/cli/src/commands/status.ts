import type { CommandModule } from "yargs";
import { readFile, readdir } from "fs/promises";
import { existsSync } from "fs";
import * as p from "@clack/prompts";
import {
  memoryIndexPath,
  listMemoryFiles,
  manuscriptsPath,
  openWorkspace,
  extractNodeDeps,
} from "@flowcabal/engine";
import { findProjectRoot, listWorkspaces, resolveWorkspace, loadLlmConfigs } from "../config.js";
import { STATUS_ICON } from "../utils.js";

export const statusCommand: CommandModule = {
  command: "status",
  describe: "项目概况",
  builder: (yargs) =>
    yargs.version(false).option("workspace", {
      alias: "w",
      type: "string",
      describe: "指定 workspace ID",
    }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    p.intro("项目状态");

    // ── Manuscripts ──
    const msDir = manuscriptsPath(rootDir);
    let manuscripts: string[] = [];
    if (existsSync(msDir)) {
      manuscripts = (await readdir(msDir)).filter((f) => f.endsWith(".md"));
    }
    p.log.info(`手稿: ${manuscripts.length} 个文件`);
    for (const m of manuscripts) {
      p.log.message(`  ${m}`);
    }

    // ── Memory ──
    const entries = await listMemoryFiles(rootDir);
    p.log.info(`Memory 条目: ${entries.length}`);
    for (const e of entries) {
      p.log.message(`  ${e}`);
    }

    const idx = memoryIndexPath(rootDir);
    if (existsSync(idx)) {
      const content = await readFile(idx, "utf-8");
      p.note(content, "index.md (L0)");
    } else {
      p.log.warn("index.md 尚未生成");
    }

    // ── Workspaces ──
    const workspaces = await listWorkspaces(rootDir);
    p.log.info(`Workspace: ${workspaces.length} 个`);
    for (const ws of workspaces) {
      p.log.message(`  ${ws.id.slice(0, 12)}  创建于 ${ws.meta.createdAt}`);
    }

    // ── 节点（自动选 workspace 或用 --workspace 指定） ──
    if (workspaces.length > 0) {
      const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
      if (wsId) {
        const llmConfigs = await loadLlmConfigs();
        const ws = await openWorkspace(rootDir, wsId, llmConfigs);
        const dashboard = ws.getDashboard();
        const nodes = ws.getNodes();

        p.log.info(`workspace ${wsId.slice(0, 12)} — ${dashboard.nodes.length} 个节点`);

        const deps = extractNodeDeps(nodes);

        for (const node of dashboard.nodes) {
          const icon = STATUS_ICON[node.status] ?? "?";
          const upstream = deps.get(node.id);
          let depStr = "";
          if (upstream && upstream.size > 0) {
            const depIds = [...upstream].map((id) => id.slice(0, 8));
            depStr = `  ← ${depIds.join(", ")}`;
          }
          p.log.message(`  ${node.id.slice(0, 8)} ${icon} ${node.label}${depStr}`);
        }
      }
    }

    p.outro("");
  },
};
