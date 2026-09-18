import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import type { DesktopAgentTheme } from "./theme";

type PanelButtonProps = {
  accessibilityLabel: string;
  children: ReactNode;
  disabled?: boolean;
  onPress: () => void;
  theme: DesktopAgentTheme;
  variant?: "primary" | "secondary" | "quiet";
};

export function PanelButton({
  accessibilityLabel,
  children,
  disabled = false,
  onPress,
  theme,
  variant = "secondary",
}: PanelButtonProps) {
  const primary = variant === "primary";
  const quiet = variant === "quiet";
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        quiet && styles.quiet,
        {
          backgroundColor: quiet
            ? "transparent"
            : primary
              ? theme.accent
              : theme.surfaceMuted,
          borderColor: quiet
            ? "transparent"
            : primary
              ? theme.accent
              : theme.border,
          opacity: disabled ? 0.5 : pressed ? 0.78 : 1,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: primary ? theme.accentText : theme.text },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 34,
    minWidth: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
  },
  quiet: {
    minWidth: 36,
    paddingHorizontal: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.1,
  },
});
