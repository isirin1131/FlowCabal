import { colors } from "../theme.js";

interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  label?: string;
}

export function ProgressBar(props: ProgressBarProps) {
  const { current, total, width = 20, label } = props;
  const ratio = total > 0 ? Math.min(current / total, 1) : 0;
  const filled = Math.round(ratio * width);
  const empty = width - filled;
  const bar = "█".repeat(filled) + "░".repeat(empty);
  const text = label ?? `${current}/${total}`;

  return (
    <box flexDirection="row">
      <text content={bar} fg={colors.primary} />
      <text content={` ${text}`} fg={colors.textDim} />
    </box>
  );
}
