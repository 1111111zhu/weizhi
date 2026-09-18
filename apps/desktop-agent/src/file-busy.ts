import { execFile } from "node:child_process";
import { open } from "node:fs/promises";
import pathModule from "node:path";

import type { DesktopAgentOpenObservationSource } from "@project-wing/shared/desktop";

const { extname } = pathModule;

export type LocalFileBusySession = {
  localPath: string;
  excelHelperProcessId?: number;
};
export type LocalFileProbeState =
  | "WORKBOOK_OPEN"
  | "DOCUMENT_OPEN"
  | "EDITOR_PROCESS_OPEN"
  | "FILE_LOCKED"
  | "CLOSED"
  | "MISSING"
  | "PROBE_ERROR";
export type LocalFileProbeResult = {
  state: LocalFileProbeState;
  busy: boolean;
  openObservedSource?: DesktopAgentOpenObservationSource;
  comAvailable?: boolean;
  error?: string;
};
type LocalFileProbeValue = boolean | LocalFileProbeResult;
type LocalFileBusyOptions = {
  excelWorkbookOpenProbe?: (filePath: string) => Promise<LocalFileProbeValue>;
  officeDocumentOpenProbe?: (filePath: string) => Promise<LocalFileProbeValue>;
  editorProcessProbe?: (
    session: LocalFileBusySession
  ) => Promise<LocalFileProbeValue>;
  exclusiveOpenProbe?: (filePath: string) => Promise<LocalFileProbeValue>;
  platform?: NodeJS.Platform;
};

type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean; env?: NodeJS.ProcessEnv },
  callback: (error: (Error & { code?: number | string | null }) | null) => void
) => void;

const EXCEL_WORKBOOK_EXTENSIONS = new Set([
  ".csv",
  ".xls",
  ".xlsb",
  ".xlsm",
  ".xlsx",
]);
const WORD_DOCUMENT_EXTENSIONS = new Set([".doc", ".docx"]);
const POWERPOINT_PRESENTATION_EXTENSIONS = new Set([".ppt", ".pptx"]);
const PDF_DOCUMENT_EXTENSIONS = new Set([".pdf"]);

type OfficeDocumentProbeTarget = {
  appName: "Excel" | "Word" | "PowerPoint";
  progId: string;
  collectionName: string;
  openState: Extract<LocalFileProbeState, "WORKBOOK_OPEN" | "DOCUMENT_OPEN">;
};

export async function isLocalFileBusy(
  session: LocalFileBusySession,
  options: LocalFileBusyOptions = {}
) {
  const state = await probeLocalFileState(session, options);
  return state.busy;
}

export async function probeLocalFileState(
  session: LocalFileBusySession,
  options: LocalFileBusyOptions = {}
): Promise<LocalFileProbeResult> {
  const exclusiveOpenProbe =
    options.exclusiveOpenProbe ?? probeFileLockedByExclusiveOpen;
  const platform = options.platform ?? process.platform;
  const officeProbeTarget =
    platform === "win32"
      ? getOfficeDocumentProbeTarget(session.localPath)
      : null;
  if (officeProbeTarget) {
    const officeDocumentOpenProbe =
      officeProbeTarget.appName === "Excel" &&
      options.excelWorkbookOpenProbe &&
      !options.officeDocumentOpenProbe
        ? options.excelWorkbookOpenProbe
        : (options.officeDocumentOpenProbe ??
          (officeProbeTarget.appName === "Excel"
            ? probeExcelWorkbookOpenInWindows
            : probeOfficeDocumentOpenInWindows));
    const officeResult = normalizeOfficeProbeResult(
      await officeDocumentOpenProbe(session.localPath),
      officeProbeTarget.openState
    );
    if (officeResult.state === officeProbeTarget.openState) {
      return { ...officeResult, comAvailable: true };
    }

    const exclusiveResult = normalizeExclusiveProbeResult(
      await exclusiveOpenProbe(session.localPath)
    );
    const comAvailable = officeResult.state !== "PROBE_ERROR";
    if (exclusiveResult.state === "FILE_LOCKED") {
      return { ...exclusiveResult, comAvailable };
    }
    if (exclusiveResult.state === "MISSING") {
      return { state: "MISSING", busy: false, comAvailable };
    }
    if (exclusiveResult.state === "PROBE_ERROR") {
      return { ...exclusiveResult, busy: true, comAvailable };
    }
    return { state: "CLOSED", busy: false, comAvailable };
  }

  if (platform === "win32" && isPdfDocument(session.localPath)) {
    const editorProcessProbe =
      options.editorProcessProbe ?? probeEditorProcessOpenInWindows;
    const editorProcessResult = normalizeEditorProcessProbeResult(
      await editorProcessProbe(session)
    );
    if (editorProcessResult.state === "EDITOR_PROCESS_OPEN") {
      return editorProcessResult;
    }

    return normalizeExclusiveProbeResult(
      await exclusiveOpenProbe(session.localPath)
    );
  }

  return normalizeExclusiveProbeResult(
    await exclusiveOpenProbe(session.localPath)
  );
}

