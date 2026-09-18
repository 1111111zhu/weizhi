import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";

import type {
  DesktopAgentCheckInRequest,
  DesktopAgentCheckInResponse,
  DesktopAgentReleaseRequest,
  DesktopAgentReleaseResponse,
  DesktopAgentSession,
  DesktopAgentUpdateRequest,
  DesktopAgentUpdateResponse,
  DesktopAgentUpdateStatus,
  DesktopAgentUpdateStatusResponse,
  DesktopAgentWindowsSignaturePolicy,
} from "@project-wing/shared/desktop";

import {
  checkInDesktopSession as defaultCheckInDesktopSession,
  releaseDesktopSession as defaultReleaseDesktopSession,
} from "./check-in-service.js";
import {
  getAgentManagerExePath,
  getApiBaseUrl,
  getDesktopAgentWindowsDownloadUrl,
  getStateRoot,
} from "./config.js";
import { DesktopAgentError } from "./errors.js";
import { isLocalFileBusy as defaultIsLocalFileBusy } from "./file-busy.js";
import {
  buildMasterCheckInRequest,
  buildMasterReleaseRequest,
} from "./master-callbacks.js";
import { createUpdateStatusStore } from "./update-status-store.js";

const DEFAULT_UPDATE_POLL_INTERVAL_MS = 1000;

type SessionStore = {
  refresh: () => Promise<DesktopAgentSession[]>;
  updateIf?: (
    sessionId: string,
    predicate: (session: DesktopAgentSession) => boolean,
    patch: Partial<DesktopAgentSession>
  ) => Promise<DesktopAgentSession | null>;
};

type CheckInDesktopSession = (
  request: DesktopAgentCheckInRequest
) => Promise<DesktopAgentCheckInResponse>;
type ReleaseDesktopSession = (
  request: DesktopAgentReleaseRequest
) => Promise<DesktopAgentReleaseResponse>;

export type DesktopAgentUpdaterOptions = {
  apiBaseUrl?: string;
  downloadUrl?: string;
  stateRoot?: string;
  sessionStore: SessionStore;
  checkInDesktopSession?: CheckInDesktopSession;
  releaseDesktopSession?: ReleaseDesktopSession;
  isLocalFileBusy?: (session: DesktopAgentSession) => Promise<boolean>;
  startManagerUpdate?: (input: {
    downloadUrl: string;
    expectedVersion: string;
    expectedSha256: string;
    expectedFileSize: number;
    signaturePolicy: DesktopAgentWindowsSignaturePolicy;
  }) => Promise<boolean>;
  readUpdateStatus?: () => Promise<DesktopAgentUpdateStatusResponse | null>;
  pollIntervalMs?: number;
  now?: () => Date;
  randomUUID?: () => string;
};

type UpdateTask = {
  request: DesktopAgentUpdateRequest;
  response: DesktopAgentUpdateResponse;
  promise: Promise<void>;
};

