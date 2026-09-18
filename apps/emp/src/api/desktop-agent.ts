import {
  DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS,
  DesktopAgentCheckInResponseSchema,
  DesktopAgentDeviceAuthStatusResponseSchema,
  DesktopAgentErrorResponseSchema,
  DesktopAgentHealthResponseSchema,
  DesktopAgentOpenResponseSchema,
  DesktopAgentPrintResponseSchema,
  DesktopAgentPrintersResponseSchema,
  DesktopAgentReleaseManifestSchema,
  DesktopAgentReleaseResponseSchema,
  DesktopAgentSessionsResponseSchema,
  DesktopAgentUpdateResponseSchema,
  DesktopAgentUpdateStatusResponseSchema,
  PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
} from "@project-wing/shared";
import type {
  DesktopAgentDeviceAuthStatusResponse,
  DesktopAgentHealthResponse,
  DesktopAgentMode,
  DesktopAgentOpenRequest,
  DesktopAgentOpenResponse,
  DesktopAgentPrintResponse,
  DesktopAgentPrinter,
  DesktopAgentReleaseManifest,
  DesktopAgentSession,
  DesktopAgentUpdateResponse,
  DesktopAgentUpdateStatusResponse,
} from "@project-wing/shared";

import { getDesktopAgentVersionPolicy } from "../config/desktop-agent";
import { getApiMode, isMockApiMode } from "./mode";

const DEFAULT_AGENT_BASE_URL =
  process.env.NEXT_PUBLIC_DESKTOP_AGENT_URL ?? "http://127.0.0.1:17862";
const DEFAULT_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";
const DEFAULT_AUTH_BASE_URL =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? DEFAULT_API_BASE_URL;
const DEFAULT_HEALTH_TIMEOUT_MS = 800;
const DESKTOP_AGENT_HEALTH_READY_ATTEMPTS = 3;
const DESKTOP_AGENT_HEALTH_READY_RETRY_DELAY_MS = 250;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_OPEN_REQUEST_TIMEOUT_MS = 35 * 60_000;
const RELEASE_MANIFEST_SESSION_KEY =
  "project-wing-desktop-agent-release-manifest";
const DESKTOP_AGENT_MUTATION_HEADERS = {
  "Content-Type": "application/json",
  "X-Project-Wing-Agent": "1",
} as const;
const activeDesktopAgentPairings = new Map<string, Promise<void>>();
const activeDesktopAgentOpens = new Map<
  string,
  Promise<DesktopAgentOpenResponse | null>
>();

type Fetcher = (
  input: string,
  init?: RequestInit
) => Promise<Pick<Response, "ok" | "json" | "status">>;

export class DesktopAgentClientError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "DesktopAgentClientError";
  }
}

type PreparedMasterSession = {
  downloadUrl: string;
  lockSessionId: string;
  baseVersion: number;
  baseVersionId?: string;
  lockEpoch?: number;
  cacheVersionId?: string;
  cacheOwnerId?: string;
  fileSize?: number;
  mimeType?: string;
  contentHash?: string;
  directUploadSupported?: boolean;
  grantSecret: string;
  fileName: string;
  contentToken?: string;
  recovered: boolean;
};

export type OpenAttachmentInDesktopAgentInput = {
  requestId?: string;
  mode: DesktopAgentMode;
  projectId: string;
  attachmentId: string;
  fileName: string;
  downloadUrl?: string;
  heartbeatUrl?: string;
  checkInUrl?: string;
  releaseUrl?: string;
  lockSessionId?: string;
  baseVersion?: number;
  baseVersionId?: string;
  lockEpoch?: number;
  cacheVersionId?: string;
  cacheOwnerId?: string;
  fileSize?: number;
  mimeType?: string;
  contentHash?: string;
  directUploadSupported?: boolean;
  grantSecret?: string;
  contentToken?: string;
};

export type CheckInDesktopAgentSessionInput = {
  sessionId: string;
  lockSessionId?: string;
  projectId: string;
  attachmentId: string;
  checkInUrl?: string;
  releaseUrl?: string;
};

export type DesktopAgentClientOptions = {
  agentBaseUrl?: string;
  apiBaseUrl?: string;
  authBaseUrl?: string;
  apiMode?: string;
  fetcher?: Fetcher;
  healthTimeoutMs?: number;
  requestTimeoutMs?: number;
  openRequestTimeoutMs?: number;
  pairingWait?: (milliseconds: number) => Promise<void>;
  releaseManifest?: DesktopAgentReleaseManifest;
};

export async function checkDesktopAgentAvailability(
  options: DesktopAgentClientOptions = {}
) {
  const status = await getDesktopAgentStatus(options);
  return status.isSupported;
}

export type DesktopAgentStatus = {
  health: DesktopAgentHealthResponse | null;
  isInstalled: boolean;
  isSupported: boolean;
  supportsSelfUpdate: boolean;
};

export type DesktopAgentCacheSettings = {
  cacheRoot: string;
  maxBytes: number;
  usedBytes?: number;
  entryCount?: number;
  orphanBytes?: number;
  orphanCount?: number;
  hitCount?: number;
  missCount?: number;
  bytesSaved?: number;
  restartRequired?: boolean;
};

const MOCK_CACHE_SETTINGS_STORAGE_KEY =
  "project-wing-preview-desktop-agent-cache-settings";
const DEFAULT_MOCK_CACHE_SETTINGS: DesktopAgentCacheSettings = {
  cacheRoot: "D:\\ProjectWingCache",
  maxBytes: 5 * 1024 * 1024 * 1024,
};

