import { createHash, randomUUID } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  statfs,
} from "node:fs/promises";
import pathModule from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { setTimeout as delay } from "node:timers/promises";

import type {
  DesktopAgentCheckInRequest,
  DesktopAgentCheckInResponse,
  DesktopAgentPendingReleaseReason,
  DesktopAgentReleaseRequest,
  DesktopAgentReleaseResponse,
  DesktopAgentSession,
  DesktopAgentSessionContentState,
  DesktopUploadGrant,
} from "@project-wing/shared/desktop";
import { DesktopUploadGrantSchema } from "@project-wing/shared/desktop";

import type { DesktopAgentCacheIndex } from "./cache-index.js";
import {
  getAllowedDownloadOrigins,
  getCacheRoot,
  getDesktopAgentTransferTimeoutMs,
} from "./config.js";
import { OssCrc64, crc64File } from "./crc64.js";
import { DesktopAgentError } from "./errors.js";
import { fetchWithDesktopAgentTimeout } from "./fetch-timeout.js";
import { createSessionStore, hashFile } from "./session-store.js";

const { dirname, isAbsolute, join, relative, resolve } = pathModule;

type FetchUpload = (
  url: string,
  init: {
    method: "POST" | "PUT";
    headers: Record<string, string>;
    body: FormData | string | NodeJS.ReadableStream;
    duplex?: "half";
    signal?: AbortSignal;
  }
) => Promise<Response>;
type WaitForStableFile = (filePath: string) => Promise<void>;
type CopySnapshotFile = (source: string, destination: string) => Promise<void>;
type GetSnapshotAvailableBytes = (
  snapshotRoot: string
) => Promise<number | null>;
type SnapshotCacheIndex = Pick<
  DesktopAgentCacheIndex,
  "recordAccess" | "remove" | "setPinned" | "trim"
>;
type ServerErrorBody = {
  code?: string;
  message?: string;
};
type SessionOperationKind = "CHECK_IN" | "RELEASE";
type ActiveSessionOperation = {
  kind: SessionOperationKind;
  controller: AbortController;
  promise: Promise<unknown>;
};

const activeSessionOperations = new Map<string, ActiveSessionOperation>();
const MAX_DIRECT_UPLOAD_ATTEMPTS = 3;
const RETRYABLE_DIRECT_UPLOAD_CODES = new Set([
  "DIRECT_UPLOAD_GRANT_EXPIRED",
  "DIRECT_UPLOAD_TRANSIENT_FAILURE",
  "DIRECT_UPLOAD_NOT_FOUND",
  "DIRECT_UPLOAD_SIZE_MISMATCH",
  "DIRECT_UPLOAD_HASH_MISMATCH",
  "DIRECT_UPLOAD_CRC64_MISMATCH",
  "DIRECT_UPLOAD_VERIFY_UNAVAILABLE",
]);
const ROTATE_DIRECT_UPLOAD_ATTEMPT_CODES = new Set([
  "DIRECT_UPLOAD_NOT_FOUND",
  "DIRECT_UPLOAD_SIZE_MISMATCH",
  "DIRECT_UPLOAD_HASH_MISMATCH",
  "DIRECT_UPLOAD_CRC64_MISMATCH",
]);
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429]);
const MAX_IN_MEMORY_PROXY_FALLBACK_BYTES = 32 * 1024 * 1024;
const SNAPSHOT_DISK_RESERVE_BYTES = 64 * 1024 * 1024;
const ORPHANED_SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000;
const UPLOAD_GRANT_REFRESH_WINDOW_MS = 2 * 60_000;
const RENEWABLE_OSS_ERROR_CODES = new Set([
  "EXPIREDTOKEN",
  "REQUESTEXPIRED",
  "REQUESTTIMETOOSKEWED",
  "SECURITYTOKENEXPIRED",
  "SIGNATUREDOESNOTMATCH",
]);

export type CheckInDesktopSessionOptions = {
  allowedUploadOrigins?: string[];
  fetchUpload?: FetchUpload;
  fetchTransfer?: FetchUpload;
  operationSignal?: AbortSignal;
  waitForStableFile?: WaitForStableFile;
  isLocalFileBusy?: (session: DesktopAgentSession) => Promise<boolean>;
  copySnapshotFile?: CopySnapshotFile;
  getSnapshotAvailableBytes?: GetSnapshotAvailableBytes;
  cacheRoot?: string;
  cacheIndex?: SnapshotCacheIndex;
  sessionStore?: {
    list?: () => Promise<DesktopAgentSession[]>;
    get: (sessionId: string) => Promise<DesktopAgentSession | null>;
    update: (
      sessionId: string,
      patch: Partial<DesktopAgentSession>
    ) => Promise<DesktopAgentSession | null>;
    updateIf?: (
      sessionId: string,
      predicate: (session: DesktopAgentSession) => boolean,
      patch: Partial<DesktopAgentSession>
    ) => Promise<DesktopAgentSession | null>;
    remove: (sessionId: string) => Promise<DesktopAgentSession | null>;
  };
};

export function checkInDesktopSession(
  request: DesktopAgentCheckInRequest,
  options: CheckInDesktopSessionOptions = {}
): Promise<DesktopAgentCheckInResponse> {
  return runSessionOperation(request.sessionId, "CHECK_IN", (signal) =>
    checkInDesktopSessionUnlocked(request, {
      ...options,
      operationSignal: signal,
    })
  );
}

