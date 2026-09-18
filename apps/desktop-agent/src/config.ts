import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import pathModule from "node:path";

const { isAbsolute, join, resolve } = pathModule;

export const AGENT_APP_NAME = "project-wing-desktop-agent";
export const FALLBACK_AGENT_VERSION = "0.2.1";
export const DEFAULT_AGENT_PORT = 17_862;
export const DEFAULT_AGENT_WORKER_PORT = 17_863;
export const DEFAULT_MASTER_OPEN_OBSERVATION_TIMEOUT_MS = 20_000;
export const DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS = 45_000;
export const DEFAULT_AGENT_FETCH_TIMEOUT_MS = 60_000;
export const DEFAULT_AGENT_TRANSFER_TIMEOUT_MS = 30 * 60_000;
export const DEFAULT_AGENT_LOG_MAX_BYTES = 100 * 1024 * 1024;
export const DEFAULT_AGENT_CACHE_MAX_BYTES = 5 * 1024 * 1024 * 1024;
export const AGENT_CACHE_SETTINGS_FILE_NAME = "cache-settings.json";
export type DesktopAgentDiagnosticLogLevel = "normal" | "debug";
export type DesktopAgentRuntimeRole = "standalone" | "worker";
const DEFAULT_DEPLOYED_ORIGINS = [
  "https://emp.superfx.cn",
  "https://emp.wzcpa.hk",
  "https://wing.superfx.cn",
];
const DEFAULT_AUTH_BASE_URL = "https://auth.superfx.cn";
const DEFAULT_ALLOWED_AUTH_ORIGINS = [
  DEFAULT_AUTH_BASE_URL,
  "https://auth.wzcpa.hk",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:3020",
  "http://127.0.0.1:3020",
];

export function getAgentVersion(
  env: NodeJS.ProcessEnv = process.env,
  cwd = process.cwd()
) {
  const envVersion = env.PROJECT_WING_AGENT_VERSION?.trim();
  if (envVersion) {
    return envVersion;
  }

  const manifestPath =
    env.PROJECT_WING_AGENT_MANIFEST_PATH?.trim() ??
    join(cwd, "agent-manifest.json");
  const manifestVersion = readManifestVersion(manifestPath);
  return manifestVersion ?? FALLBACK_AGENT_VERSION;
}

export function getCacheRoot(env: NodeJS.ProcessEnv = process.env) {
  const environmentRoot = env.PROJECT_WING_AGENT_CACHE_ROOT?.trim();
  if (environmentRoot) {
    return resolve(environmentRoot);
  }

  const persistedRoot = readCacheSettings(getStateRoot(env))?.cacheRoot;
  if (persistedRoot) {
    return persistedRoot;
  }

  if (process.platform === "win32" && env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, "ProjectWing", "agent-cache");
  }

  return join(homedir(), ".project-wing", "agent-cache");
}

export function getCacheMaxBytes(env: NodeJS.ProcessEnv = process.env) {
  const environmentValue = parsePositiveInteger(
    env.PROJECT_WING_AGENT_CACHE_MAX_BYTES
  );
  if (environmentValue) {
    return environmentValue;
  }

  return (
    readCacheSettings(getStateRoot(env))?.maxBytes ??
    DEFAULT_AGENT_CACHE_MAX_BYTES
  );
}

export function getStateRoot(env: NodeJS.ProcessEnv = process.env) {
  if (env.PROJECT_WING_AGENT_STATE_ROOT) {
    return env.PROJECT_WING_AGENT_STATE_ROOT;
  }

  if (process.platform === "win32" && env.LOCALAPPDATA) {
    return join(env.LOCALAPPDATA, "ProjectWing", "AgentState");
  }

  return join(homedir(), ".project-wing", "AgentState");
}

export function getAllowedDownloadOrigins(
  env: NodeJS.ProcessEnv = process.env
) {
  return splitOrigins(env.PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS, [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3020",
    "http://127.0.0.1:3020",
    ...DEFAULT_DEPLOYED_ORIGINS,
  ]);
}

export function getAllowedWebOrigins(env: NodeJS.ProcessEnv = process.env) {
  return splitOrigins(env.PROJECT_WING_AGENT_ALLOWED_WEB_ORIGINS, [
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3021",
    "http://127.0.0.1:3021",
    ...DEFAULT_DEPLOYED_ORIGINS,
  ]);
}

export function getApiBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  return (
    env.PROJECT_WING_AGENT_API_BASE_URL?.replace(/\/+$/, "") ??
    getAllowedDownloadOrigins(env)[0]
  );
}

export function getAuthBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  const configured = env.PROJECT_WING_AGENT_AUTH_BASE_URL?.trim();
  if (!configured) {
    return DEFAULT_AUTH_BASE_URL;
  }
  try {
    const url = new URL(configured);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.origin
      : DEFAULT_AUTH_BASE_URL;
  } catch {
    return DEFAULT_AUTH_BASE_URL;
  }
}

export function getAllowedAuthOrigins(env: NodeJS.ProcessEnv = process.env) {
  return normalizeOrigins([
    ...splitOrigins(
      env.PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS,
      DEFAULT_ALLOWED_AUTH_ORIGINS
    ),
    getAuthBaseUrl(env),
  ]);
}

