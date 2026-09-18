import { createHash, randomUUID } from "node:crypto";
import { createWriteStream } from "node:fs";
import {
  access,
  chmod,
  copyFile,
  mkdir,
  open,
  readFile,
  rename,
  rm,
  stat,
} from "node:fs/promises";
import pathModule from "node:path";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { setTimeout as delay } from "node:timers/promises";

import {
  getDesktopAgentCompatibilityStatus,
  isDesktopAgentOpenSupportedFileName,
} from "@project-wing/shared/desktop";
import type {
  DesktopAgentLaunchFailedReason,
  DesktopAgentOpenRequest,
  DesktopAgentOpenResponse,
  DesktopAgentSession,
  DesktopAgentSessionContentState,
} from "@project-wing/shared/desktop";

import type { CacheEntryState, DesktopAgentCacheIndex } from "./cache-index.js";
import {
  getAgentBaseUrl,
  getAllowedDownloadOrigins,
  getCacheRoot,
  getDesktopAgentTransferTimeoutMs,
  getMasterOpenObservationTimeoutMs,
  getPdfMasterOpenObservationTimeoutMs,
} from "./config.js";
import { DesktopAgentError } from "./errors.js";
import { fetchWithDesktopAgentTimeout } from "./fetch-timeout.js";
import { launchFile as defaultLaunchFile } from "./launcher.js";
import type { LaunchFileContext, LaunchFileResult } from "./launcher.js";
import {
  getMasterLaunchFailedBeforeVisibleMessage,
  getMasterOpenObservationTimeoutMessage,
  getMasterOpenObservationTimeoutMsForFileName,
} from "./master-open-observation.js";
import { buildCacheFilePath } from "./path-safety.js";
import { createSessionStore, hashFile } from "./session-store.js";

export { DesktopAgentError } from "./errors.js";

const { basename, dirname, join } = pathModule;

export type AuthenticatedDesktopAgentOpenRequest = DesktopAgentOpenRequest & {
  authorization: string;
};

const DEFAULT_MASTER_OPEN_OBSERVATION_POLL_INTERVAL_MS = 100;
const LEGACY_MASTER_CACHE_MANIFEST_VERSION = 1;
const MASTER_CACHE_MANIFEST_FILE_NAME = ".project-wing-cache.json";
const MASTER_CACHE_MANIFEST_VERSION = 2;

type FetchFile = (
  url: string,
  init: { headers: Record<string, string> }
) => Promise<Response>;

type MasterCacheManifest = {
  version:
    | typeof MASTER_CACHE_MANIFEST_VERSION
    | typeof LEGACY_MASTER_CACHE_MANIFEST_VERSION;
  projectId: string;
  attachmentId: string;
  lockSessionId: string;
  cacheVersionId?: string;
  cacheOwnerId?: string;
  fileSize?: number;
  contentHash?: string;
  fileName: string;
  originalHash: string;
  createdAt: string;
};

type MasterCachePlan = {
  reuseExisting: boolean;
  repairManifest: boolean;
};

type VersionedMasterCacheHit = {
  originalHash: string;
  lastKnownHash: string;
  repairManifest: boolean;
};

type DownloadedFile = {
  temporaryPath: string;
  sha256: string | null;
};

export type OpenDesktopFileOptions = {
  allowedDownloadOrigins?: string[];
  cacheRoot?: string;
  cacheIndex?: Pick<
    DesktopAgentCacheIndex,
    "findReusable" | "recordAccess" | "trim"
  >;
  fetchFile?: FetchFile;
  launchFile?: (
    filePath: string,
    context?: LaunchFileContext
  ) => Promise<LaunchFileResult | undefined> | LaunchFileResult | undefined;
  now?: () => Date;
  randomUUID?: () => string;
  sessionStore?: {
    list?: () => Promise<DesktopAgentSession[]>;
    get?: (sessionId: string) => Promise<DesktopAgentSession | null>;
    upsert: (session: DesktopAgentSession) => Promise<DesktopAgentSession>;
    update?: (
      sessionId: string,
      patch: Partial<DesktopAgentSession>
    ) => Promise<DesktopAgentSession | null>;
  };
  openObservationTimeoutMs?: number;
  openObservationPollIntervalMs?: number;
  terminateHelperProcess?: (processId: number) => void;
};