export function createDesktopAgentUpdater(options: DesktopAgentUpdaterOptions) {
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? getApiBaseUrl());
  const downloadUrl =
    options.downloadUrl ?? getDesktopAgentWindowsDownloadUrl();
  const stateRoot = options.stateRoot ?? getStateRoot();
  const checkInDesktopSession =
    options.checkInDesktopSession ??
    ((request) => defaultCheckInDesktopSession(request));
  const releaseDesktopSession =
    options.releaseDesktopSession ??
    ((request) => defaultReleaseDesktopSession(request));
  const isLocalFileBusy = options.isLocalFileBusy ?? defaultIsLocalFileBusy;
  const startManagerUpdate =
    options.startManagerUpdate ?? startTrustedManagerUpdate;
  const readUpdateStatus =
    options.readUpdateStatus ?? createUpdateStatusStore(stateRoot).read;
  const pollIntervalMs =
    options.pollIntervalMs ?? DEFAULT_UPDATE_POLL_INTERVAL_MS;
  const now = options.now ?? (() => new Date());
  const makeTaskId = options.randomUUID ?? randomUUID;
  let currentTask: UpdateTask | null = null;

  const setTaskStatus = (
    task: UpdateTask,
    status: DesktopAgentUpdateStatus,
    message?: string
  ) => {
    task.response = {
      ...task.response,
      status,
      ...(message ? { message } : { message: undefined }),
    };
  };
  const runUpdate = async (task: UpdateTask) => {
    try {
      await resolveLocalMasterSessions({
        task,
        sessionStore: options.sessionStore,
        apiBaseUrl,
        checkInDesktopSession,
        releaseDesktopSession,
        isLocalFileBusy,
        pollIntervalMs,
        now,
        setTaskStatus,
      });
      const managerStarted = await startManagerUpdate({
        downloadUrl,
        expectedVersion: task.request.expectedVersion,
        expectedSha256: task.request.expectedSha256,
        expectedFileSize: task.request.expectedFileSize,
        signaturePolicy: task.request.signaturePolicy,
      });
      if (managerStarted) {
        setTaskStatus(
          task,
          "IN_PROGRESS",
          "Desktop Agent manager is updating."
        );
        return;
      }

      throw new DesktopAgentError(
        "INSTALLER_VERIFY_FAILED",
        "Desktop Agent Manager is unavailable. Download and run the repair installer."
      );
    } catch (error) {
      setTaskStatus(
        task,
        "FAILED",
        error instanceof Error ? error.message : "Desktop Agent update failed."
      );
    }
  };

  return {
    startUpdate(
      request: DesktopAgentUpdateRequest
    ): Promise<DesktopAgentUpdateResponse> {
      if (currentTask && isActiveUpdateStatus(currentTask.response.status)) {
        return Promise.resolve({
          ...currentTask.response,
          status: "IN_PROGRESS",
          message: "Desktop Agent update is already running.",
        });
      }

      const response: DesktopAgentUpdateResponse = {
        ok: true,
        status: "STARTED",
        taskId: makeTaskId(),
        ...(request.expectedVersion
          ? { expectedVersion: request.expectedVersion }
          : {}),
        downloadUrl,
      };
      const task: UpdateTask = {
        request,
        response,
        promise: Promise.resolve(),
      };
      task.promise = runUpdate(task);
      currentTask = task;
      return Promise.resolve(response);
    },

    getCurrentUpdate() {
      return currentTask?.response ?? null;
    },

    async getCurrentUpdateStatus() {
      return (await readUpdateStatus()) ?? currentTask?.response ?? null;
    },

    isUpdating() {
      return Boolean(
        currentTask && isActiveUpdateStatus(currentTask.response.status)
      );
    },
  };
}

async function resolveLocalMasterSessions({
  task,
  sessionStore,
  apiBaseUrl,
  checkInDesktopSession,
  releaseDesktopSession,
  isLocalFileBusy,
  pollIntervalMs,
  now,
  setTaskStatus,
}: {
  task: UpdateTask;
  sessionStore: SessionStore;
  apiBaseUrl: string;
  checkInDesktopSession: CheckInDesktopSession;
  releaseDesktopSession: ReleaseDesktopSession;
  isLocalFileBusy: (session: DesktopAgentSession) => Promise<boolean>;
  pollIntervalMs: number;
  now: () => Date;
  setTaskStatus: (
    task: UpdateTask,
    status: DesktopAgentUpdateStatus,
    message?: string
  ) => void;
}) {
  while (true) {
    const refreshedSessions = await sessionStore.refresh();
    const sessions = refreshedSessions.filter(
      (session) => session.mode === "MASTER" && isUpdateBlockingSession(session)
    );
    let waitingForWorkbook = false;

    for (const session of sessions) {
      if (await shouldWaitForWorkbookClose(session, isLocalFileBusy)) {
        setTaskStatus(
          task,
          "WAITING_FOR_WORKBOOK_CLOSE",
          `Close ${session.fileName} to continue the Desktop Agent update.`
        );
        waitingForWorkbook = true;
        break;
      }

      await resolveLocalMasterSession({
        session,
        sessionStore,
        apiBaseUrl,
        checkInDesktopSession,
        releaseDesktopSession,
        now,
        setTaskStatus: (status, message) =>
          setTaskStatus(task, status, message),
      });
    }

    if (!waitingForWorkbook) {
      return;
    }
    await delay(Math.max(1, pollIntervalMs));
  }
}

