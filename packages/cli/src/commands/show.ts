import type { CommandModule } from "yargs";
import * as p from "@clack/prompts";
import type { TextBlock, NodeDef } from "@flowcabal/engine";
import { openWorkspace } from "@flowcabal/engine";
import { findProjectRoot, resolveWorkspace, loadLlmConfigs } from "../config.js";

const STATUS_ICON: Record<string, string> = {
  cached: "✓",
  stale: "~",
  pending: "○",
};

function formatBlock(block: TextBlock, nodes: NodeDef[]): string {
  switch (block.kind) {
    case "literal": {
      const preview = block.content.length > 80
        ? block.content.slice(0, 80) + "..."
        : block.content;
      return `[literal] ${preview}`;
    }
    case "ref": {
      const upstream = nodes.find((n) => n.id === block.nodeId);
      const label = upstream ? upstream.label : "???";
      return `[ref] → ${label} [${block.nodeId.slice(0, 8)}]`;
    }
    case "agent-inject":
      return `[agent-inject] ${block.hint}`;
  }
}

export const showCommand: CommandModule = {
  command: "show <nodeId>",
  describe: "节点详情（类似 git show）",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", {
        type: "string",
        describe: "节点 ID（支持短 ID 前缀匹配）",
        demandOption: true,
      })
      .option("workspace", {
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
    const nodes = ws.getNodes();

    // 前缀匹配节点 ID
    const nodeIdArg = argv.nodeId as string;
    const matches = nodes.filter((n) => n.id.startsWith(nodeIdArg));
    if (matches.length === 0) {
      p.cancel(`没有找到匹配 "${nodeIdArg}" 的节点`);
      process.exit(1);
    }
    if (matches.length > 1) {
      p.cancel(`"${nodeIdArg}" 匹配多个节点，请提供更长的前缀`);
      process.exit(1);
    }

    const node = matches[0];
    const status = ws.getNodeStatus(node.id);
    const versions = ws.getVersions(node.id);
    const icon = STATUS_ICON[status] ?? "?";

    console.log(`节点: ${node.label} [${node.id.slice(0, 12)}...]`);
    console.log(`状态: ${icon} ${status}`);

    // system prompt
    console.log(`\n── system prompt ──`);
    if (node.systemPrompt.length === 0) {
      console.log("(空)");
    } else {
      for (const block of node.systemPrompt) {
        console.log(formatBlock(block, nodes));
      }
    }

    // user prompt
    console.log(`\n── user prompt ──`);
    if (node.userPrompt.length === 0) {
      console.log("(空)");
    } else {
      for (const block of node.userPrompt) {
        console.log(formatBlock(block, nodes));
      }
    }

    // versions
    console.log(`\n── 版本 ──`);
    if (versions.length === 0) {
      console.log("无");
    } else {
      for (const v of versions) {
        const cur = v.current ? " (当前)" : "";
        const preview = v.output.length > 60
          ? v.output.slice(0, 60).replace(/\n/g, " ") + "..."
          : v.output.replace(/\n/g, " ");
        console.log(`${v.id.slice(0, 8)} ${v.source.kind}${cur}  ${preview}`);
      }
    }
  },
};
