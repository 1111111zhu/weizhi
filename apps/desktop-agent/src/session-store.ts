import { createHash, randomUUID } from "node:crypto";
import { createReadStream } from "node:fs";
import { access, mkdir, open, readFile, rename, rm } from "node:fs/promises";
import pathModule from "node:path";

import {
  DesktopAgentSessionSchema,
  getDesktopAgentCompatibilityStatus,
} from "@project-wing/shared/desktop";
import type {
  DesktopAgentPendingReleaseReason,
  DesktopAgentSession,
  DesktopAgentSessionContentState,
  DesktopAgentSessionLifecycleState,
} from "@project-wing/shared/desktop";

import { getStateRoot } from "./config.js";

const { basename, dirname, join } = pathModule;

const SESSION_FILE_NAME = "sessions.json";
const SESSION_QUARANTINE_FILE_NAME = "sessions.quarantine.json";

export type SessionStoreOptions = {
  stateRoot?: string;
  now?: () => Date;
};

export type SessionRecoveryStatus = {
  state: "READY" | "DEGRADED_NEEDS_ATTENTION";
  quarantinedCount: number;
  message?: string;
};

export function createSessionStore(options: SessionStoreOptions = {}) {
  const stateRoot = options.stateRoot ?? getStateRoot();
  const now = options.now ?? (() => new Date());
  const sessionFile = join(stateRoot, SESSION_FILE_NAME);
  let writeQueue = Promise.resolve();
  let recoveryStatus: SessionRecoveryStatus = {
    state: "READY",
    quarantinedCount: 0,
  };
  const recordRecoveryIssue = (issue: {
    quarantinedCount: number;
    message: string;
  }) => {
    recoveryStatus = {
      state: "DEGRADED_NEEDS_ATTENTION",
      quarantinedCount: Math.max(
        recoveryStatus.quarantinedCount,
        issue.quarantinedCount
      ),
      message: issue.message,
    };
  };
  const readStoredSessions = () =>
    readSessions(sessionFile, recordRecoveryIssue);
  const enqueueWrite = <T>(operation: () => Promise<T>) => {
    const next = writeQueue.then(operation, operation);
    writeQueue = next.then(
      () => {},
      () => {}
    );
    return next;
  };

  return {
    async list() {
      await Promise.resolve();
      return readStoredSessions();
    },

    async get(sessionId: string) {
      const sessions = await readStoredSessions();
      return (
        sessions.find((session) => session.sessionId === sessionId) ?? null
      );
    },

    async upsert(session: DesktopAgentSession) {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const nextSession = {
          ...session,
          lastSeenAt: now().toISOString(),
        };
        const nextSessions = [
          ...sessions.filter(
            (current) => current.sessionId !== session.sessionId
          ),
          nextSession,
        ];
        await writeSessions(sessionFile, nextSessions);
        return nextSession;
      });
    },

    async markClean(sessionId: string, cleanHash: string) {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const session = sessions.find(
          (current) => current.sessionId === sessionId
        );
        if (!session) {
          return null;
        }

        const nextSession: DesktopAgentSession = {
          ...session,
          originalHash: cleanHash,
          lastKnownHash: cleanHash,
          contentState: "UNCHANGED",
          lifecycleState: "OPEN",
          status: "OPEN_UNCHANGED",
          lastSeenAt: now().toISOString(),
        };
        await writeSessions(
          sessionFile,
          sessions.map((current) =>
            current.sessionId === sessionId ? nextSession : current
          )
        );
        return nextSession;
      });
    },

    async update(
      sessionId: string,
      patch: Partial<DesktopAgentSession>
    ): Promise<DesktopAgentSession | null> {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const session = sessions.find(
          (current) => current.sessionId === sessionId
        );
        if (!session) {
          return null;
        }
        const nextSession: DesktopAgentSession = {
          ...session,
          ...patch,
          lastSeenAt: now().toISOString(),
        };
        await writeSessions(
          sessionFile,
          sessions.map((current) =>
            current.sessionId === sessionId ? nextSession : current
          )
        );
        return nextSession;
      });
    },

    async updateIf(
      sessionId: string,
      predicate: (session: DesktopAgentSession) => boolean,
      patch: Partial<DesktopAgentSession>
    ): Promise<DesktopAgentSession | null> {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const session = sessions.find(
          (current) => current.sessionId === sessionId
        );
        if (!session || !predicate(session)) {
          return null;
        }
        const nextSession: DesktopAgentSession = {
          ...session,
          ...patch,
          lastSeenAt: now().toISOString(),
        };
        await writeSessions(
          sessionFile,
          sessions.map((current) =>
            current.sessionId === sessionId ? nextSession : current
          )
        );
        return nextSession;
      });
    },

    async remove(sessionId: string) {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const session = sessions.find(
          (current) => current.sessionId === sessionId
        );
        if (!session) {
          return null;
        }
        await writeSessions(
          sessionFile,
          sessions.filter((current) => current.sessionId !== sessionId)
        );
        return {
          ...session,
          status: "CLOSED" as const,
          lastSeenAt: now().toISOString(),
        };
      });
    },

    async deleteLocalFile(sessionId: string) {
      const sessions = await readStoredSessions();
      const session = sessions.find(
        (current) => current.sessionId === sessionId
      );
      if (!session) {
        return null;
      }
      await rm(session.localPath, { force: true });
      return session;
    },

    async refresh() {
      await Promise.resolve();
      return enqueueWrite(async () => {
        const sessions = await readStoredSessions();
        const refreshed = await mapWithConcurrency(
          sessions,
          2,
          async (session) => {
            await Promise.resolve();
            return reconcileSession(session, now());
          }
        );
        const purged = await purgeUnrecoverableLocalHistorySessions(refreshed);
        await writeSessions(sessionFile, purged);
        return purged;
      });
    },

    getRecoveryStatus() {
      return { ...recoveryStatus };
    },
  };
}

