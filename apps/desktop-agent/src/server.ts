import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";

import {
  DesktopAgentCheckInRequestSchema,
  DesktopAgentClosedRequestSchema,
  DesktopAgentLaunchAbortReleaseRequestSchema,
  DesktopAgentLaunchFailedRequestSchema,
  DesktopAgentOpenObservedRequestSchema,
  DesktopAgentOpenRequestSchema,
  DesktopAgentPrintRequestSchema,
  DesktopAgentReleaseRequestSchema,
  DesktopAgentStartDevicePairSchema,
  DesktopAgentUpdateRequestSchema,
  getDesktopAgentCompatibilityStatus,
} from "@project-wing/shared/desktop";
import type {
  DesktopAgentCheckInRequest,
  DesktopAgentCheckInResponse,
  DesktopAgentHealthDiagnostics,
  DesktopAgentLaunchFailedReason,
  DesktopAgentOpenResponse,
  DesktopAgentPrintResponse,
  DesktopAgentPrinter,
  DesktopAgentReleaseRequest,
  DesktopAgentReleaseResponse,
  DesktopAgentSession,
  DesktopAgentUpdateRequest,
  DesktopAgentUpdateResponse,
  DesktopAgentUpdateStatusResponse,
} from "@project-wing/shared/desktop";

import {
  getDesktopAgentCacheSettings,
  updateDesktopAgentCacheSettings,
} from "./cache-settings.js";
import type {
  DesktopAgentCacheSettings,
  UpdateDesktopAgentCacheSettingsInput,
} from "./cache-settings.js";
import {
  checkInDesktopSession as defaultCheckInDesktopSession,
  releaseDesktopSession as defaultReleaseDesktopSession,
} from "./check-in-service.js";
import {
  AGENT_APP_NAME,
  getAgentVersion,
  getAllowedAuthOrigins,
  getAllowedWebOrigins,
  getApiBaseUrl,
} from "./config.js";
import { createDeviceAuthSession } from "./device-auth-session.js";
import type { DesktopAgentDeviceAuthSession } from "./device-auth-session.js";
import {
  DesktopAgentError,
  getStatusForAgentError,
  toAgentErrorResponse,
} from "./errors.js";
import { isLocalFileBusy } from "./file-busy.js";
import { openDesktopFile as defaultOpenDesktopFile } from "./file-session-service.js";
import type { AuthenticatedDesktopAgentOpenRequest } from "./file-session-service.js";
import { buildMasterCheckInRequest } from "./master-callbacks.js";
import { PDF_MASTER_EDITOR_OPEN_RECOMMENDATION } from "./pdf-master-editors.js";
import {
  listDesktopPrinters as defaultListDesktopPrinters,
  printConfirmationDocuments as defaultPrintConfirmationDocuments,
} from "./printer-service.js";
import type { AuthenticatedDesktopAgentPrintRequest } from "./printer-service.js";
import { createSessionStore, hashFile } from "./session-store.js";

type OpenDesktopFile = (
  request: AuthenticatedDesktopAgentOpenRequest
) => Promise<DesktopAgentOpenResponse>;
type CheckInDesktopSession = (
  request: DesktopAgentCheckInRequest
) => Promise<DesktopAgentCheckInResponse>;
type ReleaseDesktopSession = (
  request: DesktopAgentReleaseRequest
) => Promise<DesktopAgentReleaseResponse>;
type UpdateDesktopAgent = (
  request: DesktopAgentUpdateRequest
) => Promise<DesktopAgentUpdateResponse>;
type GetDesktopAgentUpdateStatus =
  () => Promise<DesktopAgentUpdateStatusResponse | null>;
type IsDesktopAgentUpdateActive = () => boolean;
type GetHealthDiagnostics = () => Promise<DesktopAgentHealthDiagnostics>;
type ListDesktopPrinters = () => Promise<DesktopAgentPrinter[]>;
type PrintConfirmationDocuments = (
  request: AuthenticatedDesktopAgentPrintRequest
) => Promise<DesktopAgentPrintResponse>;
type GetDesktopAgentAuthorization = () => string | null;
type GetDesktopAgentCacheSettings = () => DesktopAgentCacheSettings;
type UpdateDesktopAgentCacheSettings = (
  input: UpdateDesktopAgentCacheSettingsInput
) => Promise<DesktopAgentCacheSettings>;
type GetRuntimeHealth = () => {
  agentState:
    | "RECOVERING"
    | "READY"
    | "READY_WITH_ATTENTION"
    | "DEGRADED_NEEDS_ATTENTION"
    | "FAILED";
  recoveryMessage?: string;
  quarantinedSessionCount?: number;
};