async function checkInDesktopSessionUnlocked(
  request: DesktopAgentCheckInRequest,
  options: CheckInDesktopSessionOptions
): Promise<DesktopAgentCheckInResponse> {
  const allowedUploadOrigins =
    options.allowedUploadOrigins ?? getAllowedDownloadOrigins();
  const fetchUpload = bindOperationSignal(
    options.fetchUpload ?? defaultFetchUpload,
    options.operationSignal
  );
  const fetchProxyTransfer = bindOperationSignal(
    options.fetchUpload ?? defaultFetchTransfer,
    options.operationSignal
  );
  const fetchTransfer = bindOperationSignal(
    options.fetchTransfer ?? options.fetchUpload ?? defaultFetchTransfer,
    options.operationSignal
  );
  const waitForStableFile =
    options.waitForStableFile ?? defaultWaitForStableFile;
  const sessionStore = options.sessionStore ?? createSessionStore();
  const session = await sessionStore.get(request.sessionId);
  if (!session) {
    throw new DesktopAgentError(
      "SESSION_NOT_FOUND",
      "Tracked file session was not found."
    );
  }

  if (isCleanupOnlyLifecycle(session.lifecycleState)) {
    return finalizeLocalCleanup(request.sessionId, session, sessionStore);
  }
  assertAllowedUploadOrigin(request.releaseUrl, allowedUploadOrigins);

  if (isReleaseOnlyLifecycle(session.lifecycleState)) {
    const releaseDecision = await getStoredReleaseDecision(
      session,
      sessionStore
    );
    return releaseMasterAndCleanup({
      request,
      session,
      sessionStore,
      fetchUpload,
      releaseReason: releaseDecision.reason,
      releaseHash: releaseDecision.hash,
      cacheIndex: options.cacheIndex,
    });
  }

  if (
    session.lifecycleState !== "CLOSE_DETECTED" &&
    session.lifecycleState !== "CHECKING_IN" &&
    session.lifecycleState !== "CHECKIN_FAILED"
  ) {
    throw new DesktopAgentError(
      "LOCAL_FILE_BUSY_OR_OPEN",
      "The tracked local file has not been closed."
    );
  }

  const snapshotted = await resolveCheckInSnapshot({
    session,
    sessionStore,
    waitForStableFile,
    isLocalFileBusy: options.isLocalFileBusy,
    copySnapshotFile: options.copySnapshotFile,
    getSnapshotAvailableBytes: options.getSnapshotAvailableBytes,
    cacheRoot: options.cacheRoot,
    cacheIndex: options.cacheIndex,
  });
  const activeSession = snapshotted.session;
  const { snapshot } = snapshotted;
  const localHash = snapshot.contentHash;
  const localContentCrc64 =
    snapshot.contentCrc64 ?? (await crc64File(snapshot.path));
  const localFileSize = snapshot.fileSize;
  const contentState = deriveContentState(activeSession, localHash);
  const shouldUploadChangedFile =
    localHash !== activeSession.originalHash &&
    localHash !== activeSession.lastUploadedHash;
  let pendingRelease: DesktopAgentSession | null = null;
  if (shouldUploadChangedFile) {
    const checkInUrl = request.checkInUrl ?? request.uploadUrl;
    if (!checkInUrl) {
      throw new DesktopAgentError(
        "VALIDATION_FAILED",
        "Check-in URL is required."
      );
    }
    assertAllowedUploadOrigin(checkInUrl, allowedUploadOrigins);
    const checkingIn = await updateSessionIfCurrent(
      sessionStore,
      activeSession,
      ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED"],
      {
        lifecycleState: "CHECKING_IN",
        status: "CHECKING_IN",
        contentState: "DIRTY",
        lastKnownHash: localHash,
        lastUploadAttemptAt: new Date().toISOString(),
      }
    );
    assertSessionStateUpdated(checkingIn);
    const response = await uploadAndCommitChangedFile({
      checkInUrl,
      session: checkingIn,
      sourcePath: snapshot.path,
      localHash,
      localContentCrc64,
      localFileSize,
      fetchUpload,
      fetchProxyTransfer,
      fetchTransfer,
      sessionStore,
    }).catch(async (error) => {
      const normalized =
        error instanceof DesktopAgentError
          ? { code: error.code, message: error.message }
          : {
              code: "UPLOAD_FAILED",
              message: "Could not upload the tracked file.",
            };
      await updateSessionForServerFailure({
        session: checkingIn,
        sessionStore,
        sessionId: request.sessionId,
        stage: "CHECK_IN",
        error: normalized,
      });
      throw error instanceof DesktopAgentError
        ? error
        : new DesktopAgentError(normalized.code, normalized.message);
    });
    if (!response.ok) {
      const error = await readServerError(
        response,
        "UPLOAD_FAILED",
        "Could not upload the tracked file."
      );
      await updateSessionForServerFailure({
        session: checkingIn,
        sessionStore,
        sessionId: request.sessionId,
        stage: "CHECK_IN",
        error,
      });
      throw new DesktopAgentError(error.code, error.message);
    }
    const checkInResult = (await response.json().catch(() => null)) as {
      conflict?: boolean;
      candidateVersionId?: string;
    } | null;
    if (checkInResult?.conflict) {
      const conflictMessage = checkInResult.candidateVersionId
        ? `The server preserved this upload as conflict candidate ${checkInResult.candidateVersionId}. PIC resolution is required.`
        : "The server preserved this upload as a conflict candidate. PIC resolution is required.";
      const conflicted = await updateSessionIfCurrent(
        sessionStore,
        checkingIn,
        ["CHECKING_IN"],
        {
          lifecycleState: "CONFLICT_RISK",
          status: "CONFLICT_RISK",
          contentState: "DIRTY",
          lastKnownHash: localHash,
          lastUploadedHash: localHash,
          checkInSnapshot: undefined,
          uploadCheckpoint: undefined,
          retryCount: 0,
          lastError: conflictMessage,
        }
      );
      assertSessionStateUpdated(conflicted);
      await cleanupCheckInSnapshot(
        snapshot,
        activeSession.localPath,
        options.cacheIndex
      );
      throw new DesktopAgentError("CONFLICT_RISK", conflictMessage);
    }
    const currentWorkingHash = await hashFile(activeSession.localPath).catch(
      () => null
    );
    if (currentWorkingHash !== localHash) {
      const conflictMessage =
        "The local file changed after its immutable upload snapshot was created. The uploaded snapshot was preserved, and the newer local changes require recovery.";
      const conflicted = await updateSessionIfCurrent(
        sessionStore,
        checkingIn,
        ["CHECKING_IN"],
        {
          lifecycleState: "CONFLICT_RISK",
          status: "CONFLICT_RISK",
          contentState: currentWorkingHash ? "DIRTY" : "MISSING",
          lastKnownHash: currentWorkingHash ?? localHash,
          lastUploadedHash: localHash,
          checkInSnapshot: undefined,
          uploadCheckpoint: undefined,
          retryCount: 0,
          lastError: conflictMessage,
        }
      );
      assertSessionStateUpdated(conflicted);
      await cleanupCheckInSnapshot(
        snapshot,
        activeSession.localPath,
        options.cacheIndex
      );
      throw new DesktopAgentError("CONFLICT_RISK", conflictMessage);
    }
    pendingRelease = await updateSessionIfCurrent(
      sessionStore,
      checkingIn,
      ["CHECKING_IN"],
      {
        lifecycleState: "RELEASE_PENDING",
        status: "RELEASE_PENDING",
        contentState: "UPLOADED",
        lastKnownHash: localHash,
        lastUploadedHash: localHash,
        pendingReleaseReason: "CHECKED_IN",
        pendingReleaseHash: localHash,
        checkInSnapshot: undefined,
        uploadCheckpoint: undefined,
        retryCount: 0,
        lastError: undefined,
      }
    );
  } else {
    const pendingReleaseReason: DesktopAgentPendingReleaseReason =
      localHash === activeSession.originalHash
        ? "UNCHANGED_RELEASE"
        : "CHECKED_IN";
    pendingRelease = await updateSessionIfCurrent(
      sessionStore,
      activeSession,
      ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED"],
      {
        lifecycleState: "RELEASE_PENDING",
        status: "RELEASE_PENDING",
        contentState,
        lastKnownHash: localHash,
        pendingReleaseReason,
        pendingReleaseHash: localHash,
        checkInSnapshot: undefined,
        uploadCheckpoint: undefined,
        retryCount: 0,
        lastError: undefined,
      }
    );
  }

  assertSessionStateUpdated(pendingRelease);
  await cleanupCheckInSnapshot(
    snapshot,
    activeSession.localPath,
    options.cacheIndex
  );

  return releaseMasterAndCleanup({
    request,
    session: {
      ...activeSession,
      lifecycleState: "RELEASE_PENDING",
      status: "RELEASE_PENDING",
      contentState: shouldUploadChangedFile ? "UPLOADED" : contentState,
      lastKnownHash: localHash,
      lastUploadedHash: shouldUploadChangedFile
        ? localHash
        : activeSession.lastUploadedHash,
      pendingReleaseReason:
        localHash === activeSession.originalHash
          ? "UNCHANGED_RELEASE"
          : "CHECKED_IN",
      pendingReleaseHash: localHash,
      checkInSnapshot: undefined,
      uploadCheckpoint: undefined,
    },
    sessionStore,
    fetchUpload,
    releaseReason:
      localHash === activeSession.originalHash
        ? "UNCHANGED_RELEASE"
        : "CHECKED_IN",
    releaseHash: localHash,
    cacheIndex: options.cacheIndex,
  });
}

async function resolveCheckInSnapshot({
  session,
  sessionStore,
  waitForStableFile,
  isLocalFileBusy,
  copySnapshotFile,
  getSnapshotAvailableBytes: getAvailableBytes,
  cacheRoot,
  cacheIndex,
}: {
  session: DesktopAgentSession;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
  waitForStableFile: WaitForStableFile;
  isLocalFileBusy?: (session: DesktopAgentSession) => Promise<boolean>;
  copySnapshotFile?: CopySnapshotFile;
  getSnapshotAvailableBytes?: GetSnapshotAvailableBytes;
  cacheRoot?: string;
  cacheIndex?: SnapshotCacheIndex;
}) {
  const existing = session.checkInSnapshot;
  if (
    existing &&
    (await isUsableCheckInSnapshot(existing, session.localPath))
  ) {
    await recordActiveCheckInSnapshot(existing, session, cacheIndex);
    return { session, snapshot: existing };
  }
  if (existing) {
    await cleanupCheckInSnapshot(existing, session.localPath, cacheIndex);
  }

  if (isLocalFileBusy && (await isLocalFileBusy(session))) {
    throw new DesktopAgentError(
      "LOCAL_FILE_BUSY",
      "The tracked local file is still open or being saved."
    );
  }
  try {
    await waitForStableFile(session.localPath);
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      throw error;
    }
    throw new DesktopAgentError(
      "LOCAL_FILE_MISSING",
      "The tracked local file is no longer in the controlled cache."
    );
  }

  const snapshot = await createCheckInSnapshot(session, {
    copySnapshotFile,
    getSnapshotAvailableBytes: getAvailableBytes,
    cacheRoot,
    cacheIndex,
    sessionStore,
  });
  const snapshottedSession = await updateSessionIfCurrent(
    sessionStore,
    session,
    ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED"],
    { checkInSnapshot: snapshot }
  );
  if (!snapshottedSession) {
    await cleanupCheckInSnapshot(snapshot, session.localPath, cacheIndex);
    assertSessionStateUpdated(snapshottedSession);
  }
  return { session: snapshottedSession, snapshot };
}

