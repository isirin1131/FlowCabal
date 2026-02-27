import { colors } from "../theme.js";

interface StreamingOutputProps {
  content: string;
  streaming?: boolean;
}

export function StreamingOutput(props: StreamingOutputProps) {
  return (
    <box flexDirection="column">
      <text content={props.content || "(无输出)"} fg={colors.text} />
      {props.streaming && <text content="▍" fg={colors.primary} />}
    </box>
  );
}