export type AgentServerOptions = {
  allowedAuthOrigins?: string[];
  allowedWebOrigins?: string[];
  openDesktopFile?: OpenDesktopFile;
  checkInDesktopSession?: CheckInDesktopSession;
  releaseDesktopSession?: ReleaseDesktopSession;
  updateDesktopAgent?: UpdateDesktopAgent;
  getDesktopAgentUpdateStatus?: GetDesktopAgentUpdateStatus;
  isDesktopAgentUpdateActive?: IsDesktopAgentUpdateActive;
  getHealthDiagnostics?: GetHealthDiagnostics;
  getRuntimeHealth?: GetRuntimeHealth;
  listDesktopPrinters?: ListDesktopPrinters;
  printConfirmationDocuments?: PrintConfirmationDocuments;
  getCacheSettings?: GetDesktopAgentCacheSettings;
  updateCacheSettings?: UpdateDesktopAgentCacheSettings;
  apiBaseUrl?: string;
  deviceAuthSession?: DesktopAgentDeviceAuthSession;
  now?: () => Date;
  isLocalFileBusy?: typeof isLocalFileBusy;
  sessionStore?: {
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
};

export function createAgentServer(options: AgentServerOptions = {}) {
  const allowedAuthOrigins = normalizeOrigins(
    options.allowedAuthOrigins ?? getAllowedAuthOrigins()
  );
  const allowedWebOrigins = normalizeOrigins(
    options.allowedWebOrigins ?? getAllowedWebOrigins()
  );
  const openDesktopFile = options.openDesktopFile ?? defaultOpenDesktopFile;
  const checkInDesktopSession =
    options.checkInDesktopSession ?? defaultCheckInDesktopSession;
  const releaseDesktopSession =
    options.releaseDesktopSession ?? defaultReleaseDesktopSession;
  const updateDesktopAgent =
    options.updateDesktopAgent ?? defaultUpdateDesktopAgent;
  const getDesktopAgentUpdateStatus =
    options.getDesktopAgentUpdateStatus ??
    (async () => {
      await Promise.resolve();
      return null;
    });
  const isDesktopAgentUpdateActive =
    options.isDesktopAgentUpdateActive ?? (() => false);
  const { getHealthDiagnostics } = options;
  const getRuntimeHealth =
    options.getRuntimeHealth ?? (() => ({ agentState: "READY" as const }));
  const listDesktopPrinters =
    options.listDesktopPrinters ?? defaultListDesktopPrinters;
  const printConfirmationDocuments =
    options.printConfirmationDocuments ?? defaultPrintConfirmationDocuments;
  const getCacheSettings =
    options.getCacheSettings ?? getDesktopAgentCacheSettings;
  const updateCacheSettings =
    options.updateCacheSettings ?? updateDesktopAgentCacheSettings;
  const sessionStore = options.sessionStore ?? createSessionStore();
  const apiBaseUrl = normalizeBaseUrl(options.apiBaseUrl ?? getApiBaseUrl());
  const deviceAuthSession =
    options.deviceAuthSession ?? createDeviceAuthSession({});
  const now = options.now ?? (() => new Date());
  const probeLocalFileBusy = options.isLocalFileBusy ?? isLocalFileBusy;
  const agentVersion = getAgentVersion();

  return createServer(async (request, response) => {
    try {
      writeCorsHeaders(request, response, allowedWebOrigins);

      if (!isLoopback(request.socket.remoteAddress)) {
        sendJson(response, 403, {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED",
          message: "Only localhost requests are allowed.",
        });
        return;
      }

      if (!isAllowedBrowserOrigin(request, allowedWebOrigins)) {
        sendJson(response, 403, {
          ok: false,
          code: "ORIGIN_NOT_ALLOWED",
          message: "This web origin is not allowed to access Desktop Agent.",
        });
        return;
      }

      if (request.method === "OPTIONS") {
        response.writeHead(204);
        response.end();
        return;
      }

      if (!hasRequiredBrowserMutationHeader(request)) {
        sendJson(response, 403, {
          ok: false,
          code: "AGENT_REQUEST_HEADER_REQUIRED",
          message: "Desktop Agent mutation header is required.",
        });
        return;
      }

      const url = new URL(request.url ?? "/", "http://127.0.0.1");

      if (request.method === "POST" && url.pathname === "/update") {
        await handleUpdate(request, response, updateDesktopAgent);
        return;
      }

      if (request.method === "GET" && url.pathname === "/update/status") {
        await handleUpdateStatus(response, getDesktopAgentUpdateStatus);
        return;
      }

      if (request.method === "GET" && url.pathname === "/health") {
        sendJson(response, 200, {
          ok: true,
          app: AGENT_APP_NAME,
          version: agentVersion,
          ...getRuntimeHealth(),
        });
        return;
      }

      if (request.method === "GET" && url.pathname === "/cache/settings") {
        sendJson(response, 200, { ok: true, ...getCacheSettings() });
        return;
      }

      if (request.method === "POST" && url.pathname === "/cache/settings") {
        await handleCacheSettings(request, response, updateCacheSettings);
        return;
      }

      if (request.method === "GET" && url.pathname === "/auth/status") {
        sendJson(response, 200, {
          ok: true,
          ...deviceAuthSession.status(),
        });
        return;
      }

      if (request.method === "POST" && url.pathname === "/auth/pair") {
        await handleDevicePair(
          request,
          response,
          deviceAuthSession,
          allowedAuthOrigins
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/diagnostics/office") {
        await handleOfficeDiagnostics(response, getHealthDiagnostics);
        return;
      }

      if (request.method === "GET" && url.pathname === "/printers") {
        await handlePrinters(response, listDesktopPrinters);
        return;
      }

      if (request.method === "POST" && url.pathname === "/print") {
        await handlePrint(request, response, printConfirmationDocuments, () =>
          deviceAuthSession.getAuthorization()
        );
        return;
      }

      if (request.method === "GET" && url.pathname === "/sessions") {
        try {
          const sessions = sessionStore.list
            ? await sessionStore.list()
            : await sessionStore.refresh();
          sendJson(response, 200, {
            ok: true,
            sessions: sessions.map(toPublicDesktopAgentSession),
          });
        } catch {
          sendJson(response, 500, {
            ok: false,
            code: "SESSION_REFRESH_FAILED",
            message: "Could not refresh Desktop Agent sessions.",
          });
        }
        return;
      }

      const checkInMatch = /^\/sessions\/([^/]+)\/check-in$/.exec(url.pathname);
      const releaseMatch = /^\/sessions\/([^/]+)\/release$/.exec(url.pathname);
      const openObservedMatch = /^\/sessions\/([^/]+)\/open-observed$/.exec(
        url.pathname
      );
      const launchFailedMatch = /^\/sessions\/([^/]+)\/launch-failed$/.exec(
        url.pathname
      );
      const closedMatch = /^\/sessions\/([^/]+)\/closed$/.exec(url.pathname);
      const recoverLaunchFailedReleaseMatch =
        /^\/sessions\/([^/]+)\/recover-launch-failed-release$/.exec(
          url.pathname
        );
      if (request.method === "POST" && openObservedMatch) {
        await handleSessionOpenObserved(
          request,
          response,
          decodeURIComponent(openObservedMatch[1] ?? ""),
          sessionStore,
          now
        );
        return;
      }
      if (request.method === "POST" && launchFailedMatch) {
        await handleSessionLaunchFailed(
          request,
          response,
          decodeURIComponent(launchFailedMatch[1] ?? ""),
          sessionStore,
          now
        );
        return;
      }
      if (request.method === "POST" && closedMatch) {
        await handleSessionClosed(
          request,
          response,
          decodeURIComponent(closedMatch[1] ?? ""),
          sessionStore,
          now,
          checkInDesktopSession,
          apiBaseUrl
        );
        return;
      }
      if (request.method === "POST" && recoverLaunchFailedReleaseMatch) {
        await handleRecoverLaunchFailedRelease(
          request,
          response,
          decodeURIComponent(recoverLaunchFailedReleaseMatch[1] ?? ""),
          sessionStore,
          probeLocalFileBusy
        );
        return;
      }

      if (request.method === "POST" && checkInMatch) {
        await handleCheckIn(
          request,
          response,
          decodeURIComponent(checkInMatch[1] ?? ""),
          checkInDesktopSession
        );
        return;
      }

      if (request.method === "POST" && releaseMatch) {
        await handleRelease(
          request,
          response,
          decodeURIComponent(releaseMatch[1] ?? ""),
          releaseDesktopSession
        );
        return;
      }

      if (request.method === "POST" && url.pathname === "/open") {
        if (isDesktopAgentUpdateActive()) {
          sendJson(response, 409, {
            ok: false,
            code: "AGENT_UPDATE_IN_PROGRESS",
            message: "Desktop Agent is updating.",
          });
          return;
        }
        await handleOpen(
          request,
          response,
          openDesktopFile,
          getHealthDiagnostics,
          () => deviceAuthSession.getAuthorization()
        );
        return;
      }

      sendJson(response, 404, {
        ok: false,
        code: "NOT_FOUND",
        message: "Endpoint not found.",
      });
    } catch (error) {
      sendUnhandledRequestError(response, error);
    }
  });
}

function toPublicDesktopAgentSession(session: DesktopAgentSession) {
  const {
    grantSecret: _grantSecret,
    uploadCheckpoint: _uploadCheckpoint,
    checkInSnapshot: _checkInSnapshot,
    ...publicSession
  } = session;
  return publicSession;
}

async function handleCacheSettings(
  request: IncomingMessage,
  response: ServerResponse,
  updateCacheSettings: UpdateDesktopAgentCacheSettings
) {
  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  if (!body.value || typeof body.value !== "object") {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Cache settings are invalid.",
    });
    return;
  }
  const value = body.value as Record<string, unknown>;
  if (
    typeof value.cacheRoot !== "string" ||
    (value.maxBytes !== undefined && typeof value.maxBytes !== "number")
  ) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Cache settings are invalid.",
    });
    return;
  }

  try {
    const settings = await updateCacheSettings({
      cacheRoot: value.cacheRoot,
      maxBytes: value.maxBytes,
    });
    sendJson(response, 200, { ok: true, ...settings });
  } catch (error) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message:
        error instanceof Error
          ? error.message
          : "Could not update cache settings.",
    });
  }
}