export async function getDesktopAgentCacheSettings(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentCacheSettings> {
  await Promise.resolve();
  return requestDesktopAgentCacheSettings("GET", undefined, options);
}

export async function updateDesktopAgentCacheSettings(
  input: DesktopAgentCacheSettings,
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentCacheSettings> {
  await Promise.resolve();
  return requestDesktopAgentCacheSettings("POST", input, options);
}

async function requestDesktopAgentCacheSettings(
  method: "GET" | "POST",
  input: DesktopAgentCacheSettings | undefined,
  options: DesktopAgentClientOptions
) {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return requestMockDesktopAgentCacheSettings(method, input);
  }
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  let response: Awaited<ReturnType<Fetcher>>;
  try {
    response = await fetchWithDesktopAgentRequestTimeout(
      options.fetcher ?? fetch,
      `${agentBaseUrl}/cache/settings`,
      {
        method,
        ...(input
          ? {
              headers: DESKTOP_AGENT_MUTATION_HEADERS,
              body: JSON.stringify(input),
            }
          : {}),
      },
      options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
    );
  } catch {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_UNAVAILABLE",
      "Desktop Agent is not available."
    );
  }
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_CACHE_SETTINGS_FAILED",
      parsed.success
        ? parsed.data.message
        : "Could not update Desktop Agent cache settings."
    );
  }
  if (!isDesktopAgentCacheSettings(body)) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop Agent returned invalid cache settings."
    );
  }
  return {
    cacheRoot: body.cacheRoot,
    maxBytes: body.maxBytes,
    usedBytes: readOptionalNonnegativeInteger(body.usedBytes),
    entryCount: readOptionalNonnegativeInteger(body.entryCount),
    orphanBytes: readOptionalNonnegativeInteger(body.orphanBytes),
    orphanCount: readOptionalNonnegativeInteger(body.orphanCount),
    hitCount: readOptionalNonnegativeInteger(body.hitCount),
    missCount: readOptionalNonnegativeInteger(body.missCount),
    bytesSaved: readOptionalNonnegativeInteger(body.bytesSaved),
    restartRequired:
      typeof body.restartRequired === "boolean"
        ? body.restartRequired
        : undefined,
  };
}

function requestMockDesktopAgentCacheSettings(
  method: "GET" | "POST",
  input?: DesktopAgentCacheSettings
): DesktopAgentCacheSettings {
  if (method === "POST" && input) {
    const nextSettings = {
      cacheRoot: input.cacheRoot,
      maxBytes: input.maxBytes,
    };
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        MOCK_CACHE_SETTINGS_STORAGE_KEY,
        JSON.stringify(nextSettings)
      );
    }
    return nextSettings;
  }

  if (typeof window === "undefined") {
    return DEFAULT_MOCK_CACHE_SETTINGS;
  }

  try {
    const stored = window.localStorage.getItem(MOCK_CACHE_SETTINGS_STORAGE_KEY);
    if (!stored) {
      return DEFAULT_MOCK_CACHE_SETTINGS;
    }
    const parsed = JSON.parse(stored) as Partial<DesktopAgentCacheSettings>;
    const { cacheRoot, maxBytes } = parsed;
    if (
      typeof cacheRoot !== "string" ||
      typeof maxBytes !== "number" ||
      !Number.isFinite(maxBytes)
    ) {
      return DEFAULT_MOCK_CACHE_SETTINGS;
    }
    return { cacheRoot, maxBytes };
  } catch {
    return DEFAULT_MOCK_CACHE_SETTINGS;
  }
}

function isDesktopAgentCacheSettings(
  value: unknown
): value is DesktopAgentCacheSettings & { ok?: boolean } {
  if (!value || typeof value !== "object") {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.cacheRoot === "string" &&
    typeof candidate.maxBytes === "number" &&
    Number.isSafeInteger(candidate.maxBytes) &&
    candidate.maxBytes > 0
  );
}

function readOptionalNonnegativeInteger(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? value
    : undefined;
}

export async function getDesktopAgentStatus(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentStatus> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return {
      health: null,
      isInstalled: false,
      isSupported: false,
      supportsSelfUpdate: false,
    };
  }
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const health = await fetchReadyDesktopAgentHealth(fetcher, agentBaseUrl, {
    timeoutMs: options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
  });
  return {
    health,
    isInstalled: Boolean(health),
    isSupported: Boolean(
      health &&
      isDesktopAgentHealthReady(health) &&
      isDesktopAgentVersionSupported(health.version)
    ),
    supportsSelfUpdate: Boolean(
      health &&
      isDesktopAgentHealthReady(health) &&
      isDesktopAgentSelfUpdateSupported(health.version)
    ),
  };
}

export async function getDesktopAgentReleaseManifest(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentReleaseManifest> {
  const useSessionCache = !options.fetcher && typeof window !== "undefined";
  if (useSessionCache) {
    const cached = readCachedDesktopAgentReleaseManifest();
    if (cached) {
      return cached;
    }
  }
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ?? DEFAULT_API_BASE_URL
  );
  const response = await (options.fetcher ?? fetch)(
    `${apiBaseUrl}/downloads/desktop-agent/windows/manifest`,
    { method: "GET" }
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_MANIFEST_UNAVAILABLE",
      "Desktop Agent release information is unavailable."
    );
  }
  const parsed = DesktopAgentReleaseManifestSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop Agent release information is invalid."
    );
  }
  if (useSessionCache) {
    window.sessionStorage.setItem(
      RELEASE_MANIFEST_SESSION_KEY,
      JSON.stringify(parsed.data)
    );
  }
  return parsed.data;
}

export function clearDesktopAgentReleaseManifestCache() {
  if (typeof window !== "undefined") {
    window.sessionStorage.removeItem(RELEASE_MANIFEST_SESSION_KEY);
  }
}

