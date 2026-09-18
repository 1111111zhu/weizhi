import { getDesktopAgentCompatibilityStatus } from "@project-wing/shared/desktop";
import type {
  DesktopAgentCheckInRequest,
  DesktopAgentSession,
  DesktopAgentSessionContentState,
} from "@project-wing/shared/desktop";

import { checkInDesktopSession as defaultCheckInDesktopSession } from "./check-in-service.js";
import {
  getApiBaseUrl,
  getMasterOpenObservationTimeoutMs,
  getPdfMasterOpenObservationTimeoutMs,
} from "./config.js";
import { DesktopAgentError } from "./errors.js";
import { fetchWithDesktopAgentTimeout } from "./fetch-timeout.js";
import { probeLocalFileState as defaultProbeLocalFileState } from "./file-busy.js";
import type { LocalFileProbeResult } from "./file-busy.js";
import { buildMasterCheckInRequest } from "./master-callbacks.js";
import {
  getMasterOpenObservationTimeoutMessage,
  getMasterOpenObservationTimeoutMsForFileName,
} from "./master-open-observation.js";
import {
  createSessionStore,
  hashFile as defaultHashFile,
} from "./session-store.js";

type DesktopAgentHeartbeatRequest = {
  session: DesktopAgentSession;
  heartbeatUrl: string;
};
type LocalFileProbe = (
  session: DesktopAgentSession
) => Promise<LocalFileProbeResult>;
type HashLocalFile = (filePath: string) => Promise<string>;
type SessionStore = {
  refresh: () => Promise<DesktopAgentSession[]>;
  list?: () => Promise<DesktopAgentSession[]>;
  get?: (sessionId: string) => Promise<DesktopAgentSession | null>;
  update?: (
    sessionId: string,
    patch: Partial<DesktopAgentSession>
  ) => Promise<DesktopAgentSession | null>;
  updateIf?: (
    sessionId: string,
    predicate: (session: DesktopAgentSession) => boolean,
    patch: Partial<DesktopAgentSession>
  ) => Promise<DesktopAgentSession | null>;
};

export type SessionMonitorOptions = {
  sessionStore?: SessionStore;
  checkInDesktopSession?: (
    request: DesktopAgentCheckInRequest
  ) => Promise<unknown>;
  localFileProbe?: LocalFileProbe;
  isLocalFileBusy?: (session: DesktopAgentSession) => Promise<boolean>;
  hashLocalFile?: HashLocalFile;
  heartbeatDesktopSession?: (
    request: DesktopAgentHeartbeatRequest
  ) => Promise<unknown>;
  apiBaseUrl?: string;
  intervalMs?: number;
  heartbeatIntervalMs?: number;
  closeConfirmationCount?: number;
  openObservationTimeoutMs?: number;
  retryDelaysMs?: number[];
  now?: () => Date;
};

const DEFAULT_CLOSE_CONFIRMATION_COUNT = 1;
const DEFAULT_HEARTBEAT_INTERVAL_MS = 5000;
const DEFAULT_INTERVAL_MS = 1000;
const DEFAULT_RETRY_DELAYS_MS = [5000, 15_000, 30_000, 60_000];