export async function reconcileSession(
  session: DesktopAgentSession,
  now: Date
): Promise<DesktopAgentSession> {
  if (
    [
      "RELEASE_PENDING",
      "CLEANUP_PENDING",
      "CONFLICT_RISK",
      "LOCK_REVOKED",
      "CLOSED",
    ].includes(session.lifecycleState)
  ) {
    return {
      ...session,
      lastSeenAt: now.toISOString(),
    };
  }

  if (["RELEASING", "RELEASE_FAILED"].includes(session.lifecycleState)) {
    return {
      ...session,
      lifecycleState: "RELEASE_PENDING",
      status: "RELEASE_PENDING",
      lastSeenAt: now.toISOString(),
    };
  }

  if (session.lifecycleState === "CLEANUP_FAILED") {
    return {
      ...session,
      lifecycleState: "CLEANUP_PENDING",
      status: "CLEANUP_PENDING",
      lastSeenAt: now.toISOString(),
    };
  }

  if (!(await fileExists(session.localPath))) {
    return {
      ...session,
      lifecycleState: "LOCAL_FILE_MISSING",
      contentState: "MISSING",
      status: "LOCAL_FILE_MISSING",
      lastSeenAt: now.toISOString(),
    };
  }

  const localHash = await tryHashFile(session.localPath);
  if (!localHash.ok) {
    const lifecycleState = deriveRefreshLifecycleState(session);
    return {
      ...session,
      lifecycleState,
      status:
        session.lifecycleState === "CHECKING_IN"
          ? "CHECKING_IN"
          : getDesktopAgentCompatibilityStatus({
              lifecycleState,
              contentState: session.contentState,
            }),
      lastSeenAt: now.toISOString(),
      lastError:
        "Local file is temporarily unavailable; Desktop Agent will retry.",
    };
  }
  const lastKnownHash = localHash.hash;
  const contentState = deriveContentState({
    ...session,
    lastKnownHash,
  });

  if (session.lifecycleState === "CHECKING_IN") {
    return {
      ...session,
      lastKnownHash,
      lifecycleState: "CHECKING_IN",
      contentState,
      status: "CHECKING_IN",
      lastSeenAt: now.toISOString(),
    };
  }

  const lifecycleState = deriveRefreshLifecycleState(session);
  return {
    ...session,
    lastKnownHash,
    lifecycleState,
    contentState,
    status: getDesktopAgentCompatibilityStatus({
      lifecycleState,
      contentState,
    }),
    lastSeenAt: now.toISOString(),
  };
}

