import type { DesktopAgentSession } from "@project-wing/shared";

import type { DesktopAgentRuntimeSnapshot } from "./runtime-client.js";

const ATTENTION_SESSION_STATUSES = new Set<DesktopAgentSession["status"]>([
  "CHECKIN_FAILED",
  "RELEASE_FAILED",
  "CLEANUP_FAILED",
  "LOCAL_FILE_MISSING",
  "CONFLICT_RISK",
  "LOCK_REVOKED",
]);
const ACTIVE_UPDATE_STATUSES = new Set([
  "STARTED",
  "IN_PROGRESS",
  "WAITING_FOR_WORKBOOK_CLOSE",
  "CHECKING_IN",
  "RELEASING",
  "RELEASING_SESSIONS",
  "DOWNLOADING",
  "VERIFYING_INSTALLER",
  "STOPPING_AGENT",
  "REPAIRING_ENVIRONMENT",
  "INSTALLING",
  "STARTING_AGENT",
  "RESTARTING",
  "VERIFYING_HEALTH",
]);

export type DesktopAgentTrayState =
  | "OFFLINE"
  | "STARTING"
  | "PAIR_REQUIRED"
  | "PAIRING"
  | "READY"
  | "UPDATING"
  | "ATTENTION"
  | "FAILED";

export type DesktopAgentTrayViewModel = {
  state: DesktopAgentTrayState;
  version: string | null;
  requiredVersion: string | null;
  authenticated: boolean;
  attentionCount: number;
  updateStatus: string | null;
  errors: string[];
  sessions: {
    sessionId: string;
    projectId: string;
    attachmentId: string;
    fileName: string;
    mode: DesktopAgentSession["mode"];
    status: DesktopAgentSession["status"];
    lifecycleState: DesktopAgentSession["lifecycleState"];
    contentState: DesktopAgentSession["contentState"];
    lastError: string | null;
    openedAt: string;
    requiresAttention: boolean;
  }[];
  recentSessions: {
    projectId: string;
    attachmentId: string;
    fileName: string;
    mode: DesktopAgentSession["mode"];
    openedAt: string;
    closedAt: string;
  }[];
};

export function buildDesktopAgentTrayViewModel(
  snapshot: DesktopAgentRuntimeSnapshot
): DesktopAgentTrayViewModel {
  const sessions = snapshot.sessions
    .map((session) => ({
      sessionId: session.sessionId,
      projectId: session.projectId,
      attachmentId: session.attachmentId,
      fileName: session.fileName,
      mode: session.mode,
      status: session.status,
      lifecycleState: session.lifecycleState,
      contentState: session.contentState,
      lastError: session.lastError ?? null,
      openedAt: session.openedAt,
      requiresAttention:
        ATTENTION_SESSION_STATUSES.has(session.status) ||
        session.lifecycleState === "LAUNCH_FAILED",
    }))
    .sort((left, right) =>
      compareTimestampDescending(left.openedAt, right.openedAt)
    );
  const activeFileKeys = new Set(
    sessions.map((session) => fileKey(session.projectId, session.attachmentId))
  );
  const recentSessions = (snapshot.recentSessions ?? [])
    .filter(
      (session) =>
        !activeFileKeys.has(fileKey(session.projectId, session.attachmentId))
    )
    .sort((left, right) =>
      compareTimestampDescending(left.openedAt, right.openedAt)
    );
  const localAttentionCount = sessions.filter(
    (session) => session.requiresAttention
  ).length;
  const managedAttentionCount =
    snapshot.health?.app === "project-wing-desktop-runtime"
      ? snapshot.health.attentionCount
      : 0;
  const attentionCount = Math.max(localAttentionCount, managedAttentionCount);

  return {
    state: deriveTrayState(snapshot, attentionCount),
    version: snapshot.health?.version ?? null,
    requiredVersion:
      snapshot.health?.app === "project-wing-desktop-runtime"
        ? (snapshot.health.requiredAgentVersion ?? null)
        : null,
    authenticated: snapshot.auth?.authenticated ?? false,
    attentionCount,
    updateStatus: snapshot.update?.status ?? null,
    errors: snapshot.errors,
    sessions,
    recentSessions,
  };
}

function fileKey(projectId: string, attachmentId: string) {
  return `${projectId}\u0000${attachmentId}`;
}

function compareTimestampDescending(left: string, right: string) {
  return Date.parse(right) - Date.parse(left);
}

function deriveTrayState(
  snapshot: DesktopAgentRuntimeSnapshot,
  attentionCount: number
): DesktopAgentTrayState {
  if (!snapshot.health) {
    return "OFFLINE";
  }
  if (isFailed(snapshot)) {
    return "FAILED";
  }
  if (snapshot.update && ACTIVE_UPDATE_STATUSES.has(snapshot.update.status)) {
    return "UPDATING";
  }
  if (
    snapshot.health.app === "project-wing-desktop-runtime" &&
    ["NOT_INSTALLED", "STARTING", "RESTORING"].includes(
      snapshot.health.agentState
    )
  ) {
    return "STARTING";
  }
  if (snapshot.auth?.pairing) {
    return "PAIRING";
  }
  if (
    snapshot.update?.status === "FAILED" ||
    attentionCount > 0 ||
    snapshot.errors.length > 0
  ) {
    return "ATTENTION";
  }
  if (!snapshot.auth?.authenticated) {
    return "PAIR_REQUIRED";
  }
  return "READY";
}

function isFailed(snapshot: DesktopAgentRuntimeSnapshot) {
  return (
    snapshot.health?.app === "project-wing-desktop-runtime" &&
    snapshot.health.agentState === "FAILED"
  );
}
