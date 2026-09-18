import { mkdir, realpath, stat } from "node:fs/promises";
import path from "node:path";

import type {
  DesktopAgentAccount,
  DesktopAgentSnapshot,
  DesktopAgentState,
  DesktopCacheFiles,
  DesktopCacheSettings,
} from "../shared/desktop-agent-api";

const runtimeOrigin = "http://127.0.0.1:17862";
const runtimeRequestTimeoutMs = 8000;

export class DesktopAgentRuntimeClient {
  constructor(
    private readonly webBaseUrl = "https://emp.superfx.cn",
    private readonly origin = runtimeOrigin
  ) {}
  private sessions = new Map<string, RuntimeSession>();
  private recentProjectIds = new Set<string>();
  private lastKnown: DesktopAgentSnapshot | null = null;
  private readTask: Promise<DesktopAgentSnapshot> | null = null;
  private authGeneration = 0;

  async cacheFiles(): Promise<DesktopCacheFiles> {
    const payload = await this.get("/cache/files");
    if (!Array.isArray(payload.files) || typeof payload.usedBytes !== "number")
      throw new Error(
        "Cache list unavailable. Update Desktop Agent and retry."
      );
    for (const file of payload.files) {
      if (
        !file ||
        typeof file.id !== "string" ||
        typeof file.fileName !== "string" ||
        typeof file.size !== "number" ||
        typeof file.canDelete !== "boolean"
      )
        throw new Error("Invalid cache listing.");
    }
    return payload as unknown as DesktopCacheFiles;
  }

  async deleteCacheFile(id: string) {
    await this.post("/cache/files/delete", { id, confirmed: true });
    return this.cacheFiles();
  }

  async cacheSettings(): Promise<DesktopCacheSettings> {
    return this.get(
      "/cache/settings"
    ) as unknown as Promise<DesktopCacheSettings>;
  }

  async saveCacheSettings(
    settings: Pick<
      DesktopCacheSettings,
      "cacheRoot" | "maxBytes" | "evictionPolicy" | "idleDays"
    >,
    capacityReductionConfirmed = false
  ): Promise<DesktopCacheSettings> {
    if (
      typeof settings.cacheRoot !== "string" ||
      !path.isAbsolute(settings.cacheRoot) ||
      !Number.isSafeInteger(settings.maxBytes) ||
      settings.maxBytes <= 0 ||
      (settings.evictionPolicy !== undefined &&
        !["LRU", "FIFO"].includes(settings.evictionPolicy)) ||
      (settings.idleDays !== undefined &&
        (!Number.isInteger(settings.idleDays) ||
          settings.idleDays < 1 ||
          settings.idleDays > 3650))
    )
      throw new Error(
        "Enter a local cache folder and a positive capacity limit."
      );
    return this.post("/cache/settings", {
      ...settings,
      capacityReductionConfirmed,
    }) as unknown as Promise<DesktopCacheSettings>;
  }

  snapshot(): Promise<DesktopAgentSnapshot> {
    return (this.readTask ??= this.readSnapshot().finally(() => {
      this.readTask = null;
    }));
  }