function readCachedDesktopAgentReleaseManifest() {
  try {
    const value = window.sessionStorage.getItem(RELEASE_MANIFEST_SESSION_KEY);
    if (!value) {
      return null;
    }
    const parsed = DesktopAgentReleaseManifestSchema.safeParse(
      JSON.parse(value)
    );
    if (parsed.success) {
      return parsed.data;
    }
    window.sessionStorage.removeItem(RELEASE_MANIFEST_SESSION_KEY);
  } catch {
    window.sessionStorage.removeItem(RELEASE_MANIFEST_SESSION_KEY);
  }
  return null;
}

export async function listDesktopAgentPrinters(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentPrinter[]> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return [];
  }
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const response = await fetchWithDesktopAgentRequestTimeout(
    options.fetcher ?? fetch,
    `${agentBaseUrl}/printers`,
    { method: "GET" },
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_PRINT_UNSUPPORTED",
      parsed.success
        ? parsed.data.message
        : "Desktop Agent does not support printer discovery."
    );
  }
  const parsed = DesktopAgentPrintersResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop Agent returned an invalid printer list."
    );
  }
  return parsed.data.printers;
}

export async function getDesktopAgentAuthStatus(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentDeviceAuthStatusResponse | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  try {
    const response = await fetchDesktopAgent(
      options.fetcher ?? fetch,
      `${agentBaseUrl}/auth/status`
    );
    const body = await response.json().catch(() => null);
    const parsed = DesktopAgentDeviceAuthStatusResponseSchema.safeParse(body);
    return response.ok && parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function printConfirmationDocuments(
  input: {
    printerName: string;
    documents: { confirmationId: string; fileName: string }[];
  },
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentPrintResponse> {
  await Promise.resolve();
  return retryAfterDesktopAgentPairing(
    () => requestConfirmationPrint(input, options),
    options
  );
}

async function requestConfirmationPrint(
  input: {
    printerName: string;
    documents: { confirmationId: string; fileName: string }[];
  },
  options: DesktopAgentClientOptions
): Promise<DesktopAgentPrintResponse> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_UNAVAILABLE",
      "Printing confirmations requires the Desktop Agent."
    );
  }
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ?? DEFAULT_API_BASE_URL
  );
  const response = await fetchWithDesktopAgentRequestTimeout(
    options.fetcher ?? fetch,
    `${agentBaseUrl}/print`,
    {
      method: "POST",
      headers: DESKTOP_AGENT_MUTATION_HEADERS,
      body: JSON.stringify({
        printerName: input.printerName,
        documents: input.documents.map((document) => ({
          id: document.confirmationId,
          fileName: document.fileName,
          downloadUrl: `${apiBaseUrl}/confirmations/print-documents/${encodeURIComponent(document.confirmationId)}.pdf`,
        })),
      }),
    },
    options.requestTimeoutMs ?? DEFAULT_OPEN_REQUEST_TIMEOUT_MS
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_PRINT_FAILED",
      parsed.success ? parsed.data.message : "Confirmation printing failed."
    );
  }
  const parsed = DesktopAgentPrintResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop Agent returned an invalid print response."
    );
  }
  return parsed.data;
}

export function pairDesktopAgentWithBetterAuth(
  options: DesktopAgentClientOptions = {}
): Promise<void> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return Promise.reject(
      new DesktopAgentClientError(
        "DESKTOP_AGENT_UNAVAILABLE",
        "Desktop Agent is not available."
      )
    );
  }
  const fetcher = options.fetcher ?? fetch;
  const authBaseUrl = normalizeBaseUrl(
    options.authBaseUrl ?? DEFAULT_AUTH_BASE_URL
  );
  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const pairingKey = `${authBaseUrl}\n${agentBaseUrl}`;
  const existingPairing = activeDesktopAgentPairings.get(pairingKey);
  if (existingPairing) {
    return existingPairing;
  }

  const pairing = startDesktopAgentPairingWithBetterAuth(
    fetcher,
    authBaseUrl,
    agentBaseUrl,
    options.pairingWait
  );
  activeDesktopAgentPairings.set(pairingKey, pairing);
  pairing
    .then(() => clearActiveDesktopAgentPairing(pairingKey, pairing))
    .catch(() => clearActiveDesktopAgentPairing(pairingKey, pairing));
  return pairing;
}

async function startDesktopAgentPairingWithBetterAuth(
  fetcher: Fetcher,
  authBaseUrl: string,
  agentBaseUrl: string,
  pairingWait?: (milliseconds: number) => Promise<void>
) {
  const deviceCode = await requestDesktopAgentDeviceCode(fetcher, authBaseUrl);

  await startDesktopAgentPairing(
    fetcher,
    agentBaseUrl,
    authBaseUrl,
    deviceCode
  );
  await claimDesktopAgentDeviceCode(fetcher, authBaseUrl, deviceCode.userCode);
  await approveDesktopAgentDeviceCode(
    fetcher,
    authBaseUrl,
    deviceCode.userCode
  );
  await waitForDesktopAgentPairing(
    fetcher,
    agentBaseUrl,
    deviceCode,
    pairingWait
  );
}

function clearActiveDesktopAgentPairing(
  pairingKey: string,
  pairing: Promise<void>
) {
  if (activeDesktopAgentPairings.get(pairingKey) === pairing) {
    activeDesktopAgentPairings.delete(pairingKey);
  }
}

async function retryAfterDesktopAgentPairing<T>(
  request: () => Promise<T>,
  options: DesktopAgentClientOptions
) {
  try {
    return await request();
  } catch (error) {
    if (
      !(error instanceof DesktopAgentClientError) ||
      error.code !== "DEVICE_AUTH_REQUIRED"
    ) {
      throw error;
    }
    await pairDesktopAgentWithBetterAuth(options);
    return request();
  }
}

type DesktopAgentDeviceCode = {
  deviceCode: string;
  userCode: string;
  expiresInSeconds: number;
  intervalSeconds: number;
};

