import type { CommandModule } from "yargs";
import type { CoreMessage } from "ai";
import * as p from "@clack/prompts";
import { conversationalAgent } from "@flowcabal/engine";
import { findProjectRoot, loadConfig } from "../config.js";

export const generateCommand: CommandModule = {
  command: "generate",
  describe: "对话式创作模式（REPL）",
  handler: async () => {
    const rootDir = findProjectRoot();
    if (!rootDir) {
      p.cancel("找不到 flowcabal.json，请先运行 flowcabal init");
      process.exit(1);
    }

    const config = await loadConfig(rootDir);
    p.intro("对话式创作模式（输入 exit 退出）");

    const messages: CoreMessage[] = [];

    while (true) {
      const input = await p.text({
        message: "你",
        placeholder: "说点什么...",
      });

      if (p.isCancel(input) || input === "exit") {
        p.outro("再见！");
        break;
      }

      messages.push({ role: "user", content: input as string });

      process.stdout.write("\n助手: ");
      const gen = conversationalAgent(rootDir, config.userLlm, messages);

      let full = "";
      while (true) {
        const { value, done } = await gen.next();
        if (done) {
          full = value;
          break;
        }
        process.stdout.write(value);
        full += value;
      }
      process.stdout.write("\n\n");

      messages.push({ role: "assistant", content: full });
    }
  },
};
