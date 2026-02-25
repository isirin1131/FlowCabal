import type { CommandModule } from "yargs";
import { writeFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { existsSync } from "fs";
import * as p from "@clack/prompts";
import { initMemory, globalLlmConfigsPath } from "@flowcabal/engine";

export const initCommand: CommandModule = {
  command: "init",
  describe: "初始化当前目录为 FlowCabal 项目",
  handler: async () => {
    p.intro("FlowCabal 项目初始化");

    const rootDir = process.cwd();

    if (existsSync("flowcabal.json")) {
      p.cancel("当前目录已是 FlowCabal 项目");
      process.exit(1);
    }

    const name = await p.text({
      message: "项目名称",
      placeholder: "my-novel",
      defaultValue: "my-novel",
    });

    if (p.isCancel(name)) {
      p.cancel("已取消");
      process.exit(0);
    }

    // LLM 配置（写到全局 ~/.config/flowcabal/）
    const llmConfigPath = globalLlmConfigsPath();
    let skipLlm = false;
    if (existsSync(llmConfigPath)) {
      skipLlm = true;
      p.log.info("已检测到全局 LLM 配置，跳过");
    }

    if (!skipLlm) {
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

      const llmConfigs = {
        default: {
          provider: llmSetup.provider as string,
          apiKey: llmSetup.apiKey as string,
          model: llmSetup.model as string,
          ...(llmSetup.baseURL ? { baseURL: llmSetup.baseURL as string } : {}),
        },
      };
      await mkdir(dirname(llmConfigPath), { recursive: true });
      await writeFile(llmConfigPath, JSON.stringify(llmConfigs, null, 2), "utf-8");
    }

    const s = p.spinner();
    s.start("创建项目结构...");

    // flowcabal.json
    await writeFile(
      "flowcabal.json",
      JSON.stringify({ name: name as string }, null, 2),
      "utf-8"
    );

    // .flowcabal/memory/ 种子结构
    await initMemory(rootDir);

    s.stop("项目创建完成");

    p.note(
      [
        `flowcabal add-chapter <file>  # 添加章节`,
        `flowcabal status              # 查看状态`,
        `flowcabal generate            # 对话式创作`,
      ].join("\n"),
      "下一步"
    );

    p.outro("开始创作吧！");
  },
};
