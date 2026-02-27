#!/usr/bin/env bun
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { runInit } from "./init.js";
import { launchTui } from "./app.js";

yargs(hideBin(process.argv))
  .scriptName("flowcabal")
  .usage("$0 [options]")
  .command(
    "init",
    "初始化当前目录为 FlowCabal 项目",
    {},
    async () => {
      await runInit();
    },
  )
  .command(
    "$0",
    "启动 FlowCabal TUI",
    (yargs) =>
      yargs.option("workspace", {
        type: "string",
        alias: "w",
        describe: "指定 workspace ID",
      }),
    async (argv) => {
      await launchTui(argv.workspace);
    },
  )
  .strict()
  .help()
  .parse();