async function createCheckInSnapshot(
  session: DesktopAgentSession,
  options: {
    copySnapshotFile?: CopySnapshotFile;
    getSnapshotAvailableBytes?: GetSnapshotAvailableBytes;
    cacheRoot?: string;
    cacheIndex?: SnapshotCacheIndex;
    sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
  }
) {
  const snapshotRoot = getCheckInSnapshotRoot(session.localPath);
  const snapshotId = randomUUID();
  const temporaryPath = join(snapshotRoot, `${snapshotId}.tmp`);
  const snapshotPath = join(snapshotRoot, `${snapshotId}.snapshot`);

  try {
    await mkdir(snapshotRoot, { recursive: true });
    const before = await stat(session.localPath);
    await reserveCheckInSnapshotCapacity(
      session,
      before.size,
      options.cacheRoot,
      options.cacheIndex,
      options.sessionStore
    );
    await assertSnapshotDiskCapacity(
      snapshotRoot,
      before.size,
      options.getSnapshotAvailableBytes
    );
    const digests = options.copySnapshotFile
      ? await copyAndHashWithInjectedCopy(
          options.copySnapshotFile,
          session.localPath,
          temporaryPath
        )
      : await copyAndHashSnapshot(session.localPath, temporaryPath);
    const after = await stat(session.localPath);
    if (before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
      throw new DesktopAgentError(
        "LOCAL_FILE_BUSY",
        "The tracked local file changed while its upload snapshot was created."
      );
    }
    await rename(temporaryPath, snapshotPath);
    const snapshotStat = await stat(snapshotPath);
    const snapshot = {
      snapshotId,
      path: snapshotPath,
      fileSize: snapshotStat.size,
      contentHash: digests.contentHash,
      contentCrc64: digests.contentCrc64,
      createdAt: new Date().toISOString(),
    };
    await recordActiveCheckInSnapshot(snapshot, session, options.cacheIndex);
    return snapshot;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    await rm(snapshotPath, { force: true }).catch(() => {});
    options.cacheIndex?.remove(snapshotPath);
    if (error instanceof DesktopAgentError) {
      throw error;
    }
    throw classifySnapshotFileSystemError(error);
  }
}

async function copyAndHashWithInjectedCopy(
  copySnapshotFile: CopySnapshotFile,
  sourcePath: string,
  destinationPath: string
) {
  await copySnapshotFile(sourcePath, destinationPath);
  const [contentHash, contentCrc64] = await Promise.all([
    hashFile(destinationPath),
    crc64File(destinationPath),
  ]);
  return { contentHash, contentCrc64 };
}

async function copyAndHashSnapshot(
  sourcePath: string,
  destinationPath: string
) {
  const hash = createHash("sha256");
  const crc64 = new OssCrc64();
  const digestingStream = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk);
      crc64.update(chunk);
      callback(null, chunk);
    },
  });
  await pipeline(
    createReadStream(sourcePath),
    digestingStream,
    createWriteStream(destinationPath, { flags: "wx" })
  );
  return {
    contentHash: hash.digest("hex"),
    contentCrc64: crc64.digestDecimal(),
  };
}

async function reserveCheckInSnapshotCapacity(
  session: DesktopAgentSession,
  snapshotSize: number,
  cacheRoot: string | undefined,
  cacheIndex: SnapshotCacheIndex | undefined,
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>
) {
  if (!cacheIndex) {
    return;
  }
  const sessions = (await sessionStore.list?.()) ?? [session];
  await cleanupOrphanedCheckInSnapshots(sessions, { cacheIndex });
  const protectedPaths = sessions.flatMap((current) => [
    current.localPath,
    ...(current.checkInSnapshot ? [current.checkInSnapshot.path] : []),
  ]);
  await cacheIndex.trim({
    cacheRoot: cacheRoot ?? getCacheRoot(),
    incomingBytes: snapshotSize,
    protectedPaths,
  });
}

async function recordActiveCheckInSnapshot(
  snapshot: NonNullable<DesktopAgentSession["checkInSnapshot"]>,
  session: DesktopAgentSession,
  cacheIndex?: SnapshotCacheIndex
) {
  if (!cacheIndex) {
    return;
  }
  await cacheIndex.recordAccess({
    localPath: snapshot.path,
    projectId: session.projectId,
    attachmentId: session.attachmentId,
    mode: session.mode,
    remoteVersionId: session.baseVersionId,
    contentHash: snapshot.contentHash,
    state: "UPLOADING",
  });
  cacheIndex.setPinned(snapshot.path, true);
}

async function assertSnapshotDiskCapacity(
  snapshotRoot: string,
  snapshotSize: number,
  getAvailableBytes: GetSnapshotAvailableBytes = getSnapshotAvailableBytes
) {
  const availableBytes = await getAvailableBytes(snapshotRoot);
  if (availableBytes === null) {
    return;
  }
  const requiredBytes = snapshotSize + SNAPSHOT_DISK_RESERVE_BYTES;
  if (availableBytes >= requiredBytes) {
    return;
  }
  throw new DesktopAgentError(
    "DESKTOP_AGENT_STORAGE_FULL",
    `Creating the upload snapshot requires ${requiredBytes} bytes, but only ${availableBytes} bytes are available.`
  );
}

async function getSnapshotAvailableBytes(snapshotRoot: string) {
  try {
    const capacity = await statfs(snapshotRoot);
    return capacity.bavail * capacity.bsize;
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOSYS" || code === "EINVAL") {
      return null;
    }
    throw error;
  }
}

function classifySnapshotFileSystemError(error: unknown) {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  if (code === "ENOSPC" || code === "EDQUOT") {
    return new DesktopAgentError(
      "DESKTOP_AGENT_STORAGE_FULL",
      "There is not enough local disk space to create the upload snapshot."
    );
  }
  if (code === "EACCES" || code === "EPERM") {
    return new DesktopAgentError(
      "LOCAL_STORAGE_PERMISSION_DENIED",
      "Desktop Agent does not have permission to create the upload snapshot."
    );
  }
  if (code === "EBUSY" || code === "ETXTBSY") {
    return new DesktopAgentError(
      "LOCAL_FILE_BUSY",
      "The tracked local file is temporarily busy and could not be snapshotted."
    );
  }
  if (code === "ENOENT") {
    return new DesktopAgentError(
      "LOCAL_FILE_MISSING",
      "The tracked local file is no longer in the controlled cache."
    );
  }
  return new DesktopAgentError(
    "FILE_WRITE_FAILED",
    error instanceof Error
      ? `Could not create the upload snapshot: ${error.message}`
      : "Could not create the upload snapshot."
  );
}

async function isUsableCheckInSnapshot(
  snapshot: NonNullable<DesktopAgentSession["checkInSnapshot"]>,
  localPath: string
) {
  if (!isTrustedCheckInSnapshotPath(snapshot.path, localPath)) {
    return false;
  }
  const snapshotStat = await stat(snapshot.path).catch(() => null);
  if (
    snapshotStat?.isFile() !== true ||
    snapshotStat.size !== snapshot.fileSize
  ) {
    return false;
  }
  const snapshotHash = await hashFile(snapshot.path).catch(() => null);
  return snapshotHash === snapshot.contentHash;
}

async function cleanupCheckInSnapshot(
  snapshot: DesktopAgentSession["checkInSnapshot"],
  localPath: string,
  cacheIndex?: SnapshotCacheIndex
) {
  if (!snapshot || !isTrustedCheckInSnapshotPath(snapshot.path, localPath)) {
    return;
  }
  await rm(snapshot.path, { force: true }).catch(() => {});
  cacheIndex?.remove(snapshot.path);
}

function getCheckInSnapshotRoot(localPath: string) {
  return resolve(dirname(localPath), ".check-in-staging");
}

function isTrustedCheckInSnapshotPath(snapshotPath: string, localPath: string) {
  const relativePath = relative(
    getCheckInSnapshotRoot(localPath),
    resolve(snapshotPath)
  );
  return (
    relativePath !== "" &&
    !relativePath.startsWith("..") &&
    !isAbsolute(relativePath)
  );
}

