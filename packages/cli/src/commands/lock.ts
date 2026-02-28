import type { CommandModule } from "yargs";
import * as p from "@clack/prompts";
import { findProjectRoot, listWorkspaces, writeLockFile } from "../config.js";

export const lockCommand: CommandModule = {
  command: "lock [id]",
  describe: "锁定 workspace（类似 git checkout）",
  builder: (yargs) =>
    yargs.version(false).positional("id", {
      type: "string",
      describe: "workspace ID（支持短 ID 前缀匹配）",
    }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const workspaces = await listWorkspaces(rootDir);
    if (workspaces.length === 0) {
      p.log.warn("没有找到 workspace，请先运行 flowcabal create");
      return;
    }

    let wsId: string;
    const idArg = argv.id as string | undefined;

    if (idArg) {
      // 前缀匹配
      const matches = workspaces.filter((ws) => ws.id.startsWith(idArg));
      if (matches.length === 0) {
        p.cancel(`没有找到匹配 "${idArg}" 的 workspace`);
        process.exit(1);
      }
      if (matches.length > 1) {
        p.cancel(`"${idArg}" 匹配多个 workspace，请提供更长的前缀`);
        process.exit(1);
      }
      wsId = matches[0].id;
    } else {
      // 交互选择
      const selected = await p.select({
        message: "选择 workspace",
        options: workspaces.map((ws) => ({
          label: ws.id.slice(0, 12),
          value: ws.id,
          hint: `创建于 ${ws.meta.createdAt}`,
        })),
      });
      if (p.isCancel(selected)) return;
      wsId = selected as string;
    }

    await writeLockFile(rootDir, wsId);
    p.log.success(`locked: ${wsId.slice(0, 12)}`);
  },
};
