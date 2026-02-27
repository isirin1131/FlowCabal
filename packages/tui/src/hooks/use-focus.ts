import { useState, useCallback } from "react";

export type FocusTarget = "sidebar" | "main" | "command" | "input";

export function useFocus(initial: FocusTarget = "sidebar") {
  const [current, setCurrent] = useState<FocusTarget>(initial);
  const [previous, setPrevious] = useState<FocusTarget>(initial);

  const focus = useCallback(
    (target: FocusTarget) => {
      setPrevious(current);
      setCurrent(target);
    },
    [current],
  );

  const focusSidebar = useCallback(() => focus("sidebar"), [focus]);
  const focusMain = useCallback(() => focus("main"), [focus]);
  const focusCommand = useCallback(() => focus("command"), [focus]);
  const focusInput = useCallback(() => focus("input"), [focus]);

  const goBack = useCallback(() => {
    setCurrent(previous);
  }, [previous]);

  return {
    current,
    previous,
    focus,
    focusSidebar,
    focusMain,
    focusCommand,
    focusInput,
    goBack,
  };
}