export async function hashFile(filePath: string) {
  const hash = createHash("sha256");
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("data", (chunk) => hash.update(chunk));
    stream.on("error", reject);
    stream.on("end", resolve);
  });
  return hash.digest("hex");
}

async function tryHashFile(
  filePath: string
): Promise<{ ok: true; hash: string } | { ok: false; error: unknown }> {
  try {
    return { ok: true, hash: await hashFile(filePath) };
  } catch (error) {
    return { ok: false, error };
  }
}

function deriveRefreshLifecycleState(
  session: DesktopAgentSession
): DesktopAgentSessionLifecycleState {
  if (
    session.lifecycleState === "LAUNCHING" ||
    session.lifecycleState === "OPEN_NOT_OBSERVED" ||
    session.lifecycleState === "LAUNCH_FAILED" ||
    session.lifecycleState === "LEASE_LOST" ||
    session.lifecycleState === "CHECKING_IN"
  ) {
    return session.lifecycleState;
  }
  return session.closeDetectedAt ? "CLOSE_DETECTED" : "OPEN";
}

async function readSessions(
  sessionFile: string,
  reportRecoveryIssue?: (issue: {
    quarantinedCount: number;
    message: string;
  }) => void
) {
  try {
    const raw = await readFile(sessionFile, "utf-8");
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripUtf8Bom(raw)) as unknown;
    } catch (error) {
      await writeSessionQuarantine(sessionFile, [
        {
          index: -1,
          value: raw,
          issues: [
            {
              message:
                error instanceof Error
                  ? `Persisted session JSON is invalid: ${error.message}`
                  : "Persisted session JSON is invalid.",
            },
          ],
        },
      ]);
      reportRecoveryIssue?.({
        quarantinedCount: 1,
        message: "Desktop Agent quarantined malformed persisted session state.",
      });
      return [];
    }
    if (!Array.isArray(parsed)) {
      await writeSessionQuarantine(sessionFile, [
        {
          index: -1,
          value: parsed,
          issues: [{ message: "Persisted session state must be an array." }],
        },
      ]);
      reportRecoveryIssue?.({
        quarantinedCount: 1,
        message: "Desktop Agent quarantined invalid persisted session state.",
      });
      return [];
    }
    const normalized = await Promise.all(
      parsed.map((item) => normalizePersistedSession(item))
    );
    const validated = normalized.map((item) =>
      DesktopAgentSessionSchema.safeParse(item)
    );
    const invalid = validated.flatMap((result, index) =>
      result.success
        ? []
        : [
            {
              index,
              value: parsed[index],
              issues: result.error.issues,
            },
          ]
    );
    if (invalid.length > 0) {
      await writeSessionQuarantine(sessionFile, invalid);
      reportRecoveryIssue?.({
        quarantinedCount: invalid.length,
        message: `Desktop Agent quarantined ${invalid.length} invalid persisted session(s).`,
      });
    } else {
      await reportPersistedSessionQuarantine(sessionFile, reportRecoveryIssue);
    }
    return validated.flatMap((result) => (result.success ? [result.data] : []));
  } catch (error) {
    const fileError = error as NodeJS.ErrnoException;
    if (fileError.code === "ENOENT") {
      await reportPersistedSessionQuarantine(sessionFile, reportRecoveryIssue);
      return [];
    }
    throw error;
  }
}

async function reportPersistedSessionQuarantine(
  sessionFile: string,
  reportRecoveryIssue?: (issue: {
    quarantinedCount: number;
    message: string;
  }) => void
) {
  if (!reportRecoveryIssue) {
    return;
  }
  const quarantineFile = join(
    dirname(sessionFile),
    SESSION_QUARANTINE_FILE_NAME
  );
  const raw = await readFile(quarantineFile, "utf-8").catch(() => null);
  if (!raw) {
    return;
  }
  try {
    const persisted = JSON.parse(stripUtf8Bom(raw)) as {
      invalid?: unknown[];
    };
    const quarantinedCount = Math.max(1, persisted.invalid?.length ?? 0);
    reportRecoveryIssue({
      quarantinedCount,
      message: `Desktop Agent has ${quarantinedCount} quarantined persisted session(s) requiring attention.`,
    });
  } catch {
    reportRecoveryIssue({
      quarantinedCount: 1,
      message:
        "Desktop Agent has unreadable quarantined session state requiring attention.",
    });
  }
}

