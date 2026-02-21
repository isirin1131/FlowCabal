import type { CommandModule } from "yargs";
import { readFile, copyFile } from "fs/promises";
import { join, basename } from "path";
import { existsSync } from "fs";
import * as p from "@clack/prompts";
import { runAgent, manuscriptsPath, SYSTEM_PROMPT_ANALYZE } from "@flowcabal/engine";
import { findProjectRoot, loadConfig } from "../config.js";

export const addChapterCommand: CommandModule<{}, { file: string }> = {
  command: "add-chapter <file>",
  describe: "添加章节并让 Agent 分析提取记忆",
  builder: (yargs) =>
    yargs.positional("file", {
      type: "string",
      describe: "章节文件路径",
      demandOption: true,
    }),
  handler: async (argv) => {
    p.intro("添加章节");

    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const config = await loadConfig(rootDir);
    const filePath = argv.file;

    if (!existsSync(filePath)) {
      p.cancel(`文件不存在: ${filePath}`);
      process.exit(1);
    }

    const content = await readFile(filePath, "utf-8");
    const filename = basename(filePath);

    // Copy to manuscripts/
    const dest = join(manuscriptsPath(rootDir), filename);
    await copyFile(filePath, dest);
    p.log.success(`已复制到 manuscripts/${filename}`);

    const s = p.spinner();
    s.start("Agent 正在分析章节...");

    try {
      const result = await runAgent(
        rootDir,
        config.defaultLlm,
        `请分析以下章节并提取信息写入 store：\n\n${content}`,
        SYSTEM_PROMPT_ANALYZE
      );

      s.stop("分析完成");
      p.log.info(result);
    } catch (err) {
      s.stop("分析失败");
      p.log.error(String(err));
      process.exit(1);
    }

    p.outro("章节已添加");
  },
};
