import type {
  DesktopAgentCheckInResponse,
  DesktopAgentDeviceAuthStatusResponse,
  DesktopAgentHealthResponse,
  DesktopAgentRecentSession,
  DesktopAgentReleaseResponse,
  DesktopAgentSession,
  DesktopAgentUpdateResponse,
  DesktopAgentUpdateStatusResponse,
} from "@project-wing/shared";

const VERSION_PATTERN = /^\d+\.\d+\.\d+(?:[-+].*)?$/;
const AGENT_STATES = new Set([
  "NOT_INSTALLED",
  "STARTING",
  "READY",
  "UPDATING",
  "RESTORING",
  "READY_WITH_ATTENTION",
  "DEGRADED_NEEDS_ATTENTION",
  "FAILED",
]);
const RUNTIME_UPDATE_STATES = new Set([
  "IDLE",
  "UPDATE_REQUESTED",
  "PREPARING_AGENT",
  "SNAPSHOT_RECEIVED",
  "STOPPING_AGENT",
  "AGENT_STOPPED",
  "STAGING_PAYLOAD",
  "VERIFYING_PAYLOAD",
  "SWITCHING_ACTIVE_VERSION",
  "STARTING_AGENT",
  "RESTORING_AGENT",
  "VERIFYING_READY",
  "READY",
  "FAILED",
]);
const RESTORE_STATES = new Set([
  "NOT_STARTED",
  "READY",
  "READY_WITH_ATTENTION",
  "DEGRADED_NEEDS_ATTENTION",
  "FAILED",
]);
const UPDATE_STATUSES = new Set([
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
  "READY",
  "FAILED",
]);
const SESSION_MODES = new Set(["MASTER", "READ_ONLY"]);
const SESSION_STATUSES = new Set([
  "OPEN_UNCHANGED",
  "DIRTY_PENDING_CHECKIN",
  "CHECKING_IN",
  "CHECKIN_FAILED",
  "RELEASE_PENDING",
  "RELEASING",
  "RELEASE_FAILED",
  "CLEANUP_PENDING",
  "CLEANUP_FAILED",
  "LOCAL_FILE_MISSING",
  "CONFLICT_RISK",
  "LOCK_REVOKED",
  "CLOSED",
]);
const LIFECYCLE_STATES = new Set([
  "LAUNCHING",
  "OPEN",
  "OPEN_NOT_OBSERVED",
  "LAUNCH_FAILED",
  "CLOSE_DETECTED",
  "CHECKING_IN",
  "CHECKIN_FAILED",
  "RELEASE_PENDING",
  "RELEASING",
  "RELEASE_FAILED",
  "CLEANUP_PENDING",
  "CLEANUP_FAILED",
  "CLOSED",
  "LOCAL_FILE_MISSING",
  "CONFLICT_RISK",
  "LOCK_REVOKED",
]);
const CONTENT_STATES = new Set(["UNCHANGED", "DIRTY", "UPLOADED", "MISSING"]);

export function parseHealth(value: unknown): DesktopAgentHealthResponse {
  const record = requireOkRecord(value);
  const app = readEnum(
    record,
    "app",
    new Set(["project-wing-desktop-agent", "project-wing-desktop-runtime"])
  );
  readVersion(record, "version");
  if (app === "project-wing-desktop-runtime") {
    requireManagedHealth(record);
  }
  return record as DesktopAgentHealthResponse;
}

export function parseAuthStatus(
  value: unknown
): DesktopAgentDeviceAuthStatusResponse {
  const record = requireOkRecord(value);
  if (
    typeof record.authenticated !== "boolean" ||
    typeof record.pairing !== "boolean"
  ) {
    throw invalidResponse();
  }
  return record as DesktopAgentDeviceAuthStatusResponse;
}

export function parseSessionsResponse(value: unknown): {
  ok: true;
  sessions: DesktopAgentSession[];
  recentSessions: DesktopAgentRecentSession[];
} {
  const record = requireOkRecord(value);
  if (!Array.isArray(record.sessions)) {
    throw invalidResponse();
  }
  for (const session of record.sessions) {
    requireSession(session);
  }
  const recentSessions = record.recentSessions ?? [];
  if (!Array.isArray(recentSessions)) {
    throw invalidResponse();
  }
  for (const session of recentSessions) {
    requireRecentSession(session);
  }
  return {
    ok: true,
    sessions: record.sessions as DesktopAgentSession[],
    recentSessions: recentSessions as DesktopAgentRecentSession[],
  };
}