async function writeSessionQuarantine(
  sessionFile: string,
  invalid: { index: number; value: unknown; issues: unknown }[]
) {
  const quarantineFile = join(
    dirname(sessionFile),
    SESSION_QUARANTINE_FILE_NAME
  );
  const temporaryFile = `${quarantineFile}.${process.pid}.${randomUUID()}.tmp`;
  await mkdir(dirname(quarantineFile), { recursive: true });
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fileHandle = await open(temporaryFile, "w", 0o600);
    await fileHandle.writeFile(
      JSON.stringify(
        {
          quarantinedAt: new Date().toISOString(),
          sourceFile: basename(sessionFile),
          invalid,
        },
        null,
        2
      )
    );
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    await rename(temporaryFile, quarantineFile);
  } finally {
    await fileHandle?.close().catch(() => {});
    await rm(temporaryFile, { force: true }).catch(() => {});
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>
) {
  const results = Array.from<R>({ length: values.length });
  let nextIndex = 0;
  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), values.length) },
      async () => {
        while (nextIndex < values.length) {
          const index = nextIndex;
          nextIndex += 1;
          results[index] = await mapper(values[index], index);
        }
      }
    )
  );
  return results;
}

async function normalizePersistedSession(value: unknown) {
  if (!value || typeof value !== "object") {
    return value;
  }
  const raw = value as Record<string, unknown>;
  if (
    typeof raw.sessionId !== "string" ||
    typeof raw.mode !== "string" ||
    typeof raw.projectId !== "string" ||
    typeof raw.attachmentId !== "string" ||
    typeof raw.fileName !== "string" ||
    typeof raw.localPath !== "string" ||
    typeof raw.originalHash !== "string" ||
    typeof raw.lastKnownHash !== "string" ||
    typeof raw.status !== "string" ||
    typeof raw.openedAt !== "string" ||
    typeof raw.lastSeenAt !== "string"
  ) {
    return value;
  }

  const contentState =
    parseContentState(raw.contentState) ??
    (await derivePersistedContentState(raw));
  let lifecycleState =
    parseLifecycleState(raw.lifecycleState) ??
    deriveLifecycleStateFromLegacyStatus(raw.status, raw.closeDetectedAt);
  const pendingRelease = derivePendingRelease(raw, lifecycleState);
  const lastError =
    pendingRelease.conflictError ??
    (typeof raw.lastError === "string" ? raw.lastError : undefined);

  if (pendingRelease.conflictError) {
    lifecycleState = "CONFLICT_RISK";
  }

  return {
    ...raw,
    generation:
      typeof raw.generation === "number" && Number.isInteger(raw.generation)
        ? raw.generation
        : 1,
    openSignalToken:
      typeof raw.openSignalToken === "string" && raw.openSignalToken.trim()
        ? raw.openSignalToken
        : raw.mode === "MASTER"
          ? randomUUID()
          : undefined,
    closeSignalToken:
      typeof raw.closeSignalToken === "string" && raw.closeSignalToken.trim()
        ? raw.closeSignalToken
        : raw.mode === "MASTER"
          ? randomUUID()
          : undefined,
    lifecycleState,
    contentState,
    status: getDesktopAgentCompatibilityStatus({
      lifecycleState,
      contentState,
    }),
    launchStartedAt:
      typeof raw.launchStartedAt === "string"
        ? raw.launchStartedAt
        : raw.openedAt,
    pendingReleaseReason:
      typeof raw.pendingReleaseReason === "string"
        ? raw.pendingReleaseReason
        : pendingRelease.reason,
    pendingReleaseHash:
      typeof raw.pendingReleaseHash === "string"
        ? raw.pendingReleaseHash
        : pendingRelease.hash,
    lastError,
  };
}

async function derivePersistedContentState(
  raw: Record<string, unknown>
): Promise<DesktopAgentSessionContentState> {
  if (typeof raw.localPath === "string") {
    const localHash = await hashFile(raw.localPath).catch(() => null);
    if (!localHash) {
      return "MISSING";
    }
    if (
      typeof raw.originalHash === "string" &&
      localHash === raw.originalHash
    ) {
      return "UNCHANGED";
    }
    if (
      typeof raw.lastUploadedHash === "string" &&
      localHash === raw.lastUploadedHash
    ) {
      return "UPLOADED";
    }
    return "DIRTY";
  }
  return "MISSING";
}