async function handleDevicePair(
  request: IncomingMessage,
  response: ServerResponse,
  deviceAuthSession: DesktopAgentDeviceAuthSession,
  allowedAuthOrigins: string[]
) {
  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentStartDevicePairSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Device pairing request is invalid.",
    });
    return;
  }

  const authBaseUrl = getTrustedAuthBaseUrl(
    parsed.data.authBaseUrl,
    allowedAuthOrigins
  );
  if (!authBaseUrl) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Device pairing request is invalid.",
    });
    return;
  }

  void deviceAuthSession.startPair({ ...parsed.data, authBaseUrl });
  sendJson(response, 202, {
    ok: true,
    ...deviceAuthSession.status(),
    pairing: true,
  });
}

async function handlePrinters(
  response: ServerResponse,
  listDesktopPrinters: ListDesktopPrinters
) {
  try {
    sendJson(response, 200, {
      ok: true,
      printers: await listDesktopPrinters(),
    });
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "PRINTER_DISCOVERY_FAILED",
      message: "Could not list local printers.",
    });
  }
}

async function handlePrint(
  request: IncomingMessage,
  response: ServerResponse,
  printConfirmationDocuments: PrintConfirmationDocuments,
  getAuthorization: GetDesktopAgentAuthorization
) {
  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentPrintRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Print request is invalid.",
    });
    return;
  }
  const authorization = getAuthorization();
  if (!authorization) {
    sendDeviceAuthRequired(response, "printing confirmations");
    return;
  }
  try {
    sendJson(
      response,
      200,
      await printConfirmationDocuments({
        ...parsed.data,
        authorization,
      })
    );
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "PRINT_FAILED",
      message: "Could not submit confirmation documents to the printer.",
    });
  }
}