export async function openDesktopFile(
  request: AuthenticatedDesktopAgentOpenRequest,
  options: OpenDesktopFileOptions = {}
): Promise<DesktopAgentOpenResponse> {
  const allowedDownloadOrigins =
    options.allowedDownloadOrigins ?? getAllowedDownloadOrigins();
  const cacheRoot = options.cacheRoot ?? getCacheRoot();
  const { cacheIndex } = options;
  const fetchFile = options.fetchFile ?? defaultFetchFile;
  const launchFile = options.launchFile ?? defaultLaunchFile;
  const now = options.now ?? (() => new Date());
  const makeSessionId = options.randomUUID ?? randomUUID;
  const sessionStore = options.sessionStore ?? createSessionStore();
  const masterOpenObservationTimeoutMs =
    options.openObservationTimeoutMs ?? getMasterOpenObservationTimeoutMs();
  const pdfMasterOpenObservationTimeoutMs =
    options.openObservationTimeoutMs ?? getPdfMasterOpenObservationTimeoutMs();
  const openObservationTimeoutMs = getMasterOpenObservationTimeoutMsForFileName(
    request.fileName,
    {
      masterTimeoutMs: masterOpenObservationTimeoutMs,
      pdfTimeoutMs: pdfMasterOpenObservationTimeoutMs,
    }
  );
  const openObservationPollIntervalMs =
    options.openObservationPollIntervalMs ??
    DEFAULT_MASTER_OPEN_OBSERVATION_POLL_INTERVAL_MS;
  const terminateHelperProcess =
    options.terminateHelperProcess ?? defaultTerminateHelperProcess;

  assertAllowedDownloadOrigin(request.downloadUrl, allowedDownloadOrigins);
  assertSupportedDesktopOpenFile(request.fileName, request.mode);
  if (request.mode === "MASTER") {
    await guardLocalMasterSession(request, sessionStore, {
      now: now(),
      masterOpenObservationTimeoutMs,
      pdfMasterOpenObservationTimeoutMs,
    });
  }

  const buildLocalPath = () =>
    buildCacheFilePath({
      cacheRoot,
      mode: request.mode,
      projectId: request.projectId,
      attachmentId: request.attachmentId,
      lockSessionId: request.lockSessionId,
      cacheVersionId: request.cacheVersionId,
      fileName: request.fileName,
    });
  let downloadedFile: DownloadedFile | null = null;
  let downloadedHash: string | null = null;
  let localPath: string;
  let masterCachePlan: MasterCachePlan | null = null;
  let versionedCacheHit: VersionedMasterCacheHit | null = null;

  if (request.mode === "MASTER" && request.cacheVersionId) {
    localPath = buildLocalPath();
    versionedCacheHit = await readVersionedMasterCacheHit({
      request,
      localPath,
    });
    downloadedHash = versionedCacheHit?.originalHash ?? null;
    masterCachePlan = versionedCacheHit
      ? {
          reuseExisting: true,
          repairManifest: versionedCacheHit.repairManifest,
        }
      : null;
    if (!versionedCacheHit) {
      if (cacheIndex) {
        const protectedPaths = await listProtectedCachePaths(sessionStore);
        await cacheIndex.trim({
          cacheRoot,
          incomingBytes: request.fileSize ?? 0,
          protectedPaths,
        });
      }
      downloadedFile = await downloadFileWithResume({
        request,
        localPath,
        fetchFile,
      });
      downloadedHash = downloadedFile.sha256;
      const { temporaryPath } = downloadedFile;
      try {
        masterCachePlan = await planMasterCacheRecovery({
          request,
          localPath,
          downloadedHash: downloadedHash ?? "",
        });
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    }
  } else {
    let pendingLocalPath =
      request.mode === "MASTER" && request.contentToken && cacheIndex
        ? buildLocalPath()
        : null;
    downloadedFile =
      request.mode === "MASTER" &&
      request.contentToken &&
      cacheIndex &&
      pendingLocalPath
        ? await copyReusableCacheToTemporaryFile({
            request,
            localPath: pendingLocalPath,
            cacheRoot,
            cacheIndex,
            sessionStore,
          })
        : null;
    if (!downloadedFile) {
      const response = await fetchFile(request.downloadUrl, {
        headers: request.authorization
          ? { Authorization: request.authorization }
          : {},
      });
      assertDownloadResponse(response);
      pendingLocalPath ??= buildLocalPath();
      if (cacheIndex) {
        const protectedPaths = await listProtectedCachePaths(sessionStore);
        await cacheIndex.trim({
          cacheRoot,
          incomingBytes: parseContentLength(
            response.headers.get("content-length")
          ),
          protectedPaths,
        });
      }
      downloadedFile = await downloadResponseToTemporaryFile(
        response,
        pendingLocalPath,
        { computeSha256: request.mode === "MASTER" }
      );
    }
    localPath = pendingLocalPath ?? buildLocalPath();
    downloadedHash = downloadedFile.sha256;
    if (request.mode === "MASTER") {
      const { temporaryPath } = downloadedFile;
      try {
        masterCachePlan = await planMasterCacheRecovery({
          request,
          localPath,
          downloadedHash: downloadedHash ?? "",
        });
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
    }
  }
  if (
    request.mode === "MASTER" &&
    request.contentHash &&
    downloadedHash &&
    downloadedHash.toLowerCase() !== request.contentHash.toLowerCase()
  ) {
    if (downloadedFile) {
      await rm(downloadedFile.temporaryPath, { force: true }).catch(() => {});
    }
    throw new DesktopAgentError(
      "DOWNLOAD_INTEGRITY_FAILED",
      "The downloaded Master file did not match the server content hash."
    );
  }
  const sessionId = makeSessionId();
  const generation = 1;
  const openSignalToken =
    request.mode === "MASTER" ? makeSessionId() : undefined;
  const closeSignalToken =
    request.mode === "MASTER" ? makeSessionId() : undefined;
  const openedAt = now().toISOString();
  let masterContentState: DesktopAgentSessionContentState | undefined;
  try {
    if (request.mode === "MASTER") {
      if (!masterCachePlan?.reuseExisting) {
        if (!downloadedFile) {
          throw new DesktopAgentError(
            "FILE_WRITE_FAILED",
            "Downloaded Master file is unavailable."
          );
        }
        await commitTemporaryFile(downloadedFile.temporaryPath, localPath);
      } else if (downloadedFile) {
        await rm(downloadedFile.temporaryPath, { force: true }).catch(() => {});
      }
      if (!masterCachePlan?.reuseExisting || masterCachePlan.repairManifest) {
        await writeMasterCacheManifest(
          localPath,
          buildMasterCacheManifest(request, downloadedHash ?? "", openedAt)
        );
      }
    } else {
      if (!downloadedFile) {
        throw new DesktopAgentError(
          "FILE_WRITE_FAILED",
          "Downloaded file is unavailable."
        );
      }
      await commitTemporaryFile(downloadedFile.temporaryPath, localPath, {
        replace: true,
      });
      if (request.mode === "READ_ONLY") {
        await chmod(localPath, 0o444).catch(() => {});
      }
    }
  } catch (error) {
    if (downloadedFile) {
      await rm(downloadedFile.temporaryPath, { force: true }).catch(() => {});
    }
    throw new DesktopAgentError(
      "FILE_WRITE_FAILED",
      error instanceof Error
        ? error.message
        : "Could not write the selected file."
    );
  }

  if (request.mode === "MASTER") {
    const originalHash = downloadedHash ?? "";
    const lastKnownHash =
      versionedCacheHit?.lastKnownHash ??
      (masterCachePlan?.reuseExisting
        ? await hashFile(localPath)
        : originalHash);
    const contentState = lastKnownHash === originalHash ? "UNCHANGED" : "DIRTY";
    masterContentState = contentState;
    const lifecycleState = "LAUNCHING";
    await sessionStore.upsert({
      sessionId,
      generation,
      lockSessionId: request.lockSessionId,
      mode: request.mode,
      projectId: request.projectId,
      attachmentId: request.attachmentId,
      fileName: request.fileName,
      localPath,
      baseVersion: request.baseVersion,
      baseVersionId: request.baseVersionId,
      lockEpoch: request.lockEpoch,
      cacheVersionId: request.cacheVersionId,
      cacheOwnerId: request.cacheOwnerId,
      fileSize: request.fileSize,
      mimeType: request.mimeType,
      contentHash: request.contentHash,
      directUploadSupported: request.directUploadSupported,
      heartbeatUrl: request.heartbeatUrl,
      checkInUrl: request.checkInUrl,
      releaseUrl: request.releaseUrl,
      originalHash,
      lastKnownHash,
      grantSecret: request.grantSecret,
      openSignalToken,
      closeSignalToken,
      lifecycleState,
      contentState,
      status: getDesktopAgentCompatibilityStatus({
        lifecycleState,
        contentState,
      }),
      openedAt,
      launchStartedAt: openedAt,
      lastSeenAt: openedAt,
      retryCount: 0,
    });
  }

  let launchResult: LaunchFileResult | undefined = undefined;
  try {
    launchResult = await launchFile(localPath, {
      mode: request.mode,
      sessionId,
      generation,
      openSignalToken,
      closeSignalToken,
      agentBaseUrl: getAgentBaseUrl(),
    });
    if (request.mode === "MASTER" && launchResult && sessionStore.update) {
      const launchPatch: Partial<DesktopAgentSession> = {};
      if (launchResult.helperProcessId) {
        launchPatch.excelHelperProcessId = launchResult.helperProcessId;
      }
      if (launchResult.openObservedOnSpawn) {
        const lifecycleState = "OPEN";
        const contentState = masterContentState ?? "UNCHANGED";
        const observedAt = now().toISOString();
        launchPatch.lifecycleState = lifecycleState;
        launchPatch.contentState = contentState;
        launchPatch.status = getDesktopAgentCompatibilityStatus({
          lifecycleState,
          contentState,
        });
        launchPatch.openObservedAt = observedAt;
        launchPatch.openObservedSource =
          launchResult.openObservedSource ?? "LAUNCHER_PROCESS";
        launchPatch.lastObservationAt = observedAt;
        launchPatch.lastObservationDiagnostic = undefined;
        launchPatch.lastError = undefined;
      }
      if (Object.keys(launchPatch).length > 0) {
        await sessionStore.update(sessionId, launchPatch);
      }
    }
    if (request.mode === "MASTER") {
      await waitForMasterOpenObservation({
        sessionId,
        fileName: request.fileName,
        sessionStore,
        timeoutMs: openObservationTimeoutMs,
        pollIntervalMs: openObservationPollIntervalMs,
      });
    }
  } catch (error) {
    if (request.mode === "MASTER" && launchResult?.helperProcessId) {
      terminateHelperProcess(launchResult.helperProcessId);
    }
    if (request.mode === "MASTER" && sessionStore.update) {
      const message =
        error instanceof Error ? error.message : "Could not open the file.";
      const lifecycleState = "LAUNCH_FAILED";
      const contentState = masterContentState ?? "UNCHANGED";
      const launchFailedReason = await getLaunchFailedReason({
        sessionId,
        sessionStore,
        error,
      });
      await sessionStore.update(sessionId, {
        lifecycleState,
        contentState,
        status: getDesktopAgentCompatibilityStatus({
          lifecycleState,
          contentState,
        }),
        launchFailedReason,
        lastError: message,
      });
    }
    throw new DesktopAgentError(
      "OPEN_FAILED",
      error instanceof Error ? error.message : "Could not open the file."
    );
  }

  if (cacheIndex) {
    const state: CacheEntryState =
      request.mode === "MASTER" && masterContentState === "DIRTY"
        ? "DIRTY"
        : "CLEAN";
    await cacheIndex
      .recordAccess({
        localPath,
        projectId: request.projectId,
        attachmentId: request.attachmentId,
        mode: request.mode,
        contentToken: request.contentToken,
        remoteVersionId: request.baseVersionId,
        remoteContentHash: request.contentHash,
        contentHash: downloadedHash,
        state,
      })
      .then(async () => {
        const protectedPaths = await listProtectedCachePaths(sessionStore);
        await cacheIndex.trim({ cacheRoot, protectedPaths });
      })
      .catch(() => {});
  }

  return {
    ok: true,
    sessionId,
    localPath,
    openedAt,
  };
}

async function copyReusableCacheToTemporaryFile({
  request,
  localPath,
  cacheRoot,
  cacheIndex,
  sessionStore,
}: {
  request: AuthenticatedDesktopAgentOpenRequest;
  localPath: string;
  cacheRoot: string;
  cacheIndex: NonNullable<OpenDesktopFileOptions["cacheIndex"]>;
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>;
}): Promise<DownloadedFile | null> {
  if (!request.contentToken) {
    return null;
  }
  const cached = cacheIndex.findReusable({
    projectId: request.projectId,
    attachmentId: request.attachmentId,
    contentToken: request.contentToken,
    remoteVersionId: request.baseVersionId,
    remoteContentHash: request.contentHash,
    excludePath: localPath,
  });
  if (!cached?.contentHash) {
    return null;
  }

  const actualHash = await hashFile(cached.localPath).catch(() => null);
  if (actualHash !== cached.contentHash) {
    return null;
  }

  const protectedPaths = await listProtectedCachePaths(sessionStore);
  await cacheIndex.trim({
    cacheRoot,
    incomingBytes: cached.sizeBytes,
    protectedPaths: [...protectedPaths, cached.localPath],
  });

  const temporaryPath = buildTemporaryFilePath(localPath);
  try {
    await mkdir(dirname(localPath), { recursive: true });
    await copyFile(cached.localPath, temporaryPath);
    await cacheIndex.recordAccess({
      localPath: cached.localPath,
      projectId: cached.projectId,
      attachmentId: cached.attachmentId,
      mode: cached.mode,
      contentToken: cached.contentToken,
      remoteVersionId: cached.remoteVersionId,
      remoteContentHash: cached.remoteContentHash,
      contentHash: cached.contentHash,
      state: "CLEAN",
    });
    return { temporaryPath, sha256: actualHash };
  } catch {
    await rm(temporaryPath, { force: true }).catch(() => {});
    return null;
  }
}

async function listProtectedCachePaths(
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>
) {
  if (!sessionStore.list) {
    return [];
  }
  const sessions = await sessionStore.list();
  return sessions
    .filter(
      (session) =>
        session.mode === "MASTER" &&
        !["CLOSED", "LOCAL_FILE_MISSING"].includes(session.lifecycleState)
    )
    .map((session) => session.localPath);
}

function parseContentLength(value: string | null) {
  if (!value) {
    return 0;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function waitForMasterOpenObservation({
  sessionId,
  fileName,
  sessionStore,
  timeoutMs,
  pollIntervalMs,
}: {
  sessionId: string;
  fileName: string;
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>;
  timeoutMs: number;
  pollIntervalMs: number;
}) {
  if (!sessionStore.get) {
    return;
  }

  const startedAt = Date.now();
  const safeTimeoutMs = Math.max(0, timeoutMs);
  const safePollIntervalMs = Math.max(0, pollIntervalMs);

  while (true) {
    const session = await sessionStore.get(sessionId);
    if (!session) {
      throw new DesktopAgentError(
        "OPEN_FAILED",
        "Tracked file session was not found after launch."
      );
    }

    if (session.lifecycleState === "OPEN" && session.openObservedAt) {
      return;
    }

    if (session.lifecycleState === "LAUNCH_FAILED") {
      throw new DesktopAgentError(
        "OPEN_FAILED",
        session.lastError ?? getMasterLaunchFailedBeforeVisibleMessage(fileName)
      );
    }

    if (
      [
        "CLOSED",
        "LOCAL_FILE_MISSING",
        "CONFLICT_RISK",
        "LEASE_LOST",
        "LOCK_REVOKED",
      ].includes(session.lifecycleState)
    ) {
      throw new DesktopAgentError(
        "OPEN_FAILED",
        "Tracked file session is no longer launchable."
      );
    }

    if (Date.now() - startedAt >= safeTimeoutMs) {
      throw new DesktopAgentError(
        "OPEN_FAILED",
        getMasterOpenObservationTimeoutMessage(fileName)
      );
    }

    await delay(safePollIntervalMs);
  }
}

function defaultTerminateHelperProcess(processId: number) {
  try {
    process.kill(processId);
  } catch {
    // The watcher may already have exited after reporting launch failure.
  }
}

function assertAllowedDownloadOrigin(
  downloadUrl: string,
  allowedDownloadOrigins: string[]
) {
  const { origin } = new URL(downloadUrl);
  if (!allowedDownloadOrigins.includes(origin)) {
    throw new DesktopAgentError(
      "ORIGIN_NOT_ALLOWED",
      `Download URL origin is not allowed: ${origin}`
    );
  }
}

function assertSupportedDesktopOpenFile(
  fileName: string,
  mode: "MASTER" | "READ_ONLY"
) {
  // Local open reuses the READ_ONLY transport, but unsupported formats are
  // Launched without a tracked read-only session by the EMP caller.
  if (mode === "READ_ONLY") {
    return;
  }
  if (!isDesktopAgentOpenSupportedFileName(fileName, mode)) {
    throw new DesktopAgentError(
      "UNSUPPORTED_FILE_TYPE",
      "Project Wing Desktop Agent currently supports xlsx, xls, xlsm, xlsb, csv, tsv, docx, doc, pptx, ppt, and pdf files only."
    );
  }
}

function defaultFetchFile(
  url: string,
  init: { headers: Record<string, string> }
) {
  return fetchWithDesktopAgentTimeout(
    fetch,
    url,
    init,
    getDesktopAgentTransferTimeoutMs()
  );
}

async function downloadFileWithResume({
  request,
  localPath,
  fetchFile,
}: {
  request: AuthenticatedDesktopAgentOpenRequest;
  localPath: string;
  fetchFile: FetchFile;
}): Promise<DownloadedFile> {
  if (
    request.mode !== "MASTER" ||
    !request.cacheVersionId ||
    request.fileSize === undefined
  ) {
    const response = await fetchFile(request.downloadUrl, {
      headers: request.authorization
        ? { Authorization: request.authorization }
        : {},
    });
    assertDownloadResponse(response);
    return downloadResponseToTemporaryFile(response, localPath, {
      computeSha256: request.mode === "MASTER",
    });
  }

  const temporaryPath = join(
    dirname(localPath),
    `.${basename(localPath)}.download.part`
  );
  await mkdir(dirname(localPath), { recursive: true });
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    let currentSize = await fileSizeOrZero(temporaryPath);
    if (currentSize > request.fileSize) {
      await rm(temporaryPath, { force: true });
      currentSize = 0;
    }
    if (currentSize === request.fileSize) {
      return { temporaryPath, sha256: await hashFile(temporaryPath) };
    }

    try {
      const headers: Record<string, string> = request.authorization
        ? { Authorization: request.authorization }
        : {};
      if (currentSize > 0) {
        headers.Range = `bytes=${currentSize}-`;
      }
      const response = await fetchFile(request.downloadUrl, { headers });
      assertDownloadResponse(response);
      const append = currentSize > 0 && response.status === 206;
      if (currentSize > 0 && !append) {
        currentSize = 0;
      }
      if (
        append &&
        !hasMatchingContentRange(response, currentSize, request.fileSize)
      ) {
        await rm(temporaryPath, { force: true });
        throw new Error(
          "Download range response did not match the checkpoint."
        );
      }
      await streamDownloadResponse(response, temporaryPath, append);
      const completedSize = await fileSizeOrZero(temporaryPath);
      if (completedSize !== request.fileSize) {
        throw new Error(
          `Download ended at ${completedSize} of ${request.fileSize} bytes.`
        );
      }
      return { temporaryPath, sha256: await hashFile(temporaryPath) };
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await delay(250 * 2 ** attempt);
      }
    }
  }
  throw new DesktopAgentError(
    "DOWNLOAD_FAILED",
    lastError instanceof Error
      ? `Could not resume the selected file: ${lastError.message}`
      : "Could not resume the selected file."
  );
}

function assertDownloadResponse(response: Response) {
  if (response.ok) {
    return;
  }
  throw new DesktopAgentError(
    "DOWNLOAD_FAILED",
    "Could not download the selected file."
  );
}

async function streamDownloadResponse(
  response: Response,
  temporaryPath: string,
  append: boolean
) {
  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    const handle = await open(temporaryPath, append ? "a" : "w");
    try {
      await handle.writeFile(buffer);
      await handle.sync();
    } finally {
      await handle.close();
    }
    return;
  }
  await pipeline(
    Readable.fromWeb(response.body as unknown as NodeReadableStream),
    createWriteStream(temporaryPath, { flags: append ? "a" : "w" })
  );
}

function hasMatchingContentRange(
  response: Response,
  expectedStart: number,
  expectedTotal: number
) {
  const contentRange = response.headers.get("content-range");
  if (!contentRange) {
    return false;
  }
  const match = /^bytes\s+(\d+)-(\d+)\/(\d+)$/i.exec(contentRange.trim());
  if (!match) {
    return false;
  }
  const start = Number(match[1]);
  const end = Number(match[2]);
  const total = Number(match[3]);
  if (
    start !== expectedStart ||
    total !== expectedTotal ||
    end !== expectedTotal - 1
  ) {
    return false;
  }
  const contentLength = response.headers.get("content-length");
  return contentLength === null || Number(contentLength) === end - start + 1;
}

async function fileSizeOrZero(filePath: string) {
  try {
    const { size } = await stat(filePath);
    return size;
  } catch {
    return 0;
  }
}

async function downloadResponseToTemporaryFile(
  response: Response,
  destinationPath: string,
  options: { computeSha256: boolean }
): Promise<DownloadedFile> {
  const temporaryPath = buildTemporaryFilePath(destinationPath);
  const directoryPath = dirname(destinationPath);
  await mkdir(directoryPath, { recursive: true });

  if (!response.body) {
    const buffer = Buffer.from(await response.arrayBuffer());
    if (options.computeSha256) {
      return {
        temporaryPath: await writeBufferToTemporaryFile(temporaryPath, buffer),
        sha256: hashBuffer(buffer),
      };
    }
    return {
      temporaryPath: await writeBufferToTemporaryFile(temporaryPath, buffer),
      sha256: null,
    };
  }

  const sha256 = options.computeSha256 ? createHash("sha256") : null;
  const hashingTransform = new Transform({
    transform(chunk, _encoding, callback) {
      sha256?.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.fromWeb(response.body as unknown as NodeReadableStream),
      hashingTransform,
      createWriteStream(temporaryPath, { flags: "wx" })
    );
    return {
      temporaryPath,
      sha256: sha256?.digest("hex") ?? null,
    };
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  }
}

async function writeBufferToTemporaryFile(
  temporaryPath: string,
  content: Buffer
) {
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fileHandle = await open(temporaryPath, "wx");
    await fileHandle.writeFile(content);
    await fileHandle.sync();
    return temporaryPath;
  } catch (error) {
    await rm(temporaryPath, { force: true }).catch(() => {});
    throw error;
  } finally {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
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

function hashBuffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function planMasterCacheRecovery({
  request,
  localPath,
  downloadedHash,
}: {
  request: DesktopAgentOpenRequest;
  localPath: string;
  downloadedHash: string;
}): Promise<MasterCachePlan> {
  if (!(await fileExists(localPath))) {
    return { reuseExisting: false, repairManifest: false };
  }

  const manifest = await readMasterCacheManifest(localPath);
  const localHash = await hashFile(localPath).catch(() => null);
  if (manifest && isTrustedMasterCache(manifest, request, downloadedHash)) {
    if (
      localHash &&
      (localHash === downloadedHash ||
        canRecoverDirtyMasterCache(manifest, request))
    ) {
      return {
        reuseExisting: true,
        repairManifest:
          manifest.lockSessionId !== request.lockSessionId ||
          manifest.cacheOwnerId !== request.cacheOwnerId,
      };
    }
    throw unsafeMasterCacheError();
  }

  if (localHash === downloadedHash) {
    return { reuseExisting: true, repairManifest: true };
  }

  throw unsafeMasterCacheError();
}

async function readVersionedMasterCacheHit({
  request,
  localPath,
}: {
  request: DesktopAgentOpenRequest;
  localPath: string;
}): Promise<VersionedMasterCacheHit | null> {
  if (!request.cacheVersionId || !(await fileExists(localPath))) {
    return null;
  }

  const manifest = await readMasterCacheManifest(localPath);
  if (!manifest || !isTrustedMasterCache(manifest, request)) {
    return null;
  }

  const lastKnownHash = await hashFile(localPath).catch(() => null);
  if (!lastKnownHash) {
    return null;
  }
  const isDirty = lastKnownHash !== manifest.originalHash;
  if (isDirty && !canRecoverDirtyMasterCache(manifest, request)) {
    throw unsafeMasterCacheError();
  }
  return {
    originalHash: manifest.originalHash,
    lastKnownHash,
    repairManifest:
      manifest.lockSessionId !== request.lockSessionId ||
      manifest.cacheOwnerId !== request.cacheOwnerId,
  };
}

function canRecoverDirtyMasterCache(
  manifest: MasterCacheManifest,
  request: DesktopAgentOpenRequest
) {
  if (manifest.lockSessionId === request.lockSessionId) {
    return true;
  }
  return Boolean(
    manifest.cacheOwnerId &&
    request.cacheOwnerId &&
    manifest.cacheOwnerId === request.cacheOwnerId
  );
}

function unsafeMasterCacheError() {
  return new DesktopAgentError(
    "CACHE_RECOVERY_UNSAFE",
    "Existing Master cache cannot be recovered automatically."
  );
}

function isTrustedMasterCache(
  manifest: MasterCacheManifest,
  request: DesktopAgentOpenRequest,
  downloadedHash?: string
) {
  return (
    (manifest.version === MASTER_CACHE_MANIFEST_VERSION ||
      manifest.version === LEGACY_MASTER_CACHE_MANIFEST_VERSION) &&
    manifest.projectId === request.projectId &&
    manifest.attachmentId === request.attachmentId &&
    manifest.fileName === request.fileName &&
    (request.cacheVersionId
      ? manifest.cacheVersionId === request.cacheVersionId
      : manifest.lockSessionId === request.lockSessionId) &&
    (downloadedHash === undefined || manifest.originalHash === downloadedHash)
  );
}

function buildMasterCacheManifest(
  request: DesktopAgentOpenRequest,
  originalHash: string,
  createdAt: string
): MasterCacheManifest {
  return {
    version: request.cacheVersionId
      ? MASTER_CACHE_MANIFEST_VERSION
      : LEGACY_MASTER_CACHE_MANIFEST_VERSION,
    projectId: request.projectId,
    attachmentId: request.attachmentId,
    lockSessionId: request.lockSessionId ?? "",
    cacheVersionId: request.cacheVersionId,
    cacheOwnerId: request.cacheOwnerId,
    fileSize: request.fileSize,
    contentHash: request.contentHash ?? originalHash,
    fileName: request.fileName,
    originalHash,
    createdAt,
  };
}

async function readMasterCacheManifest(localPath: string) {
  try {
    const raw = await readFile(getMasterCacheManifestPath(localPath), "utf-8");
    const parsed = JSON.parse(raw) as unknown;
    return parseMasterCacheManifest(parsed);
  } catch {
    return null;
  }
}

function parseMasterCacheManifest(value: unknown): MasterCacheManifest | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const item = value as Partial<Record<keyof MasterCacheManifest, unknown>>;
  if (
    (item.version !== MASTER_CACHE_MANIFEST_VERSION &&
      item.version !== LEGACY_MASTER_CACHE_MANIFEST_VERSION) ||
    typeof item.projectId !== "string" ||
    typeof item.attachmentId !== "string" ||
    typeof item.lockSessionId !== "string" ||
    typeof item.fileName !== "string" ||
    typeof item.originalHash !== "string" ||
    typeof item.createdAt !== "string"
  ) {
    return null;
  }
  if (
    item.version === MASTER_CACHE_MANIFEST_VERSION &&
    typeof item.cacheVersionId !== "string"
  ) {
    return null;
  }
  return item as MasterCacheManifest;
}

async function writeMasterCacheManifest(
  localPath: string,
  manifest: MasterCacheManifest
) {
  await writeFileAtomically(
    getMasterCacheManifestPath(localPath),
    Buffer.from(JSON.stringify(manifest, null, 2)),
    { replace: true }
  );
}

function getMasterCacheManifestPath(localPath: string) {
  return join(dirname(localPath), MASTER_CACHE_MANIFEST_FILE_NAME);
}

async function writeFileAtomically(
  filePath: string,
  content: Buffer,
  options: { replace?: boolean } = {}
) {
  const directoryPath = dirname(filePath);
  await mkdir(directoryPath, { recursive: true });
  const temporaryFile = join(
    directoryPath,
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fileHandle = await open(temporaryFile, "wx");
    await fileHandle.writeFile(content);
    await fileHandle.sync();
    await fileHandle.close();
    fileHandle = null;
    if (options.replace) {
      await rm(filePath, { force: true });
    }
    await rename(temporaryFile, filePath);
  } catch (error) {
    if (fileHandle) {
      await fileHandle.close().catch(() => {});
    }
    await rm(temporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

function buildTemporaryFilePath(filePath: string) {
  return join(
    dirname(filePath),
    `.${basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
}

async function commitTemporaryFile(
  temporaryPath: string,
  filePath: string,
  options: { replace?: boolean } = {}
) {
  await mkdir(dirname(filePath), { recursive: true });
  if (options.replace) {
    await rm(filePath, { force: true });
  }
  await rename(temporaryPath, filePath);
}

async function guardLocalMasterSession(
  request: DesktopAgentOpenRequest,
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>,
  {
    now,
    masterOpenObservationTimeoutMs,
    pdfMasterOpenObservationTimeoutMs,
  }: {
    now: Date;
    masterOpenObservationTimeoutMs: number;
    pdfMasterOpenObservationTimeoutMs: number;
  }
) {
  if (!sessionStore.list) {
    return;
  }

  const sessions = await sessionStore.list();
  await markStaleUnobservedLaunchesInactive({
    sessions,
    sessionStore,
    now,
    masterOpenObservationTimeoutMs,
    pdfMasterOpenObservationTimeoutMs,
  });
  const matchingAttachmentSessions = sessions.filter(
    (session) =>
      session.mode === "MASTER" &&
      session.projectId === request.projectId &&
      session.attachmentId === request.attachmentId &&
      isActiveLocalSession(
        session,
        now,
        getMasterOpenObservationTimeoutMsForFileName(session.fileName, {
          masterTimeoutMs: masterOpenObservationTimeoutMs,
          pdfTimeoutMs: pdfMasterOpenObservationTimeoutMs,
        })
      )
  );
  const duplicate = matchingAttachmentSessions.find(
    (session) => session.lockSessionId === request.lockSessionId
  );
  if (duplicate) {
    throw new DesktopAgentError(
      "SESSION_ALREADY_OPEN",
      "This Master file is already being tracked locally."
    );
  }

  if (!sessionStore.update) {
    return;
  }
  await Promise.all(
    matchingAttachmentSessions.map((session) => {
      const patch: Partial<DesktopAgentSession> = {
        leaseLostAt: now.toISOString(),
        lastError: "A newer Master session was opened for this file.",
      };
      if (shouldEnterLeaseLostLifecycle(session)) {
        patch.status = "LEASE_LOST";
        patch.lifecycleState = "LEASE_LOST";
      }
      return sessionStore.update?.(session.sessionId, patch);
    })
  );
}

function shouldEnterLeaseLostLifecycle(session: DesktopAgentSession) {
  return (
    session.lifecycleState === "LAUNCHING" ||
    session.lifecycleState === "OPEN_NOT_OBSERVED" ||
    session.lifecycleState === "OPEN" ||
    session.lifecycleState === "LEASE_LOST"
  );
}

async function markStaleUnobservedLaunchesInactive({
  sessions,
  sessionStore,
  now,
  masterOpenObservationTimeoutMs,
  pdfMasterOpenObservationTimeoutMs,
}: {
  sessions: DesktopAgentSession[];
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>;
  now: Date;
  masterOpenObservationTimeoutMs: number;
  pdfMasterOpenObservationTimeoutMs: number;
}) {
  if (!sessionStore.update) {
    return;
  }
  await Promise.all(
    sessions
      .filter((session) =>
        isStaleUnobservedLaunch(
          session,
          now,
          getMasterOpenObservationTimeoutMsForFileName(session.fileName, {
            masterTimeoutMs: masterOpenObservationTimeoutMs,
            pdfTimeoutMs: pdfMasterOpenObservationTimeoutMs,
          })
        )
      )
      .map((session) =>
        sessionStore.update?.(session.sessionId, {
          lifecycleState: "LAUNCH_FAILED",
          status: getDesktopAgentCompatibilityStatus({
            lifecycleState: "LAUNCH_FAILED",
            contentState: session.contentState,
          }),
          launchFailedReason: "OPEN_OBSERVATION_TIMEOUT",
          lastError: getMasterOpenObservationTimeoutMessage(session.fileName),
        })
      )
  );
}

async function getLaunchFailedReason({
  sessionId,
  sessionStore,
  error,
}: {
  sessionId: string;
  sessionStore: NonNullable<OpenDesktopFileOptions["sessionStore"]>;
  error: unknown;
}): Promise<DesktopAgentLaunchFailedReason> {
  const current = await sessionStore.get?.(sessionId).catch(() => null);
  if (
    current?.lifecycleState === "LAUNCH_FAILED" &&
    current.launchFailedReason
  ) {
    return current.launchFailedReason;
  }
  return classifyLocalLaunchFailure(error);
}

function classifyLocalLaunchFailure(
  error: unknown
): DesktopAgentLaunchFailedReason {
  const message = error instanceof Error ? error.message : "";
  if (message === "Tracked file session was not found after launch.") {
    return "SESSION_NOT_FOUND_AFTER_LAUNCH";
  }
  if (message === "Tracked file session is no longer launchable.") {
    return "SESSION_NO_LONGER_LAUNCHABLE";
  }
  if (message.includes("open was not observed")) {
    return "OPEN_OBSERVATION_TIMEOUT";
  }
  return "WATCHER_START_FAILED";
}

function isActiveLocalSession(
  session: DesktopAgentSession,
  now: Date,
  openObservationTimeoutMs: number
) {
  switch (session.lifecycleState) {
    case "LAUNCHING": {
      return !isStaleUnobservedLaunch(session, now, openObservationTimeoutMs);
    }
    case "OPEN_NOT_OBSERVED": {
      return !isStaleUnobservedLaunch(session, now, openObservationTimeoutMs);
    }
    case "CLOSE_DETECTED":
    case "CHECKING_IN":
    case "CHECKIN_FAILED":
    case "RELEASE_PENDING":
    case "RELEASING":
    case "RELEASE_FAILED":
    case "CLEANUP_PENDING":
    case "CLEANUP_FAILED":
    case "CONFLICT_RISK":
    case "LEASE_LOST": {
      return true;
    }
    case "OPEN": {
      return Boolean(session.openObservedAt);
    }
    case "LAUNCH_FAILED":
    case "CLOSED":
    case "LOCAL_FILE_MISSING":
    case "LOCK_REVOKED": {
      return false;
    }
    default: {
      return false;
    }
  }
}

function isStaleUnobservedLaunch(
  session: DesktopAgentSession,
  now: Date,
  timeoutMs: number
) {
  if (
    session.mode !== "MASTER" ||
    session.openObservedAt ||
    !["LAUNCHING", "OPEN_NOT_OBSERVED"].includes(session.lifecycleState)
  ) {
    return false;
  }
  return (
    now.getTime() - new Date(session.launchStartedAt).getTime() >=
    Math.max(0, timeoutMs)
  );
}
