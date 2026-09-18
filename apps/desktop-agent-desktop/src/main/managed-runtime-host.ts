import { spawn } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const runtimePort = 17_862;
const workerPort = 17_863;
const runtimeOrigin = `http://127.0.0.1:${runtimePort}`;
// Manager probes a hung worker for up to 1.5 seconds before reporting STARTING.
// The native recovery client must outlive that probe to identify the owner.
const healthTimeoutMs = 3000;
const healthRetryDelayMs = 50;
const shutdownTimeoutMs = 1500;
const restartDelayMs = 2000;

export type ManagedRuntimeHostOptions = {
  appDataPath: string;
  appVersion: string;
  isPackaged: boolean;
  localAppDataPath?: string;
  platform: NodeJS.Platform;
  resourcesPath: string;
  webBaseUrl?: string;
};

type ManagedRuntimePaths = {
  appDirectory: string;
  managerPath: string;
  runtimePath: string;
};

export class ManagedRuntimeHost {
  private manager: ChildProcess | null = null;
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private stopping = false;
  private startTask: Promise<void> | null = null;
  private recoveryTask: Promise<void> | null = null;
  private restartHistory: number[] = [];
  private adoptedManagerInstanceId: string | null = null;

  constructor(private readonly options: ManagedRuntimeHostOptions) {}

  start(): Promise<void> {
    return (this.startTask ??= this.startOnce().finally(() => {
      this.startTask = null;
    }));
  }

  recover(): Promise<void> {
    return (this.recoveryTask ??= this.recoverOnce().finally(() => {
      this.recoveryTask = null;
    }));
  }

  async resume(): Promise<void> {
    this.stopping = false;
    await this.start();
  }

  get stateRoot() {
    return resolveStateRoot(this.options);
  }