export function startSessionMonitor(options: SessionMonitorOptions = {}) {
  const sessionStore = options.sessionStore ?? createSessionStore();
  const checkInDesktopSession =
    options.checkInDesktopSession ?? defaultCheckInDesktopSession;
  const heartbeatDesktopSession =
    options.heartbeatDesktopSession ?? defaultHeartbeatDesktopSession;
  const localFileProbe =
    options.localFileProbe ?? makeLegacyLocalFileProbe(options.isLocalFileBusy);
  const hashLocalFile = options.hashLocalFile ?? defaultHashFile;
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? getApiBaseUrl());
  const intervalMs = options.intervalMs ?? DEFAULT_INTERVAL_MS;
  const heartbeatIntervalMs =
    options.heartbeatIntervalMs ?? DEFAULT_HEARTBEAT_INTERVAL_MS;
  const closeConfirmationCount =
    options.closeConfirmationCount ?? DEFAULT_CLOSE_CONFIRMATION_COUNT;
  const openObservationTimeoutMs =
    options.openObservationTimeoutMs ?? getMasterOpenObservationTimeoutMs();
  const pdfOpenObservationTimeoutMs =
    options.openObservationTimeoutMs ?? getPdfMasterOpenObservationTimeoutMs();
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
  const now = options.now ?? (() => new Date());
  let isRefreshing = false;
  const inFlightSessionIds = new Set<string>();
  const inFlightHeartbeatSessionIds = new Set<string>();
  const inFlightObservationSessionIds = new Set<string>();
  const lastHeartbeatTimes = new Map<string, number>();
  const closedConfirmationCounts = new Map<string, number>();
  const refresh = async () => {
    if (isRefreshing) {
      return;
    }
    isRefreshing = true;
    try {
      const sessions = sessionStore.list
        ? await sessionStore.list()
        : await sessionStore.refresh();
      await retrySessions({
        sessions,
        checkInDesktopSession,
        heartbeatDesktopSession,
        localFileProbe,
        hashLocalFile,
        sessionStore,
        apiBaseUrl,
        heartbeatIntervalMs,
        closeConfirmationCount,
        openObservationTimeoutMs,
        pdfOpenObservationTimeoutMs,
        retryDelaysMs,
        lastHeartbeatTimes,
        now: now(),
        inFlightSessionIds,
        inFlightHeartbeatSessionIds,
        inFlightObservationSessionIds,
        closedConfirmationCounts,
      });
    } catch (error) {
      console.error(
        "Project Wing desktop agent session monitor failed:",
        error
      );
    } finally {
      isRefreshing = false;
    }
  };
  const immediate = setTimeout(() => void refresh(), 0);
  const interval = setInterval(() => void refresh(), intervalMs);

  return {
    stop() {
      clearTimeout(immediate);
      clearInterval(interval);
    },
  };
}

