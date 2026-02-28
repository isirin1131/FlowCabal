#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { addChapterCommand } from "./commands/add-chapter.js";
import { statusCommand } from "./commands/status.js";
import { generateCommand } from "./commands/generate.js";
import { createCommand } from "./commands/create.js";
import { runCommand } from "./commands/run.js";
import { lockCommand } from "./commands/lock.js";
import { logCommand } from "./commands/log.js";
import { showCommand } from "./commands/show.js";
import { editCommand } from "./commands/edit.js";
import { nodeCommand } from "./commands/node.js";

yargs(hideBin(process.argv))
  .scriptName("flowcabal")
  .usage("$0 <command> [options]\n\n对任意命令加 --help 查看详细用法，如: $0 run --help")
  .command(initCommand)
  .command(statusCommand)
  .command(createCommand)
  .command(lockCommand)
  .command(logCommand)
  .command(showCommand)
  .command(editCommand)
  .command(nodeCommand)
  .command(runCommand)
  .command(addChapterCommand)
  .command(generateCommand)
  .demandCommand(1, "请指定一个命令")
  .strict()
  .help()
  .parse();