export async function cleanupOrphanedCheckInSnapshots(
  sessions: DesktopAgentSession[],
  options: {
    now?: Date;
    ttlMs?: number;
    cacheIndex?: SnapshotCacheIndex;
    cacheRoot?: string;
  } = {}
) {
  const now = options.now ?? new Date();
  const ttlMs = options.ttlMs ?? ORPHANED_SNAPSHOT_TTL_MS;
  await Promise.all(
    sessions.map(async (session) => {
      if (!session.checkInSnapshot) {
        return;
      }
      await recordActiveCheckInSnapshot(
        session.checkInSnapshot,
        session,
        options.cacheIndex
      ).catch(() => {});
    })
  );
  const activeSnapshotPaths = new Set(
    sessions.flatMap((session) =>
      session.checkInSnapshot
        ? [resolve(session.checkInSnapshot.path).toLowerCase()]
        : []
    )
  );
  const stagingRoots = new Set(
    sessions.map((session) => getCheckInSnapshotRoot(session.localPath))
  );
  if (options.cacheRoot) {
    for (const stagingRoot of await discoverCheckInStagingRoots(
      options.cacheRoot
    )) {
      stagingRoots.add(stagingRoot);
    }
  }

  await Promise.all(
    [...stagingRoots].map(async (stagingRoot) => {
      const entries = await readdir(stagingRoot, {
        withFileTypes: true,
      }).catch(() => []);
      await Promise.all(
        entries.map(async (entry) => {
          if (!entry.isFile()) {
            return;
          }
          if (
            !entry.name.endsWith(".tmp") &&
            !entry.name.endsWith(".snapshot")
          ) {
            return;
          }
          const candidatePath = resolve(stagingRoot, entry.name);
          if (activeSnapshotPaths.has(candidatePath.toLowerCase())) {
            return;
          }
          const candidateStat = await stat(candidatePath).catch(() => null);
          if (!candidateStat || now.getTime() - candidateStat.mtimeMs < ttlMs) {
            return;
          }
          await rm(candidatePath, { force: true }).catch(() => {});
          options.cacheIndex?.remove(candidatePath);
        })
      );
    })
  );
}

async function discoverCheckInStagingRoots(cacheRoot: string) {
  const resolvedCacheRoot = resolve(cacheRoot);
  const pending = [resolvedCacheRoot];
  const stagingRoots: string[] = [];
  let visited = 0;
  const maxVisitedDirectories = 20_000;

  while (pending.length > 0 && visited < maxVisitedDirectories) {
    const current = pending.shift();
    if (!current) {
      break;
    }
    visited += 1;
    const entries = await readdir(current, { withFileTypes: true }).catch(
      () => []
    );
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) {
        continue;
      }
      const child = resolve(current, entry.name);
      if (!isPathWithin(resolvedCacheRoot, child)) {
        continue;
      }
      if (entry.name === ".check-in-staging") {
        stagingRoots.push(child);
      } else {
        pending.push(child);
      }
    }
  }
  return stagingRoots;
}

function isPathWithin(parent: string, child: string) {
  const childRelativePath = relative(parent, child);
  return (
    childRelativePath !== "" &&
    !childRelativePath.startsWith("..") &&
    !isAbsolute(childRelativePath)
  );
}

async function uploadAndCommitChangedFile({
  checkInUrl,
  session,
  sourcePath,
  localHash,
  localContentCrc64,
  localFileSize,
  fetchUpload,
  fetchProxyTransfer,
  fetchTransfer,
  sessionStore,
}: {
  checkInUrl: string;
  session: DesktopAgentSession;
  sourcePath: string;
  localHash: string;
  localContentCrc64: string;
  localFileSize: number;
  fetchUpload: FetchUpload;
  fetchProxyTransfer: FetchUpload;
  fetchTransfer: FetchUpload;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
}) {
  const resumableCheckpoint =
    session.uploadCheckpoint?.localContentHash === localHash &&
    (!session.uploadCheckpoint.localContentCrc64 ||
      session.uploadCheckpoint.localContentCrc64 === localContentCrc64) &&
    session.uploadCheckpoint.fileSize === localFileSize
      ? session.uploadCheckpoint
      : undefined;
  let uploadAttemptId = resumableCheckpoint?.uploadAttemptId ?? randomUUID();
  let metadata = buildDesktopUploadMetadata(
    session,
    localHash,
    localFileSize,
    localContentCrc64,
    uploadAttemptId
  );
  if (session.directUploadSupported === false) {
    return uploadThroughApiProxy(
      checkInUrl,
      session,
      sourcePath,
      metadata,
      fetchProxyTransfer
    );
  }

  for (
    let directAttempt = 0;
    directAttempt < MAX_DIRECT_UPLOAD_ATTEMPTS;
    directAttempt += 1
  ) {
    const persistedSession =
      directAttempt === 0
        ? session
        : ((await sessionStore.get(session.sessionId)) ?? session);
    const matchingCheckpoint =
      persistedSession.uploadCheckpoint?.localContentHash === localHash &&
      (!persistedSession.uploadCheckpoint.localContentCrc64 ||
        persistedSession.uploadCheckpoint.localContentCrc64 ===
          localContentCrc64) &&
      persistedSession.uploadCheckpoint.fileSize === localFileSize &&
      persistedSession.uploadCheckpoint.uploadAttemptId === uploadAttemptId
        ? persistedSession.uploadCheckpoint
        : undefined;
    metadata = buildDesktopUploadMetadata(
      session,
      localHash,
      localFileSize,
      localContentCrc64,
      uploadAttemptId
    );
    const attemptMetadata = metadata;
    const attemptCheckpoint = matchingCheckpoint;
    const prepareResponse = await retryControlRequest(() =>
      fetchUpload(`${checkInUrl}/prepare`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...attemptMetadata,
          resumeUploadId: attemptCheckpoint?.uploadId,
        }),
      })
    );
    if (
      session.directUploadSupported === undefined &&
      isDirectUploadUnsupportedResponse(prepareResponse)
    ) {
      return uploadThroughApiProxy(
        checkInUrl,
        session,
        sourcePath,
        metadata,
        fetchProxyTransfer
      );
    }
    if (!prepareResponse.ok) {
      if (isRetryableHttpStatus(prepareResponse.status)) {
        return fallbackAfterDirectFailure(
          checkInUrl,
          session,
          sourcePath,
          metadata,
          fetchProxyTransfer
        );
      }
      throw await responseAsDesktopAgentError(
        prepareResponse,
        "UPLOAD_PREPARE_FAILED",
        "Could not prepare direct upload."
      );
    }
    const grant = DesktopUploadGrantSchema.safeParse(
      await prepareResponse.json().catch(() => null)
    );
    if (!grant.success) {
      throw new DesktopAgentError(
        "UPLOAD_PREPARE_FAILED",
        "Direct upload grant is invalid."
      );
    }
    if (grant.data.mode === "PROXY") {
      return uploadThroughApiProxy(
        checkInUrl,
        session,
        sourcePath,
        metadata,
        fetchProxyTransfer
      );
    }
    const directGrant = grant.data;

    try {
      await uploadWithGrant({
        grant: directGrant,
        checkInUrl,
        session,
        sourcePath,
        metadata: attemptMetadata,
        matchingCheckpoint: attemptCheckpoint,
        fetchUpload,
        fetchTransfer,
        sessionStore,
      });
    } catch (error) {
      if (
        error instanceof DesktopAgentError &&
        RETRYABLE_DIRECT_UPLOAD_CODES.has(error.code)
      ) {
        if (directAttempt + 1 < MAX_DIRECT_UPLOAD_ATTEMPTS) {
          if (ROTATE_DIRECT_UPLOAD_ATTEMPT_CODES.has(error.code)) {
            uploadAttemptId = randomUUID();
          }
          continue;
        }
        return fallbackAfterDirectFailure(
          checkInUrl,
          session,
          sourcePath,
          metadata,
          fetchProxyTransfer
        );
      }
      throw error;
    }

    const commitMetadata = attemptMetadata;
    const commitObjectKey = directGrant.objectKey;
    const commitResponse = await retryControlRequest(() =>
      fetchUpload(checkInUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...commitMetadata,
          objectKey: commitObjectKey,
        }),
      })
    );
    if (commitResponse.ok) {
      return commitResponse;
    }

    const commitError = await readServerError(
      commitResponse.clone(),
      "UPLOAD_FAILED",
      "Could not verify the direct upload."
    );
    if (RETRYABLE_DIRECT_UPLOAD_CODES.has(commitError.code)) {
      if (directAttempt + 1 < MAX_DIRECT_UPLOAD_ATTEMPTS) {
        if (ROTATE_DIRECT_UPLOAD_ATTEMPT_CODES.has(commitError.code)) {
          uploadAttemptId = randomUUID();
        }
        continue;
      }
      return fallbackAfterDirectFailure(
        checkInUrl,
        session,
        sourcePath,
        metadata,
        fetchProxyTransfer
      );
    }
    if (isRetryableHttpStatus(commitResponse.status)) {
      return fallbackAfterDirectFailure(
        checkInUrl,
        session,
        sourcePath,
        metadata,
        fetchProxyTransfer
      );
    }
    return commitResponse;
  }

  return fallbackAfterDirectFailure(
    checkInUrl,
    session,
    sourcePath,
    metadata,
    fetchProxyTransfer
  );
}

