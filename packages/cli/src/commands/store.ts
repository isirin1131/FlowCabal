import type { CommandModule } from "yargs";
import * as p from "@clack/prompts";
import {
  listStore,
  readStoreEntry,
  writeStoreEntry,
  generateIndex,
} from "@flowcabal/engine";
import { findProjectRoot } from "../config.js";

export const storeCommand: CommandModule = {
  command: "store <action> [path]",
  describe: "管理 store 条目",
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["ls", "read", "write", "index"] as const,
        describe: "操作: ls | read | write | index",
        demandOption: true,
      })
      .positional("path", {
        type: "string",
        describe: "条目路径（read/write 时需要）",
      }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const action = argv.action as string;
    const entryPath = argv.path as string | undefined;

    switch (action) {
      case "ls": {
        const entries = await listStore(rootDir);
        if (entries.length === 0) {
          p.log.warn("Store 为空");
        } else {
          for (const e of entries) {
            console.log(e);
          }
        }
        break;
      }

      case "read": {
        if (!entryPath) {
          p.cancel("请指定条目路径，如: flowcabal store read constraints/characters/xxx.md");
          process.exit(1);
        }
        const entry = await readStoreEntry(rootDir, entryPath);
        if (!entry) {
          p.cancel(`未找到: ${entryPath}`);
          process.exit(1);
        }
        console.log(entry.content);
        break;
      }

      case "write": {
        if (!entryPath) {
          p.cancel("请指定条目路径");
          process.exit(1);
        }
        const content = await p.text({
          message: "输入内容（Markdown）",
          placeholder: "# 标题\n内容...",
        });
        if (p.isCancel(content)) {
          p.cancel("已取消");
          process.exit(0);
        }
        await writeStoreEntry(rootDir, entryPath, content as string);
        p.log.success(`已写入: ${entryPath}`);
        break;
      }

      case "index": {
        const idx = await generateIndex(rootDir);
        console.log(idx);
        p.log.success("索引已更新");
        break;
      }
    }
  },
};