async function retrySessions({
  sessions,
  checkInDesktopSession,
  heartbeatDesktopSession,
  localFileProbe,
  hashLocalFile,
  sessionStore,
  apiBaseUrl,
  heartbeatIntervalMs,
  closeConfirmationCount,
  openObservationTimeoutMs,
  pdfOpenObservationTimeoutMs,
  retryDelaysMs,
  lastHeartbeatTimes,
  now,
  inFlightSessionIds,
  inFlightHeartbeatSessionIds,
  inFlightObservationSessionIds,
  closedConfirmationCounts,
}: {
  sessions: DesktopAgentSession[];
  checkInDesktopSession: (
    request: DesktopAgentCheckInRequest
  ) => Promise<unknown>;
  heartbeatDesktopSession: (
    request: DesktopAgentHeartbeatRequest
  ) => Promise<unknown>;
  localFileProbe: LocalFileProbe;
  hashLocalFile: HashLocalFile;
  sessionStore: SessionStore;
  apiBaseUrl: string;
  heartbeatIntervalMs: number;
  closeConfirmationCount: number;
  openObservationTimeoutMs: number;
  pdfOpenObservationTimeoutMs: number;
  retryDelaysMs: number[];
  lastHeartbeatTimes: Map<string, number>;
  now: Date;
  inFlightSessionIds: Set<string>;
  inFlightHeartbeatSessionIds: Set<string>;
  inFlightObservationSessionIds: Set<string>;
  closedConfirmationCounts: Map<string, number>;
}) {
  await Promise.all(
    sessions.map(async (session) => {
      const tasks: Promise<unknown>[] = [];
      const sessionOpenObservationTimeoutMs =
        getMasterOpenObservationTimeoutMsForFileName(session.fileName, {
          masterTimeoutMs: openObservationTimeoutMs,
          pdfTimeoutMs: pdfOpenObservationTimeoutMs,
        });
      const retryEligible =
        isSyncRetryEligible(session) || isCleanupRetryEligible(session);
      const canRunRetry =
        retryEligible &&
        session.lockSessionId &&
        !inFlightSessionIds.has(session.sessionId) &&
        isRetryDue(session, now, retryDelaysMs);
      const canRecoverLaunchFailedRelease =
        isLaunchFailedReleaseRecoverySession(session) &&
        session.lockSessionId &&
        !inFlightSessionIds.has(session.sessionId);

      if (
        isHeartbeatSession(session, now, sessionOpenObservationTimeoutMs) &&
        !canRunRetry &&
        isHeartbeatDue(session, now, heartbeatIntervalMs, lastHeartbeatTimes) &&
        !inFlightHeartbeatSessionIds.has(session.sessionId)
      ) {
        inFlightHeartbeatSessionIds.add(session.sessionId);
        lastHeartbeatTimes.set(session.sessionId, now.getTime());
        void heartbeatSession({
          session,
          heartbeatDesktopSession,
          sessionStore,
          apiBaseUrl,
          now,
          openObservationTimeoutMs: sessionOpenObservationTimeoutMs,
        })
          .catch((error) => {
            console.error(
              "Project Wing desktop agent session monitor background task failed:",
              error
            );
          })
          .finally(() => {
            inFlightHeartbeatSessionIds.delete(session.sessionId);
          });
      } else if (
        !isHeartbeatSession(session, now, sessionOpenObservationTimeoutMs)
      ) {
        lastHeartbeatTimes.delete(session.sessionId);
      }

      if (
        isLocalObservationSession(session) &&
        !inFlightObservationSessionIds.has(session.sessionId)
      ) {
        inFlightObservationSessionIds.add(session.sessionId);
        tasks.push(
          observeLocalOpenClose({
            session,
            localFileProbe,
            hashLocalFile,
            sessionStore,
            now,
            closeConfirmationCount,
            openObservationTimeoutMs: sessionOpenObservationTimeoutMs,
            closedConfirmationCounts,
          }).finally(() => {
            inFlightObservationSessionIds.delete(session.sessionId);
          })
        );
      } else if (!isLocalObservationSession(session)) {
        closedConfirmationCounts.delete(session.sessionId);
      }

      if (canRunRetry && session.lockSessionId) {
        inFlightSessionIds.add(session.sessionId);
        void Promise.resolve()
          .then(() =>
            checkInDesktopSession(
              buildMasterCheckInRequest(session, apiBaseUrl)
            )
          )
          .catch(() => {})
          .finally(() => {
            inFlightSessionIds.delete(session.sessionId);
          });
      }

      if (canRecoverLaunchFailedRelease && session.lockSessionId) {
        inFlightSessionIds.add(session.sessionId);
        void recoverLaunchFailedRelease({
          session,
          localFileProbe,
          hashLocalFile,
          sessionStore,
          now,
        })
          .then((recovered) => {
            if (!recovered?.lockSessionId) {
              return;
            }
            return checkInDesktopSession(
              buildMasterCheckInRequest(recovered, apiBaseUrl)
            );
          })
          .catch(() => {})
          .finally(() => {
            inFlightSessionIds.delete(session.sessionId);
          });
      }

      await Promise.all(tasks);
    })
  );
}

async function recoverLaunchFailedRelease({
  session,
  localFileProbe,
  hashLocalFile,
  sessionStore,
  now,
}: {
  session: DesktopAgentSession;
  localFileProbe: LocalFileProbe;
  hashLocalFile: HashLocalFile;
  sessionStore: SessionStore;
  now: Date;
}) {
  if (!sessionStore.updateIf) {
    return null;
  }

  const probe = await localFileProbe(session);
  if (probe.busy || probe.state !== "CLOSED") {
    return null;
  }

  let localHash: string;
  try {
    localHash = await hashLocalFile(session.localPath);
  } catch {
    return null;
  }
  if (localHash !== session.originalHash) {
    return null;
  }

  return sessionStore.updateIf(
    session.sessionId,
    makeLaunchFailedReleaseRecoveryPredicate(session),
    {
      lifecycleState: "RELEASE_PENDING",
      contentState: "UNCHANGED",
      status: "RELEASE_PENDING",
      lastKnownHash: localHash,
      pendingReleaseReason: "UNCHANGED_RELEASE",
      pendingReleaseHash: localHash,
      retryCount: 0,
      lastObservationAt: now.toISOString(),
      lastError: undefined,
    }
  );
}