async function resolveLocalMasterSession({
  session,
  sessionStore,
  apiBaseUrl,
  checkInDesktopSession,
  releaseDesktopSession,
  now,
  setTaskStatus,
}: {
  session: DesktopAgentSession;
  sessionStore: SessionStore;
  apiBaseUrl: string;
  checkInDesktopSession: CheckInDesktopSession;
  releaseDesktopSession: ReleaseDesktopSession;
  now: () => Date;
  setTaskStatus: (status: DesktopAgentUpdateStatus, message?: string) => void;
}) {
  if (
    ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED"].includes(
      session.lifecycleState
    )
  ) {
    setTaskStatus("CHECKING_IN", `Checking in ${session.fileName}.`);
    await checkInDesktopSession(buildCheckInRequest(session, apiBaseUrl));
    return;
  }

  if (
    [
      "RELEASE_PENDING",
      "RELEASING",
      "RELEASE_FAILED",
      "LAUNCHING",
      "OPEN_NOT_OBSERVED",
      "LAUNCH_FAILED",
    ].includes(session.lifecycleState)
  ) {
    setTaskStatus("RELEASING", `Releasing ${session.fileName}.`);
    await releaseDesktopSession(buildReleaseRequest(session, apiBaseUrl));
    return;
  }

  if (session.lifecycleState === "OPEN") {
    const closeDetected = await markSessionCloseDetected({
      session,
      sessionStore,
      now,
    });
    setTaskStatus("CHECKING_IN", `Checking in ${session.fileName}.`);
    await checkInDesktopSession(
      buildCheckInRequest(closeDetected ?? session, apiBaseUrl)
    );
  }
}

async function shouldWaitForWorkbookClose(
  session: DesktopAgentSession,
  isLocalFileBusy: (session: DesktopAgentSession) => Promise<boolean>
) {
  await Promise.resolve();
  if (
    !["OPEN", "LAUNCHING", "OPEN_NOT_OBSERVED"].includes(session.lifecycleState)
  ) {
    return false;
  }
  return isLocalFileBusy(session);
}

async function markSessionCloseDetected({
  session,
  sessionStore,
  now,
}: {
  session: DesktopAgentSession;
  sessionStore: SessionStore;
  now: () => Date;
}) {
  await Promise.resolve();
  if (!sessionStore.updateIf) {
    return null;
  }
  const closeDetectedAt = now().toISOString();
  return sessionStore.updateIf(
    session.sessionId,
    (current) =>
      current.sessionId === session.sessionId &&
      current.lockSessionId === session.lockSessionId &&
      current.generation === session.generation &&
      current.openSignalToken === session.openSignalToken &&
      current.closeSignalToken === session.closeSignalToken &&
      current.lifecycleState === "OPEN" &&
      !current.closeDetectedAt,
    {
      lifecycleState: "CLOSE_DETECTED",
      closeDetectedAt,
      closeDetectedSource: "MANUAL",
      lastObservationAt: closeDetectedAt,
      lastError: undefined,
    }
  );
}

function buildCheckInRequest(
  session: DesktopAgentSession,
  apiBaseUrl: string
): DesktopAgentCheckInRequest {
  return buildMasterCheckInRequest(session, apiBaseUrl);
}

function buildReleaseRequest(
  session: DesktopAgentSession,
  apiBaseUrl: string
): DesktopAgentReleaseRequest {
  return buildMasterReleaseRequest(session, apiBaseUrl);
}

function isUpdateBlockingSession(session: DesktopAgentSession) {
  return ![
    "CLOSED",
    "LOCAL_FILE_MISSING",
    "LOCK_REVOKED",
    "CONFLICT_RISK",
  ].includes(session.lifecycleState);
}

function isActiveUpdateStatus(status: DesktopAgentUpdateStatus) {
  return status !== "READY" && status !== "FAILED";
}

async function startTrustedManagerUpdate(input: {
  downloadUrl: string;
  expectedVersion: string;
  expectedSha256: string;
  expectedFileSize: number;
  signaturePolicy: DesktopAgentWindowsSignaturePolicy;
}) {
  const managerPath = getAgentManagerExePath();
  if (!managerPath) {
    return false;
  }

  const args = [
    "update",
    "--download-url",
    input.downloadUrl,
    "--expected-version",
    input.expectedVersion,
    "--expected-sha256",
    input.expectedSha256,
    "--expected-file-size",
    String(input.expectedFileSize),
    "--signature-policy",
    input.signaturePolicy,
  ];
  const child = spawn(managerPath, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  await waitForInstallerSpawn(child);
  child.unref();
  return true;
}

async function waitForInstallerSpawn(child: ReturnType<typeof spawn>) {
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    child.once("spawn", () => {
      settled = true;
      resolve();
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(
        new DesktopAgentError(
          "INSTALLER_START_FAILED",
          error instanceof Error
            ? error.message
            : "Could not start Desktop Agent installer."
        )
      );
    });
  });
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}