async function handleOfficeDiagnostics(
  response: ServerResponse,
  getHealthDiagnostics: GetHealthDiagnostics | undefined
) {
  if (!getHealthDiagnostics) {
    sendJson(response, 404, {
      ok: false,
      code: "DIAGNOSTICS_UNAVAILABLE",
      message: "Office diagnostics are not available.",
    });
    return;
  }

  try {
    const diagnostics = await getHealthDiagnostics();
    sendJson(response, 200, {
      ok: true,
      diagnostics,
    });
  } catch {
    sendJson(response, 500, {
      ok: false,
      code: "DIAGNOSTICS_FAILED",
      message: "Office diagnostics failed.",
    });
  }
}

async function handleSessionOpenObserved(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  sessionStore: NonNullable<AgentServerOptions["sessionStore"]>,
  now: () => Date
) {
  if (!sessionStore.get || !sessionStore.updateIf) {
    sendJson(response, 500, {
      ok: false,
      code: "SESSION_STORE_UNAVAILABLE",
      message: "Session store cannot record open observations.",
    });
    return;
  }

  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentOpenObservedRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Open observation payload is invalid.",
    });
    return;
  }

  const session = await getEventValidatedSession({
    response,
    sessionStore,
    sessionId,
    generation: parsed.data.generation,
    token: parsed.data.openSignalToken,
    tokenField: "openSignalToken",
    mismatchCode: "OPEN_SIGNAL_MISMATCH",
    mismatchMessage: "Open signal token does not match the tracked session.",
  });
  if (!session) {
    return;
  }
  if (isClosedOrTerminalSession(session)) {
    sendJson(response, 409, {
      ok: false,
      code: "SESSION_NOT_ACTIVE",
      message: "Tracked file session is no longer active.",
    });
    return;
  }
  if (
    session.openObservedAt ||
    !["LAUNCHING", "OPEN_NOT_OBSERVED"].includes(session.lifecycleState)
  ) {
    sendJson(response, 200, { ok: true, session });
    return;
  }

  const observedAt = now().toISOString();
  const updated = await sessionStore.updateIf(
    sessionId,
    (current) =>
      current.generation === session.generation &&
      current.lockSessionId === session.lockSessionId &&
      current.openSignalToken === session.openSignalToken &&
      !current.openObservedAt &&
      ["LAUNCHING", "OPEN_NOT_OBSERVED"].includes(current.lifecycleState),
    {
      lifecycleState: "OPEN",
      openObservedAt: observedAt,
      openObservedSource: parsed.data.source,
      lastObservationAt: observedAt,
      lastError: undefined,
    }
  );
  sendJson(response, updated ? 200 : 409, {
    ok: Boolean(updated),
    ...(updated
      ? { session: updated }
      : {
          code: "SESSION_STATE_CHANGED",
          message: "Tracked file session state changed.",
        }),
  });
}

async function handleSessionLaunchFailed(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  sessionStore: NonNullable<AgentServerOptions["sessionStore"]>,
  now: () => Date
) {
  if (!sessionStore.get || !sessionStore.updateIf) {
    sendJson(response, 500, {
      ok: false,
      code: "SESSION_STORE_UNAVAILABLE",
      message: "Session store cannot record launch failures.",
    });
    return;
  }

  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentLaunchFailedRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Launch failure payload is invalid.",
    });
    return;
  }

  const session = await getEventValidatedSession({
    response,
    sessionStore,
    sessionId,
    generation: parsed.data.generation,
    token: parsed.data.openSignalToken,
    tokenField: "openSignalToken",
    mismatchCode: "OPEN_SIGNAL_MISMATCH",
    mismatchMessage: "Open signal token does not match the tracked session.",
  });
  if (!session) {
    return;
  }
  if (session.lifecycleState === "LAUNCH_FAILED") {
    sendJson(response, 200, { ok: true, session });
    return;
  }
  if (!canRecordLaunchFailure(session, parsed.data.reason)) {
    sendJson(response, 409, {
      ok: false,
      code: "SESSION_STATE_MISMATCH",
      message: "Launch failure cannot be recorded for this session state.",
    });
    return;
  }

  const observedAt = now().toISOString();
  const updated = await sessionStore.updateIf(
    sessionId,
    (current) =>
      current.generation === session.generation &&
      current.lockSessionId === session.lockSessionId &&
      current.openSignalToken === session.openSignalToken &&
      canRecordLaunchFailure(current, parsed.data.reason),
    {
      lifecycleState: "LAUNCH_FAILED",
      status: getDesktopAgentCompatibilityStatus({
        lifecycleState: "LAUNCH_FAILED",
        contentState: session.contentState,
      }),
      launchFailedReason: parsed.data.reason,
      lastObservationAt: observedAt,
      lastObservationDiagnostic: parsed.data.message,
      lastError:
        parsed.data.message ?? `Excel launch failed: ${parsed.data.reason}.`,
    }
  );
  sendJson(response, updated ? 200 : 409, {
    ok: Boolean(updated),
    ...(updated
      ? { session: updated }
      : {
          code: "SESSION_STATE_CHANGED",
          message: "Tracked file session state changed.",
        }),
  });
}

