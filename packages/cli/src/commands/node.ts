import type { CommandModule } from "yargs";
import { writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { spawnSync } from "child_process";
import * as p from "@clack/prompts";
import { openWorkspace, newId, extractNodeDeps } from "@flowcabal/engine";
import type { NodeDef } from "@flowcabal/engine";
import { findProjectRoot, resolveWorkspace, loadLlmConfigs } from "../config.js";
import { matchNode, cleanup } from "../utils.js";

// ── node add ──

const addCommand: CommandModule = {
  command: "add <label>",
  describe: "创建空节点",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("label", { type: "string", demandOption: true, describe: "节点标签" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const id = newId();
    const node: NodeDef = {
      id,
      label: argv.label as string,
      systemPrompt: [],
      userPrompt: [],
    };
    await ws.addNode(node);
    p.log.success(`已创建节点 ${node.label} [${id}]`);
  },
};

// ── node rm ──

const rmCommand: CommandModule = {
  command: "rm <nodeId>",
  describe: "删除节点",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "节点 ID（前缀匹配）" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);

    // 检查有无下游节点 ref 到此节点
    const deps = extractNodeDeps(nodes);
    const dependents = nodes.filter((n) => {
      const nodeDeps = deps.get(n.id);
      return nodeDeps && nodeDeps.has(node.id);
    });

    if (dependents.length > 0) {
      const names = dependents.map((n) => n.label).join(", ");
      const ok = await p.confirm({ message: `以下节点引用了此节点: ${names}。确认删除？` });
      if (p.isCancel(ok) || !ok) return;
    }

    await ws.removeNode(node.id);
    p.log.success(`已删除节点 ${node.label}`);
  },
};

// ── node rename ──

const renameCommand: CommandModule = {
  command: "rename <nodeId> <newLabel>",
  describe: "重命名节点",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "节点 ID（前缀匹配）" })
      .positional("newLabel", { type: "string", demandOption: true, describe: "新标签" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);
    const oldLabel = node.label;

    // removeNode + addNode with new label (preserving blocks)
    // 直接操作：先删后加，保持 prompt 不变
    await ws.removeNode(node.id);
    await ws.addNode({ ...node, label: argv.newLabel as string });

    p.log.success(`已重命名 ${oldLabel} → ${argv.newLabel}`);
  },
};

// ── node connect ──

const connectCommand: CommandModule = {
  command: "connect <nodeId> <upstreamId>",
  describe: "添加 ref（连接上游节点）",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "目标节点 ID" })
      .positional("upstreamId", { type: "string", demandOption: true, describe: "上游节点 ID" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" })
      .option("system", { type: "boolean", default: false, describe: "添加到 systemPrompt" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);
    const upstream = matchNode(nodes, argv.upstreamId as string);

    const promptKey: "system" | "user" = argv.system ? "system" : "user";
    const blocks = promptKey === "system" ? node.systemPrompt : node.userPrompt;

    await ws.addBlock(node.id, promptKey, blocks.length, { kind: "ref", nodeId: upstream.id });
    p.log.success(`已在 ${node.label} 的 ${promptKey}Prompt 末尾添加 ref → ${upstream.label}`);
  },
};

// ── node disconnect ──

const disconnectCommand: CommandModule = {
  command: "disconnect <nodeId> <upstreamId>",
  describe: "移除 ref（断开上游节点）",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "目标节点 ID" })
      .positional("upstreamId", { type: "string", demandOption: true, describe: "上游节点 ID" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);
    const upstream = matchNode(nodes, argv.upstreamId as string);

    // 从后往前移除，避免索引错位
    let removed = 0;
    for (const promptKey of ["user", "system"] as const) {
      const blocks = promptKey === "system" ? node.systemPrompt : node.userPrompt;
      for (let i = blocks.length - 1; i >= 0; i--) {
        const b = blocks[i];
        if (b.kind === "ref" && b.nodeId === upstream.id) {
          await ws.removeBlock(node.id, promptKey, i);
          removed++;
        }
      }
    }

    if (removed === 0) {
      p.log.warn(`${node.label} 中没有对 ${upstream.label} 的 ref`);
    } else {
      p.log.success(`已从 ${node.label} 中移除 ${removed} 个 ref → ${upstream.label}`);
    }
  },
};

