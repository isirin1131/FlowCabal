import type { CommandModule } from "yargs";
import * as p from "@clack/prompts";
import type { RunEvent, RunMode } from "@flowcabal/engine";
import { openWorkspace } from "@flowcabal/engine";
import { findProjectRoot, loadLlmConfigs, resolveWorkspace } from "../config.js";

export const runCommand: CommandModule = {
  command: "run",
  describe: "执行 workspace",
  builder: (yargs) =>
    yargs
      .version(false)
      .option("workspace", {
        alias: "w",
        type: "string",
        describe: "workspace ID",
      })
      .option("mode", {
        alias: "m",
        type: "string",
        choices: ["auto", "step"] as const,
        default: "auto",
        describe: "执行模式",
      }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const mode = (argv.mode as RunMode) ?? "auto";
    const llmConfigs = await loadLlmConfigs();
    const ws = await openWorkspace(rootDir, wsId, llmConfigs);

    const dashboard = ws.getDashboard();
    if (dashboard.nodes.length === 0) {
      p.log.warn("workspace 没有节点，无法执行");
      return;
    }

    p.intro(`执行 workspace ${wsId.slice(0, 12)}（${mode} 模式）`);

    const spinner = p.spinner();
    const handle = ws.startRun({ mode });

    handle.subscribe(async (event: RunEvent) => {
      switch (event.type) {
        case "run:planned":
          p.log.info(
            `计划: ${event.plan.totalNodes} 个节点, ${event.plan.cachedNodes} 已缓存, ` +
            `预估 ~${event.plan.estimate.inputTokens} input / ~${event.plan.estimate.outputTokens} output tokens`,
          );
          break;

        case "node:start":
          spinner.start(`生成: ${event.label}`);
          break;

        case "node:cache-hit":
          spinner.stop(`已缓存: ${event.nodeId.slice(0, 8)}`);
          break;

        case "node:done":
          if (event.cached) break; // cache-hit 已处理
          spinner.stop(`完成: ${event.nodeId.slice(0, 8)}`);
          break;

        case "node:error":
          spinner.stop(`错误: ${event.nodeId.slice(0, 8)} — ${event.error}`, 1);
          break;

        case "level:paused": {
          spinner.stop("层完成，等待确认...");
          const cont = await p.confirm({ message: `继续执行第 ${event.nextLevel} 层？` });
          if (p.isCancel(cont) || !cont) {
            handle.abort();
          } else {
            await handle.advance();
          }
          break;
        }

        case "run:done":
          p.log.success(
            `完成: ${event.summary.generatedNodes} 生成, ${event.summary.cachedNodes} 缓存, ` +
            `${event.summary.errorNodes} 错误, 耗时 ${(event.summary.durationMs / 1000).toFixed(1)}s`,
          );
          break;

        case "run:error":
          p.log.error(`执行错误: ${event.error}`);
          break;

        case "run:aborted":
          p.log.warn("执行已中止");
          break;
      }
    });

    await handle.done;
    p.outro("");
  },
};