async function observeLocalOpenClose({
  session,
  localFileProbe,
  hashLocalFile,
  sessionStore,
  now,
  closeConfirmationCount,
  openObservationTimeoutMs,
  closedConfirmationCounts,
}: {
  session: DesktopAgentSession;
  localFileProbe: LocalFileProbe;
  hashLocalFile: HashLocalFile;
  sessionStore: SessionStore;
  now: Date;
  closeConfirmationCount: number;
  openObservationTimeoutMs: number;
  closedConfirmationCounts: Map<string, number>;
}) {
  if (!sessionStore.updateIf) {
    return;
  }
  const probe = await localFileProbe(session);
  if (probe.state === "MISSING") {
    await sessionStore.updateIf(
      session.sessionId,
      makeSameLifecyclePredicate(session),
      {
        lifecycleState: "LOCAL_FILE_MISSING",
        contentState: "MISSING",
        status: "LOCAL_FILE_MISSING",
        lastObservationAt: now.toISOString(),
      }
    );
    return;
  }
  if (!session.openObservedAt && isOpenObservationPending(session)) {
    if (isPositiveOpenEvidence(probe)) {
      closedConfirmationCounts.delete(session.sessionId);
      await sessionStore.updateIf(
        session.sessionId,
        makeOpenObservationPredicate(session),
        {
          lifecycleState: "OPEN",
          openObservedAt: now.toISOString(),
          openObservedSource: probe.openObservedSource ?? "MONITOR_COM",
          lastObservationAt: now.toISOString(),
          lastObservationDiagnostic: undefined,
          lastError: undefined,
        }
      );
      return;
    }
    if (isOpenObservationTimedOut(session, now, openObservationTimeoutMs)) {
      const lifecycleState = "LAUNCH_FAILED";
      await sessionStore.updateIf(
        session.sessionId,
        makeOpenObservationPredicate(session),
        {
          lifecycleState,
          status: getDesktopAgentCompatibilityStatus({
            lifecycleState,
            contentState: session.contentState,
          }),
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError: getMasterOpenObservationTimeoutMessage(session.fileName),
          lastObservationAt: now.toISOString(),
        }
      );
    }
    return;
  }

  if (!session.openObservedAt) {
    return;
  }
  if (probe.busy || probe.state !== "CLOSED") {
    closedConfirmationCounts.delete(session.sessionId);
    return;
  }

  const nextCount = (closedConfirmationCounts.get(session.sessionId) ?? 0) + 1;
  closedConfirmationCounts.set(session.sessionId, nextCount);
  if (nextCount < closeConfirmationCount) {
    return;
  }
  closedConfirmationCounts.delete(session.sessionId);
  let localHash: string;
  try {
    localHash = await hashLocalFile(session.localPath);
  } catch {
    await sessionStore.updateIf(
      session.sessionId,
      makeSameLifecyclePredicate(session),
      {
        lifecycleState: "LOCAL_FILE_MISSING",
        contentState: "MISSING",
        status: "LOCAL_FILE_MISSING",
        lastObservationAt: now.toISOString(),
      }
    );
    return;
  }
  const contentState = deriveContentState(session, localHash);
  await sessionStore.updateIf(
    session.sessionId,
    makeCloseRecordPredicate(session),
    {
      lifecycleState: "CLOSE_DETECTED",
      contentState,
      lastKnownHash: localHash,
      status: getDesktopAgentCompatibilityStatus({
        lifecycleState: "CLOSE_DETECTED",
        contentState,
      }),
      closeDetectedAt: now.toISOString(),
      closeDetectedSource: "MONITOR",
      lastObservationAt: now.toISOString(),
      lastObservationDiagnostic:
        probe.comAvailable === false
          ? "Excel COM unavailable; used exclusive file close proof."
          : undefined,
      lastError: undefined,
    }
  );
}