function fallbackAfterDirectFailure(
  checkInUrl: string,
  session: DesktopAgentSession,
  sourcePath: string,
  metadata: ReturnType<typeof buildDesktopUploadMetadata>,
  fetchUpload: FetchUpload
) {
  return uploadThroughApiProxy(
    checkInUrl,
    session,
    sourcePath,
    metadata,
    fetchUpload
  );
}

function buildDesktopUploadMetadata(
  session: DesktopAgentSession,
  localHash: string,
  localFileSize: number,
  localContentCrc64: string,
  uploadAttemptId: string
) {
  return {
    projectId: session.projectId,
    attachmentId: session.attachmentId,
    baseVersion: session.baseVersion ?? 1,
    baseVersionId: session.baseVersionId,
    lockEpoch: session.lockEpoch,
    localContentHash: localHash,
    localContentCrc64,
    idempotencyKey: `${session.lockSessionId ?? session.sessionId}:${localHash}`,
    grantSecret: session.grantSecret,
    fileName: session.fileName,
    fileSize: localFileSize,
    mimeType: session.mimeType ?? "application/octet-stream",
    uploadAttemptId,
  };
}

async function uploadThroughApiProxy(
  checkInUrl: string,
  session: DesktopAgentSession,
  sourcePath: string,
  metadata: ReturnType<typeof buildDesktopUploadMetadata>,
  fetchUpload: FetchUpload
) {
  if (metadata.fileSize > MAX_IN_MEMORY_PROXY_FALLBACK_BYTES) {
    throw new DesktopAgentError(
      "DIRECT_UPLOAD_RETRY_REQUIRED",
      "Large files require direct object-storage upload. The immutable snapshot and multipart checkpoint were preserved for retry."
    );
  }
  let fileBuffer: Buffer;
  try {
    fileBuffer = await readFile(sourcePath);
  } catch {
    throw new DesktopAgentError(
      "LOCAL_FILE_MISSING",
      "The tracked local file is no longer in the controlled cache."
    );
  }
  const form = new FormData();
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined) {
      form.set(key, String(value));
    }
  }
  form.set(
    "file",
    new Blob([new Uint8Array(fileBuffer)], {
      type: "application/octet-stream",
    }),
    session.fileName
  );
  return retryTransfer(() =>
    fetchUpload(checkInUrl, {
      method: "POST",
      headers: {},
      body: form,
    })
  );
}

async function uploadWithGrant({
  grant,
  checkInUrl,
  session,
  sourcePath,
  metadata,
  matchingCheckpoint,
  fetchUpload,
  fetchTransfer,
  sessionStore,
}: {
  grant: Exclude<DesktopUploadGrant, { mode: "PROXY" }>;
  checkInUrl: string;
  session: DesktopAgentSession;
  sourcePath: string;
  metadata: ReturnType<typeof buildDesktopUploadMetadata>;
  matchingCheckpoint?: DesktopAgentSession["uploadCheckpoint"];
  fetchUpload: FetchUpload;
  fetchTransfer: FetchUpload;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
}) {
  if (grant.mode === "ALREADY_UPLOADED") {
    return;
  }

  assertTrustedDirectUploadUrl(
    grant.mode === "DIRECT_PUT" ? grant.uploadUrl : grant.parts[0].uploadUrl
  );
  assertUploadGrantFresh(grant.expiresAt);
  if (grant.mode === "DIRECT_PUT") {
    await saveUploadCheckpoint(sessionStore, session, {
      localContentHash: metadata.localContentHash,
      localContentCrc64: metadata.localContentCrc64,
      fileSize: metadata.fileSize,
      objectKey: grant.objectKey,
      uploadAttemptId: metadata.uploadAttemptId,
      completedParts: [],
    });
    const response = await retryDirectTransfer(() =>
      fetchTransfer(grant.uploadUrl, {
        method: "PUT",
        headers: {
          ...grant.headers,
          "Content-Length": String(metadata.fileSize),
        },
        body: createReadStream(sourcePath),
        duplex: "half",
      })
    );
    if (!response.ok) {
      const diagnostic = await readObjectStorageTransferDiagnostic(
        response.clone()
      );
      await saveUploadCheckpoint(sessionStore, session, {
        localContentHash: metadata.localContentHash,
        localContentCrc64: metadata.localContentCrc64,
        fileSize: metadata.fileSize,
        objectKey: grant.objectKey,
        uploadAttemptId: metadata.uploadAttemptId,
        completedParts: [],
        ...diagnostic,
      });
      if (isRenewableOssGrantFailure(response.status, diagnostic)) {
        throw new DesktopAgentError(
          "DIRECT_UPLOAD_GRANT_EXPIRED",
          "The object storage upload grant expired and must be refreshed."
        );
      }
      if (isRetryableHttpStatus(response.status)) {
        throw new DesktopAgentError(
          "DIRECT_UPLOAD_TRANSIENT_FAILURE",
          "Object storage temporarily rejected the direct upload."
        );
      }
    }
    if (!response.ok && response.status !== 409) {
      throw await responseAsDesktopAgentError(
        response,
        "UPLOAD_FAILED",
        "Could not upload the tracked file to object storage."
      );
    }
    assertOssCrc64Matches(
      response,
      metadata.localContentCrc64,
      "the uploaded object"
    );
    return;
  }

  const completedParts =
    matchingCheckpoint?.objectKey === grant.objectKey &&
    matchingCheckpoint.uploadId === grant.uploadId
      ? [...grant.uploadedParts]
      : [];
  await saveUploadCheckpoint(sessionStore, session, {
    localContentHash: metadata.localContentHash,
    localContentCrc64: metadata.localContentCrc64,
    fileSize: metadata.fileSize,
    objectKey: grant.objectKey,
    uploadAttemptId: metadata.uploadAttemptId,
    uploadId: grant.uploadId,
    partSize: grant.partSize,
    completedParts,
  });
  const completedNumbers = new Set(
    completedParts.map((part) => part.partNumber)
  );
  const pending = grant.parts.filter(
    (part) => !completedNumbers.has(part.partNumber)
  );
  for (let index = 0; index < pending.length; index += 3) {
    assertUploadGrantFresh(grant.expiresAt);
    const batch = pending.slice(index, index + 3);
    const batchController = new AbortController();
    const results = await Promise.allSettled(
      batch.map(async (part) => {
        try {
          assertTrustedDirectUploadUrl(part.uploadUrl);
          const start = (part.partNumber - 1) * grant.partSize;
          const end = Math.min(
            metadata.fileSize - 1,
            start + grant.partSize - 1
          );
          let uploadedPartCrc64: OssCrc64 | undefined;
          const response = await retryDirectTransfer(() => {
            const partCrc64 = new OssCrc64();
            uploadedPartCrc64 = partCrc64;
            const digestingStream = createCrc64Transform(partCrc64);
            return fetchTransfer(part.uploadUrl, {
              method: "PUT",
              headers: { "Content-Length": String(end - start + 1) },
              body: createReadStream(sourcePath, { start, end }).pipe(
                digestingStream
              ),
              duplex: "half",
              signal: batchController.signal,
            });
          });
          if (!response.ok) {
            const diagnostic = await readObjectStorageTransferDiagnostic(
              response.clone()
            );
            await saveUploadCheckpoint(sessionStore, session, {
              localContentHash: metadata.localContentHash,
              localContentCrc64: metadata.localContentCrc64,
              fileSize: metadata.fileSize,
              objectKey: grant.objectKey,
              uploadAttemptId: metadata.uploadAttemptId,
              uploadId: grant.uploadId,
              partSize: grant.partSize,
              completedParts: [...completedParts],
              ...diagnostic,
            });
            if (isRenewableOssGrantFailure(response.status, diagnostic)) {
              throw new DesktopAgentError(
                "DIRECT_UPLOAD_GRANT_EXPIRED",
                "The object storage upload grant expired and must be refreshed."
              );
            }
            if (isRetryableHttpStatus(response.status)) {
              throw new DesktopAgentError(
                "DIRECT_UPLOAD_TRANSIENT_FAILURE",
                `Object storage temporarily rejected part ${part.partNumber}.`
              );
            }
            throw await responseAsDesktopAgentError(
              response,
              "UPLOAD_FAILED",
              `Could not upload part ${part.partNumber}.`
            );
          }
          if (!uploadedPartCrc64) {
            throw new DesktopAgentError(
              "UPLOAD_FAILED",
              `Could not calculate CRC64 for part ${part.partNumber}.`
            );
          }
          assertOssCrc64Matches(
            response,
            uploadedPartCrc64.digestDecimal(),
            `part ${part.partNumber}`
          );
          const etag = response.headers.get("etag")?.trim();
          if (!etag) {
            throw new DesktopAgentError(
              "UPLOAD_FAILED",
              `Object storage did not return an ETag for part ${part.partNumber}.`
            );
          }
          completedParts.push({ partNumber: part.partNumber, etag });
          completedParts.sort(
            (left, right) => left.partNumber - right.partNumber
          );
          await saveUploadCheckpoint(sessionStore, session, {
            localContentHash: metadata.localContentHash,
            localContentCrc64: metadata.localContentCrc64,
            fileSize: metadata.fileSize,
            objectKey: grant.objectKey,
            uploadAttemptId: metadata.uploadAttemptId,
            uploadId: grant.uploadId,
            partSize: grant.partSize,
            completedParts: [...completedParts],
          });
        } catch (error) {
          batchController.abort();
          throw error;
        }
      })
    );
    const failures = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected"
    );
    const failed =
      failures.find((result) => !isCallerAbort(result.reason)) ?? failures[0];
    if (failed) {
      throw failed.reason;
    }
  }

  const completeResponse = await retryControlRequest(() =>
    fetchUpload(`${checkInUrl}/complete`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...metadata,
        objectKey: grant.objectKey,
        uploadId: grant.uploadId,
        parts: completedParts,
      }),
    })
  );
  if (!completeResponse.ok) {
    if (isRetryableHttpStatus(completeResponse.status)) {
      throw new DesktopAgentError(
        "DIRECT_UPLOAD_TRANSIENT_FAILURE",
        "The multipart upload could not be completed temporarily."
      );
    }
    throw await responseAsDesktopAgentError(
      completeResponse,
      "UPLOAD_COMPLETE_FAILED",
      "Could not complete multipart upload."
    );
  }
}