async function probeFileLockedByExclusiveOpen(filePath: string) {
  if (process.platform === "win32") {
    return probeFileLockedByExclusiveOpenInWindows(filePath);
  }

  let fileHandle: Awaited<ReturnType<typeof open>> | null = null;
  try {
    fileHandle = await open(filePath, "r+");
    return { state: "CLOSED", busy: false } satisfies LocalFileProbeResult;
  } catch (error) {
    const { code } = error as NodeJS.ErrnoException;
    if (code === "ENOENT") {
      return { state: "MISSING", busy: false } satisfies LocalFileProbeResult;
    }
    if (code === "EBUSY" || code === "EPERM" || code === "EACCES") {
      return {
        state: "FILE_LOCKED",
        busy: true,
        openObservedSource: "MONITOR_FILE_LOCK",
      } satisfies LocalFileProbeResult;
    }
    return {
      state: "PROBE_ERROR",
      busy: true,
      error:
        error instanceof Error ? error.message : "Exclusive-open probe failed.",
    } satisfies LocalFileProbeResult;
  } finally {
    await fileHandle?.close().catch(() => {});
  }
}

export async function probeFileLockedByExclusiveOpenInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
): Promise<LocalFileProbeResult> {
  const locked = await runExclusiveOpenProbeInWindows(filePath, options);
  if (locked === "LOCKED") {
    return {
      state: "FILE_LOCKED",
      busy: true,
      openObservedSource: "MONITOR_FILE_LOCK",
    };
  }
  if (locked === "MISSING") {
    return { state: "MISSING", busy: false };
  }
  if (locked === "CLOSED") {
    return { state: "CLOSED", busy: false };
  }
  return {
    state: "PROBE_ERROR",
    busy: true,
    error: "Exclusive-open probe failed.",
  };
}

export async function isFileLockedByExclusiveOpenInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
) {
  const state = await probeFileLockedByExclusiveOpenInWindows(
    filePath,
    options
  );
  return state.busy;
}

async function runExclusiveOpenProbeInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
) {
  await Promise.resolve();
  const run = options.execFile ?? (execFile as ExecFileLike);
  const timeout = options.timeoutMs ?? 2000;
  const script = `
$targetPath = $env:PROJECT_WING_TARGET_PATH
try {
  $targetPath = [System.IO.Path]::GetFullPath($targetPath)
  $stream = [System.IO.File]::Open($targetPath, [System.IO.FileMode]::Open, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None)
  $stream.Dispose()
  exit 1
} catch [System.IO.FileNotFoundException] {
  exit 3
} catch {
  $exception = $_.Exception
  $hresult = $exception.HResult -band 0xFFFF
  if ($hresult -eq 32 -or $hresult -eq 33) {
    exit 0
  }
  exit 2
}
`;

  return new Promise<"LOCKED" | "CLOSED" | "MISSING" | "PROBE_ERROR">(
    (resolve) => {
      run(
        "powershell.exe",
        [
          "-NoProfile",
          "-NonInteractive",
          "-ExecutionPolicy",
          "Bypass",
          "-Command",
          script,
          filePath,
        ],
        {
          timeout,
          windowsHide: true,
          env: { ...process.env, PROJECT_WING_TARGET_PATH: filePath },
        },
        (error) => {
          if (!error) {
            resolve("LOCKED");
            return;
          }
          if (error.code === 1) {
            resolve("CLOSED");
            return;
          }
          if (error.code === 3) {
            resolve("MISSING");
            return;
          }
          resolve("PROBE_ERROR");
        }
      );
    }
  );
}

export async function probeExcelWorkbookOpenInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
): Promise<LocalFileProbeResult> {
  await Promise.resolve();
  return probeOfficeDocumentOpenInWindows(filePath, options, {
    appName: "Excel",
    progId: "Excel.Application",
    collectionName: "Workbooks",
    openState: "WORKBOOK_OPEN",
  });
}

export async function isExcelWorkbookOpenInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
) {
  const result = await probeExcelWorkbookOpenInWindows(filePath, options);
  return result.state === "WORKBOOK_OPEN" || result.state === "PROBE_ERROR";
}

export async function probeOfficeDocumentOpenInWindows(
  filePath: string,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {},
  target: OfficeDocumentProbeTarget | null = getOfficeDocumentProbeTarget(
    filePath
  )
): Promise<LocalFileProbeResult> {
  if (!target) {
    return {
      state: "PROBE_ERROR",
      busy: false,
      error: "Office COM probe failed.",
    };
  }

  const openState = await runOfficeDocumentOpenProbeInWindows(
    filePath,
    target,
    options
  );
  if (openState === "OPEN") {
    return {
      state: target.openState,
      busy: true,
      openObservedSource: "MONITOR_COM",
    };
  }
  if (openState === "CLOSED") {
    return { state: "CLOSED", busy: false };
  }
  return {
    state: "PROBE_ERROR",
    busy: false,
    error: `${target.appName} COM probe failed.`,
  };
}

export async function probeEditorProcessOpenInWindows(
  session: LocalFileBusySession,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
): Promise<LocalFileProbeResult> {
  if (!session.excelHelperProcessId) {
    return { state: "CLOSED", busy: false };
  }
  const openState = await runEditorProcessOpenProbeInWindows(session, options);
  if (openState === "OPEN") {
    return {
      state: "EDITOR_PROCESS_OPEN",
      busy: true,
      openObservedSource: "MONITOR_PROCESS",
    };
  }
  if (openState === "CLOSED") {
    return { state: "CLOSED", busy: false };
  }
  return {
    state: "PROBE_ERROR",
    busy: false,
    error: "Editor process probe failed.",
  };
}

async function runEditorProcessOpenProbeInWindows(
  session: LocalFileBusySession,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
) {
  await Promise.resolve();
  const run = options.execFile ?? (execFile as ExecFileLike);
  const timeout = options.timeoutMs ?? 2000;
  const script = `
$targetPath = [System.IO.Path]::GetFullPath($env:PROJECT_WING_TARGET_PATH)
$processId = [int]$env:PROJECT_WING_EDITOR_PROCESS_ID
try {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $processId"
  if (-not $process) { exit 1 }
  $commandLine = [string]$process.CommandLine
  if ($commandLine -and $commandLine.IndexOf($targetPath, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
    exit 0
  }
  exit 1
} catch {
  exit 2
}
`;

  return new Promise<"OPEN" | "CLOSED" | "PROBE_ERROR">((resolve) => {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
      ],
      {
        timeout,
        windowsHide: true,
        env: {
          ...process.env,
          PROJECT_WING_TARGET_PATH: session.localPath,
          PROJECT_WING_EDITOR_PROCESS_ID: String(session.excelHelperProcessId),
        },
      },
      (error) => {
        if (!error) {
          resolve("OPEN");
          return;
        }
        if (error.code === 1) {
          resolve("CLOSED");
          return;
        }
        resolve("PROBE_ERROR");
      }
    );
  });
}