async function handleSessionClosed(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  sessionStore: NonNullable<AgentServerOptions["sessionStore"]>,
  now: () => Date,
  checkInDesktopSession: CheckInDesktopSession,
  apiBaseUrl: string
) {
  if (!sessionStore.get || !sessionStore.updateIf) {
    sendJson(response, 500, {
      ok: false,
      code: "SESSION_STORE_UNAVAILABLE",
      message: "Session store cannot record close events.",
    });
    return;
  }

  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentClosedRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Close detection payload is invalid.",
    });
    return;
  }

  const session = await getEventValidatedSession({
    response,
    sessionStore,
    sessionId,
    generation: parsed.data.generation,
    token: parsed.data.closeSignalToken,
    tokenField: "closeSignalToken",
    mismatchCode: "CLOSE_SIGNAL_MISMATCH",
    mismatchMessage: "Close signal token does not match the tracked session.",
  });
  if (!session) {
    return;
  }
  if (
    session.closeDetectedAt ||
    [
      "CHECKING_IN",
      "CHECKIN_FAILED",
      "RELEASE_PENDING",
      "RELEASING",
      "RELEASE_FAILED",
    ].includes(session.lifecycleState)
  ) {
    sendJson(response, 200, { ok: true, session });
    return;
  }
  if (
    !session.openObservedAt ||
    !["OPEN", "LEASE_LOST"].includes(session.lifecycleState)
  ) {
    sendJson(response, 409, {
      ok: false,
      code: "OPEN_NOT_OBSERVED",
      message: "Open observation is required before automatic close.",
    });
    return;
  }

  const closeDetectedAt = now().toISOString();
  const updated = await sessionStore.updateIf(
    sessionId,
    (current) =>
      current.generation === session.generation &&
      current.lockSessionId === session.lockSessionId &&
      current.closeSignalToken === session.closeSignalToken &&
      canRecordClose(current),
    {
      lifecycleState: "CLOSE_DETECTED",
      closeDetectedAt,
      closeDetectedSource: parsed.data.source,
      lastObservationAt: closeDetectedAt,
      lastError: undefined,
    }
  );
  if (!updated) {
    sendJson(response, 404, {
      ok: false,
      code: "SESSION_NOT_FOUND",
      message: "Tracked file session was not found.",
    });
    return;
  }
  sendJson(response, 200, {
    ok: true,
    session: updated,
  });
  queueMicrotask(() => {
    void checkInClosedSessionImmediately({
      session: updated,
      checkInDesktopSession,
      apiBaseUrl,
    }).then((result) => {
      if (!result.error) {
        return;
      }
      console.error(
        "Project Wing desktop agent background close sync failed:",
        result.error
      );
    });
  });
}

async function checkInClosedSessionImmediately({
  session,
  checkInDesktopSession,
  apiBaseUrl,
}: {
  session: DesktopAgentSession;
  checkInDesktopSession: CheckInDesktopSession;
  apiBaseUrl: string;
}): Promise<
  | { session: DesktopAgentSession; error?: undefined }
  | { session: DesktopAgentSession; error: DesktopAgentError }
> {
  if (!session.lockSessionId) {
    return {
      session,
      error: new DesktopAgentError(
        "VALIDATION_FAILED",
        "Tracked Master session has no lock session id."
      ),
    };
  }

  try {
    const result = await checkInDesktopSession(
      buildMasterCheckInRequest(session, apiBaseUrl)
    );
    return { session: result.session };
  } catch (error) {
    return {
      session,
      error:
        error instanceof DesktopAgentError
          ? error
          : new DesktopAgentError(
              "SYNC_FAILED",
              "Could not sync the closed Master session."
            ),
    };
  }
}

