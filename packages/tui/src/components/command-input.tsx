import { colors } from "../theme.js";

interface CommandInputProps {
  onSubmit: (command: string) => void;
  onCancel: () => void;
}

export function CommandInput(props: CommandInputProps) {
  return (
    <box height={1} width="100%" backgroundColor={colors.bg}>
      <text content=":" fg={colors.primary} />
      <input
        placeholder=""
        focused={true}
        onSubmit={(value) => {
          if (typeof value === "string") props.onSubmit(value);
        }}
      />
    </box>
  );
}