function deriveContentState(session: {
  originalHash: string;
  lastKnownHash: string;
  lastUploadedHash?: string;
}): DesktopAgentSessionContentState {
  if (session.lastKnownHash === session.originalHash) {
    return "UNCHANGED";
  }
  if (
    session.lastUploadedHash &&
    session.lastKnownHash === session.lastUploadedHash
  ) {
    return "UPLOADED";
  }
  return "DIRTY";
}

function deriveLifecycleStateFromLegacyStatus(
  status: string,
  closeDetectedAt: unknown
): DesktopAgentSessionLifecycleState {
  const hasCloseDetectedAt = typeof closeDetectedAt === "string";
  switch (status) {
    case "OPEN_UNCHANGED":
    case "DIRTY_PENDING_CHECKIN": {
      return hasCloseDetectedAt ? "CLOSE_DETECTED" : "OPEN_NOT_OBSERVED";
    }
    case "CHECKING_IN": {
      return hasCloseDetectedAt ? "CHECKIN_FAILED" : "OPEN_NOT_OBSERVED";
    }
    case "CHECKIN_FAILED": {
      return hasCloseDetectedAt ? "CHECKIN_FAILED" : "OPEN_NOT_OBSERVED";
    }
    case "RELEASE_PENDING": {
      return hasCloseDetectedAt ? "RELEASE_PENDING" : "OPEN_NOT_OBSERVED";
    }
    case "RELEASING":
    case "RELEASE_FAILED": {
      return hasCloseDetectedAt ? "RELEASE_FAILED" : "OPEN_NOT_OBSERVED";
    }
    case "CLEANUP_PENDING": {
      return "CLEANUP_PENDING";
    }
    case "CLEANUP_FAILED": {
      return "CLEANUP_FAILED";
    }
    case "LOCAL_FILE_MISSING": {
      return "LOCAL_FILE_MISSING";
    }
    case "CONFLICT_RISK": {
      return "CONFLICT_RISK";
    }
    case "LEASE_LOST": {
      return "LEASE_LOST";
    }
    case "LOCK_REVOKED": {
      return "LOCK_REVOKED";
    }
    case "CLOSED": {
      return "CLOSED";
    }
    default: {
      return "OPEN_NOT_OBSERVED";
    }
  }
}

function derivePendingRelease(
  raw: Record<string, unknown>,
  lifecycleState: DesktopAgentSessionLifecycleState
): {
  reason?: DesktopAgentPendingReleaseReason;
  hash?: string;
  conflictError?: string;
} {
  if (
    !["RELEASE_PENDING", "RELEASING", "RELEASE_FAILED"].includes(lifecycleState)
  ) {
    return {};
  }

  const parsedReason =
    raw.pendingReleaseReason === "CHECKED_IN" ||
    raw.pendingReleaseReason === "UNCHANGED_RELEASE"
      ? raw.pendingReleaseReason
      : undefined;
  const parsedHash =
    typeof raw.pendingReleaseHash === "string"
      ? raw.pendingReleaseHash
      : undefined;
  const derived = deriveReleaseDecisionFromHashes(raw);

  if (parsedReason && parsedHash) {
    return {
      reason: parsedReason,
      hash: parsedHash,
    };
  }
  if (parsedReason && derived.reason && derived.hash) {
    if (parsedReason === derived.reason) {
      return derived;
    }
    return {
      conflictError:
        "Legacy release session has inconsistent pending release metadata.",
    };
  }
  if (derived.reason && derived.hash) {
    return derived;
  }

  return {
    conflictError:
      "Could not derive pending release metadata for the legacy session.",
  };
}

function deriveReleaseDecisionFromHashes(raw: Record<string, unknown>): {
  reason?: DesktopAgentPendingReleaseReason;
  hash?: string;
} {
  if (
    typeof raw.lastKnownHash === "string" &&
    typeof raw.originalHash === "string" &&
    raw.lastKnownHash === raw.originalHash
  ) {
    return {
      reason: "UNCHANGED_RELEASE",
      hash: raw.originalHash,
    };
  }

  if (
    typeof raw.lastUploadedHash === "string" &&
    typeof raw.lastKnownHash === "string" &&
    raw.lastUploadedHash === raw.lastKnownHash &&
    raw.lastKnownHash !== raw.originalHash
  ) {
    return {
      reason: "CHECKED_IN",
      hash: raw.lastUploadedHash,
    };
  }

  return {};
}