// ── node add-literal ──

const addLiteralCommand: CommandModule = {
  command: "add-literal <nodeId>",
  describe: "追加 literal block（$EDITOR 编辑）",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "节点 ID（前缀匹配）" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" })
      .option("system", { type: "boolean", default: false, describe: "添加到 systemPrompt" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);

    const editor = process.env.EDITOR || "vi";
    const tmpFile = join(tmpdir(), `flowcabal-literal-${node.id.slice(0, 8)}.md`);
    await writeFile(tmpFile, "", "utf-8");

    const result = spawnSync(editor, [tmpFile], { stdio: "inherit" });
    if (result.status !== 0) {
      p.cancel("编辑器异常退出");
      await cleanup(tmpFile);
      process.exit(1);
    }

    const content = await Bun.file(tmpFile).text();
    await cleanup(tmpFile);

    if (!content.trim()) {
      p.log.warn("内容为空，未添加");
      return;
    }

    const promptKey: "system" | "user" = argv.system ? "system" : "user";
    const blocks = promptKey === "system" ? node.systemPrompt : node.userPrompt;

    await ws.addBlock(node.id, promptKey, blocks.length, { kind: "literal", content });
    p.log.success(`已在 ${node.label} 的 ${promptKey}Prompt 末尾添加 literal block`);
  },
};

// ── node add-inject ──

const addInjectCommand: CommandModule = {
  command: "add-inject <nodeId>",
  describe: "追加 agent-inject block",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "节点 ID（前缀匹配）" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" })
      .option("system", { type: "boolean", default: false, describe: "添加到 systemPrompt" })
      .option("hint", { type: "string", demandOption: true, describe: "注入提示" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);

    const promptKey: "system" | "user" = argv.system ? "system" : "user";
    const blocks = promptKey === "system" ? node.systemPrompt : node.userPrompt;

    await ws.addBlock(node.id, promptKey, blocks.length, {
      kind: "agent-inject",
      hint: argv.hint as string,
    });
    p.log.success(`已在 ${node.label} 的 ${promptKey}Prompt 末尾添加 agent-inject block`);
  },
};

// ── node rm-block ──

const rmBlockCommand: CommandModule = {
  command: "rm-block <nodeId> <index>",
  describe: "移除指定索引的 block",
  builder: (yargs) =>
    yargs
      .version(false)
      .positional("nodeId", { type: "string", demandOption: true, describe: "节点 ID（前缀匹配）" })
      .positional("index", { type: "number", demandOption: true, describe: "block 索引" })
      .option("workspace", { alias: "w", type: "string", describe: "workspace ID" })
      .option("system", { type: "boolean", default: false, describe: "操作 systemPrompt" }),
  handler: async (argv) => {
    const rootDir = findProjectRoot();
    if (!rootDir) { p.cancel("找不到 flowcabal.json"); process.exit(1); }
    const wsId = await resolveWorkspace(rootDir, argv.workspace as string | undefined);
    if (!wsId) return;

    const ws = await openWorkspace(rootDir, wsId, await loadLlmConfigs());
    const nodes = ws.getNodes();
    const node = matchNode(nodes, argv.nodeId as string);

    const promptKey: "system" | "user" = argv.system ? "system" : "user";

    await ws.removeBlock(node.id, promptKey, argv.index as number);
    p.log.success(`已移除 ${node.label} 的 ${promptKey}Prompt[${argv.index}]`);
  },
};

// ── node 命令组 ──

export const nodeCommand: CommandModule = {
  command: "node",
  describe: "节点编排（add/rm/rename/connect/disconnect/add-literal/add-inject/rm-block）",
  builder: (yargs) =>
    yargs
      .version(false)
      .command(addCommand)
      .command(rmCommand)
      .command(renameCommand)
      .command(connectCommand)
      .command(disconnectCommand)
      .command(addLiteralCommand)
      .command(addInjectCommand)
      .command(rmBlockCommand)
      .demandCommand(1, "请指定子命令"),
  handler: () => {},
};