async function handleRecoverLaunchFailedRelease(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  sessionStore: NonNullable<AgentServerOptions["sessionStore"]>,
  probeLocalFileBusy: typeof isLocalFileBusy
) {
  if (!sessionStore.get || !sessionStore.updateIf) {
    sendJson(response, 500, {
      ok: false,
      code: "SESSION_STORE_UNAVAILABLE",
      message: "Session store cannot recover launch failures.",
    });
    return;
  }

  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }
  const parsed = DesktopAgentLaunchAbortReleaseRequestSchema.safeParse(
    body.value
  );
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Launch-abort release payload is invalid.",
    });
    return;
  }
  const session = await getEventValidatedSession({
    response,
    sessionStore,
    sessionId,
    generation: parsed.data.generation,
    token: parsed.data.closeSignalToken,
    tokenField: "closeSignalToken",
    mismatchCode: "CLOSE_SIGNAL_MISMATCH",
    mismatchMessage: "Close signal token does not match the tracked session.",
  });
  if (!session) {
    return;
  }
  if (session.lifecycleState !== "LAUNCH_FAILED") {
    sendJson(response, 409, {
      ok: false,
      code: "SESSION_STATE_MISMATCH",
      message: "Only failed launches can use this recovery action.",
    });
    return;
  }
  if (
    session.openObservedAt &&
    session.launchFailedReason !== "VISIBILITY_FAILED"
  ) {
    sendJson(response, 409, {
      ok: false,
      code: "CONFLICT_RISK",
      message: "Launch failure safety cannot be proven for this session.",
    });
    return;
  }
  if (await probeLocalFileBusy(session)) {
    sendJson(response, 409, {
      ok: false,
      code: "LOCAL_FILE_BUSY",
      message: "The tracked local file is still open.",
    });
    return;
  }

  let localHash: string;
  try {
    localHash = await hashFile(session.localPath);
  } catch {
    sendJson(response, 409, {
      ok: false,
      code: "LOCAL_FILE_MISSING",
      message: "The tracked local file is no longer in the controlled cache.",
    });
    return;
  }
  if (localHash !== session.originalHash) {
    sendJson(response, 409, {
      ok: false,
      code: "DIRTY_LOCAL_FILE",
      message: "Dirty launch-failed sessions cannot be released automatically.",
    });
    return;
  }

  const updated = await sessionStore.updateIf(
    sessionId,
    (current) =>
      current.generation === session.generation &&
      current.lockSessionId === session.lockSessionId &&
      current.closeSignalToken === session.closeSignalToken &&
      current.lifecycleState === "LAUNCH_FAILED" &&
      !current.closeDetectedAt &&
      (!current.openObservedAt ||
        current.launchFailedReason === "VISIBILITY_FAILED"),
    {
      lifecycleState: "RELEASE_PENDING",
      contentState: "UNCHANGED",
      status: "RELEASE_PENDING",
      pendingReleaseReason: "UNCHANGED_RELEASE",
      pendingReleaseHash: session.originalHash,
      lastError: undefined,
    }
  );
  sendJson(response, updated ? 200 : 409, {
    ok: Boolean(updated),
    ...(updated
      ? { session: updated }
      : {
          code: "SESSION_STATE_CHANGED",
          message: "Tracked file session state changed.",
        }),
  });
}

async function getEventValidatedSession({
  response,
  sessionStore,
  sessionId,
  generation,
  token,
  tokenField,
  mismatchCode,
  mismatchMessage,
}: {
  response: ServerResponse;
  sessionStore: NonNullable<AgentServerOptions["sessionStore"]>;
  sessionId: string;
  generation: number;
  token: string;
  tokenField: "openSignalToken" | "closeSignalToken";
  mismatchCode: string;
  mismatchMessage: string;
}) {
  const session = await sessionStore.get?.(sessionId);
  if (!session) {
    sendJson(response, 404, {
      ok: false,
      code: "SESSION_NOT_FOUND",
      message: "Tracked file session was not found.",
    });
    return null;
  }
  if (session.generation !== generation) {
    sendJson(response, 403, {
      ok: false,
      code: "SESSION_GENERATION_MISMATCH",
      message: "Session generation does not match the tracked session.",
    });
    return null;
  }
  if (!session[tokenField] || session[tokenField] !== token) {
    sendJson(response, 403, {
      ok: false,
      code: mismatchCode,
      message: mismatchMessage,
    });
    return null;
  }
  return session;
}

async function readRequestJson(
  response: ServerResponse,
  request: IncomingMessage
): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await readJson(request) };
  } catch {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Request body must be valid JSON.",
    });
    return { ok: false };
  }
}

function isClosedOrTerminalSession(session: DesktopAgentSession) {
  return [
    "CLOSED",
    "LOCK_REVOKED",
    "CONFLICT_RISK",
    "LOCAL_FILE_MISSING",
  ].includes(session.lifecycleState);
}

function canRecordClose(session: DesktopAgentSession) {
  return (
    !session.closeDetectedAt &&
    Boolean(session.openObservedAt) &&
    ["OPEN", "LEASE_LOST"].includes(session.lifecycleState)
  );
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function getTrustedAuthBaseUrl(value: string, allowedAuthOrigins: string[]) {
  try {
    const url = new URL(value);
    if (
      (url.protocol !== "http:" && url.protocol !== "https:") ||
      (url.pathname !== "/" && url.pathname !== "") ||
      url.search ||
      url.hash
    ) {
      return null;
    }
    return allowedAuthOrigins.includes(url.origin) ? url.origin : null;
  } catch {
    return null;
  }
}

function normalizeOrigins(origins: string[]) {
  return [
    ...new Set(
      origins
        .map(normalizeOrigin)
        .filter((origin): origin is string => Boolean(origin))
    ),
  ];
}

function normalizeOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function canRecordLaunchFailure(
  session: DesktopAgentSession,
  reason: DesktopAgentLaunchFailedReason
) {
  if (session.closeDetectedAt) {
    return false;
  }
  if (reason === "VISIBILITY_FAILED") {
    return (
      !session.openObservedAt &&
      (session.lifecycleState === "LAUNCHING" ||
        session.lifecycleState === "OPEN_NOT_OBSERVED")
    );
  }
  return (
    !session.openObservedAt &&
    (session.lifecycleState === "LAUNCHING" ||
      session.lifecycleState === "OPEN_NOT_OBSERVED")
  );
}

async function handleOpen(
  request: IncomingMessage,
  response: ServerResponse,
  openDesktopFile: OpenDesktopFile,
  getHealthDiagnostics?: GetHealthDiagnostics,
  getAuthorization: GetDesktopAgentAuthorization = () => null
) {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Request body must be valid JSON.",
    });
    return;
  }

  const parsed = DesktopAgentOpenRequestSchema.safeParse(body);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Open request is invalid.",
    });
    return;
  }
  const authorization = getAuthorization();
  if (!authorization) {
    sendDeviceAuthRequired(response, "opening files");
    return;
  }

  if (parsed.data.mode === "MASTER") {
    const blocker = await getMissingOfficeAppForMasterOpen(
      parsed.data.fileName,
      getHealthDiagnostics
    );
    if (blocker) {
      sendJson(response, 409, {
        ok: false,
        code: blocker.code,
        message: blocker.message,
      });
      return;
    }
  }

  try {
    const result = await openDesktopFile({ ...parsed.data, authorization });
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "OPEN_FAILED",
      message: "Could not open the selected file.",
    });
  }
}

