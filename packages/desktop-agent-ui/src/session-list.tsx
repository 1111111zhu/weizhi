import type {
  DesktopAgentTrayControllerState,
  DesktopAgentTrayViewModel,
} from "@project-wing/desktop-agent/tray";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { DesktopAgentCopy } from "./copy";
import { PanelButton } from "./panel-button";
import { readSessionAction } from "./session-actions";
import type { DesktopAgentSessionAction } from "./session-actions";
import { formatRecentOpenedAt } from "./session-list-utils";
import type { DesktopAgentTheme } from "./theme";

type TraySession = DesktopAgentTrayViewModel["sessions"][number];
type RecentSession = DesktopAgentTrayViewModel["recentSessions"][number];

type SessionListProps = {
  action: DesktopAgentTrayControllerState["action"];
  attentionCount: number;
  copy: DesktopAgentCopy;
  locale?: string | undefined;
  recentSessions: RecentSession[];
  sessions: TraySession[];
  theme: DesktopAgentTheme;
  onCheckIn: (sessionId: string) => void;
  onOpenProject: (projectId: string) => void;
  onOpenProjects: () => void;
  onRecoverRelease: (sessionId: string) => void;
  onRelease: (sessionId: string) => void;
};

export function SessionList(props: SessionListProps) {
  const { copy, recentSessions, sessions, theme } = props;
  if (sessions.length === 0 && recentSessions.length === 0) {
    return (
      <EmptySessions
        copy={copy}
        onOpenProjects={props.onOpenProjects}
        theme={theme}
      />
    );
  }
  return (
    <ScrollView
      contentContainerStyle={styles.list}
      showsVerticalScrollIndicator={false}
    >
      <SectionHeader
        attentionCount={props.attentionCount}
        attentionLabel={copy.attention}
        theme={theme}
        title={copy.activeSessions}
      />
      {sessions.length > 0 ? (
        sessions.map((session) => (
          <SessionRow key={session.sessionId} {...props} session={session} />
        ))
      ) : (
        <Text style={[styles.compactEmpty, { color: theme.textMuted }]}>
          {copy.noActiveSessions}
        </Text>
      )}
      {recentSessions.length > 0 ? (
        <>
          <SectionHeader theme={theme} title={copy.recentSessions} />
          {recentSessions.map((session) => (
            <RecentSessionRow
              copy={copy}
              key={`${session.projectId}:${session.attachmentId}`}
              locale={props.locale}
              onOpenProject={props.onOpenProject}
              session={session}
              theme={theme}
            />
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

function SectionHeader({
  attentionCount = 0,
  attentionLabel,
  theme,
  title,
}: {
  attentionCount?: number;
  attentionLabel?: string;
  theme: DesktopAgentTheme;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>{title}</Text>
      {attentionCount > 0 && attentionLabel ? (
        <Text style={[styles.attention, { color: theme.warning }]}>
          {attentionCount} {attentionLabel}
        </Text>
      ) : null}
    </View>
  );
}

function SessionRow(props: SessionListProps & { session: TraySession }) {
  const { action, copy, session, theme } = props;
  const sessionAction = readSessionAction(session);
  return (
    <View style={[styles.session, { borderBottomColor: theme.border }]}>
      <View style={styles.sessionCopy}>
        <Text
          numberOfLines={1}
          style={[styles.fileName, { color: theme.text }]}
        >
          {session.fileName}
        </Text>
        <View style={styles.metaRow}>
          <Text style={[styles.meta, { color: theme.textMuted }]}>
            {copy.modes[session.mode]}
          </Text>
          <Text style={[styles.separator, { color: theme.border }]}>·</Text>
          <Text
            style={[
              styles.meta,
              {
                color: session.requiresAttention
                  ? theme.warning
                  : theme.textMuted,
              },
            ]}
          >
            {copy.statuses[session.status]}
          </Text>
        </View>
        {session.lastError ? (
          <Text
            numberOfLines={1}
            style={[styles.error, { color: theme.danger }]}
          >
            {session.lastError}
          </Text>
        ) : null}
      </View>
      {sessionAction ? (
        <PanelButton
          accessibilityLabel={readActionLabel(sessionAction, copy)}
          disabled={action !== null}
          onPress={() =>
            runSessionAction(sessionAction, session.sessionId, props)
          }
          theme={theme}
        >
          {readActionLabel(sessionAction, copy)}
        </PanelButton>
      ) : null}
    </View>
  );
}

function RecentSessionRow({
  copy,
  locale,
  onOpenProject,
  session,
  theme,
}: {
  copy: DesktopAgentCopy;
  locale?: string | undefined;
  onOpenProject: (projectId: string) => void;
  session: RecentSession;
  theme: DesktopAgentTheme;
}) {
  return (
    <Pressable
      accessibilityLabel={`${copy.openProject}: ${session.fileName}`}
      accessibilityRole="button"
      onPress={() => onOpenProject(session.projectId)}
    >
      {({ pressed }) => (
        <View
          style={[
            styles.session,
            {
              backgroundColor: pressed ? theme.surfaceMuted : theme.surface,
              borderBottomColor: theme.border,
            },
          ]}
        >
          <View style={styles.sessionCopy}>
            <Text
              numberOfLines={1}
              style={[styles.fileName, { color: theme.text }]}
            >
              {session.fileName}
            </Text>
            <View style={styles.metaRow}>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {copy.modes[session.mode]}
              </Text>
              <Text style={[styles.separator, { color: theme.border }]}>·</Text>
              <Text style={[styles.meta, { color: theme.textMuted }]}>
                {formatRecentOpenedAt(session.openedAt, locale)}
              </Text>
            </View>
          </View>
          <Text style={[styles.openProjectGlyph, { color: theme.textMuted }]}>
            ›
          </Text>
        </View>
      )}
    </Pressable>
  );
}

function EmptySessions({
  copy,
  onOpenProjects,
  theme,
}: Pick<SessionListProps, "copy" | "onOpenProjects" | "theme">) {
  return (
    <View style={styles.empty}>
      <Text style={[styles.emptyTitle, { color: theme.text }]}>
        {copy.noSessions}
      </Text>
      <Text style={[styles.emptyDetail, { color: theme.textMuted }]}>
        {copy.noSessionsDetail}
      </Text>
      <View style={styles.emptyAction}>
        <PanelButton
          accessibilityLabel={copy.openProjects}
          onPress={onOpenProjects}
          theme={theme}
          variant="primary"
        >
          {copy.openProjects}
        </PanelButton>
      </View>
      <Text style={[styles.emptyHint, { color: theme.textMuted }]}>
        {copy.automaticSessionHint}
      </Text>
    </View>
  );
}

function readActionLabel(
  action: DesktopAgentSessionAction,
  copy: DesktopAgentCopy
) {
  if (action === "CHECK_IN") {
    return copy.checkIn;
  }
  if (action === "RECOVER_RELEASE") {
    return copy.recoverRelease;
  }
  return copy.release;
}

function runSessionAction(
  action: DesktopAgentSessionAction,
  sessionId: string,
  props: SessionListProps
) {
  if (action === "CHECK_IN") {
    props.onCheckIn(sessionId);
  } else if (action === "RECOVER_RELEASE") {
    props.onRecoverRelease(sessionId);
  } else {
    props.onRelease(sessionId);
  }
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 18, paddingBottom: 12 },
  sectionHeader: {
    minHeight: 36,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
  },
  sectionTitle: { fontSize: 12, fontWeight: "700", letterSpacing: 0.2 },
  attention: { fontSize: 10, fontWeight: "600" },
  compactEmpty: { paddingBottom: 12, paddingTop: 4, fontSize: 11 },
  session: {
    minHeight: 70,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
  },
  sessionCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
  fileName: { fontSize: 13, fontWeight: "600" },
  metaRow: { marginTop: 5, flexDirection: "row", alignItems: "center" },
  meta: { fontSize: 11, fontWeight: "500" },
  separator: { marginHorizontal: 5, fontSize: 11 },
  error: { marginTop: 4, fontSize: 10 },
  openProjectGlyph: { fontSize: 24, fontWeight: "400" },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 36,
    paddingBottom: 18,
  },
  emptyTitle: { fontSize: 15, fontWeight: "700", textAlign: "center" },
  emptyDetail: {
    marginTop: 6,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  emptyAction: { marginTop: 18 },
  emptyHint: {
    marginTop: 12,
    fontSize: 10,
    lineHeight: 15,
    textAlign: "center",
  },
});