async function runOfficeDocumentOpenProbeInWindows(
  filePath: string,
  target: OfficeDocumentProbeTarget,
  options: { execFile?: ExecFileLike; timeoutMs?: number } = {}
) {
  await Promise.resolve();
  const run = options.execFile ?? (execFile as ExecFileLike);
  const timeout = options.timeoutMs ?? 2000;
  const script = `
$targetPath = $env:PROJECT_WING_TARGET_PATH
$progId = $env:PROJECT_WING_OFFICE_PROG_ID
$collectionName = $env:PROJECT_WING_OFFICE_COLLECTION_NAME
$targetPath = [System.IO.Path]::GetFullPath($targetPath)
try {
  try {
    $application = [Runtime.InteropServices.Marshal]::GetActiveObject($progId)
  } catch {
    exit 1
  }

  $documents = $application.$collectionName
  foreach ($document in @($documents)) {
    try {
      $documentPath = [System.IO.Path]::GetFullPath([string]$document.FullName)
      if ([string]::Equals($documentPath, $targetPath, [System.StringComparison]::OrdinalIgnoreCase)) {
        exit 0
      }
    } catch {}
  }

  exit 1
} catch {
  exit 2
}
`;

  return new Promise<"OPEN" | "CLOSED" | "PROBE_ERROR">((resolve) => {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        script,
        filePath,
      ],
      {
        timeout,
        windowsHide: true,
        env: {
          ...process.env,
          PROJECT_WING_TARGET_PATH: filePath,
          PROJECT_WING_OFFICE_PROG_ID: target.progId,
          PROJECT_WING_OFFICE_COLLECTION_NAME: target.collectionName,
        },
      },
      (error) => {
        if (!error) {
          resolve("OPEN");
          return;
        }
        if (error.code === 1) {
          resolve("CLOSED");
          return;
        }
        resolve("PROBE_ERROR");
      }
    );
  });
}

function getOfficeDocumentProbeTarget(
  filePath: string
): OfficeDocumentProbeTarget | null {
  const extension = extname(filePath).toLowerCase();
  if (EXCEL_WORKBOOK_EXTENSIONS.has(extension)) {
    return {
      appName: "Excel",
      progId: "Excel.Application",
      collectionName: "Workbooks",
      openState: "WORKBOOK_OPEN",
    };
  }
  if (WORD_DOCUMENT_EXTENSIONS.has(extension)) {
    return {
      appName: "Word",
      progId: "Word.Application",
      collectionName: "Documents",
      openState: "DOCUMENT_OPEN",
    };
  }
  if (POWERPOINT_PRESENTATION_EXTENSIONS.has(extension)) {
    return {
      appName: "PowerPoint",
      progId: "PowerPoint.Application",
      collectionName: "Presentations",
      openState: "DOCUMENT_OPEN",
    };
  }
  return null;
}

function isPdfDocument(filePath: string) {
  return PDF_DOCUMENT_EXTENSIONS.has(extname(filePath).toLowerCase());
}

function normalizeOfficeProbeResult(
  value: LocalFileProbeValue,
  openState: Extract<LocalFileProbeState, "WORKBOOK_OPEN" | "DOCUMENT_OPEN">
) {
  if (typeof value !== "boolean") {
    return value;
  }
  return value
    ? ({
        state: openState,
        busy: true,
        openObservedSource: "MONITOR_COM",
      } satisfies LocalFileProbeResult)
    : ({ state: "CLOSED", busy: false } satisfies LocalFileProbeResult);
}

function normalizeExclusiveProbeResult(value: LocalFileProbeValue) {
  if (typeof value !== "boolean") {
    return value;
  }
  return value
    ? ({
        state: "FILE_LOCKED",
        busy: true,
        openObservedSource: "MONITOR_FILE_LOCK",
      } satisfies LocalFileProbeResult)
    : ({ state: "CLOSED", busy: false } satisfies LocalFileProbeResult);
}

function normalizeEditorProcessProbeResult(value: LocalFileProbeValue) {
  if (typeof value !== "boolean") {
    return value;
  }
  return value
    ? ({
        state: "EDITOR_PROCESS_OPEN",
        busy: true,
        openObservedSource: "MONITOR_PROCESS",
      } satisfies LocalFileProbeResult)
    : ({ state: "CLOSED", busy: false } satisfies LocalFileProbeResult);
}
