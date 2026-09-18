import type { DesktopAgentTrayState } from "@project-wing/desktop-agent/tray";
import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { DesktopAgentCopy } from "./copy";
import { STATUS_ACTION_WIDTH } from "./status-header-layout";
import type { DesktopAgentTheme } from "./theme";
import type { DesktopAgentWindowControls } from "./window-controls";

type StatusHeaderProps = {
  copy: DesktopAgentCopy;
  refreshing: boolean;
  state: DesktopAgentTrayState;
  theme: DesktopAgentTheme;
  onRefresh: () => void;
  windowControls?: DesktopAgentWindowControls | undefined;
};

export function StatusHeader({
  copy,
  refreshing,
  state,
  theme,
  onRefresh,
  windowControls,
}: StatusHeaderProps) {
  const stateColor = readStateColor(state, theme);
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);

  return (
    <View style={[styles.header, { borderBottomColor: theme.border }]}>
      <View style={styles.titleRow}>
        <View style={styles.brandRow}>
          <View style={[styles.mark, { backgroundColor: theme.accent }]}>
            <Text style={[styles.markText, { color: theme.accentText }]}>
              W
            </Text>
          </View>
          <View style={styles.identity}>
            <Text style={[styles.product, { color: theme.text }]}>
              {copy.productName}
            </Text>
            <Text style={[styles.panelName, { color: theme.textMuted }]}>
              {copy.panelName}
            </Text>
          </View>
        </View>
        {windowControls ? (
          <WindowButtons copy={copy} controls={windowControls} theme={theme} />
        ) : null}
      </View>
      <Pressable
        accessibilityLabel={copy.refresh}
        accessibilityRole="button"
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
        disabled={refreshing}
        onBlur={() => setFocused(false)}
        onFocus={() => setFocused(true)}
        onHoverIn={() => setHovered(true)}
        onHoverOut={() => setHovered(false)}
        onPress={onRefresh}
      >
        {({ pressed }) => (
          <View
            style={[
              styles.statusAction,
              {
                backgroundColor: hovered
                  ? theme.surfaceHover
                  : theme.surfaceMuted,
                borderColor: focused ? stateColor : theme.border,
                opacity: pressed ? 0.76 : 1,
              },
            ]}
          >
            <View style={[styles.statusDot, { backgroundColor: stateColor }]} />
            <Text
              numberOfLines={1}
              style={[styles.status, { color: stateColor }]}
            >
              {copy.states[state]}
            </Text>
            <View style={styles.refreshSlot}>
              {refreshing ? (
                <ActivityIndicator color={stateColor} size="small" />
              ) : (
                <Text style={[styles.refreshGlyph, { color: theme.textMuted }]}>
                  ↻
                </Text>
              )}
            </View>
          </View>
        )}
      </Pressable>
    </View>
  );
}

function WindowButtons({
  copy,
  controls,
  theme,
}: {
  copy: DesktopAgentCopy;
  controls: DesktopAgentWindowControls;
  theme: DesktopAgentTheme;
}) {
  const maximizeLabel = controls.isMaximized
    ? copy.restoreWindow
    : copy.maximizeWindow;
  const handleMinimize = controls.onMinimize;
  const handleToggleMaximize = controls.onToggleMaximize;
  const handleClose = controls.onClose;
  return (
    <View style={styles.windowButtons}>
      <WindowButton
        glyph="—"
        label={copy.minimizeWindow}
        onPress={handleMinimize}
        theme={theme}
      />
      <WindowButton
        glyph={controls.isMaximized ? "❐" : "□"}
        label={maximizeLabel}
        onPress={handleToggleMaximize}
        theme={theme}
      />
      <WindowButton
        close
        glyph="×"
        label={copy.closeWindow}
        onPress={handleClose}
        theme={theme}
      />
    </View>
  );
}

function WindowButton({
  close,
  glyph,
  label,
  onPress,
  theme,
}: {
  close?: boolean;
  glyph: string;
  label: string;
  onPress: () => void;
  theme: DesktopAgentTheme;
}) {
  const [focused, setFocused] = useState(false);
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onBlur={() => setFocused(false)}
      onFocus={() => setFocused(true)}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      onPress={onPress}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.windowButton,
            {
              backgroundColor:
                close && hovered
                  ? theme.danger
                  : hovered
                    ? theme.surfaceHover
                    : "transparent",
              borderColor: focused ? theme.accent : "transparent",
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Text
            style={[
              styles.windowGlyph,
              { color: close && hovered ? theme.accentText : theme.text },
            ]}
          >
            {glyph}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function readStateColor(
  state: DesktopAgentTrayState,
  theme: DesktopAgentTheme
) {
  if (state === "READY") {
    return theme.success;
  }
  if (state === "ATTENTION" || state === "PAIR_REQUIRED") {
    return theme.warning;
  }
  if (state === "FAILED" || state === "OFFLINE") {
    return theme.danger;
  }
  return theme.textMuted;
}

const styles = StyleSheet.create({
  header: {
    minHeight: 102,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  titleRow: {
    height: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  brandRow: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  mark: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  markText: { fontSize: 17, fontWeight: "800" },
  identity: { marginLeft: 10, flexShrink: 1 },
  product: { fontSize: 14, fontWeight: "700" },
  panelName: { marginTop: 1, fontSize: 11, fontWeight: "500" },
  statusAction: {
    width: STATUS_ACTION_WIDTH,
    height: 38,
    alignSelf: "flex-end",
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  status: { flexShrink: 1, marginLeft: 7, fontSize: 12, fontWeight: "700" },
  refreshSlot: {
    width: 18,
    height: 20,
    marginLeft: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  refreshGlyph: { fontSize: 16, fontWeight: "700" },
  windowButtons: { flexDirection: "row", alignItems: "center" },
  windowButton: {
    width: 28,
    height: 28,
    marginLeft: 2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 5,
  },
  windowGlyph: { fontSize: 17, fontWeight: "500", lineHeight: 19 },
});