export function getDesktopAgentWindowsDownloadUrl(
  env: NodeJS.ProcessEnv = process.env
) {
  return (
    env.PROJECT_WING_AGENT_WINDOWS_DOWNLOAD_URL?.trim() ||
    `${getApiBaseUrl(env)}/downloads/desktop-agent/windows/latest`
  );
}

export function getAgentManagerExePath(env: NodeJS.ProcessEnv = process.env) {
  return env.PROJECT_WING_AGENT_MANAGER_EXE_PATH?.trim() || null;
}

export function getAgentBaseUrl(env: NodeJS.ProcessEnv = process.env) {
  if (env.PROJECT_WING_AGENT_BASE_URL) {
    return env.PROJECT_WING_AGENT_BASE_URL.replace(/\/+$/, "");
  }

  return `http://127.0.0.1:${env.PROJECT_WING_AGENT_PORT ?? DEFAULT_AGENT_PORT}`;
}

export function getAgentRuntimeRole(
  env: NodeJS.ProcessEnv = process.env
): DesktopAgentRuntimeRole {
  return env.PROJECT_WING_AGENT_RUNTIME_ROLE?.trim().toLowerCase() === "worker"
    ? "worker"
    : "standalone";
}

export function getAgentWorkerPort(env: NodeJS.ProcessEnv = process.env) {
  return parsePort(
    env.PROJECT_WING_AGENT_WORKER_PORT,
    DEFAULT_AGENT_WORKER_PORT
  );
}

export function getMasterOpenObservationTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
) {
  const raw = env.PROJECT_WING_AGENT_OPEN_OBSERVATION_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_MASTER_OPEN_OBSERVATION_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_MASTER_OPEN_OBSERVATION_TIMEOUT_MS;
  }
  return parsed;
}

export function getPdfMasterOpenObservationTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
) {
  const raw = env.PROJECT_WING_AGENT_PDF_OPEN_OBSERVATION_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_PDF_MASTER_OPEN_OBSERVATION_TIMEOUT_MS;
  }
  return parsed;
}

export function getDesktopAgentFetchTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
) {
  const raw = env.PROJECT_WING_AGENT_FETCH_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_AGENT_FETCH_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_AGENT_FETCH_TIMEOUT_MS;
  }
  return parsed;
}

export function getDesktopAgentTransferTimeoutMs(
  env: NodeJS.ProcessEnv = process.env
) {
  const raw = env.PROJECT_WING_AGENT_TRANSFER_TIMEOUT_MS;
  if (!raw) {
    return DEFAULT_AGENT_TRANSFER_TIMEOUT_MS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_AGENT_TRANSFER_TIMEOUT_MS;
  }
  return parsed;
}

export function getDiagnosticLogLevel(
  env: NodeJS.ProcessEnv = process.env
): DesktopAgentDiagnosticLogLevel {
  return env.PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL?.trim().toLowerCase() ===
    "debug"
    ? "debug"
    : "normal";
}

export function getAgentLogMaxBytes(env: NodeJS.ProcessEnv = process.env) {
  const raw = env.PROJECT_WING_AGENT_LOG_MAX_BYTES;
  if (!raw) {
    return DEFAULT_AGENT_LOG_MAX_BYTES;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_AGENT_LOG_MAX_BYTES;
  }
  return Math.floor(parsed);
}

function splitOrigins(value: string | undefined, fallback: string[]) {
  if (!value) {
    return fallback;
  }
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function normalizeOrigins(origins: string[]) {
  return [
    ...new Set(
      origins
        .map(normalizeHttpOrigin)
        .filter((origin): origin is string => Boolean(origin))
    ),
  ];
}

function normalizeHttpOrigin(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

function parsePort(value: string | undefined, fallback: number) {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65_535) {
    return fallback;
  }
  return parsed;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function readCacheSettings(stateRoot: string) {
  try {
    const raw = readFileSync(
      join(stateRoot, AGENT_CACHE_SETTINGS_FILE_NAME),
      "utf-8"
    ).replace(/^\uFEFF/, "");
    const value = JSON.parse(raw) as {
      cacheRoot?: unknown;
      maxBytes?: unknown;
    };
    const cacheRoot =
      typeof value.cacheRoot === "string" && isAbsolute(value.cacheRoot)
        ? resolve(value.cacheRoot)
        : null;
    const maxBytes =
      typeof value.maxBytes === "number" &&
      Number.isSafeInteger(value.maxBytes) &&
      value.maxBytes > 0
        ? value.maxBytes
        : null;
    if (!cacheRoot && !maxBytes) {
      return null;
    }
    return {
      cacheRoot: cacheRoot ?? undefined,
      maxBytes: maxBytes ?? undefined,
    };
  } catch {
    return null;
  }
}

function readManifestVersion(manifestPath: string) {
  try {
    if (!existsSync(manifestPath)) {
      return null;
    }
    const manifestJson = readFileSync(manifestPath, "utf-8").replace(
      /^\uFEFF/,
      ""
    );
    const manifest = JSON.parse(manifestJson) as {
      app?: unknown;
      version?: unknown;
    };
    if (
      manifest.app !== AGENT_APP_NAME ||
      typeof manifest.version !== "string"
    ) {
      return null;
    }
    const version = manifest.version.trim();
    return version || null;
  } catch {
    return null;
  }
}
