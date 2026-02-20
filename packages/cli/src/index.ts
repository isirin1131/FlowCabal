#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { initCommand } from "./commands/init.js";
import { addChapterCommand } from "./commands/add-chapter.js";
import { statusCommand } from "./commands/status.js";
import { generateCommand } from "./commands/generate.js";
import { storeCommand } from "./commands/store.js";

yargs(hideBin(process.argv))
  .scriptName("flowcabal")
  .usage("$0 <command> [options]")
  .command(initCommand)
  .command(addChapterCommand)
  .command(statusCommand)
  .command(generateCommand)
  .command(storeCommand)
  .demandCommand(1, "请指定一个命令")
  .strict()
  .help()
  .parse();