  private async recoverOnce() {
    if (this.stopping) {
      throw new Error("Desktop Agent is stopping or updating.");
    }
    this.restartHistory = [];
    await this.start();
    const health = await readRuntimeHealth();
    if (health?.maintenanceState === "REVIEW_REQUIRED") {
      throw new Error(
        "A previous local update was interrupted and its ownership cannot be verified. Open the installed Desktop Agent and retry Check for updates; your working files are retained. Do not remove local state or stop unrelated processes."
      );
    }
    this.assertVersion(health);
    if (health && !isOurRuntime(health)) {
      throw new Error(
        "The local port belongs to an unrecognized service. No process was stopped."
      );
    }
    if (health && isReadyRuntime(health)) {
      return;
    }
    if (health?.agentState === "UPDATING") {
      throw new Error(
        "An update is in progress. Recovery will not interrupt it."
      );
    }
    if (
      health?.recoverySupported === true &&
      typeof health.managerInstanceId === "string"
    ) {
      const response = await fetch(`${runtimeOrigin}/control/recover`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Project-Wing-Agent": "1",
        },
        body: JSON.stringify({ managerInstanceId: health.managerInstanceId }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) {
        throw new Error(
          "Recovery was refused because the instance or update state changed. Refresh status before retrying."
        );
      }
    } else if (health) {
      throw new Error(
        "This Agent cannot safely recover through the current protocol. Use the signed installer repair; local working files must be retained."
      );
    }
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline && !this.stopping) {
      const current = await readRuntimeHealth();
      this.assertVersion(current);
      if (current && !isOurRuntime(current)) {
        throw new Error("The local service changed during recovery.");
      }
      if (current && isReadyRuntime(current)) {
        return;
      }
      if (current?.agentState === "DEGRADED_NEEDS_ATTENTION") {
        throw new Error(
          "Automatic recovery stopped after repeated failures. Local files were not removed."
        );
      }
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 250);
      });
    }
    throw new Error(
      "The Agent has not confirmed readiness. Local files were not removed; installation repair may be required."
    );
  }

  private async startOnce() {
    if (this.stopping) {
      return;
    }
    const health = await readRuntimeHealth();
    this.assertVersion(health);
    if (health && !isOurRuntime(health)) {
      throw new Error(
        "The local port belongs to an unrecognized service. No process was stopped."
      );
    }
    // Degraded Managers still own their workers: never spawn a competing one.
    if (this.stopping) {
      return;
    }
    if (health) {
      if (!this.manager && this.matchesInstallation(health)) {
        this.adoptedManagerInstanceId = health.managerInstanceId as string;
      }
      return;
    }
    if (this.manager && this.manager.exitCode === null) {
      return;
    }
    const paths = resolveManagedRuntimePaths(this.options);
    if (!paths) {
      throw new Error(
        "Desktop Agent runtime files are missing. Repair the installation; working files are retained."
      );
    }
    await mkdir(resolveStateRoot(this.options), { recursive: true });
    if (this.stopping) {
      return;
    }
    this.manager = spawn(
      paths.managerPath,
      buildManagerArgs(paths, this.options),
      {
        cwd: paths.appDirectory,
        env: {
          ...process.env,
          PROJECT_WING_AGENT_STATE_ROOT: resolveStateRoot(this.options),
          PROJECT_WING_AGENT_WEB_BASE_URL:
            this.options.webBaseUrl ??
            process.env.PROJECT_WING_AGENT_WEB_BASE_URL,
        },
        stdio: "ignore",
        windowsHide: true,
      }
    );
    const { manager } = this;
    const exited = () => {
      if (this.manager === manager) {
        this.scheduleRestart();
      }
    };
    manager.once("exit", exited);
    manager.once("error", exited);
  }

  private assertVersion(health: Record<string, unknown> | null) {
    if (
      health &&
      isOurRuntime(health) &&
      typeof health.version === "string" &&
      health.version !== this.options.appVersion
    ) {
      throw new Error(
        `Another Agent version (${health.version}) is active. This copy (${this.options.appVersion}) will not take it over. Finish or repair the existing installation first; working files are retained.`
      );
    }
  }

  private matchesInstallation(identity: Record<string, unknown>): boolean {
    const appDirectory =
      process.env.PROJECT_WING_AGENT_APP_DIRECTORY ??
      (process.env.PROJECT_WING_AGENT_MANAGER_PATH
        ? path.dirname(process.env.PROJECT_WING_AGENT_MANAGER_PATH)
        : path.join(this.options.resourcesPath, "DesktopRuntime"));
    const normalize = (value: string) => {
      const resolved = path.resolve(value);
      return this.options.platform === "win32"
        ? resolved.toLowerCase()
        : resolved;
    };
    return (
      isOurRuntime(identity) &&
      identity.version === this.options.appVersion &&
      typeof identity.managerInstanceId === "string" &&
      typeof identity.appDirectory === "string" &&
      typeof identity.stateRoot === "string" &&
      normalize(identity.appDirectory) === normalize(appDirectory) &&
      normalize(identity.stateRoot) ===
        normalize(resolveStateRoot(this.options))
    );
  }

  async stop() {
    this.stopping = true;
    this.clearRestartTimer();
    const ownedManager = this.manager;
    const health = await readRuntimeIdentity();
    if (!health) {
      return;
    }
    const accepted =
      health &&
      isOurRuntime(health) &&
      (ownedManager?.exitCode === null
        ? health.managerPid === ownedManager.pid
        : this.matchesInstallation(health) &&
          health.managerInstanceId === this.adoptedManagerInstanceId) &&
      typeof health.managerInstanceId === "string"
        ? await requestShutdown(health.managerInstanceId)
        : false;
    if (accepted && (await waitForRuntimeStop())) {
      return;
    }
    if (ownedManager?.exitCode === null) {
      ownedManager.kill();
      if (
        health.managerPid === ownedManager.pid &&
        (await waitForRuntimeStop())
      ) {
        return;
      }
    }
    throw new Error(
      "The installed local service has not confirmed shutdown. The update was not started; retry recovery without reinstalling."
    );
  }

  private scheduleRestart() {
    this.manager = null;
    if (this.stopping || this.restartTimer) {
      return;
    }
    const now = Date.now();
    this.restartHistory = this.restartHistory.filter(
      (attempt) => now - attempt < 300_000
    );
    if (this.restartHistory.length >= 5) {
      console.error(
        "Desktop Agent Manager restart budget exhausted. Use Recover local service; local files are retained."
      );
      return;
    }
    const delay = restartDelayMs * 2 ** this.restartHistory.length;
    this.restartHistory.push(now);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.start().catch((error) =>
        console.error("Desktop Agent Manager restart failed:", error)
      );
    }, delay);
  }

  private clearRestartTimer() {
    if (!this.restartTimer) {
      return;
    }
    clearTimeout(this.restartTimer);
    this.restartTimer = null;
  }
}

function resolveManagedRuntimePaths(
  options: ManagedRuntimeHostOptions
): ManagedRuntimePaths | null {
  const configured = resolveConfiguredPaths(options);
  if (configured) {
    return configured;
  }
  if (!options.isPackaged) {
    return null;
  }
  const runtimeRoot = path.join(options.resourcesPath, "DesktopRuntime");
  const managedRoot = path.join(runtimeRoot, "managed");
  const managerName =
    options.platform === "win32"
      ? "ProjectWing.AgentManager.exe"
      : "ProjectWing.AgentManager";
  const runtimeName =
    options.platform === "win32"
      ? "ProjectWing.DesktopAgent.Runtime.exe"
      : "ProjectWing.DesktopAgent.Runtime";
  return (
    [
      {
        appDirectory: runtimeRoot,
        managerPath: path.join(managedRoot, managerName),
        runtimePath: path.join(managedRoot, runtimeName),
      },
      {
        appDirectory: runtimeRoot,
        managerPath: path.join(managedRoot, "manager", managerName),
        runtimePath: path.join(managedRoot, "runtime", runtimeName),
      },
    ].find(
      (candidate) =>
        existsSync(candidate.managerPath) && existsSync(candidate.runtimePath)
    ) ?? null
  );
}

