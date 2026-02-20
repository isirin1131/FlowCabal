import type { CommandModule } from "yargs";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import * as p from "@clack/prompts";
import { indexPath, listStore, manuscriptsPath } from "@flowcabal/engine";
import { findProjectRoot } from "../config.js";
import { readdir } from "fs/promises";

export const statusCommand: CommandModule = {
  command: "status",
  describe: "显示项目状态",
  handler: async () => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    p.intro("项目状态");

    // Manuscripts
    const msDir = manuscriptsPath(rootDir);
    let manuscripts: string[] = [];
    if (existsSync(msDir)) {
      manuscripts = (await readdir(msDir)).filter((f) => f.endsWith(".md"));
    }
    p.log.info(`手稿: ${manuscripts.length} 个文件`);
    for (const m of manuscripts) {
      p.log.message(`  ${m}`);
    }

    // Store entries
    const entries = await listStore(rootDir);
    p.log.info(`Store 条目: ${entries.length}`);
    for (const e of entries) {
      p.log.message(`  ${e}`);
    }

    // Index
    const idx = indexPath(rootDir);
    if (existsSync(idx)) {
      const content = await readFile(idx, "utf-8");
      p.note(content, "index.md (L0)");
    } else {
      p.log.warn("index.md 尚未生成");
    }

    p.outro("");
  },
};
