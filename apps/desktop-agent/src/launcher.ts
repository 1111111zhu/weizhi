import { execFile, spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import pathModule from "node:path";

import type { DesktopAgentOpenObservationSource } from "@project-wing/shared/desktop";

import { getDiagnosticLogLevel } from "./config.js";
import { DesktopAgentError } from "./errors.js";
import {
  PDF_MASTER_EDITOR_OPEN_RECOMMENDATION,
  WINDOWS_TRUSTED_PDF_EDITOR_DISCOVERY_SCRIPT,
  selectTrustedPdfMasterEditorPath,
} from "./pdf-master-editors.js";

const { join, resolve: resolvePath } = pathModule;

const PDF_EDITOR_DISCOVERY_TIMEOUT_MS = 10_000;
let cachedPdfMasterEditorPath: string | null = null;

type OfficeMasterApp = "excel" | "word" | "powerpoint";

export type LaunchFileContext = {
  mode?: "MASTER" | "READ_ONLY";
  sessionId?: string;
  generation?: number;
  openSignalToken?: string;
  closeSignalToken?: string;
  agentBaseUrl?: string;
};
export type LaunchFileResult = {
  helperProcessId?: number;
  openObservedOnSpawn?: boolean;
  openObservedSource?: DesktopAgentOpenObservationSource;
};

export async function launchFile(
  filePath: string,
  context: LaunchFileContext = {}
): Promise<LaunchFileResult | undefined> {
  if (
    process.platform === "win32" &&
    context.mode === "MASTER" &&
    context.sessionId &&
    context.generation &&
    context.openSignalToken &&
    context.closeSignalToken &&
    context.agentBaseUrl
  ) {
    if (isPdfFile(filePath)) {
      return launchPdfMasterFile(filePath);
    }
    return launchOfficeMasterFile(filePath, {
      officeApp: getOfficeMasterApp(filePath),
      sessionId: context.sessionId,
      generation: context.generation,
      openSignalToken: context.openSignalToken,
      closeSignalToken: context.closeSignalToken,
      agentBaseUrl: context.agentBaseUrl,
    });
  }

  const child =
    process.platform === "win32"
      ? spawn("cmd", ["/c", "start", "", filePath], launcherOptions())
      : process.platform === "darwin"
        ? spawn("open", [filePath], launcherOptions())
        : spawn("xdg-open", [filePath], launcherOptions());

  await waitForSpawn(child);
  child.unref();
}

async function launchPdfMasterFile(filePath: string) {
  const editorPath = await resolvePdfMasterEditorPath();
  const child = spawn(editorPath, [filePath], launcherOptions());
  await waitForSpawn(child);
  child.unref();
  return {
    helperProcessId: child.pid,
    openObservedOnSpawn: true,
    openObservedSource: "LAUNCHER_PROCESS" as const,
  };
}

function launchOfficeMasterFile(
  filePath: string,
  {
    officeApp,
    sessionId,
    generation,
    openSignalToken,
    closeSignalToken,
    agentBaseUrl,
  }: {
    officeApp: OfficeMasterApp;
    sessionId: string;
    generation: number;
    openSignalToken: string;
    closeSignalToken: string;
    agentBaseUrl: string;
  }
) {
  const diagnosticLogLevel = getDiagnosticLogLevel();
  const isDebugLogging = diagnosticLogLevel === "debug";
  const runtimeLogDir = join(tmpdir(), "project-wing-runtime-logs");
  const safeSessionId = sessionId.replaceAll(/[^a-zA-Z0-9_-]/g, "_");
  const watcherTimelineLogPath = join(
    runtimeLogDir,
    `${officeApp}-watcher-${safeSessionId}.timeline.log`
  );
  const watcherStdoutPath = join(
    runtimeLogDir,
    `${officeApp}-watcher-${safeSessionId}.stdout.log`
  );
  const watcherStderrPath = join(
    runtimeLogDir,
    `${officeApp}-watcher-${safeSessionId}.stderr.log`
  );
  try {
    mkdirSync(runtimeLogDir, { recursive: true });
  } catch (error) {
    throw new DesktopAgentError(
      "OPEN_FAILED",
      error instanceof Error
        ? error.message
        : "Could not prepare the Office watcher log directory."
    );
  }
  const watcherCommand = makeOfficeWatcherCommand({
    officeApp,
    targetPath: filePath,
    sessionId,
    generation,
    openSignalToken,
    closeSignalToken,
    agentBaseUrl,
    timelineLogPath: watcherTimelineLogPath,
    diagnosticLogLevel,
  });
  const watcherStdout = isDebugLogging
    ? createWriteStream(watcherStdoutPath, { flags: "a" })
    : null;
  const watcherStderr = isDebugLogging
    ? createWriteStream(watcherStderrPath, { flags: "a" })
    : null;
  watcherStdout?.on("error", (error) => {
    console.error("Office watcher stdout log failed:", error);
  });
  watcherStderr?.on("error", (error) => {
    console.error("Office watcher stderr log failed:", error);
  });
  const child = spawn(watcherCommand.command, watcherCommand.args, {
    windowsHide: true,
    stdio: isDebugLogging ? ["ignore", "pipe", "pipe"] : "ignore",
    env: {
      ...process.env,
      PROJECT_WING_EXCEL_WATCHER_LOG_PATH: watcherTimelineLogPath,
      PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL: diagnosticLogLevel,
      ...(isDebugLogging
        ? {
            PROJECT_WING_EXCEL_WATCHER_STDOUT_LOG_PATH: watcherStdoutPath,
            PROJECT_WING_EXCEL_WATCHER_STDERR_LOG_PATH: watcherStderrPath,
          }
        : {}),
    },
  });
  if (watcherStdout) {
    child.stdout?.pipe(watcherStdout);
  }
  if (watcherStderr) {
    child.stderr?.pipe(watcherStderr);
  }
  child.unref();
  unrefIfPossible(child.stdout);
  unrefIfPossible(child.stderr);
  child.once("close", () => {
    if (watcherStdout) {
      endStreamIfOpen(watcherStdout);
    }
    if (watcherStderr) {
      endStreamIfOpen(watcherStderr);
    }
  });

  return waitForSpawn(child)
    .then(() => ({ helperProcessId: child.pid }))
    .catch((error) => {
      if (watcherStdout) {
        child.stdout?.unpipe(watcherStdout);
      }
      if (watcherStderr) {
        child.stderr?.unpipe(watcherStderr);
      }
      if (watcherStdout) {
        endStreamIfOpen(watcherStdout);
      }
      if (watcherStderr) {
        endStreamIfOpen(watcherStderr);
      }
      throw error;
    });
}

function makeOfficeWatcherCommand({
  officeApp,
  targetPath,
  sessionId,
  generation,
  openSignalToken,
  closeSignalToken,
  agentBaseUrl,
  timelineLogPath,
  diagnosticLogLevel,
}: {
  officeApp: OfficeMasterApp;
  targetPath: string;
  sessionId: string;
  generation: number;
  openSignalToken: string;
  closeSignalToken: string;
  agentBaseUrl: string;
  timelineLogPath: string;
  diagnosticLogLevel: string;
}) {
  const launcherDirectory = import.meta.dirname;
  const configuredWatcherExePath =
    process.env.PROJECT_WING_EXCEL_WATCHER_EXE_PATH;
  const watcherProjectDirectory = resolvePath(
    launcherDirectory,
    "..",
    "watcher",
    "ProjectWing.ExcelWatcher"
  );
  const watcherDllPath = join(
    watcherProjectDirectory,
    "bin",
    "Debug",
    "net8.0-windows",
    "ProjectWing.ExcelWatcher.dll"
  );
  const watcherProjectPath = join(
    watcherProjectDirectory,
    "ProjectWing.ExcelWatcher.csproj"
  );
  const watcherProgramPath = join(watcherProjectDirectory, "Program.cs");
  const watcherCommandArgs = [
    "--office-app",
    officeApp,
    "--target-path",
    targetPath,
    "--session-id",
    sessionId,
    "--generation",
    String(generation),
    "--open-signal-token",
    openSignalToken,
    "--close-signal-token",
    closeSignalToken,
    "--agent-base-url",
    agentBaseUrl,
    "--timeline-log-path",
    timelineLogPath,
    "--diagnostic-log-level",
    diagnosticLogLevel,
  ];

  if (configuredWatcherExePath) {
    return {
      command: configuredWatcherExePath,
      args: watcherCommandArgs,
    };
  }

  if (
    isWatcherDllFresh(watcherDllPath, [watcherProjectPath, watcherProgramPath])
  ) {
    return {
      command: "dotnet",
      args: [watcherDllPath, ...watcherCommandArgs],
    };
  }

  return {
    command: "dotnet",
    args: ["run", "--project", watcherProjectPath, "--", ...watcherCommandArgs],
  };
}

function getOfficeMasterApp(filePath: string): OfficeMasterApp {
  const normalized = filePath.trim().toLowerCase();
  if (normalized.endsWith(".docx") || normalized.endsWith(".doc")) {
    return "word";
  }
  if (normalized.endsWith(".pptx") || normalized.endsWith(".ppt")) {
    return "powerpoint";
  }
  return "excel";
}

function isPdfFile(filePath: string) {
  return filePath.trim().toLowerCase().endsWith(".pdf");
}

async function resolvePdfMasterEditorPath() {
  const configuredPath = process.env.PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH;
  if (configuredPath) {
    if (!existsSync(configuredPath)) {
      throw new DesktopAgentError(
        "PDF_EDITOR_UNAVAILABLE",
        "The configured PDF Master editor could not be found."
      );
    }
    return configuredPath;
  }

  if (cachedPdfMasterEditorPath) {
    if (existsSync(cachedPdfMasterEditorPath)) {
      return cachedPdfMasterEditorPath;
    }
    cachedPdfMasterEditorPath = null;
  }

  const editorPath = selectTrustedPdfMasterEditorPath(
    await discoverPdfMasterEditorCandidatesInWindows()
  );
  if (editorPath) {
    cachedPdfMasterEditorPath = editorPath;
    return editorPath;
  }

  throw new DesktopAgentError(
    "PDF_EDITOR_UNAVAILABLE",
    `A supported PDF editor is required for PDF Master editing. ${PDF_MASTER_EDITOR_OPEN_RECOMMENDATION}`
  );
}

function discoverPdfMasterEditorCandidatesInWindows() {
  const script = `
${WINDOWS_TRUSTED_PDF_EDITOR_DISCOVERY_SCRIPT}
$candidates = @(Find-ProjectWingTrustedPdfEditorCandidatePaths)
[pscustomobject]@{ candidates = $candidates } | ConvertTo-Json -Compress -Depth 3
`;

  return new Promise<string[]>((_resolve) => {
    execFile(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      { timeout: PDF_EDITOR_DISCOVERY_TIMEOUT_MS, windowsHide: true },
      (error, stdout) => {
        if (error) {
          _resolve([]);
          return;
        }
        const value = stdout.trim();
        if (!value) {
          _resolve([]);
          return;
        }
        let candidates: string[] = [];
        try {
          const parsed = JSON.parse(value) as { candidates?: unknown };
          candidates = Array.isArray(parsed.candidates)
            ? parsed.candidates.filter(
                (candidate): candidate is string =>
                  typeof candidate === "string"
              )
            : [];
        } catch {
          candidates = [];
        }
        _resolve(candidates);
      }
    );
  });
}

function isWatcherDllFresh(watcherDllPath: string, sourcePaths: string[]) {
  if (!existsSync(watcherDllPath)) {
    return false;
  }
  try {
    const dllModifiedAt = statSync(watcherDllPath).mtimeMs;
    return sourcePaths.every((sourcePath) => {
      if (!existsSync(sourcePath)) {
        return false;
      }
      return statSync(sourcePath).mtimeMs <= dllModifiedAt;
    });
  } catch {
    return false;
  }
}

function endStreamIfOpen(stream: ReturnType<typeof createWriteStream>) {
  if (!stream.closed && !stream.destroyed) {
    stream.end();
  }
}

function unrefIfPossible(stream: unknown) {
  (stream as { unref?: () => void } | null | undefined)?.unref?.();
}

async function waitForSpawn(child: ReturnType<typeof spawn>) {
  await new Promise<void>((_resolve, reject) => {
    let settled = false;
    child.once("spawn", () => {
      settled = true;
      _resolve();
    });
    child.once("error", (error) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(new DesktopAgentError("OPEN_FAILED", error.message));
    });
  });
}

function launcherOptions() {
  return {
    detached: true,
    stdio: "ignore" as const,
    windowsHide: true,
  };
}