function createCrc64Transform(crc64: OssCrc64) {
  return new Transform({
    transform(chunk, _encoding, callback) {
      crc64.update(chunk);
      callback(null, chunk);
    },
  });
}

function assertOssCrc64Matches(
  response: Response,
  expectedCrc64: string,
  subject: string
) {
  const actualCrc64 = response.headers.get("x-oss-hash-crc64ecma")?.trim();
  if (!actualCrc64 || actualCrc64 === expectedCrc64) {
    return;
  }
  throw new DesktopAgentError(
    "DIRECT_UPLOAD_CRC64_MISMATCH",
    `Object storage CRC64 verification failed for ${subject}.`
  );
}

function isDirectUploadUnsupportedResponse(response: Response) {
  return [404, 405, 501].includes(response.status);
}

async function saveUploadCheckpoint(
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>,
  session: DesktopAgentSession,
  uploadCheckpoint: NonNullable<DesktopAgentSession["uploadCheckpoint"]>
) {
  const updated = await updateSessionIfCurrent(
    sessionStore,
    session,
    ["CHECKING_IN"],
    { uploadCheckpoint }
  );
  assertSessionStateUpdated(updated);
}

async function retryTransfer(operation: () => Promise<Response>) {
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await operation();
      if (!isRetryableHttpStatus(response.status)) {
        return response;
      }
      lastResponse = response;
      lastError = new Error(`Transfer failed with ${response.status}.`);
      if (attempt < 2) {
        await response.body?.cancel().catch(() => {});
      }
    } catch (error) {
      if (isCallerAbort(error)) {
        throw error;
      }
      lastResponse = undefined;
      lastError = error;
    }
    if (attempt < 2) {
      await delay(retryDelayMs(attempt));
    }
  }
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

async function retryDirectTransfer(operation: () => Promise<Response>) {
  try {
    return await retryTransfer(operation);
  } catch (error) {
    if (isCallerAbort(error)) {
      throw error;
    }
    throw new DesktopAgentError(
      "DIRECT_UPLOAD_TRANSIENT_FAILURE",
      error instanceof Error
        ? error.message
        : "The direct file transfer failed temporarily."
    );
  }
}

async function retryControlRequest(operation: () => Promise<Response>) {
  let lastError: unknown;
  let lastResponse: Response | undefined;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await operation();
      if (!isRetryableHttpStatus(response.status)) {
        return response;
      }
      lastResponse = response;
      lastError = new Error(`Control request failed with ${response.status}.`);
      if (attempt < 2) {
        await response.body?.cancel().catch(() => {});
      }
    } catch (error) {
      if (isCallerAbort(error)) {
        throw error;
      }
      lastResponse = undefined;
      lastError = error;
    }
    if (attempt < 2) {
      await delay(retryDelayMs(attempt));
    }
  }
  if (lastResponse) {
    return lastResponse;
  }
  throw lastError;
}

function isRetryableHttpStatus(status: number) {
  return RETRYABLE_HTTP_STATUSES.has(status) || status >= 500;
}

function retryDelayMs(attempt: number) {
  const jitter = 0.75 + Math.random() * 0.5;
  return Math.round(250 * 2 ** attempt * jitter);
}

function isCallerAbort(error: unknown) {
  return error instanceof Error && error.name === "AbortError";
}

async function responseAsDesktopAgentError(
  response: Response,
  fallbackCode: string,
  fallbackMessage: string
) {
  const error = await readServerError(response, fallbackCode, fallbackMessage);
  return new DesktopAgentError(error.code, error.message);
}

async function readObjectStorageTransferDiagnostic(response: Response) {
  const body = await response.text().catch(() => "");
  return {
    lastTransferStatus: response.status,
    ...optionalDiagnosticValue(
      "lastTransferErrorCode",
      readXmlElement(body, "Code")
    ),
    ...optionalDiagnosticValue(
      "lastTransferRequestId",
      response.headers.get("x-oss-request-id") ??
        readXmlElement(body, "RequestId")
    ),
  };
}

function isRenewableOssGrantFailure(
  status: number,
  diagnostic: Awaited<ReturnType<typeof readObjectStorageTransferDiagnostic>>
) {
  const errorCode = diagnostic.lastTransferErrorCode?.toUpperCase();
  return (
    status === 403 &&
    Boolean(errorCode && RENEWABLE_OSS_ERROR_CODES.has(errorCode))
  );
}

function assertUploadGrantFresh(expiresAt: string) {
  if (Date.parse(expiresAt) - Date.now() > UPLOAD_GRANT_REFRESH_WINDOW_MS) {
    return;
  }
  throw new DesktopAgentError(
    "DIRECT_UPLOAD_GRANT_EXPIRED",
    "The object storage upload grant is expiring and must be refreshed."
  );
}

function readXmlElement(body: string, element: string) {
  const match = new RegExp(`<${element}>([^<]+)</${element}>`, "i").exec(body);
  return match?.[1]?.trim() || undefined;
}

function optionalDiagnosticValue<
  Key extends "lastTransferErrorCode" | "lastTransferRequestId",
>(key: Key, value: string | undefined): Partial<Record<Key, string>> {
  return value ? ({ [key]: value } as Record<Key, string>) : {};
}