function sendDeviceAuthRequired(response: ServerResponse, action: string) {
  sendJson(response, 401, {
    ok: false,
    code: "DEVICE_AUTH_REQUIRED",
    message: `Pair this Desktop Agent before ${action}.`,
  });
}

async function getMissingOfficeAppForMasterOpen(
  fileName: string,
  getHealthDiagnostics: GetHealthDiagnostics | undefined
) {
  const diagnostics = await getHealthDiagnostics?.().catch(() => {});
  const requiredApp = getRequiredOfficeAppForMaster(fileName);
  if (requiredApp === "excel") {
    const excel = diagnostics?.excel;
    if (excel?.status === "MISSING" || excel?.installed === false) {
      return {
        code: "EXCEL_NOT_INSTALLED",
        message:
          "Microsoft Excel is required for Master editing. Install Excel, then retry Master.",
      };
    }
  }
  if (requiredApp === "word") {
    const word = diagnostics?.word;
    if (word?.status === "MISSING" || word?.installed === false) {
      return {
        code: "WORD_NOT_INSTALLED",
        message:
          "Microsoft Word is required for Master editing. Install Word, then retry Master.",
      };
    }
  }
  if (requiredApp === "powerPoint") {
    const powerPoint = diagnostics?.powerPoint;
    if (powerPoint?.status === "MISSING" || powerPoint?.installed === false) {
      return {
        code: "POWERPOINT_NOT_INSTALLED",
        message:
          "Microsoft PowerPoint is required for Master editing. Install PowerPoint, then retry Master.",
      };
    }
  }
  if (requiredApp === "pdfEditor") {
    const pdfEditor = diagnostics?.pdfEditor;
    if (
      pdfEditor?.status === "MISSING" ||
      pdfEditor?.installed === false ||
      pdfEditor?.trustedEditor === false
    ) {
      return {
        code: "PDF_EDITOR_NOT_INSTALLED",
        message: `A supported PDF editor is required for PDF Master editing. ${PDF_MASTER_EDITOR_OPEN_RECOMMENDATION}`,
      };
    }
  }
  return null;
}

function getRequiredOfficeAppForMaster(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  if (normalized.endsWith(".pdf")) {
    return "pdfEditor";
  }
  if (normalized.endsWith(".docx") || normalized.endsWith(".doc")) {
    return "word";
  }
  if (normalized.endsWith(".pptx") || normalized.endsWith(".ppt")) {
    return "powerPoint";
  }
  if (
    normalized.endsWith(".xlsx") ||
    normalized.endsWith(".xls") ||
    normalized.endsWith(".xlsm") ||
    normalized.endsWith(".xlsb") ||
    normalized.endsWith(".csv")
  ) {
    return "excel";
  }
  return null;
}

async function handleUpdate(
  request: IncomingMessage,
  response: ServerResponse,
  updateDesktopAgent: UpdateDesktopAgent
) {
  const body = await readRequestJson(response, request);
  if (!body.ok) {
    return;
  }

  const parsed = DesktopAgentUpdateRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Update request is invalid.",
    });
    return;
  }

  try {
    const result = await updateDesktopAgent(parsed.data);
    sendJson(response, result.status === "READY" ? 200 : 202, result);
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "UPDATE_FAILED",
      message: "Could not start Desktop Agent update.",
    });
  }
}

async function handleUpdateStatus(
  response: ServerResponse,
  getDesktopAgentUpdateStatus: GetDesktopAgentUpdateStatus
) {
  const result = await getDesktopAgentUpdateStatus();
  if (!result) {
    sendJson(response, 404, {
      ok: false,
      code: "NOT_FOUND",
      message: "Desktop Agent update status is not available.",
    });
    return;
  }
  sendJson(response, 200, result);
}

async function handleCheckIn(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  checkInDesktopSession: CheckInDesktopSession
) {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Request body must be valid JSON.",
    });
    return;
  }

  const parsed = DesktopAgentCheckInRequestSchema.safeParse({
    ...(typeof body === "object" && body ? body : {}),
    sessionId,
  });
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Check-in request is invalid.",
    });
    return;
  }

  try {
    const result = await checkInDesktopSession(parsed.data);
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "UPLOAD_FAILED",
      message: "Could not check in the tracked file.",
    });
  }
}