async function heartbeatSession({
  session,
  heartbeatDesktopSession,
  sessionStore,
  apiBaseUrl,
  now,
  openObservationTimeoutMs,
}: {
  session: DesktopAgentSession;
  heartbeatDesktopSession: (
    request: DesktopAgentHeartbeatRequest
  ) => Promise<unknown>;
  sessionStore: SessionStore;
  apiBaseUrl: string;
  now: Date;
  openObservationTimeoutMs: number;
}) {
  if (!session.lockSessionId || !session.grantSecret) {
    return;
  }
  try {
    await heartbeatDesktopSession({
      session,
      heartbeatUrl: buildHeartbeatUrl(session, apiBaseUrl),
    });
    await updateHeartbeatSession(
      sessionStore,
      session,
      {
        lastHeartbeatAt: now.toISOString(),
        lastError: undefined,
      },
      now,
      openObservationTimeoutMs
    );
  } catch (error) {
    if (
      error instanceof DesktopAgentError &&
      (error.code === "LOCK_REVOKED" || error.code === "LOCK_SESSION_MISMATCH")
    ) {
      const leaseLostAt = now.toISOString();
      const patch: Partial<DesktopAgentSession> = {
        leaseLostAt,
        lastError: error.message,
      };
      if (shouldEnterLeaseLostLifecycle(session)) {
        patch.lifecycleState = "LEASE_LOST";
        patch.status = "LEASE_LOST";
      }
      await updateHeartbeatSession(
        sessionStore,
        session,
        patch,
        now,
        openObservationTimeoutMs
      );
    }
  }
}

async function updateHeartbeatSession(
  sessionStore: SessionStore,
  session: DesktopAgentSession,
  patch: Partial<DesktopAgentSession>,
  now: Date,
  openObservationTimeoutMs: number
) {
  const predicate = makeSameHeartbeatPredicate(
    session,
    now,
    openObservationTimeoutMs
  );
  if (sessionStore.updateIf) {
    return sessionStore.updateIf(session.sessionId, predicate, patch);
  }
  const current = await getCurrentHeartbeatSession(sessionStore, session);
  if (!current || !predicate(current)) {
    return null;
  }
  return sessionStore.update?.(current.sessionId, patch) ?? null;
}

async function getCurrentHeartbeatSession(
  sessionStore: SessionStore,
  session: DesktopAgentSession
) {
  await Promise.resolve();
  if (!sessionStore.get) {
    return session;
  }
  return sessionStore.get(session.sessionId);
}

async function defaultHeartbeatDesktopSession({
  session,
  heartbeatUrl,
}: DesktopAgentHeartbeatRequest) {
  const response = await fetchWithDesktopAgentTimeout(fetch, heartbeatUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: session.projectId,
      attachmentId: session.attachmentId,
      grantSecret: session.grantSecret,
      lockEpoch: session.lockEpoch,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as {
      code?: string;
      message?: string;
    } | null;
    throw new DesktopAgentError(
      body?.code ?? "HEARTBEAT_FAILED",
      body?.message ?? "Could not refresh desktop Master heartbeat."
    );
  }
}

function isHeartbeatSession(
  session: DesktopAgentSession,
  now: Date,
  openObservationTimeoutMs: number
) {
  return (
    session.mode === "MASTER" &&
    isHeartbeatEligible(session, now, openObservationTimeoutMs)
  );
}

function buildHeartbeatUrl(session: DesktopAgentSession, apiBaseUrl: string) {
  if (session.heartbeatUrl) {
    return session.heartbeatUrl;
  }
  if (session.releaseUrl?.endsWith("/release")) {
    return `${session.releaseUrl.slice(0, -"/release".length)}/heartbeat`;
  }
  return `${apiBaseUrl}/desktop/master-sessions/${encodeURIComponent(
    session.lockSessionId ?? ""
  )}/heartbeat`;
}

function isHeartbeatEligible(
  session: DesktopAgentSession,
  now: Date,
  openObservationTimeoutMs: number
) {
  if (session.leaseLostAt) {
    return false;
  }
  switch (session.lifecycleState) {
    case "LAUNCHING": {
      return !isOpenObservationTimedOut(session, now, openObservationTimeoutMs);
    }
    case "OPEN": {
      return Boolean(session.openObservedAt);
    }
    case "OPEN_NOT_OBSERVED":
    case "LAUNCH_FAILED":
    case "CLEANUP_PENDING":
    case "CLEANUP_FAILED":
    case "CLOSED":
    case "LOCAL_FILE_MISSING":
    case "CONFLICT_RISK":
    case "LEASE_LOST":
    case "LOCK_REVOKED": {
      return false;
    }
    case "CLOSE_DETECTED":
    case "CHECKING_IN":
    case "CHECKIN_FAILED":
    case "RELEASE_PENDING":
    case "RELEASING":
    case "RELEASE_FAILED": {
      return true;
    }
    default: {
      return assertNeverLifecycle(session.lifecycleState);
    }
  }
}

