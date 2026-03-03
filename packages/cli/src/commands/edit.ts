import type { CommandModule } from "yargs";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";
import { openWorkspace } from "@flowcabal/engine";
import type { TextBlock, NodeDef } from "@flowcabal/engine";
import { findProjectRoot, resolveWorkspace, loadLlmConfigs } from "../config.js";
import { matchNode, formatBlock, cleanup } from "../utils.js";

export const editCommand: CommandModule = {
  command: "edit [nodeId] [blockIndex]",
  describe: "编辑单个 block 的文本内容（$EDITOR）",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", {
        type: "string",
        describe: "节点 ID（支持前缀匹配）",
      })
      .positional("blockIndex", {
        type: "number",
        describe: "block 索引",
      })
      .option("workspace", {
        alias: "w",
        type: "string",
        describe: "workspace ID",
      })
      .option("system", {
        type: "boolean",
        default: false,
        describe: "编辑 systemPrompt（默认 userPrompt）",
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

    // ── 选择节点 ──
    let node: NodeDef;
    const nodeIdArg = argv.nodeId as string | undefined;
    if (nodeIdArg) {
      node = matchNode(nodes, nodeIdArg);
    } else {
      if (nodes.length === 0) {
        p.cancel("没有节点");
        process.exit(1);
      }
      const selected = await p.select({
        message: "选择节点",
        options: nodes.map((n) => ({
          label: `${n.label} [${n.id.slice(0, 8)}]`,
          value: n.id,
        })),
      });
      if (p.isCancel(selected)) return;
      node = nodes.find((n) => n.id === selected)!;
    }

    const promptKey: "system" | "user" = argv.system ? "system" : "user";
    const blocks = promptKey === "system" ? node.systemPrompt : node.userPrompt;

    if (blocks.length === 0) {
      p.log.warn(`${promptKey}Prompt 为空，没有可编辑的 block`);
      return;
    }

    // ── 选择 block ──
    let blockIndex: number;
    const blockIndexArg = argv.blockIndex as number | undefined;
    if (blockIndexArg !== undefined) {
      if (blockIndexArg < 0 || blockIndexArg >= blocks.length) {
        p.cancel(`block 索引 ${blockIndexArg} 越界 (0..${blocks.length - 1})`);
        process.exit(1);
      }
      blockIndex = blockIndexArg;
    } else if (blocks.length === 1) {
      blockIndex = 0;
    } else {
      const selected = await p.select({
        message: "选择 block",
        options: blocks.map((b, i) => ({
          label: `[${i}] ${formatBlock(b, nodes)}`,
          value: i,
        })),
      });
      if (p.isCancel(selected)) return;
      blockIndex = selected as number;
    }

    const block = blocks[blockIndex];

    // ref 不可编辑
    if (block.kind === "ref") {
      p.log.warn("ref block 不可直接编辑，请使用 node connect/disconnect 管理连接");
      return;
    }

    // ── 打开编辑器 ──
    const text = block.kind === "literal" ? block.content : block.hint;
    const editor = process.env.EDITOR || "vi";
    const ext = block.kind === "literal" ? ".md" : ".txt";
    const tmpFile = join(tmpdir(), `flowcabal-edit-${node.id.slice(0, 8)}-${blockIndex}${ext}`);

    await writeFile(tmpFile, text, "utf-8");

    const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });
    if (result.status !== 0) {
      p.cancel("编辑器异常退出");
      await cleanup(tmpFile);
      process.exit(1);
    }

    const edited = await Bun.file(tmpFile).text();
    await cleanup(tmpFile);

    if (edited === text) {
      p.log.info("内容未变更");
      return;
    }

    // ── 更新 block ──
    const newBlock: TextBlock = block.kind === "literal"
      ? { kind: "literal", content: edited }
      : { kind: "agent-inject", hint: edited };

    await ws.removeBlock(node.id, promptKey, blockIndex);
    await ws.addBlock(node.id, promptKey, blockIndex, newBlock);

    p.log.success(`已更新 ${node.label} 的 ${promptKey}Prompt[${blockIndex}]`);
  },
};