async function requestDesktopAgentDeviceCode(
  fetcher: Fetcher,
  authBaseUrl: string
): Promise<DesktopAgentDeviceCode> {
  const response = await fetcher(`${authBaseUrl}/auth/device/code`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throwDeviceAuthError(body, "Could not start Desktop Agent pairing.");
  }
  return parseDesktopAgentDeviceCode(body);
}

async function startDesktopAgentPairing(
  fetcher: Fetcher,
  agentBaseUrl: string,
  authBaseUrl: string,
  deviceCode: DesktopAgentDeviceCode
) {
  const response = await fetcher(`${agentBaseUrl}/auth/pair`, {
    method: "POST",
    headers: DESKTOP_AGENT_MUTATION_HEADERS,
    body: JSON.stringify({
      clientId: PROJECT_WING_DESKTOP_AGENT_CLIENT_ID,
      deviceCode: deviceCode.deviceCode,
      authBaseUrl,
      expiresInSeconds: deviceCode.expiresInSeconds,
      intervalSeconds: deviceCode.intervalSeconds,
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throwDeviceAuthError(body, "Could not start Desktop Agent pairing.");
  }
}

async function claimDesktopAgentDeviceCode(
  fetcher: Fetcher,
  authBaseUrl: string,
  userCode: string
) {
  const response = await fetcher(
    `${authBaseUrl}/auth/device?user_code=${encodeURIComponent(userCode)}`,
    { method: "GET", credentials: "include" }
  );
  if (!response.ok) {
    throw new DesktopAgentClientError(
      "DEVICE_AUTHORIZATION_FAILED",
      "Could not verify Desktop Agent pairing."
    );
  }
}

async function approveDesktopAgentDeviceCode(
  fetcher: Fetcher,
  authBaseUrl: string,
  userCode: string
) {
  const response = await fetcher(`${authBaseUrl}/auth/device/approve`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userCode }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throwDeviceAuthError(body, "Could not approve Desktop Agent pairing.");
  }
}

async function waitForDesktopAgentPairing(
  fetcher: Fetcher,
  agentBaseUrl: string,
  deviceCode: DesktopAgentDeviceCode,
  pairingWait?: (milliseconds: number) => Promise<void>
) {
  const attempts = Math.ceil(
    deviceCode.expiresInSeconds / deviceCode.intervalSeconds
  );
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const response = await fetcher(`${agentBaseUrl}/auth/status`, {
      method: "GET",
    });
    const body = await response.json().catch(() => null);
    const status = DesktopAgentDeviceAuthStatusResponseSchema.safeParse(body);
    if (response.ok && status.success && status.data.authenticated) {
      return;
    }
    if (status.success && status.data.lastError) {
      break;
    }
    if (attempt + 1 < attempts) {
      await (pairingWait ?? waitForDesktopAgentPairingInterval)(
        deviceCode.intervalSeconds * 1000
      );
    }
  }
  throw new DesktopAgentClientError(
    "DEVICE_AUTHORIZATION_FAILED",
    "Desktop Agent pairing did not complete."
  );
}

function parseDesktopAgentDeviceCode(body: unknown): DesktopAgentDeviceCode {
  const value = body as Partial<{
    device_code: unknown;
    user_code: unknown;
    expires_in: unknown;
    interval: unknown;
  }> | null;
  if (
    typeof value?.device_code !== "string" ||
    typeof value.user_code !== "string" ||
    !isPositiveInteger(value.expires_in) ||
    !isPositiveInteger(value.interval)
  ) {
    throw new DesktopAgentClientError(
      "DEVICE_AUTHORIZATION_FAILED",
      "Authentication service returned an invalid device pairing response."
    );
  }
  return {
    deviceCode: value.device_code,
    userCode: value.user_code,
    expiresInSeconds: value.expires_in,
    intervalSeconds: value.interval,
  };
}

function throwDeviceAuthError(body: unknown, fallback: string): never {
  const value = body as Partial<{
    message: unknown;
    error_description: unknown;
  }> | null;
  const message =
    typeof value?.message === "string"
      ? value.message
      : typeof value?.error_description === "string"
        ? value.error_description
        : fallback;
  throw new DesktopAgentClientError("DEVICE_AUTHORIZATION_FAILED", message);
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function waitForDesktopAgentPairingInterval(milliseconds: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

export async function openAttachmentInDesktopAgent(
  input: OpenAttachmentInDesktopAgentInput,
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentOpenResponse | null> {
  const key = `${input.mode}:${input.projectId}:${input.attachmentId}`;
  const active = activeDesktopAgentOpens.get(key);
  if (active) return active;
  const task = openAttachmentInDesktopAgentCore(input, options).finally(() => {
    if (activeDesktopAgentOpens.get(key) === task) {
      activeDesktopAgentOpens.delete(key);
    }
  });
  activeDesktopAgentOpens.set(key, task);
  return task;
}

async function openAttachmentInDesktopAgentCore(
  input: OpenAttachmentInDesktopAgentInput,
  options: DesktopAgentClientOptions
): Promise<DesktopAgentOpenResponse | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ?? DEFAULT_API_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const requestTimeoutMs =
    options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const openRequestTimeoutMs =
    options.openRequestTimeoutMs ??
    options.requestTimeoutMs ??
    DEFAULT_OPEN_REQUEST_TIMEOUT_MS;
  const releaseManifestTask = Promise.resolve(
    input.mode === "MASTER"
      ? (options.releaseManifest ??
          (options.fetcher
            ? undefined
            : getDesktopAgentReleaseManifest({
                apiBaseUrl,
              })))
      : undefined
  );
  const [releaseManifest, health] = await Promise.all([
    releaseManifestTask,
    fetchReadyDesktopAgentHealth(fetcher, agentBaseUrl, {
      timeoutMs: options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
    }),
  ]);
  if (
    !health ||
    !isDesktopAgentHealthReady(health) ||
    !isDesktopAgentVersionSupported(
      health.version,
      input.mode === "MASTER"
        ? releaseManifest?.minimumSupportedVersion
        : undefined
    )
  ) {
    return null;
  }
  if (
    input.mode === "MASTER" &&
    isOfficeAppUnavailableForMaster(input, health)
  ) {
    return null;
  }

  const preparedMaster =
    input.mode === "MASTER" && !input.lockSessionId
      ? await prepareMasterSession(input, fetcher, apiBaseUrl, requestTimeoutMs)
      : null;
  const downloadUrl =
    normalizePreparedMasterDownloadUrl(
      preparedMaster?.downloadUrl ?? input.downloadUrl,
      apiBaseUrl
    ) ?? `${apiBaseUrl}${getAttachmentDownloadPath(input)}`;
  const lockSessionId = preparedMaster?.lockSessionId ?? input.lockSessionId;
  const openRequest: DesktopAgentOpenRequest = {
    ...input,
    requestId: input.requestId ?? createDesktopAgentRequestId(),
    downloadUrl,
    heartbeatUrl: normalizePreparedMasterDownloadUrl(
      input.heartbeatUrl,
      apiBaseUrl
    ),
    checkInUrl:
      normalizePreparedMasterDownloadUrl(input.checkInUrl, apiBaseUrl) ??
      buildPreparedMasterActionUrl(apiBaseUrl, lockSessionId, "check-in"),
    releaseUrl:
      normalizePreparedMasterDownloadUrl(input.releaseUrl, apiBaseUrl) ??
      buildPreparedMasterActionUrl(apiBaseUrl, lockSessionId, "release"),
    lockSessionId,
    baseVersion: preparedMaster?.baseVersion ?? input.baseVersion,
    baseVersionId: preparedMaster?.baseVersionId ?? input.baseVersionId,
    lockEpoch: preparedMaster?.lockEpoch ?? input.lockEpoch,
    cacheVersionId: preparedMaster?.cacheVersionId ?? input.cacheVersionId,
    cacheOwnerId: preparedMaster?.cacheOwnerId ?? input.cacheOwnerId,
    fileSize: preparedMaster?.fileSize ?? input.fileSize,
    mimeType: preparedMaster?.mimeType ?? input.mimeType,
    contentHash: preparedMaster?.contentHash ?? input.contentHash,
    directUploadSupported:
      preparedMaster?.directUploadSupported ?? input.directUploadSupported,
    grantSecret: preparedMaster?.grantSecret ?? input.grantSecret,
    contentToken: preparedMaster?.contentToken ?? input.contentToken,
    fileName: preparedMaster?.fileName ?? input.fileName,
  };

  try {
    return await retryAfterDesktopAgentPairing(
      () =>
        requestDesktopAgentOpen(
          fetcher,
          agentBaseUrl,
          openRequest,
          openRequestTimeoutMs
        ),
      options
    );
  } catch (error) {
    if (preparedMaster && !preparedMaster.recovered) {
      await releasePreparedMasterSession(
        input,
        preparedMaster,
        fetcher,
        apiBaseUrl,
        requestTimeoutMs
      ).catch(() => {});
    }
    throw error;
  }
}

function createDesktopAgentRequestId() {
  return (
    globalThis.crypto?.randomUUID?.() ??
    `open-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

async function requestDesktopAgentOpen(
  fetcher: Fetcher,
  agentBaseUrl: string,
  openRequest: DesktopAgentOpenRequest,
  timeoutMs: number
) {
  const response = await fetchWithDesktopAgentRequestTimeout(
    fetcher,
    `${agentBaseUrl}/open`,
    {
      method: "POST",
      headers: DESKTOP_AGENT_MUTATION_HEADERS,
      body: JSON.stringify(openRequest),
    },
    timeoutMs
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    const errorCode =
      response.status === 404 &&
      parsed.success &&
      parsed.data.code === "NOT_FOUND"
        ? "DESKTOP_AGENT_ROUTE_NOT_FOUND"
        : parsed.success
          ? parsed.data.code
          : "DESKTOP_AGENT_FAILED";
    throw new DesktopAgentClientError(
      errorCode,
      parsed.success ? parsed.data.message : "Desktop agent request failed."
    );
  }
  const parsed = DesktopAgentOpenResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data;
}

async function prepareMasterSession(
  input: OpenAttachmentInDesktopAgentInput,
  fetcher: Fetcher,
  apiBaseUrl: string,
  requestTimeoutMs: number
): Promise<PreparedMasterSession> {
  const response = await fetchWithDesktopAgentRequestTimeout(
    fetcher,
    `${apiBaseUrl}/engagement/${input.projectId}/workflow/attachments/${input.attachmentId}/master/open`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
    requestTimeoutMs
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DesktopAgentClientError(
      typeof body?.code === "string" ? body.code : "MASTER_OPEN_FAILED",
      typeof body?.message === "string"
        ? body.message
        : "Could not open Master."
    );
  }
  if (body?.ok === false && body.code === "ALREADY_MASTER") {
    return recoverMasterSession(input, fetcher, apiBaseUrl, requestTimeoutMs);
  }
  if (body?.ok === false && body.code === "LOCKED_BY_OTHER") {
    throw new DesktopAgentClientError(
      "LOCKED_BY_OTHER",
      typeof body.holderName === "string"
        ? `${body.holderName} is the Master.`
        : "Another user is the Master."
    );
  }
  return parsePreparedMasterSession(
    body,
    input,
    "MASTER_OPEN_INVALID_RESPONSE",
    false
  );
}

async function recoverMasterSession(
  input: OpenAttachmentInDesktopAgentInput,
  fetcher: Fetcher,
  apiBaseUrl: string,
  requestTimeoutMs: number
): Promise<PreparedMasterSession> {
  const response = await fetchWithDesktopAgentRequestTimeout(
    fetcher,
    `${apiBaseUrl}/engagement/${input.projectId}/workflow/attachments/${input.attachmentId}/master/recover`,
    {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    },
    requestTimeoutMs
  );
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new DesktopAgentClientError(
      typeof body?.code === "string" ? body.code : "MASTER_RECOVER_FAILED",
      typeof body?.message === "string"
        ? body.message
        : "Could not recover Master."
    );
  }
  return parsePreparedMasterSession(
    body,
    input,
    "MASTER_RECOVER_INVALID_RESPONSE",
    true
  );
}

function parsePreparedMasterSession(
  body: unknown,
  input: OpenAttachmentInDesktopAgentInput,
  invalidCode: string,
  recovered: boolean
): PreparedMasterSession {
  const value = body as Partial<{
    ok: boolean;
    downloadUrl: string;
    lockSessionId: string;
    grantSecret: string;
    version: number;
    baseVersionId: string;
    lockEpoch: number;
    cacheVersionId?: string;
    cacheOwnerId?: string;
    fileSize?: number;
    mimeType?: string;
    contentHash?: string;
    directUploadSupported?: boolean;
    fileName: string;
    contentToken: string;
  }> | null;
  if (
    value?.ok !== true ||
    typeof value.downloadUrl !== "string" ||
    typeof value.lockSessionId !== "string" ||
    typeof value.grantSecret !== "string" ||
    typeof value.version !== "number"
  ) {
    throw new DesktopAgentClientError(
      invalidCode,
      "Master open returned an invalid response."
    );
  }
  return {
    downloadUrl: value.downloadUrl,
    lockSessionId: value.lockSessionId,
    baseVersion: value.version,
    baseVersionId:
      typeof value.baseVersionId === "string" ? value.baseVersionId : undefined,
    lockEpoch:
      typeof value.lockEpoch === "number" ? value.lockEpoch : undefined,
    cacheVersionId:
      typeof value.cacheVersionId === "string"
        ? value.cacheVersionId
        : undefined,
    cacheOwnerId:
      typeof value.cacheOwnerId === "string" ? value.cacheOwnerId : undefined,
    fileSize: typeof value.fileSize === "number" ? value.fileSize : undefined,
    mimeType: typeof value.mimeType === "string" ? value.mimeType : undefined,
    contentHash:
      typeof value.contentHash === "string" ? value.contentHash : undefined,
    directUploadSupported:
      typeof value.directUploadSupported === "boolean"
        ? value.directUploadSupported
        : undefined,
    grantSecret: value.grantSecret,
    fileName:
      typeof value.fileName === "string" ? value.fileName : input.fileName,
    contentToken:
      typeof value.contentToken === "string" ? value.contentToken : undefined,
    recovered,
  };
}

async function releasePreparedMasterSession(
  input: OpenAttachmentInDesktopAgentInput,
  preparedMaster: PreparedMasterSession,
  fetcher: Fetcher,
  apiBaseUrl: string,
  requestTimeoutMs: number
) {
  await fetchWithDesktopAgentRequestTimeout(
    fetcher,
    `${apiBaseUrl}/desktop/master-sessions/${encodeURIComponent(
      preparedMaster.lockSessionId
    )}/release`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId: input.projectId,
        attachmentId: input.attachmentId,
        grantSecret: preparedMaster.grantSecret,
        reason: "UNCHANGED_RELEASE",
      }),
    },
    requestTimeoutMs
  );
}

async function fetchWithDesktopAgentRequestTimeout(
  fetcher: Fetcher,
  input: string,
  init: RequestInit,
  timeoutMs: number
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(input, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (isAbortError(error)) {
      throw new DesktopAgentClientError(
        "DESKTOP_AGENT_REQUEST_TIMEOUT",
        "Desktop Agent request timed out."
      );
    }
    throw toDesktopAgentNetworkError(error);
  } finally {
    window.clearTimeout(timeout);
  }
}

function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function toDesktopAgentNetworkError(error: unknown) {
  if (error instanceof DesktopAgentClientError) {
    return error;
  }
  return new DesktopAgentClientError(
    "DESKTOP_AGENT_UNAVAILABLE",
    "Desktop agent is not available."
  );
}

async function fetchDesktopAgent(
  fetcher: Fetcher,
  input: string,
  init?: RequestInit
) {
  try {
    return init === undefined
      ? await fetcher(input)
      : await fetcher(input, init);
  } catch (error) {
    throw toDesktopAgentNetworkError(error);
  }
}

export async function listDesktopAgentSessions(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentSession[] | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const isAvailable = await checkDesktopAgentHealth(fetcher, agentBaseUrl, {
    timeoutMs: options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
  });
  if (!isAvailable) {
    return null;
  }

  const response = await fetchDesktopAgent(fetcher, `${agentBaseUrl}/sessions`);
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_FAILED",
      parsed.success ? parsed.data.message : "Desktop agent request failed."
    );
  }

  const parsed = DesktopAgentSessionsResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data.sessions;
}

export async function checkInDesktopAgentSession(
  input: CheckInDesktopAgentSessionInput,
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentSession | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ?? DEFAULT_API_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const isAvailable = await checkDesktopAgentHealth(fetcher, agentBaseUrl, {
    timeoutMs: options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
  });
  if (!isAvailable) {
    return null;
  }

  const response = await fetchDesktopAgent(
    fetcher,
    `${agentBaseUrl}/sessions/${encodeURIComponent(input.sessionId)}/check-in`,
    {
      method: "POST",
      headers: DESKTOP_AGENT_MUTATION_HEADERS,
      body: JSON.stringify({
        checkInUrl:
          normalizeApiUrl(input.checkInUrl, apiBaseUrl) ??
          `${apiBaseUrl}${getDesktopMasterSessionPath(input, "check-in")}`,
        releaseUrl:
          normalizeApiUrl(input.releaseUrl, apiBaseUrl) ??
          `${apiBaseUrl}${getDesktopMasterSessionPath(input, "release")}`,
      }),
    }
  );
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_FAILED",
      parsed.success ? parsed.data.message : "Desktop agent request failed."
    );
  }

  const parsed = DesktopAgentCheckInResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data.session;
}

export async function releaseDesktopAgentSession(
  input: CheckInDesktopAgentSessionInput,
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentSession | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const apiBaseUrl = normalizeBaseUrl(
    options.apiBaseUrl ?? DEFAULT_API_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const isAvailable = await checkDesktopAgentHealth(fetcher, agentBaseUrl, {
    timeoutMs: options.healthTimeoutMs ?? DEFAULT_HEALTH_TIMEOUT_MS,
  });
  if (!isAvailable) {
    return null;
  }

  const response = await fetchDesktopAgent(
    fetcher,
    `${agentBaseUrl}/sessions/${encodeURIComponent(input.sessionId)}/release`,
    {
      method: "POST",
      headers: DESKTOP_AGENT_MUTATION_HEADERS,
      body: JSON.stringify({
        releaseUrl:
          normalizeApiUrl(input.releaseUrl, apiBaseUrl) ??
          `${apiBaseUrl}${getDesktopMasterSessionPath(input, "release")}`,
      }),
    }
  );
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_FAILED",
      parsed.success ? parsed.data.message : "Desktop agent request failed."
    );
  }

  const parsed = DesktopAgentReleaseResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data.session;
}

export async function updateDesktopAgent(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentUpdateResponse> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_UNAVAILABLE",
      "Desktop agent is not available."
    );
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const release = options.releaseManifest;
  if (!release) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_MANIFEST_UNAVAILABLE",
      "Desktop Agent release information is required before starting an update."
    );
  }
  const response = await fetchDesktopAgent(fetcher, `${agentBaseUrl}/update`, {
    method: "POST",
    headers: DESKTOP_AGENT_MUTATION_HEADERS,
    body: JSON.stringify({
      expectedVersion: release.version,
      expectedSha256: release.sha256,
      expectedFileSize: release.fileSize,
      downloadUrl: release.downloadUrl,
      signaturePolicy: release.signaturePolicy,
    }),
  });
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    const code = parsed.success ? parsed.data.code : "DESKTOP_AGENT_FAILED";
    const message = parsed.success
      ? parsed.data.message
      : "Desktop agent request failed.";
    if (response.status === 404 && code === "NOT_FOUND") {
      throw new DesktopAgentClientError(
        "DESKTOP_AGENT_UPDATE_UNSUPPORTED",
        "This Desktop Agent version does not support self-update."
      );
    }
    throw new DesktopAgentClientError(code, message);
  }

  const parsed = DesktopAgentUpdateResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data;
}

export async function getDesktopAgentUpdateStatus(
  options: DesktopAgentClientOptions = {}
): Promise<DesktopAgentUpdateStatusResponse | null> {
  if (isMockApiMode(options.apiMode ?? getApiMode())) {
    return null;
  }

  const agentBaseUrl = normalizeBaseUrl(
    options.agentBaseUrl ?? DEFAULT_AGENT_BASE_URL
  );
  const fetcher = options.fetcher ?? fetch;
  const response = await fetchDesktopAgent(
    fetcher,
    `${agentBaseUrl}/update/status`
  );
  if (response.status === 404) {
    return null;
  }
  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const parsed = DesktopAgentErrorResponseSchema.safeParse(body);
    throw new DesktopAgentClientError(
      parsed.success ? parsed.data.code : "DESKTOP_AGENT_FAILED",
      parsed.success ? parsed.data.message : "Desktop agent request failed."
    );
  }

  const parsed = DesktopAgentUpdateStatusResponseSchema.safeParse(body);
  if (!parsed.success) {
    throw new DesktopAgentClientError(
      "DESKTOP_AGENT_INVALID_RESPONSE",
      "Desktop agent returned an invalid response."
    );
  }
  return parsed.data;
}

async function checkDesktopAgentHealth(
  fetcher: Fetcher,
  agentBaseUrl: string,
  { timeoutMs }: { timeoutMs: number }
) {
  const health = await fetchDesktopAgentHealth(fetcher, agentBaseUrl, {
    timeoutMs,
  });
  return Boolean(
    health &&
    isDesktopAgentHealthReady(health) &&
    isDesktopAgentVersionSupported(health.version)
  );
}

async function fetchDesktopAgentHealth(
  fetcher: Fetcher,
  agentBaseUrl: string,
  { timeoutMs }: { timeoutMs: number }
) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetcher(`${agentBaseUrl}/health`, {
      signal: controller.signal,
    });
    if (!response.ok) {
      return null;
    }
    const body = await response.json().catch(() => null);
    const parsed = DesktopAgentHealthResponseSchema.safeParse(body);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchReadyDesktopAgentHealth(
  fetcher: Fetcher,
  agentBaseUrl: string,
  options: { timeoutMs: number }
) {
  let health: DesktopAgentHealthResponse | null = null;
  for (
    let attempt = 0;
    attempt < DESKTOP_AGENT_HEALTH_READY_ATTEMPTS;
    attempt += 1
  ) {
    health = await fetchDesktopAgentHealth(fetcher, agentBaseUrl, options);
    if (!health || isDesktopAgentHealthReady(health)) {
      return health;
    }
    if (attempt + 1 < DESKTOP_AGENT_HEALTH_READY_ATTEMPTS) {
      await waitForDesktopAgentPairingInterval(
        DESKTOP_AGENT_HEALTH_READY_RETRY_DELAY_MS
      );
    }
  }
  return health;
}

function isDesktopAgentVersionSupported(
  version: string,
  minimumVersion?: string
) {
  const minimumSupportedVersion =
    minimumVersion ?? getDesktopAgentVersionPolicy().minimumSupportedVersion;
  return compareDesktopAgentVersions(version, minimumSupportedVersion) >= 0;
}

function isDesktopAgentSelfUpdateSupported(version: string) {
  const { minimumSelfUpdateVersion } = getDesktopAgentVersionPolicy();
  return compareDesktopAgentVersions(version, minimumSelfUpdateVersion) >= 0;
}

function isDesktopAgentHealthReady(health: DesktopAgentHealthResponse) {
  if (health.app !== "project-wing-desktop-runtime") {
    return true;
  }
  return (
    health.agentState === "READY" ||
    health.agentState === "READY_WITH_ATTENTION"
  );
}

function isOfficeAppUnavailableForMaster(
  input: OpenAttachmentInDesktopAgentInput,
  health: DesktopAgentHealthResponse
) {
  const requiredApp = getRequiredOfficeAppForMaster(input.fileName);
  if (requiredApp === "excel") {
    const excel = health.diagnostics?.excel;
    return excel?.status === "MISSING" || excel?.installed === false;
  }
  if (requiredApp === "word") {
    const word = health.diagnostics?.word;
    return word?.status === "MISSING" || word?.installed === false;
  }
  if (requiredApp === "powerPoint") {
    const powerPoint = health.diagnostics?.powerPoint;
    return powerPoint?.status === "MISSING" || powerPoint?.installed === false;
  }
  if (requiredApp === "pdfEditor") {
    const pdfEditor = health.diagnostics?.pdfEditor;
    return (
      pdfEditor?.status === "MISSING" ||
      pdfEditor?.installed === false ||
      pdfEditor?.trustedEditor === false
    );
  }
  return false;
}

function getRequiredOfficeAppForMaster(fileName: string) {
  const extension = getFileExtension(fileName);
  if (!extension) {
    return null;
  }
  if (extension === ".pdf") {
    return "pdfEditor";
  }
  if (extension === ".docx" || extension === ".doc") {
    return "word";
  }
  if (extension === ".pptx" || extension === ".ppt") {
    return "powerPoint";
  }
  return (DESKTOP_AGENT_MASTER_OPEN_SUPPORTED_EXTENSIONS as readonly string[])
    .filter((supportedExtension) => supportedExtension !== ".docx")
    .filter((supportedExtension) => supportedExtension !== ".doc")
    .filter((supportedExtension) => supportedExtension !== ".pptx")
    .filter((supportedExtension) => supportedExtension !== ".ppt")
    .includes(extension)
    ? "excel"
    : null;
}

function getFileExtension(fileName: string) {
  const normalized = fileName.trim().toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex <= 0 ? null : normalized.slice(dotIndex);
}

function compareDesktopAgentVersions(left: string, right: string) {
  const leftParts = parseDesktopAgentVersion(left);
  const rightParts = parseDesktopAgentVersion(right);
  if (!leftParts || !rightParts) {
    return -1;
  }

  for (let index = 0; index < leftParts.length; index += 1) {
    const delta = leftParts[index] - rightParts[index];
    if (delta !== 0) {
      return delta;
    }
  }
  return 0;
}

function parseDesktopAgentVersion(version: string) {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());
  if (!match) {
    return null;
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])] as const;
}

function getAttachmentDownloadPath(input: OpenAttachmentInDesktopAgentInput) {
  const suffix = input.mode === "MASTER" ? "download" : "download-readonly";
  return `/engagement/${input.projectId}/workflow/attachments/${input.attachmentId}/${suffix}`;
}

function getDesktopMasterSessionPath(
  input: CheckInDesktopAgentSessionInput,
  action: "check-in" | "release"
) {
  const lockSessionId = input.lockSessionId ?? input.sessionId;
  return `/desktop/master-sessions/${encodeURIComponent(lockSessionId)}/${action}`;
}

function buildPreparedMasterActionUrl(
  apiBaseUrl: string,
  lockSessionId: string | undefined,
  action: "check-in" | "release"
) {
  if (!lockSessionId) {
    return;
  }
  return `${normalizeBaseUrl(apiBaseUrl)}/desktop/master-sessions/${encodeURIComponent(
    lockSessionId
  )}/${action}`;
}

function normalizeBaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function normalizeApiUrl(value: string | undefined, apiBaseUrl: string) {
  if (!value) {
    return;
  }
  return value.startsWith("/") ? `${apiBaseUrl}${value}` : value;
}

function normalizePreparedMasterDownloadUrl(
  value: string | undefined,
  apiBaseUrl: string
) {
  if (!value) {
    return;
  }

  const normalizedApiBaseUrl = normalizeBaseUrl(apiBaseUrl);
  try {
    const apiUrl = new URL(normalizedApiBaseUrl);
    const downloadUrl = new URL(value, `${normalizedApiBaseUrl}/`);
    if (downloadUrl.origin === apiUrl.origin) {
      return downloadUrl.toString();
    }

    const apiPath = apiUrl.pathname.replace(/\/+$/, "");
    const downloadPath = downloadUrl.pathname.startsWith(`${apiPath}/`)
      ? downloadUrl.pathname.slice(apiPath.length)
      : downloadUrl.pathname;
    return `${normalizedApiBaseUrl}${downloadPath}${downloadUrl.search}${downloadUrl.hash}`;
  } catch {
    return normalizeApiUrl(value, normalizedApiBaseUrl);
  }
}