function shouldEnterLeaseLostLifecycle(session: DesktopAgentSession) {
  return (
    session.lifecycleState === "LAUNCHING" ||
    session.lifecycleState === "OPEN_NOT_OBSERVED" ||
    session.lifecycleState === "OPEN" ||
    session.lifecycleState === "LEASE_LOST"
  );
}

function isSyncRetryEligible(session: DesktopAgentSession) {
  if (session.mode !== "MASTER") {
    return false;
  }
  return (
    session.lifecycleState === "CLOSE_DETECTED" ||
    session.lifecycleState === "CHECKING_IN" ||
    session.lifecycleState === "CHECKIN_FAILED" ||
    session.lifecycleState === "RELEASE_PENDING" ||
    session.lifecycleState === "RELEASE_FAILED"
  );
}

function isCleanupRetryEligible(session: DesktopAgentSession) {
  if (session.mode !== "MASTER") {
    return false;
  }
  return (
    session.lifecycleState === "CLEANUP_PENDING" ||
    session.lifecycleState === "CLEANUP_FAILED"
  );
}

function isLaunchFailedReleaseRecoverySession(session: DesktopAgentSession) {
  return (
    session.mode === "MASTER" &&
    session.lifecycleState === "LAUNCH_FAILED" &&
    session.contentState === "UNCHANGED" &&
    Boolean(session.lockSessionId) &&
    !session.openObservedAt &&
    !session.closeDetectedAt
  );
}

function isLocalObservationSession(session: DesktopAgentSession) {
  if (session.mode !== "MASTER") {
    return false;
  }
  return (
    session.lifecycleState === "LAUNCHING" ||
    session.lifecycleState === "OPEN_NOT_OBSERVED" ||
    session.lifecycleState === "OPEN" ||
    session.lifecycleState === "LEASE_LOST"
  );
}

function deriveContentState(
  session: DesktopAgentSession,
  hash: string
): DesktopAgentSessionContentState {
  if (hash === session.originalHash) {
    return "UNCHANGED";
  }
  if (session.lastUploadedHash && hash === session.lastUploadedHash) {
    return "UPLOADED";
  }
  return "DIRTY";
}

function canRecordClose(session: DesktopAgentSession) {
  return (
    session.mode === "MASTER" &&
    (session.lifecycleState === "OPEN" ||
      session.lifecycleState === "LEASE_LOST") &&
    Boolean(session.openObservedAt)
  );
}

function makeOpenObservationPredicate(expected: DesktopAgentSession) {
  return (current: DesktopAgentSession) =>
    current.sessionId === expected.sessionId &&
    current.generation === expected.generation &&
    current.lockSessionId === expected.lockSessionId &&
    current.openSignalToken === expected.openSignalToken &&
    isOpenObservationPending(current);
}

function makeCloseRecordPredicate(expected: DesktopAgentSession) {
  return (current: DesktopAgentSession) =>
    current.sessionId === expected.sessionId &&
    current.generation === expected.generation &&
    current.lockSessionId === expected.lockSessionId &&
    current.closeSignalToken === expected.closeSignalToken &&
    canRecordClose(current);
}

function makeLaunchFailedReleaseRecoveryPredicate(
  expected: DesktopAgentSession
) {
  return (current: DesktopAgentSession) =>
    current.sessionId === expected.sessionId &&
    current.generation === expected.generation &&
    current.lockSessionId === expected.lockSessionId &&
    current.openSignalToken === expected.openSignalToken &&
    current.closeSignalToken === expected.closeSignalToken &&
    isLaunchFailedReleaseRecoverySession(current);
}