  private async readSnapshot(): Promise<DesktopAgentSnapshot> {
    const { authGeneration } = this;
    const results = await Promise.allSettled([
      this.get("/health"),
      this.get("/auth/status"),
      this.get("/sessions"),
    ]);
    const [healthResult, authResult, sessionsResult] = results;
    if (authGeneration !== this.authGeneration) {
      return {
        state: "PAIR_REQUIRED",
        version: null,
        attentionCount: 0,
        error: null,
        user: null,
        recentFiles: [],
        sessions: [],
        stale: true,
      };
    }
    const health =
      healthResult.status === "fulfilled" ? healthResult.value : null;
    const auth = authResult.status === "fulfilled" ? authResult.value : null;
    const sessions =
      sessionsResult.status === "fulfilled" ? sessionsResult.value : null;
    if (
      auth &&
      (!readAccount(auth) || readAccount(auth)?.id !== this.lastKnown?.user?.id)
    ) {
      this.lastKnown = null;
      this.sessions.clear();
      this.recentProjectIds.clear();
    }
    const validSessions =
      sessions &&
      Array.isArray(sessions.sessions) &&
      readSessions(sessions).length === sessions.sessions.length;
    const recoveryRequired = Boolean(
      health &&
      (readNumber(health, "quarantineCount") > 0 ||
        (readString(health, "restoreState") &&
          readString(health, "restoreState") !== "READY"))
    );
    if (!health || !auth || !sessions || !validSessions) {
      this.sessions.clear();
      const state = health
        ? readState(health, auth ?? {}, sessions ?? {})
        : "OFFLINE";
      return {
        state:
          state === "READY" || state === "PAIR_REQUIRED" ? "ATTENTION" : state,
        version: health
          ? readString(health, "version")
          : (this.lastKnown?.version ?? null),
        attentionCount: this.lastKnown?.attentionCount ?? 0,
        error:
          readString(health ?? {}, "failureReason") ??
          "Current local service state could not be confirmed. Last-known files are shown; file actions are disabled.",
        user: auth ? readAccount(auth) : (this.lastKnown?.user ?? null),
        recentFiles: this.lastKnown?.recentFiles ?? [],
        sessions: this.lastKnown?.sessions ?? [],
        stale: true,
        observedAt: this.lastKnown?.observedAt,
      };
    }
    const runtimeSessions = readSessions(sessions);
    if (recoveryRequired && runtimeSessions.length === 0) {
      this.sessions.clear();
      return {
        state: "ATTENTION",
        version: readString(health, "version"),
        attentionCount: readNumber(health, "attentionCount"),
        error: null,
        user: readAccount(auth),
        recentFiles: this.lastKnown?.recentFiles ?? [],
        sessions: this.lastKnown?.sessions ?? [],
        stale: true,
        recoveryRequired: true,
        observedAt: this.lastKnown?.observedAt,
      };
    }
    this.sessions = new Map(
      runtimeSessions.map((session) => [session.sessionId, session])
    );
    const activeKeys = new Set(
      runtimeSessions.flatMap((session) =>
        session.attachmentId
          ? [`${session.projectId}:${session.attachmentId}`]
          : []
      )
    );
    const recentFiles = readRecentFiles(sessions)
      .filter(
        (file) => !activeKeys.has(`${file.projectId}:${file.attachmentId}`)
      )
      .slice(0, 5);
    this.recentProjectIds = new Set(recentFiles.map((file) => file.projectId));
    this.lastKnown = {
      state: readState(health, auth, sessions),
      version: readString(health, "version"),
      attentionCount: readNumber(health, "attentionCount"),
      error: null,
      user: readAccount(auth),
      recentFiles,
      sessions: runtimeSessions.map(toPublicSession),
      stale: false,
      recoveryRequired,
      observedAt: new Date().toISOString(),
    };
    return this.lastKnown;
  }

  async signOut() {
    this.authGeneration += 1;
    this.lastKnown = null;
    this.sessions.clear();
    this.recentProjectIds.clear();
    await this.post("/auth/sign-out", {});
    this.lastKnown = null;
    this.sessions.clear();
    this.recentProjectIds.clear();
    return this.snapshot();
  }

  async checkIn(sessionId: string) {
    const session = await this.getSession(sessionId);
    // A visible row is not permission to mutate it. Revalidated on every IPC
    // action, so stale renderer state cannot enable read-only or unsafe work.
    if (!session.canCheckIn || !session.checkInUrl || !session.releaseUrl) {
      throw new Error(
        "This file is read-only or is not currently safe to synchronize. No files were changed."
      );
    }
    await this.post(`/sessions/${encodeURIComponent(sessionId)}/check-in`, {
      sessionId: session.sessionId,
      checkInUrl: session.checkInUrl,
      releaseUrl: session.releaseUrl,
    });
    return this.snapshot();
  }

  release(sessionId: string) {
    // Keep the user action safe even with an older native service whose release
    // route meant discard. Check-in uploads changed bytes before releasing.
    return this.checkIn(sessionId);
  }

  async endTracking(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (
      ![
        "LOCAL_FILE_MISSING",
        "LEASE_LOST",
        "LOCK_REVOKED",
        "SERVER_FILE_REMOVED",
      ].includes(session.lifecycleState ?? session.status)
    )
      throw new Error(
        "This session changed. Refresh and retry; no record was removed."
      );
    await this.post(`/sessions/${encodeURIComponent(sessionId)}/end-tracking`, {
      confirmed: true,
    });
    return this.snapshot();
  }

  async recoveryHistoryDirectory() {
    const health = await this.get("/health");
    assertRecoverySource(health);
    const stateRoot = readString(health, "stateRoot");
    if (!stateRoot || !path.isAbsolute(stateRoot))
      throw new Error("Recovery history is unavailable.");
    const directory = path.join(await realpath(stateRoot), "resolved-sessions");
    await mkdir(directory, { recursive: true });
    return realpath(directory);
  }