function assertTrustedDirectUploadUrl(uploadUrl: string) {
  const parsed = new URL(uploadUrl);
  if (
    parsed.protocol !== "https:" &&
    !(
      parsed.protocol === "http:" &&
      (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1")
    )
  ) {
    throw new DesktopAgentError(
      "ORIGIN_NOT_ALLOWED",
      "Direct upload URL is not trusted."
    );
  }
}

export function releaseDesktopSession(
  request: DesktopAgentReleaseRequest,
  options: CheckInDesktopSessionOptions = {}
): Promise<DesktopAgentReleaseResponse> {
  return runSessionOperation(request.sessionId, "RELEASE", (signal) =>
    releaseDesktopSessionUnlocked(request, {
      ...options,
      operationSignal: signal,
    })
  );
}

async function releaseDesktopSessionUnlocked(
  request: DesktopAgentReleaseRequest,
  options: CheckInDesktopSessionOptions
): Promise<DesktopAgentReleaseResponse> {
  const allowedUploadOrigins =
    options.allowedUploadOrigins ?? getAllowedDownloadOrigins();
  const fetchUpload = bindOperationSignal(
    options.fetchUpload ?? defaultFetchUpload,
    options.operationSignal
  );
  const sessionStore = options.sessionStore ?? createSessionStore();
  const session = await sessionStore.get(request.sessionId);
  if (!session) {
    throw new DesktopAgentError(
      "SESSION_NOT_FOUND",
      "Tracked file session was not found."
    );
  }

  if (isCleanupOnlyLifecycle(session.lifecycleState)) {
    return finalizeLocalCleanup(request.sessionId, session, sessionStore);
  }

  assertAllowedUploadOrigin(request.releaseUrl, allowedUploadOrigins);

  if (isReleaseOnlyLifecycle(session.lifecycleState)) {
    const releaseDecision = await getStoredReleaseDecision(
      session,
      sessionStore
    );
    return releaseMasterAndCleanup({
      request,
      session,
      sessionStore,
      fetchUpload,
      releaseReason: releaseDecision.reason,
      releaseHash: releaseDecision.hash,
      cacheIndex: options.cacheIndex,
    });
  }

  const releaseHash = session.lastKnownHash || session.originalHash;
  const pendingRelease = await updateSessionIfCurrent(
    sessionStore,
    session,
    [
      "LAUNCHING",
      "OPEN_NOT_OBSERVED",
      "OPEN",
      "LAUNCH_FAILED",
      "CLOSE_DETECTED",
      "CHECKIN_FAILED",
    ],
    {
      lifecycleState: "RELEASE_PENDING",
      status: "RELEASE_PENDING",
      pendingReleaseReason: "UNCHANGED_RELEASE",
      pendingReleaseHash: releaseHash,
      retryCount: 0,
      lastError: undefined,
    }
  );
  assertSessionStateUpdated(pendingRelease);

  return releaseMasterAndCleanup({
    request,
    session: pendingRelease,
    sessionStore,
    fetchUpload,
    releaseReason: "UNCHANGED_RELEASE",
    releaseHash,
    cacheIndex: options.cacheIndex,
  });
}

function isCleanupOnlyLifecycle(
  lifecycleState: DesktopAgentSession["lifecycleState"]
) {
  return (
    lifecycleState === "CLEANUP_PENDING" || lifecycleState === "CLEANUP_FAILED"
  );
}

function isReleaseOnlyLifecycle(
  lifecycleState: DesktopAgentSession["lifecycleState"]
) {
  return (
    lifecycleState === "RELEASE_PENDING" || lifecycleState === "RELEASE_FAILED"
  );
}

async function releaseMasterAndCleanup({
  request,
  session,
  sessionStore,
  fetchUpload,
  releaseReason,
  releaseHash,
  cacheIndex,
}: {
  request: Pick<DesktopAgentCheckInRequest, "sessionId" | "releaseUrl">;
  session: DesktopAgentSession;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
  fetchUpload: FetchUpload;
  releaseReason: DesktopAgentPendingReleaseReason;
  releaseHash: string;
  cacheIndex?: SnapshotCacheIndex;
}): Promise<DesktopAgentCheckInResponse> {
  const releasing = await updateSessionIfCurrent(
    sessionStore,
    session,
    ["RELEASE_PENDING", "RELEASE_FAILED"],
    {
      lifecycleState: "RELEASING",
      status: "RELEASING",
      lastReleaseAttemptAt: new Date().toISOString(),
    }
  );
  assertSessionStateUpdated(releasing);
  const releaseResponse = await fetchWithFailureState({
    fetchUpload,
    url: request.releaseUrl,
    init: {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: session.projectId,
        attachmentId: session.attachmentId,
        grantSecret: session.grantSecret,
        lockEpoch: session.lockEpoch,
        reason: releaseReason,
      }),
    },
    session: releasing,
    sessionStore,
    sessionId: request.sessionId,
    stage: "RELEASE",
    fallbackCode: "RELEASE_FAILED",
    fallbackMessage: "Could not release Master.",
  });
  if (!releaseResponse.ok) {
    const error = await readServerError(
      releaseResponse,
      "RELEASE_FAILED",
      "Could not release Master."
    );
    await updateSessionForServerFailure({
      session: releasing,
      sessionStore,
      sessionId: request.sessionId,
      stage: "RELEASE",
      error,
    });
    throw new DesktopAgentError(error.code, error.message);
  }
  await cleanupCheckInSnapshot(
    session.checkInSnapshot,
    session.localPath,
    cacheIndex
  );

  const cleanupPending = await updateSessionIfCurrent(
    sessionStore,
    releasing,
    ["RELEASING"],
    {
      lifecycleState: "CLEANUP_PENDING",
      status: "CLEANUP_PENDING",
      lastCleanupAttemptAt: new Date().toISOString(),
      retryCount: 0,
      lastError: undefined,
    }
  );
  assertSessionStateUpdated(cleanupPending);
  const closedSession = await sessionStore.remove(request.sessionId);
  if (!closedSession) {
    throw new DesktopAgentError(
      "SESSION_NOT_FOUND",
      "Tracked file session was not found."
    );
  }

  return {
    ok: true,
    session: {
      ...closedSession,
      lifecycleState: "CLOSED",
      contentState:
        releaseReason === "CHECKED_IN" ? "UPLOADED" : session.contentState,
      lastKnownHash: releaseHash,
      lastUploadedHash:
        releaseReason === "CHECKED_IN" ? releaseHash : session.lastUploadedHash,
      status: "CLOSED",
    },
  };
}

async function finalizeLocalCleanup(
  sessionId: string,
  session: DesktopAgentSession,
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>
): Promise<DesktopAgentCheckInResponse> {
  const cleanupPending = await updateSessionIfCurrent(
    sessionStore,
    session,
    ["CLEANUP_PENDING", "CLEANUP_FAILED"],
    {
      lifecycleState: "CLEANUP_PENDING",
      status: "CLEANUP_PENDING",
      lastCleanupAttemptAt: new Date().toISOString(),
    }
  );
  assertSessionStateUpdated(cleanupPending);
  const closedSession = await sessionStore.remove(sessionId);
  if (!closedSession) {
    throw new DesktopAgentError(
      "SESSION_NOT_FOUND",
      "Tracked file session was not found."
    );
  }
  return {
    ok: true,
    session: {
      ...closedSession,
      lifecycleState: "CLOSED",
      status: "CLOSED",
    },
  };
}

async function updateSessionIfCurrent(
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>,
  expected: DesktopAgentSession,
  allowedLifecycles: DesktopAgentSession["lifecycleState"][],
  patch: Partial<DesktopAgentSession>
) {
  const predicate = (current: DesktopAgentSession) =>
    current.sessionId === expected.sessionId &&
    current.lockSessionId === expected.lockSessionId &&
    current.generation === expected.generation &&
    current.openSignalToken === expected.openSignalToken &&
    current.closeSignalToken === expected.closeSignalToken &&
    allowedLifecycles.includes(current.lifecycleState);
  if (sessionStore.updateIf) {
    return sessionStore.updateIf(expected.sessionId, predicate, patch);
  }
  const current = await sessionStore.get(expected.sessionId);
  if (!current || !predicate(current)) {
    return null;
  }
  return sessionStore.update(expected.sessionId, patch);
}

function assertSessionStateUpdated(
  session: DesktopAgentSession | null
): asserts session is DesktopAgentSession {
  if (session) {
    return;
  }
  throw new DesktopAgentError(
    "SESSION_STATE_CHANGED",
    "Tracked file session state changed."
  );
}

function nextRetryCount(
  session: DesktopAgentSession,
  matchingLifecycles: DesktopAgentSession["lifecycleState"][]
) {
  return matchingLifecycles.includes(session.lifecycleState)
    ? (session.retryCount ?? 0) + 1
    : 1;
}