function isPositiveOpenEvidence(probe: LocalFileProbeResult) {
  return (
    probe.state === "WORKBOOK_OPEN" ||
    probe.state === "DOCUMENT_OPEN" ||
    probe.state === "EDITOR_PROCESS_OPEN"
  );
}

function isOpenObservationPending(session: DesktopAgentSession) {
  return (
    session.mode === "MASTER" &&
    !session.openObservedAt &&
    (session.lifecycleState === "LAUNCHING" ||
      session.lifecycleState === "OPEN_NOT_OBSERVED")
  );
}

function isOpenObservationTimedOut(
  session: DesktopAgentSession,
  now: Date,
  timeoutMs: number
) {
  return (
    now.getTime() - new Date(session.launchStartedAt).getTime() >= timeoutMs
  );
}

function isRetryDue(
  session: DesktopAgentSession,
  now: Date,
  retryDelaysMs: number[]
) {
  const lastAttempt = getLastAttemptTime(session);
  const retryCount = session.retryCount ?? 0;
  if (!lastAttempt || retryCount === 0) {
    return true;
  }

  const delayIndex = Math.min(retryCount - 1, retryDelaysMs.length - 1);
  const retryDelayMs = retryDelaysMs[delayIndex] ?? retryDelaysMs.at(-1) ?? 0;
  return now.getTime() - lastAttempt.getTime() >= retryDelayMs;
}

function isHeartbeatDue(
  session: DesktopAgentSession,
  now: Date,
  heartbeatIntervalMs: number,
  lastHeartbeatTimes: Map<string, number>
) {
  const lastHeartbeatTime =
    lastHeartbeatTimes.get(session.sessionId) ??
    (session.lastHeartbeatAt
      ? new Date(session.lastHeartbeatAt).getTime()
      : null);
  if (!lastHeartbeatTime) {
    return true;
  }
  return now.getTime() - lastHeartbeatTime >= heartbeatIntervalMs;
}

function getLastAttemptTime(session: DesktopAgentSession) {
  const value =
    session.lifecycleState === "RELEASE_PENDING" ||
    session.lifecycleState === "RELEASE_FAILED" ||
    session.lifecycleState === "RELEASING"
      ? session.lastReleaseAttemptAt
      : session.lifecycleState === "CLEANUP_PENDING" ||
          session.lifecycleState === "CLEANUP_FAILED"
        ? session.lastCleanupAttemptAt
        : session.lastUploadAttemptAt;
  return value ? new Date(value) : null;
}

function makeSameLifecyclePredicate(expected: DesktopAgentSession) {
  return (current: DesktopAgentSession) =>
    current.mode === "MASTER" &&
    current.sessionId === expected.sessionId &&
    current.generation === expected.generation &&
    current.lockSessionId === expected.lockSessionId &&
    current.openSignalToken === expected.openSignalToken &&
    current.closeSignalToken === expected.closeSignalToken &&
    current.lifecycleState === expected.lifecycleState;
}

function makeSameHeartbeatPredicate(
  expected: DesktopAgentSession,
  now: Date,
  openObservationTimeoutMs: number
) {
  return (current: DesktopAgentSession) =>
    current.mode === "MASTER" &&
    current.sessionId === expected.sessionId &&
    current.generation === expected.generation &&
    current.lockSessionId === expected.lockSessionId &&
    current.openSignalToken === expected.openSignalToken &&
    current.closeSignalToken === expected.closeSignalToken &&
    current.lifecycleState === expected.lifecycleState &&
    isHeartbeatEligible(current, now, openObservationTimeoutMs);
}

function makeLegacyLocalFileProbe(
  legacyProbe?: (session: DesktopAgentSession) => Promise<boolean>
): LocalFileProbe {
  if (!legacyProbe) {
    return defaultProbeLocalFileState;
  }
  return async (session) => {
    const busy = await legacyProbe(session);
    return busy
      ? {
          state: "FILE_LOCKED",
          busy: true,
          openObservedSource: "MONITOR_FILE_LOCK",
        }
      : {
          state: "CLOSED",
          busy: false,
        };
  };
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function assertNeverLifecycle(value: never): never {
  throw new Error(`Unhandled desktop Master lifecycle state: ${value}`);
}