  async projectUrl(sessionId: string) {
    const session = await this.getSession(sessionId);
    const url = new URL(this.webBaseUrl);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Invalid project website.");
    return new URL(
      `/zh-CN/engagement/${encodeURIComponent(session.projectId)}`,
      url.origin
    ).href;
  }

  async recentProjectUrl(projectId: string) {
    const current = await this.snapshot();
    if (current.stale || !current.user || !this.recentProjectIds.has(projectId))
      throw new Error(
        "This recent project is no longer available. Refresh and retry."
      );
    return this.buildProjectUrl(projectId);
  }

  async sessionFilePath(sessionId: string) {
    const session = await this.getSession(sessionId);
    if (!session.localPath || !path.isAbsolute(session.localPath))
      throw new Error("The local file location is unavailable.");
    const canonical = await realpath(session.localPath);
    if (!(await stat(canonical)).isFile())
      throw new Error("The local file is no longer available.");
    return canonical;
  }

  private buildProjectUrl(projectId: string) {
    const url = new URL(this.webBaseUrl);
    if (!["https:", "http:"].includes(url.protocol))
      throw new Error("Invalid project website.");
    return new URL(
      `/zh-CN/engagement/${encodeURIComponent(projectId)}`,
      url.origin
    ).href;
  }

  async retainedFilesDirectory(): Promise<string> {
    // Do not infer a folder from renderer input, stale session rows or defaults.
    // The current Manager generation must confirm the native configuration.
    const before = await this.get("/health");
    assertRecoverySource(before);
    const settings = await this.get("/cache/settings");
    const after = await this.get("/health");
    assertRecoverySource(after);
    if (
      before.managerInstanceId !== after.managerInstanceId ||
      settings.ok !== true ||
      typeof settings.cacheRoot !== "string" ||
      !settings.cacheRoot.trim()
    ) {
      throw new Error(
        "The local recovery folder could not be confirmed. Recover the local service and retry; no files were changed."
      );
    }
    // Windows can redirect the whole user profile. Resolve the freshly
    // confirmed native configuration before passing it to the strict opener.
    return realpath(settings.cacheRoot);
  }