async function handleRelease(
  request: IncomingMessage,
  response: ServerResponse,
  sessionId: string,
  releaseDesktopSession: ReleaseDesktopSession
) {
  let body: unknown;
  try {
    body = await readJson(request);
  } catch {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Request body must be valid JSON.",
    });
    return;
  }

  const parsed = DesktopAgentReleaseRequestSchema.safeParse({
    ...(typeof body === "object" && body ? body : {}),
    sessionId,
  });
  if (!parsed.success) {
    sendJson(response, 400, {
      ok: false,
      code: "VALIDATION_FAILED",
      message: "Release request is invalid.",
    });
    return;
  }

  try {
    const result = await releaseDesktopSession(parsed.data);
    sendJson(response, 200, result);
  } catch (error) {
    if (error instanceof DesktopAgentError) {
      sendJson(
        response,
        getStatusForAgentError(error),
        toAgentErrorResponse(error)
      );
      return;
    }
    sendJson(response, 500, {
      ok: false,
      code: "RELEASE_FAILED",
      message: "Could not release Master.",
    });
  }
}

async function readJson(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 1_000_000) {
      throw new Error("Request body is too large.");
    }
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf-8") || "{}");
}

function writeCorsHeaders(
  request: IncomingMessage,
  response: ServerResponse,
  allowedWebOrigins: string[]
) {
  const { origin } = request.headers;
  if (typeof origin === "string" && allowedWebOrigins.includes(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }
  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, X-Project-Wing-Agent"
  );
  if (request.headers["access-control-request-private-network"] === "true") {
    response.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

function isAllowedBrowserOrigin(
  request: IncomingMessage,
  allowedWebOrigins: string[]
) {
  const { origin } = request.headers;
  if (origin === undefined) {
    return true;
  }
  if (typeof origin !== "string") {
    return false;
  }
  const normalizedOrigin = normalizeOrigin(origin);
  return (
    normalizedOrigin !== null && allowedWebOrigins.includes(normalizedOrigin)
  );
}

function hasRequiredBrowserMutationHeader(request: IncomingMessage) {
  if (request.headers.origin === undefined) {
    return true;
  }
  if (request.method === "GET" || request.method === "HEAD") {
    return true;
  }
  return request.headers["x-project-wing-agent"] === "1";
}

function sendJson(response: ServerResponse, status: number, body: unknown) {
  response.writeHead(status, { "Content-Type": "application/json" });
  response.end(JSON.stringify(body));
}

function sendUnhandledRequestError(response: ServerResponse, error: unknown) {
  if (response.writableEnded) {
    return;
  }
  if (response.headersSent) {
    response.end();
    return;
  }

  const fallback = classifyUnhandledRequestError(error);
  sendJson(response, fallback.status, {
    ok: false,
    code: fallback.code,
    message: fallback.message,
  });
}

function classifyUnhandledRequestError(error: unknown) {
  if (error instanceof DesktopAgentError) {
    return {
      status: getStatusForAgentError(error),
      code: error.code,
      message: error.message,
    };
  }

  const code = getErrorCode(error);
  if (isBusyFileSystemErrorCode(code)) {
    return {
      status: 503,
      code: "DESKTOP_AGENT_FILE_SYSTEM_BUSY",
      message:
        "A local Desktop Agent file is temporarily unavailable. Retry in a moment.",
    };
  }
  if (code === "ENOENT") {
    return {
      status: 409,
      code: "DESKTOP_AGENT_FILE_MISSING",
      message:
        "A required local Desktop Agent file was not found. Reopen the file and retry.",
    };
  }
  if (code === "ENOSPC") {
    return {
      status: 507,
      code: "DESKTOP_AGENT_STORAGE_FULL",
      message:
        "The local disk is full. Free up space, then retry the Desktop Agent action.",
    };
  }
  if (code === "EROFS") {
    return {
      status: 409,
      code: "DESKTOP_AGENT_STORAGE_READ_ONLY",
      message:
        "The local Desktop Agent storage location is read-only. Choose a writable location and retry.",
    };
  }
  if (isInvalidLocalPathErrorCode(code)) {
    return {
      status: 409,
      code: "DESKTOP_AGENT_INVALID_LOCAL_PATH",
      message:
        "A local Desktop Agent path is invalid. Reopen the file and retry.",
    };
  }

  return {
    status: 500,
    code: "DESKTOP_AGENT_INTERNAL_ERROR",
    message: "Desktop Agent could not complete the request.",
  };
}

function getErrorCode(error: unknown) {
  return typeof error === "object" && error && "code" in error
    ? String(error.code)
    : undefined;
}

function isBusyFileSystemErrorCode(code: string | undefined) {
  return (
    code === "EBUSY" ||
    code === "EPERM" ||
    code === "EACCES" ||
    code === "EMFILE" ||
    code === "ENFILE"
  );
}

function isInvalidLocalPathErrorCode(code: string | undefined) {
  return code === "ENAMETOOLONG" || code === "EISDIR" || code === "ENOTDIR";
}

function isLoopback(remoteAddress: string | undefined) {
  return (
    remoteAddress === "127.0.0.1" ||
    remoteAddress === "::1" ||
    remoteAddress === "::ffff:127.0.0.1"
  );
}

async function defaultUpdateDesktopAgent(
  _request: DesktopAgentUpdateRequest
): Promise<DesktopAgentUpdateResponse> {
  await Promise.resolve();
  throw new DesktopAgentError(
    "UPDATE_UNAVAILABLE",
    "Desktop Agent self-update is not available."
  );
}
