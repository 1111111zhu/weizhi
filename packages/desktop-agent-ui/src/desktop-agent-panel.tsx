import type {
  DesktopAgentTrayControllerState,
  DesktopAgentTrayViewModel,
} from "@project-wing/desktop-agent/tray";
import { StyleSheet, Text, View } from "react-native";

import { resolveDesktopAgentCopy } from "./copy";
import type { DesktopAgentCopy } from "./copy";
import { PanelFooter } from "./panel-footer";
import { SessionList } from "./session-list";
import { StatusHeader } from "./status-header";
import { darkTheme, lightTheme } from "./theme";
import type { DesktopAgentTheme } from "./theme";
import type { DesktopAgentWindowControls } from "./window-controls";

export type DesktopAgentPanelProps = {
  action: DesktopAgentTrayControllerState["action"];
  actionError: string | null;
  colorScheme: "dark" | "light";
  locale?: string;
  refreshing: boolean;
  viewModel: DesktopAgentTrayViewModel;
  onCheckIn: (sessionId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenProjects: () => void;
  onRecoverRelease: (sessionId: string) => void;
  onRefresh: () => void;
  onRelease: (sessionId: string) => void;
  onUpdate: (expectedVersion?: string) => void;
  windowControls?: DesktopAgentWindowControls | undefined;
};

export function DesktopAgentPanel(props: DesktopAgentPanelProps) {
  const copy = resolveDesktopAgentCopy(props.locale);
  const theme = props.colorScheme === "dark" ? darkTheme : lightTheme;
  return <PanelLayout {...props} copy={copy} theme={theme} />;
}

type PanelLayoutProps = DesktopAgentPanelProps & {
  copy: DesktopAgentCopy;
  theme: DesktopAgentTheme;
};

function PanelLayout(props: PanelLayoutProps) {
  const { copy, refreshing, theme, viewModel } = props;
  return (
    <View style={[styles.root, { backgroundColor: theme.surface }]}>
      <View style={[styles.panel, { backgroundColor: theme.surface }]}>
        <StatusHeader
          copy={copy}
          onRefresh={props.onRefresh}
          refreshing={refreshing}
          state={viewModel.state}
          theme={theme}
          windowControls={props.windowControls}
        />
        <PanelMessages {...props} />
        <SessionSection {...props} />
        <PanelFooter {...props} />
      </View>
    </View>
  );
}

function PanelMessages({
  actionError,
  copy,
  theme,
  viewModel,
}: PanelLayoutProps) {
  const hint = readStateHint(viewModel.state, copy);
  return (
    <>
      {hint ? (
        <View style={[styles.notice, { backgroundColor: theme.surfaceMuted }]}>
          <Text style={[styles.noticeText, { color: theme.textMuted }]}>
            {hint}
          </Text>
        </View>
      ) : null}
      {actionError ? (
        <View
          style={[styles.errorBanner, { backgroundColor: theme.dangerSurface }]}
        >
          <Text style={[styles.errorTitle, { color: theme.danger }]}>
            {copy.actionFailed}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.errorCode, { color: theme.danger }]}
          >
            {actionError}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function SessionSection(props: PanelLayoutProps) {
  const { action, copy, theme, viewModel } = props;
  return (
    <View style={styles.sessions}>
      <SessionList
        action={action}
        attentionCount={viewModel.attentionCount}
        copy={copy}
        locale={props.locale}
        onCheckIn={props.onCheckIn}
        onOpenProject={props.onOpenProject}
        onOpenProjects={props.onOpenProjects}
        onRecoverRelease={props.onRecoverRelease}
        onRelease={props.onRelease}
        recentSessions={viewModel.recentSessions}
        sessions={viewModel.sessions}
        theme={theme}
      />
    </View>
  );
}

function readStateHint(
  state: DesktopAgentTrayViewModel["state"],
  copy: ReturnType<typeof resolveDesktopAgentCopy>
) {
  if (state === "PAIR_REQUIRED" || state === "PAIRING") {
    return copy.pairHint;
  }
  if (state === "OFFLINE" || state === "STARTING") {
    return copy.offlineHint;
  }
  if (state === "FAILED") {
    return copy.failedHint;
  }
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  panel: {
    flex: 1,
    overflow: "hidden",
  },
  notice: { marginHorizontal: 18, marginTop: 12, borderRadius: 8, padding: 10 },
  noticeText: { fontSize: 11, lineHeight: 16 },
  errorBanner: {
    marginHorizontal: 18,
    marginTop: 12,
    borderRadius: 8,
    padding: 10,
  },
  errorTitle: { fontSize: 11, fontWeight: "700" },
  errorCode: { marginTop: 3, fontSize: 10 },
  sessions: { flex: 1 },
});
