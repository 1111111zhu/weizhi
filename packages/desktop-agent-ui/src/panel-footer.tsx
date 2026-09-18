import type {
  DesktopAgentTrayControllerState,
  DesktopAgentTrayViewModel,
} from "@project-wing/desktop-agent/tray";
import { StyleSheet, Text, View } from "react-native";

import type { DesktopAgentCopy } from "./copy";
import { PanelButton } from "./panel-button";
import type { DesktopAgentTheme } from "./theme";

type PanelFooterProps = {
  action: DesktopAgentTrayControllerState["action"];
  copy: DesktopAgentCopy;
  theme: DesktopAgentTheme;
  viewModel: DesktopAgentTrayViewModel;
  onUpdate: (expectedVersion?: string) => void;
};

export function PanelFooter({
  action,
  copy,
  onUpdate,
  theme,
  viewModel,
}: PanelFooterProps) {
  const updateAvailable = Boolean(
    viewModel.requiredVersion && viewModel.requiredVersion !== viewModel.version
  );
  return (
    <View style={[styles.footer, { borderTopColor: theme.border }]}>
      <Text style={[styles.version, { color: theme.textMuted }]}>
        {copy.version} {viewModel.version ?? "—"}
      </Text>
      {updateAvailable || viewModel.state === "FAILED" ? (
        <PanelButton
          accessibilityLabel={copy.update}
          disabled={action !== null || viewModel.state === "UPDATING"}
          onPress={() => onUpdate(viewModel.requiredVersion ?? undefined)}
          theme={theme}
          variant="primary"
        >
          {viewModel.state === "UPDATING" ? copy.updating : copy.update}
        </PanelButton>
      ) : (
        <Text style={[styles.updated, { color: theme.textMuted }]}>
          {copy.lastUpdated}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
  },
  version: { fontSize: 10, fontWeight: "500" },
  updated: { fontSize: 10 },
});