async function fetchWithFailureState({
  fetchUpload,
  url,
  init,
  session,
  sessionStore,
  sessionId,
  stage,
  fallbackCode,
  fallbackMessage,
}: {
  fetchUpload: FetchUpload;
  url: string;
  init: Parameters<FetchUpload>[1];
  session: DesktopAgentSession;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
  sessionId: string;
  stage: "CHECK_IN" | "RELEASE";
  fallbackCode: string;
  fallbackMessage: string;
}) {
  try {
    return await retryControlRequest(() => fetchUpload(url, init));
  } catch {
    const error = { code: fallbackCode, message: fallbackMessage };
    await updateSessionForServerFailure({
      session,
      sessionStore,
      sessionId,
      stage,
      error,
    });
    throw new DesktopAgentError(error.code, error.message);
  }
}

async function readServerError(
  response: Response,
  fallbackCode: string,
  fallbackMessage: string
) {
  const body = (await response
    .json()
    .catch(() => null)) as ServerErrorBody | null;
  return {
    code: body?.code || fallbackCode,
    message: body?.message || fallbackMessage,
  };
}

async function updateSessionForServerFailure({
  session,
  sessionStore,
  sessionId: _sessionId,
  stage,
  error,
}: {
  session: DesktopAgentSession;
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>;
  sessionId: string;
  stage: "CHECK_IN" | "RELEASE";
  error: { code: string; message: string };
}) {
  if (error.code === "CONFLICT_RISK") {
    await updateSessionIfCurrent(
      sessionStore,
      session,
      getFailureUpdateLifecycles(stage),
      {
        lifecycleState: "CONFLICT_RISK",
        status: "CONFLICT_RISK",
        lastError: error.message,
      }
    );
    return;
  }

  if (error.code === "LOCK_REVOKED" || error.code === "LOCK_SESSION_MISMATCH") {
    await updateSessionIfCurrent(
      sessionStore,
      session,
      getFailureUpdateLifecycles(stage),
      {
        lifecycleState: "LOCK_REVOKED",
        status: "LOCK_REVOKED",
        lastError: error.message,
      }
    );
    return;
  }

  if (stage === "CHECK_IN") {
    await updateSessionIfCurrent(sessionStore, session, ["CHECKING_IN"], {
      lifecycleState: "CHECKIN_FAILED",
      status: "CHECKIN_FAILED",
      retryCount: nextRetryCount(session, ["CHECKIN_FAILED", "CHECKING_IN"]),
      lastError: error.message,
    });
    return;
  }

  await updateSessionIfCurrent(sessionStore, session, ["RELEASING"], {
    lifecycleState: "RELEASE_FAILED",
    status: "RELEASE_FAILED",
    pendingReleaseReason: session.pendingReleaseReason,
    pendingReleaseHash: session.pendingReleaseHash,
    retryCount: nextRetryCount(session, [
      "RELEASE_FAILED",
      "RELEASE_PENDING",
      "RELEASING",
    ]),
    lastError: error.message,
  });
}

function getFailureUpdateLifecycles(
  stage: "CHECK_IN" | "RELEASE"
): DesktopAgentSession["lifecycleState"][] {
  return stage === "CHECK_IN" ? ["CHECKING_IN"] : ["RELEASING"];
}

async function getStoredReleaseDecision(
  session: DesktopAgentSession,
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>
) {
  if (session.pendingReleaseReason && session.pendingReleaseHash) {
    return {
      reason: session.pendingReleaseReason,
      hash: session.pendingReleaseHash,
    };
  }
  const patch: Partial<DesktopAgentSession> = {
    lifecycleState: "CONFLICT_RISK",
    status: "CONFLICT_RISK",
    lastError: "Stored release decision is missing.",
  };
  const hasMissingDecision = (current: DesktopAgentSession) =>
    current.sessionId === session.sessionId &&
    current.lockSessionId === session.lockSessionId &&
    current.generation === session.generation &&
    current.openSignalToken === session.openSignalToken &&
    current.closeSignalToken === session.closeSignalToken &&
    (current.lifecycleState === "RELEASE_PENDING" ||
      current.lifecycleState === "RELEASE_FAILED") &&
    !current.pendingReleaseReason &&
    !current.pendingReleaseHash;
  const updated = sessionStore.updateIf
    ? await sessionStore.updateIf(session.sessionId, hasMissingDecision, patch)
    : await markMissingStoredReleaseDecisionWithoutUpdateIf(
        session,
        sessionStore,
        hasMissingDecision,
        patch
      );
  assertSessionStateUpdated(updated);
  throw new DesktopAgentError(
    "CONFLICT_RISK",
    "Stored release decision is missing."
  );
}

async function markMissingStoredReleaseDecisionWithoutUpdateIf(
  session: DesktopAgentSession,
  sessionStore: NonNullable<CheckInDesktopSessionOptions["sessionStore"]>,
  predicate: (session: DesktopAgentSession) => boolean,
  patch: Partial<DesktopAgentSession>
) {
  const current = await sessionStore.get(session.sessionId);
  if (
    current?.pendingReleaseReason &&
    current.pendingReleaseHash &&
    current.generation === session.generation
  ) {
    return current;
  }
  if (!current || !predicate(current)) {
    return null;
  }
  return sessionStore.update(session.sessionId, patch);
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

function assertAllowedUploadOrigin(
  uploadUrl: string,
  allowedUploadOrigins: string[]
) {
  const { origin } = new URL(uploadUrl);
  if (!allowedUploadOrigins.includes(origin)) {
    throw new DesktopAgentError(
      "ORIGIN_NOT_ALLOWED",
      "Upload URL origin is not allowed."
    );
  }
}

function defaultFetchUpload(url: string, init: Parameters<FetchUpload>[1]) {
  return fetchWithDesktopAgentTimeout(fetch, url, init as RequestInit);
}

function defaultFetchTransfer(url: string, init: Parameters<FetchUpload>[1]) {
  return fetchWithDesktopAgentTimeout(
    fetch,
    url,
    init as RequestInit,
    getDesktopAgentTransferTimeoutMs()
  );
}

function bindOperationSignal(
  fetchUpload: FetchUpload,
  signal: AbortSignal | undefined
): FetchUpload {
  if (!signal) {
    return fetchUpload;
  }
  return (url, init) =>
    fetchUpload(url, {
      ...init,
      signal: combineAbortSignals(signal, init.signal),
    });
}

function combineAbortSignals(
  operationSignal: AbortSignal,
  requestSignal: AbortSignal | undefined
) {
  if (!requestSignal) {
    return operationSignal;
  }
  return AbortSignal.any([operationSignal, requestSignal]);
}

async function runSessionOperation<T>(
  sessionId: string,
  kind: SessionOperationKind,
  operation: (signal: AbortSignal) => Promise<T>
): Promise<T> {
  const active = activeSessionOperations.get(sessionId);
  if (active) {
    if (active.kind === kind) {
      return active.promise as Promise<T>;
    }
    if (kind === "RELEASE" && active.kind === "CHECK_IN") {
      active.controller.abort();
    }
    await active.promise.catch(() => {});
    return runSessionOperation(sessionId, kind, operation);
  }

  const controller = new AbortController();
  const promise = operation(controller.signal);
  const current: ActiveSessionOperation = { kind, controller, promise };
  activeSessionOperations.set(sessionId, current);
  try {
    return await promise;
  } finally {
    if (activeSessionOperations.get(sessionId) === current) {
      activeSessionOperations.delete(sessionId);
    }
  }
}

async function defaultWaitForStableFile(filePath: string) {
  let previous = await getFileSnapshot(filePath);

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await delay(500);
    const current = await getFileSnapshot(filePath);
    if (
      current.size === previous.size &&
      current.mtimeMs === previous.mtimeMs
    ) {
      return;
    }
    previous = current;
  }

  throw new DesktopAgentError(
    "LOCAL_FILE_BUSY",
    "The tracked local file is still being saved."
  );
}

async function getFileSnapshot(filePath: string) {
  try {
    const fileStat = await stat(filePath);
    return {
      size: fileStat.size,
      mtimeMs: fileStat.mtimeMs,
    };
  } catch {
    throw new DesktopAgentError(
      "LOCAL_FILE_MISSING",
      "The tracked local file is no longer in the controlled cache."
    );
  }
}