function resolveConfiguredPaths(
  _options: ManagedRuntimeHostOptions
): ManagedRuntimePaths | null {
  const managerPath = process.env.PROJECT_WING_AGENT_MANAGER_PATH;
  const runtimePath = process.env.PROJECT_WING_AGENT_RUNTIME_PATH;
  if (
    !managerPath ||
    !runtimePath ||
    !existsSync(managerPath) ||
    !existsSync(runtimePath)
  ) {
    return null;
  }
  return {
    appDirectory:
      process.env.PROJECT_WING_AGENT_APP_DIRECTORY ?? path.dirname(managerPath),
    managerPath,
    runtimePath,
  };
}

function buildManagerArgs(
  paths: ManagedRuntimePaths,
  options: ManagedRuntimeHostOptions
) {
  const args = [
    "run",
    "--app-directory",
    paths.appDirectory,
    "--agent-version",
    options.appVersion,
    "--state-root",
    resolveStateRoot(options),
    "--manager-path",
    paths.managerPath,
    "--runtime-path",
    paths.runtimePath,
    "--runtime-port",
    String(runtimePort),
    "--worker-port",
    String(workerPort),
  ];
  for (const [option, environmentName] of [
    ["--api-base-url", "PROJECT_WING_AGENT_API_BASE_URL"],
    ["--auth-base-url", "PROJECT_WING_AGENT_AUTH_BASE_URL"],
    [
      "--allowed-download-origins",
      "PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS",
    ],
    ["--allowed-web-origins", "PROJECT_WING_AGENT_ALLOWED_WEB_ORIGINS"],
    ["--allowed-auth-origins", "PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS"],
  ] as const) {
    const value = process.env[environmentName];
    if (value) {
      args.push(option, value);
    }
  }
  return args;
}

function resolveStateRoot(options: ManagedRuntimeHostOptions) {
  if (options.platform === "win32" && options.localAppDataPath) {
    return path.join(options.localAppDataPath, "ProjectWing", "AgentState");
  }
  return path.join(options.appDataPath, "ProjectWing", "AgentState");
}

export function isReadyRuntime(health: Record<string, unknown>) {
  return (
    isOurRuntime(health) &&
    (health.agentState === "READY" ||
      health.agentState === "READY_WITH_ATTENTION")
  );
}

function isOurRuntime(health: Record<string, unknown>) {
  return health.app === "project-wing-desktop-runtime";
}

function readRuntimeHealth(): Promise<Record<string, unknown> | null> {
  return readRuntimeResponse("/health");
}

function readRuntimeIdentity(): Promise<Record<string, unknown> | null> {
  return readRuntimeResponse("/control/identity");
}

async function readRuntimeResponse(
  endpoint: string
): Promise<Record<string, unknown> | null> {
  try {
    const response = await fetch(`${runtimeOrigin}${endpoint}`, {
      signal: AbortSignal.timeout(healthTimeoutMs),
      headers: { "X-Project-Wing-Agent": "1" },
    });
    if (!response.ok) {
      return { app: "unrecognized-listener" };
    }
    const body: unknown = await response
      .json()
      .catch(() => ({ app: "unrecognized-listener" }));
    return body && typeof body === "object"
      ? (body as Record<string, unknown>)
      : { app: "unrecognized-listener" };
  } catch (error) {
    const cause = error instanceof Error ? error.cause : null;
    if (
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ECONNREFUSED"
    ) {
      return null;
    }
    // A timeout or malformed listener is unknown, not proof of no owner.
    return { app: "unrecognized-listener" };
  }
}

async function requestShutdown(managerInstanceId: string) {
  try {
    const response = await fetch(`${runtimeOrigin}/control/shutdown`, {
      method: "POST",
      headers: { "X-Project-Wing-Manager-Instance": managerInstanceId },
      signal: AbortSignal.timeout(shutdownTimeoutMs),
    });
    return response.status === 202;
  } catch {
    return false;
  }
}

async function waitForRuntimeStop() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    if ((await readRuntimeIdentity()) === null) {
      return true;
    }
    await new Promise<void>((resolve) => {
      setTimeout(resolve, healthRetryDelayMs);
    });
  }
  return false;
}
