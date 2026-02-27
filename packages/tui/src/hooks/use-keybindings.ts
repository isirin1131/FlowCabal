import { useKeyboard } from "@opentui/react";
import type { ViewId } from "../theme.js";
import { viewKeys } from "../theme.js";
import type { FocusTarget } from "./use-focus.js";

interface KeybindingsOptions {
  activeView: ViewId;
  setActiveView: (view: ViewId) => void;
  focusCurrent: FocusTarget;
  focusSidebar: () => void;
  focusMain: () => void;
  focusCommand: () => void;
  goBack: () => void;
  onRun?: () => void;
  onStep?: () => void;
  onQuit?: () => void;
}

export function useKeybindings(opts: KeybindingsOptions) {
  useKeyboard((key) => {
    // 命令模式和输入焦点下不拦截快捷键
    if (opts.focusCurrent === "command" || opts.focusCurrent === "input") {
      if (key.name === "escape") {
        opts.goBack();
      }
      return;
    }

    // 视图切换：1-5
    const num = parseInt(key.name ?? "", 10);
    if (num >= 1 && num <= 5) {
      opts.setActiveView(viewKeys[num - 1]);
      return;
    }

    // 面板焦点
    if (key.name === "h") {
      opts.focusSidebar();
      return;
    }
    if (key.name === "l") {
      opts.focusMain();
      return;
    }
    if (key.name === "tab") {
      if (opts.focusCurrent === "sidebar") opts.focusMain();
      else opts.focusSidebar();
      return;
    }

    // 命令模式
    if (key.name === ":") {
      opts.focusCommand();
      return;
    }

    // Esc
    if (key.name === "escape") {
      opts.goBack();
      return;
    }

    // 运行
    if (key.name === "r" && opts.onRun) {
      opts.onRun();
      return;
    }
    if (key.name === "s" && opts.onStep) {
      opts.onStep();
      return;
    }
  });
}
