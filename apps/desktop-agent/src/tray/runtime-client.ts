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

import { DesktopAgentRuntimeRequestError } from "./runtime-request-error.js";
import {
  parseAuthStatus,
  parseCheckInResponse,
  parseHealth,
  parseReleaseResponse,
  parseSessionsResponse,
  parseUpdateResponse,
  parseUpdateStatus,
  readRuntimeError,
} from "./runtime-validation.js";

export { DesktopAgentRuntimeRequestError } from "./runtime-request-error.js";

const DEFAULT_RUNTIME_URL = "http://127.0.0.1:17862";

type RuntimeFetcher = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "json" | "ok" | "status">>;

type Parser<T> = (value: unknown) => T;

export type DesktopAgentRuntimeSnapshot = {
  health: DesktopAgentHealthResponse | null;
  auth: DesktopAgentDeviceAuthStatusResponse | null;
  sessions: DesktopAgentSession[];
  recentSessions: DesktopAgentRecentSession[];
  update: DesktopAgentUpdateStatusResponse | null;
  errors: string[];
};

export type DesktopAgentRuntimeClientOptions = {
  baseUrl?: string;
  fetcher?: RuntimeFetcher;
};

export class DesktopAgentRuntimeClient {
  private readonly baseUrl: string;
  private readonly fetcher: RuntimeFetcher;

  constructor(options: DesktopAgentRuntimeClientOptions = {}) {
    this.baseUrl = normalizeLoopbackUrl(options.baseUrl ?? DEFAULT_RUNTIME_URL);
    this.fetcher = options.fetcher ?? fetch;
  }

  async readSnapshot(): Promise<DesktopAgentRuntimeSnapshot> {
    const health = await this.tryRead("health", "/health", parseHealth);
    if (!health.value) {
      return {
        health: null,
        auth: null,
        sessions: [],
        recentSessions: [],
        update: null,
        errors: [health.error ?? "health"],
      };
    }

    const [auth, sessions, update] = await Promise.all([
      this.tryRead("auth", "/auth/status", parseAuthStatus),
      this.tryRead("sessions", "/sessions", parseSessionsResponse),
      this.tryRead("update", "/update/status", parseUpdateStatus),
    ]);
    return {
      health: health.value,
      auth: auth.value,
      sessions: sessions.value?.sessions ?? [],
      recentSessions: sessions.value?.recentSessions ?? [],
      update: update.value,
      errors: [auth.error, sessions.error, update.error].filter(isString),
    };
  }

  async startUpdate(
    expectedVersion?: string
  ): Promise<DesktopAgentUpdateResponse> {
    await Promise.resolve();
    return this.post(
      "/update",
      expectedVersion ? { expectedVersion } : {},
      parseUpdateResponse
    );
  }

  async checkInSession(
    session: DesktopAgentSession
  ): Promise<DesktopAgentCheckInResponse> {
    await Promise.resolve();
    return this.post(
      sessionPath(session.sessionId, "check-in"),
      {
        sessionId: session.sessionId,
        checkInUrl: requireUrl(session.checkInUrl, "checkInUrl"),
        releaseUrl: requireUrl(session.releaseUrl, "releaseUrl"),
      },
      parseCheckInResponse
    );
  }

  async releaseSession(
    session: DesktopAgentSession
  ): Promise<DesktopAgentReleaseResponse> {
    await Promise.resolve();
    return this.post(
      sessionPath(session.sessionId, "release"),
      {
        sessionId: session.sessionId,
        releaseUrl: requireUrl(session.releaseUrl, "releaseUrl"),
      },
      parseReleaseResponse
    );
  }

  async recoverLaunchFailedRelease(
    session: DesktopAgentSession
  ): Promise<DesktopAgentCheckInResponse> {
    await Promise.resolve();
    return this.post(
      sessionPath(session.sessionId, "recover-launch-failed-release"),
      {
        generation: session.generation,
        closeSignalToken: requireValue(
          session.closeSignalToken,
          "closeSignalToken"
        ),
        confirmNoUserVisibleWorkbook: true,
      },
      parseCheckInResponse
    );
  }

  private async tryRead<T>(label: string, path: string, parse: Parser<T>) {
    try {
      const response = await this.fetcher(`${this.baseUrl}${path}`, {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        return { value: null, error: `${label}:${response.status}` };
      }
      return { value: parse(await response.json()), error: null };
    } catch {
      return { value: null, error: label };
    }
  }

  private async post<T>(
    path: string,
    body: unknown,
    parse: Parser<T>
  ): Promise<T> {
    const response = await this.fetcher(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) {
      throw requestError(response.status, payload);
    }
    return parse(payload);
  }
}

function requestError(status: number, payload: unknown) {
  const parsed = readRuntimeError(payload);
  if (parsed) {
    return new DesktopAgentRuntimeRequestError(
      status,
      parsed.code,
      parsed.message
    );
  }
  return new DesktopAgentRuntimeRequestError(
    status,
    "RUNTIME_REQUEST_FAILED",
    `Desktop Agent request failed with status ${status}.`
  );
}

function sessionPath(sessionId: string, action: string) {
  return `/sessions/${encodeURIComponent(sessionId)}/${action}`;
}

function requireUrl(value: string | undefined, name: string) {
  return requireValue(value, name);
}

function requireValue(value: string | undefined, name: string) {
  if (!value) {
    throw new Error(`Desktop Agent session is missing ${name}.`);
  }
  return value;
}

function normalizeLoopbackUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "http:" ||
    (url.hostname !== "127.0.0.1" && url.hostname !== "localhost") ||
    (url.pathname !== "/" && url.pathname !== "") ||
    url.search ||
    url.hash ||
    url.username ||
    url.password
  ) {
    throw new Error(
      "Desktop Agent runtime URL must be a loopback HTTP origin."
    );
  }
  return url.origin;
}

function isString(value: string | null): value is string {
  return typeof value === "string";
}