function parseLifecycleState(
  value: unknown
): DesktopAgentSessionLifecycleState | null {
  return typeof value === "string" && isLifecycleState(value) ? value : null;
}

function parseContentState(
  value: unknown
): DesktopAgentSessionContentState | null {
  return typeof value === "string" && isContentState(value) ? value : null;
}

function isLifecycleState(
  value: string
): value is DesktopAgentSessionLifecycleState {
  return [
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
    "LEASE_LOST",
    "LOCK_REVOKED",
  ].includes(value);
}

function isContentState(
  value: string
): value is DesktopAgentSessionContentState {
  return ["UNCHANGED", "DIRTY", "UPLOADED", "MISSING"].includes(value);
}

function stripUtf8Bom(value: string) {
  return value.codePointAt(0) === 0xfe_ff ? value.slice(1) : value;
}

async function writeSessions(
  sessionFile: string,
  sessions: DesktopAgentSession[]
) {
  await mkdir(dirname(sessionFile), { recursive: true });
  const temporaryFile = `${sessionFile}.${process.pid}.${randomUUID()}.tmp`;
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fileHandle = await open(temporaryFile, "w");
    await fileHandle.writeFile(JSON.stringify(sessions, null, 2));
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    await retryTransientFileSystemOperation(() =>
      rename(temporaryFile, sessionFile)
    );
    await syncDirectoryBestEffort(dirname(sessionFile));
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
    await rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

export async function retryTransientFileSystemOperation<T>(
  operation: () => Promise<T>,
  options: { retries?: number; delayMs?: number } = {}
): Promise<T> {
  const retries = options.retries ?? 5;
  const delayMs = options.delayMs ?? 50;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!isTransientFileSystemError(error) || attempt >= retries) {
        throw error;
      }
      await sleep(delayMs * attempt);
    }
  }
  throw new Error("Transient file-system retry failed unexpectedly.");
}

function isTransientFileSystemError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  return (
    code === "EBUSY" ||
    code === "EPERM" ||
    code === "EACCES" ||
    code === "EMFILE" ||
    code === "ENFILE"
  );
}

async function sleep(delayMs: number) {
  if (delayMs <= 0) {
    return;
  }
  await new Promise((resolve) => {
    setTimeout(resolve, delayMs);
  });
}

async function syncDirectoryBestEffort(directoryPath: string) {
  let directoryHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    directoryHandle = await open(directoryPath, "r");
    await directoryHandle.sync();
  } catch {
    // Directory fsync is not available on every platform, especially Windows.
  } finally {
    if (directoryHandle) {
      await directoryHandle.close().catch(() => {});
    }
  }
}

async function fileExists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function purgeUnrecoverableLocalHistorySessions(
  sessions: DesktopAgentSession[]
) {
  const recoverableSessions: DesktopAgentSession[] = [];
  for (const session of sessions) {
    if (await shouldPurgeLocalHistorySession(session)) {
      await rm(session.localPath, { force: true }).catch(() => {});
      continue;
    }
    recoverableSessions.push(session);
  }
  return recoverableSessions;
}

async function shouldPurgeLocalHistorySession(session: DesktopAgentSession) {
  await Promise.resolve();
  if (session.mode !== "MASTER") {
    return false;
  }

  if (
    session.lifecycleState === "CLOSED" ||
    session.lifecycleState === "LOCAL_FILE_MISSING"
  ) {
    return true;
  }

  if (session.lifecycleState === "LOCK_REVOKED") {
    return canSafelyPurgeRevokedSession(session);
  }

  return false;
}

async function canSafelyPurgeRevokedSession(session: DesktopAgentSession) {
  if (!(await fileExists(session.localPath))) {
    return true;
  }

  const localHash = await hashFile(session.localPath).catch(() => null);
  if (!localHash) {
    return false;
  }

  return (
    localHash === session.originalHash ||
    localHash === session.lastUploadedHash ||
    (session.lastUploadedHash === session.lastKnownHash &&
      localHash === session.lastKnownHash)
  );
}