  private async getSession(sessionId: string) {
    const current = await this.snapshot();
    if (
      current.stale ||
      !current.user ||
      !["READY", "ATTENTION"].includes(current.state)
    ) {
      throw new Error(
        "Current session state is unavailable. Refresh or recover the local service before modifying files."
      );
    }
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error("Desktop Agent session was not found.");
    }
    return session;
  }

  private async get(path: string) {
    const response = await fetch(`${this.origin}${path}`, {
      signal: AbortSignal.timeout(runtimeRequestTimeoutMs),
    });
    if (!response.ok) {
      throw await readRuntimeError(response, "request");
    }
    return (await response.json()) as Record<string, unknown>;
  }

  private async post(path: string, body: unknown) {
    const response = await fetch(`${this.origin}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Project-Wing-Agent": "1",
      },
      signal: AbortSignal.timeout(runtimeRequestTimeoutMs),
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      throw await readRuntimeError(response, "action");
    }
    return (await response.json()) as Record<string, unknown>;
  }
}

function assertRecoverySource(health: Record<string, unknown>) {
  if (
    health.app !== "project-wing-desktop-runtime" ||
    health.ok !== true ||
    typeof health.managerInstanceId !== "string" ||
    !health.managerInstanceId ||
    !["READY", "READY_WITH_ATTENTION"].includes(String(health.agentState))
  ) {
    throw new Error(
      "The local recovery folder could not be confirmed. Recover the local service and retry; no files were changed."
    );
  }
}

function readAccount(
  payload: Record<string, unknown>
): DesktopAgentAccount | null {
  if (!payload.user || typeof payload.user !== "object") {
    return null;
  }
  const user = payload.user as Record<string, unknown>;
  const id = readString(user, "id");
  const email = readString(user, "email");
  const name = readString(user, "name");
  const globalRole = readString(user, "globalRole") ?? "USER";
  return id && email && name ? { id, email, name, globalRole } : null;
}

function readState(
  health: Record<string, unknown>,
  auth: Record<string, unknown>,
  sessions: Record<string, unknown>
): DesktopAgentState {
  const state = readString(health, "agentState");
  if (state === "STARTING" || state === "RECOVERING") {
    return "STARTING";
  }
  if (state === "UPDATING") {
    return "UPDATING";
  }
  if (
    state === "DEGRADED_NEEDS_ATTENTION" ||
    state === "READY_WITH_ATTENTION"
  ) {
    return "ATTENTION";
  }
  if (state !== "READY") {
    return "FAILED";
  }
  if (
    readNumber(health, "attentionCount") > 0 ||
    readSessions(sessions).some((item) => item.status.includes("FAILED"))
  ) {
    return "ATTENTION";
  }
  if (auth.pairing === true) {
    return "PAIRING";
  }
  if (auth.authenticated !== true) {
    return "PAIR_REQUIRED";
  }
  return "READY";
}

type RuntimeSession = DesktopAgentSnapshot["sessions"][number] & {
  checkInUrl: string | null;
  releaseUrl: string | null;
  attachmentId: string | null;
  localPath: string | null;
};

function readSessions(payload: Record<string, unknown>): RuntimeSession[] {
  if (!Array.isArray(payload.sessions)) {
    return [];
  }
  return payload.sessions.flatMap((value) => {
    if (!value || typeof value !== "object") {
      return [];
    }
    const item = value as Record<string, unknown>;
    const sessionId = readString(item, "sessionId");
    const fileName = readString(item, "fileName");
    const projectId = readString(item, "projectId");
    const attachmentId = readString(item, "attachmentId");
    const status = readString(item, "status");
    const checkInUrl = readString(item, "checkInUrl");
    const releaseUrl = readString(item, "releaseUrl");
    const rawMode = readString(item, "mode");
    // Older writable records omitted mode, but carried both mutation URLs.
    // Do not infer writable access for explicit unknown modes or partial rows.
    const mode =
      rawMode === "READ_ONLY"
        ? "READ_ONLY"
        : rawMode === "MASTER" ||
            (item.mode === undefined && checkInUrl && releaseUrl)
          ? "MASTER"
          : "UNKNOWN";
    const lifecycleState = readString(item, "lifecycleState");
    const canCheckIn =
      mode === "MASTER" &&
      Boolean(checkInUrl && releaseUrl) &&
      canSynchronizeState(status) &&
      (!lifecycleState || canSynchronizeState(lifecycleState));
    return sessionId && fileName && projectId && status
      ? [
          {
            sessionId,
            fileName,
            projectId,
            attachmentId,
            status,
            mode,
            canCheckIn,
            checkInUrl,
            releaseUrl,
            localPath: readString(item, "localPath"),
            lifecycleState: lifecycleState ?? undefined,
            lastError: readString(item, "lastError") ?? undefined,
          },
        ]
      : [];
  });
}

function readRecentFiles(
  payload: Record<string, unknown>
): NonNullable<DesktopAgentSnapshot["recentFiles"]> {
  if (!Array.isArray(payload.recentSessions)) return [];
  return payload.recentSessions.flatMap((value) => {
    if (!value || typeof value !== "object") return [];
    const item = value as Record<string, unknown>;
    const projectId = readString(item, "projectId");
    const attachmentId = readString(item, "attachmentId");
    const fileName = readString(item, "fileName");
    const openedAt = readString(item, "openedAt");
    const closedAt = readString(item, "closedAt");
    const rawMode = readString(item, "mode");
    const mode =
      rawMode === "MASTER" || rawMode === "READ_ONLY" ? rawMode : "UNKNOWN";
    return projectId && attachmentId && fileName && openedAt && closedAt
      ? [{ projectId, attachmentId, fileName, mode, openedAt, closedAt }]
      : [];
  });
}

function canSynchronizeState(state: string | null) {
  return (
    state !== null &&
    [
      "CLOSE_DETECTED",
      "DIRTY_PENDING_CHECKIN",
      "CHECKIN_FAILED",
      "RELEASE_FAILED",
      "CLEANUP_FAILED",
      "CONFLICT_RISK",
      "CLOSED",
    ].includes(state)
  );
}

function toPublicSession({
  checkInUrl: _checkInUrl,
  releaseUrl: _releaseUrl,
  attachmentId: _attachmentId,
  localPath: _localPath,
  ...session
}: RuntimeSession) {
  return session;
}

function readString(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "string" ? value[key] : null;
}

function readNumber(value: Record<string, unknown>, key: string) {
  return typeof value[key] === "number" ? value[key] : 0;
}

async function readRuntimeError(response: Response, operation: string) {
  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  const message = payload ? readString(payload, "message") : null;
  if (message) {
    return new Error(message);
  }
  return new Error(`Desktop Agent ${operation} failed (${response.status}).`);
}