export function parseUpdateStatus(
  value: unknown
): DesktopAgentUpdateStatusResponse {
  const record = requireOkRecord(value);
  readEnum(record, "status", UPDATE_STATUSES);
  return record as DesktopAgentUpdateStatusResponse;
}

export function parseUpdateResponse(
  value: unknown
): DesktopAgentUpdateResponse {
  return parseUpdateStatus(value) as DesktopAgentUpdateResponse;
}

export function parseCheckInResponse(
  value: unknown
): DesktopAgentCheckInResponse {
  const record = requireOkRecord(value);
  requireSession(record.session);
  return record as DesktopAgentCheckInResponse;
}

export function parseReleaseResponse(
  value: unknown
): DesktopAgentReleaseResponse {
  const record = requireOkRecord(value);
  requireSession(record.session);
  return record as DesktopAgentReleaseResponse;
}

export function readRuntimeError(value: unknown) {
  const record = readRecord(value);
  if (
    record?.ok !== false ||
    typeof record.code !== "string" ||
    typeof record.message !== "string"
  ) {
    return null;
  }
  return { code: record.code, message: record.message };
}

function requireManagedHealth(record: Record<string, unknown>) {
  readVersion(record, "managerVersion");
  if (record.agentVersion !== undefined) {
    readVersion(record, "agentVersion");
  }
  if (record.requiredAgentVersion !== undefined) {
    readVersion(record, "requiredAgentVersion");
  }
  readEnum(record, "agentState", AGENT_STATES);
  readEnum(record, "updateState", RUNTIME_UPDATE_STATES);
  readEnum(record, "restoreState", RESTORE_STATES);
  if (
    !Number.isInteger(record.attentionCount) ||
    Number(record.attentionCount) < 0
  ) {
    throw invalidResponse();
  }
  if (
    record.quarantineCount !== undefined &&
    (!Number.isInteger(record.quarantineCount) ||
      Number(record.quarantineCount) < 0)
  ) {
    throw invalidResponse();
  }
}

function requireSession(value: unknown) {
  const session = readRecord(value);
  if (!session) {
    throw invalidResponse();
  }
  for (const key of [
    "sessionId",
    "projectId",
    "attachmentId",
    "fileName",
    "localPath",
    "originalHash",
    "lastKnownHash",
    "openedAt",
    "launchStartedAt",
    "lastSeenAt",
  ]) {
    readRequiredString(session, key);
  }
  if (!Number.isInteger(session.generation) || Number(session.generation) < 1) {
    throw invalidResponse();
  }
  readEnum(session, "mode", SESSION_MODES);
  readEnum(session, "status", SESSION_STATUSES);
  readEnum(session, "lifecycleState", LIFECYCLE_STATES);
  readEnum(session, "contentState", CONTENT_STATES);
}

function requireRecentSession(value: unknown) {
  const session = readRecord(value);
  if (!session) {
    throw invalidResponse();
  }
  for (const key of [
    "projectId",
    "attachmentId",
    "fileName",
    "openedAt",
    "closedAt",
  ]) {
    readRequiredString(session, key);
  }
  readEnum(session, "mode", SESSION_MODES);
}

function requireOkRecord(value: unknown) {
  const record = readRecord(value);
  if (record?.ok !== true) {
    throw invalidResponse();
  }
  return record;
}

function readVersion(record: Record<string, unknown>, key: string) {
  const version = readRequiredString(record, key);
  if (!VERSION_PATTERN.test(version)) {
    throw invalidResponse();
  }
  return version;
}

function readEnum(
  record: Record<string, unknown>,
  key: string,
  values: ReadonlySet<string>
) {
  const value = readRequiredString(record, key);
  if (!values.has(value)) {
    throw invalidResponse();
  }
  return value;
}

function readRequiredString(record: Record<string, unknown>, key: string) {
  const value = record[key];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw invalidResponse();
  }
  return value;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function invalidResponse() {
  return new Error("Desktop Agent runtime returned an invalid response.");
}
