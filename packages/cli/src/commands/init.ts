import type { CommandModule } from "yargs";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import * as p from "@clack/prompts";
import { initStore } from "@flowcabal/engine";

export const initCommand: CommandModule<{}, { name: string }> = {
  command: "init [name]",
  describe: "初始化一个 FlowCabal 项目",
  builder: (yargs) =>
    yargs.positional("name", {
      type: "string",
      describe: "项目名称（也是目录名）",
      default: "my-novel",
    }),
  handler: async (argv) => {
    p.intro("FlowCabal 项目初始化");

    const name = argv.name;
    const rootDir = join(process.cwd(), name);

    if (existsSync(rootDir)) {
      p.cancel(`目录 ${name} 已存在`);
      process.exit(1);
    }

    const llmSetup = await p.group({
      provider: () =>
        p.select({
          message: "选择 LLM 提供商",
          options: [
            { value: "openai-compatible", label: "OpenAI Compatible (DeepSeek 等)" },
            { value: "openai", label: "OpenAI" },
            { value: "anthropic", label: "Anthropic" },
            { value: "google", label: "Google" },
          ],
        }),
      apiKey: () =>
        p.text({
          message: "API Key",
          placeholder: "sk-...",
          validate: (v) => (v.length < 3 ? "请输入有效的 API Key" : undefined),
        }),
      model: () =>
        p.text({
          message: "模型名称",
          placeholder: "deepseek-chat",
          defaultValue: "deepseek-chat",
        }),
      baseURL: () =>
        p.text({
          message: "API Base URL (可选，OpenAI Compatible 需要)",
          placeholder: "https://api.deepseek.com",
          defaultValue: "",
        }),
    });

    if (p.isCancel(llmSetup)) {
      p.cancel("已取消");
      process.exit(0);
    }

    const s = p.spinner();
    s.start("创建项目结构...");

    await mkdir(rootDir, { recursive: true });
    await mkdir(join(rootDir, "manuscripts"), { recursive: true });
    await initStore(rootDir);

    const llmConfig = {
      provider: llmSetup.provider as string,
      apiKey: llmSetup.apiKey as string,
      model: llmSetup.model as string,
      ...(llmSetup.baseURL ? { baseURL: llmSetup.baseURL as string } : {}),
    };

    const config = {
      name,
      rootDir,
      userLlm: llmConfig,
      agentLlm: llmConfig,
    };

    await writeFile(
      join(rootDir, "flowcabal.json"),
      JSON.stringify(config, null, 2),
      "utf-8"
    );

    s.stop("项目创建完成");

    p.note(
      [
        `cd ${name}`,
        `flowcabal add-chapter <file>  # 添加章节`,
        `flowcabal status              # 查看状态`,
        `flowcabal generate            # 对话式创作`,
      ].join("\n"),
      "下一步"
    );

    p.outro("开始创作吧！");
  },
};
