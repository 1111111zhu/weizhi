import { execFile } from "node:child_process";

import type { DesktopAgentHealthDiagnostics } from "@project-wing/shared/desktop";

import {
  PDF_MASTER_EDITOR_INSTALL_RECOMMENDATION,
  WINDOWS_TRUSTED_PDF_EDITOR_DISCOVERY_SCRIPT,
} from "./pdf-master-editors.js";

type ExecFileCallback = (
  error: (Error & { code?: number | string | null }) | null,
  stdout: string,
  stderr: string
) => void;
type ExecFileLike = (
  file: string,
  args: string[],
  options: { timeout: number; windowsHide: boolean },
  callback: ExecFileCallback
) => void;

type OfficeAppKey = "excel" | "word" | "powerPoint";
type OfficeAppProbeResult = {
  installed?: boolean;
  comAvailable?: boolean;
  hresult?: number;
  error?: string;
  hiddenAutomationProcessIds?: number[];
};
type PdfEditorProbeResult = {
  installed?: boolean;
  trustedEditor?: boolean;
  editorPath?: string;
  error?: string;
};
type WindowsOfficeProbeResult = Partial<
  Record<OfficeAppKey, OfficeAppProbeResult>
> & {
  excelInstalled?: boolean;
  comAvailable?: boolean;
  hresult?: number;
  error?: string;
  hiddenAutomationProcessIds?: number[];
  pdfEditor?: PdfEditorProbeResult;
};
type NormalizedOfficeProbeResult = {
  excel: OfficeAppProbeResult;
  word?: OfficeAppProbeResult;
  powerPoint?: OfficeAppProbeResult;
  pdfEditor?: PdfEditorProbeResult;
};

type OfficeDiagnosticsStatus = NonNullable<
  DesktopAgentHealthDiagnostics["excel"]
>["status"];
type OfficeComAutomation = NonNullable<
  DesktopAgentHealthDiagnostics["excel"]
>["comAutomation"];
type PdfEditorDiagnosticsStatus = NonNullable<
  DesktopAgentHealthDiagnostics["pdfEditor"]
>["status"];

export type ExcelDiagnosticsProviderOptions = {
  platform?: NodeJS.Platform;
  execFile?: ExecFileLike;
  now?: () => Date;
  timeoutMs?: number;
  cacheTtlMs?: number;
};

const DEFAULT_CACHE_TTL_MS = 60_000;
const DEFAULT_TIMEOUT_MS = 8000;
const OFFICE_APP_LABELS: Record<OfficeAppKey, string> = {
  excel: "Excel",
  word: "Word",
  powerPoint: "PowerPoint",
};

export function createExcelDiagnosticsProvider(
  options: ExcelDiagnosticsProviderOptions = {}
) {
  const platform = options.platform ?? process.platform;
  const run = options.execFile ?? (execFile as ExecFileLike);
  const now = options.now ?? (() => new Date());
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_CACHE_TTL_MS;
  let cached:
    | { expiresAt: number; diagnostics: DesktopAgentHealthDiagnostics }
    | undefined;
  let inFlight: Promise<DesktopAgentHealthDiagnostics> | undefined;

  return async () => {
    await Promise.resolve();
    const currentTime = now().getTime();
    if (cached && currentTime < cached.expiresAt) {
      return cached.diagnostics;
    }
    if (inFlight) {
      return inFlight;
    }

    inFlight = buildOfficeDiagnostics({ platform, run, now, timeoutMs }).then(
      (diagnostics) => {
        cached = {
          diagnostics,
          expiresAt: now().getTime() + cacheTtlMs,
        };
        inFlight = undefined;
        return diagnostics;
      },
      (error) => {
        inFlight = undefined;
        throw error;
      }
    );
    return inFlight;
  };
}

async function buildOfficeDiagnostics({
  platform,
  run,
  now,
  timeoutMs,
}: {
  platform: NodeJS.Platform;
  run: ExecFileLike;
  now: () => Date;
  timeoutMs: number;
}): Promise<DesktopAgentHealthDiagnostics> {
  const checkedAt = now().toISOString();
  if (platform !== "win32") {
    return {
      excel: buildSkippedDiagnostics("excel", checkedAt),
      word: buildSkippedDiagnostics("word", checkedAt),
      powerPoint: buildSkippedDiagnostics("powerPoint", checkedAt),
    };
  }

  const probe = normalizeWindowsOfficeProbeResult(
    await runWindowsOfficeProbe(run, timeoutMs).catch(
      (error): WindowsOfficeProbeResult => ({
        excel: {
          error:
            error instanceof Error
              ? error.message
              : "Office diagnostics probe failed.",
        },
        word: {
          error:
            error instanceof Error
              ? error.message
              : "Office diagnostics probe failed.",
        },
        powerPoint: {
          error:
            error instanceof Error
              ? error.message
              : "Office diagnostics probe failed.",
        },
        pdfEditor: {
          error:
            error instanceof Error
              ? error.message
              : "PDF editor diagnostics probe failed.",
        },
      })
    )
  );

  return {
    excel: buildOfficeAppDiagnostics("excel", checkedAt, probe.excel),
    ...(probe.word
      ? { word: buildOfficeAppDiagnostics("word", checkedAt, probe.word) }
      : {}),
    ...(probe.powerPoint
      ? {
          powerPoint: buildOfficeAppDiagnostics(
            "powerPoint",
            checkedAt,
            probe.powerPoint
          ),
        }
      : {}),
    ...(probe.pdfEditor
      ? { pdfEditor: buildPdfEditorDiagnostics(checkedAt, probe.pdfEditor) }
      : {}),
  };
}

function buildSkippedDiagnostics(app: OfficeAppKey, checkedAt: string) {
  return {
    status: "SKIPPED" as const,
    checkedAt,
    comAutomation: "SKIPPED" as const,
    hiddenAutomationProcessCount: 0,
    message: `${OFFICE_APP_LABELS[app]} diagnostics are only available on Windows.`,
  };
}

function buildOfficeAppDiagnostics(
  app: OfficeAppKey,
  checkedAt: string,
  probe: OfficeAppProbeResult
) {
  const hiddenAutomationProcessIds = probe.hiddenAutomationProcessIds ?? [];
  const comAutomation: OfficeComAutomation =
    probe.comAvailable === true
      ? "AVAILABLE"
      : probe.comAvailable === false
        ? "UNAVAILABLE"
        : "UNKNOWN";
  const needsAttention =
    hiddenAutomationProcessIds.length > 0 || comAutomation === "UNAVAILABLE";
  const status: OfficeDiagnosticsStatus =
    probe.installed === false
      ? "MISSING"
      : needsAttention
        ? "NEEDS_ATTENTION"
        : comAutomation === "UNKNOWN"
          ? "UNKNOWN"
          : "OK";
  const message = getOfficeDiagnosticMessage({
    app,
    status,
    comAutomation,
    needsAttention,
  });
  const recommendedAction = getOfficeRecommendedAction({
    app,
    status,
    needsAttention,
  });

  return {
    status,
    ...(probe.installed === undefined ? {} : { installed: probe.installed }),
    checkedAt,
    comAutomation,
    hiddenAutomationProcessCount: hiddenAutomationProcessIds.length,
    hiddenAutomationProcessIds,
    ...(probe.hresult === undefined ? {} : { hresult: probe.hresult }),
    ...(message ? { message } : {}),
    ...(recommendedAction ? { recommendedAction } : {}),
  };
}

function buildPdfEditorDiagnostics(
  checkedAt: string,
  probe: PdfEditorProbeResult
) {
  const status: PdfEditorDiagnosticsStatus =
    probe.installed === false || probe.trustedEditor === false
      ? "MISSING"
      : probe.installed === true && probe.trustedEditor === true
        ? "OK"
        : "UNKNOWN";
  const message = getPdfEditorDiagnosticMessage(status, probe.error);
  const recommendedAction =
    status === "MISSING" ? PDF_MASTER_EDITOR_INSTALL_RECOMMENDATION : undefined;

  return {
    status,
    ...(probe.installed === undefined ? {} : { installed: probe.installed }),
    checkedAt,
    ...(probe.trustedEditor === undefined
      ? {}
      : { trustedEditor: probe.trustedEditor }),
    ...(probe.editorPath ? { editorPath: probe.editorPath } : {}),
    ...(message ? { message } : {}),
    ...(recommendedAction ? { recommendedAction } : {}),
  };
}

function getPdfEditorDiagnosticMessage(
  status: PdfEditorDiagnosticsStatus,
  error: string | undefined
) {
  if (status === "MISSING") {
    return error ?? "A supported PDF editor is not installed or configured.";
  }
  if (status === "UNKNOWN") {
    return error ?? "PDF editor diagnostics could not complete.";
  }
}

function getOfficeDiagnosticMessage({
  app,
  status,
  comAutomation,
  needsAttention,
}: {
  app: OfficeAppKey;
  status: OfficeDiagnosticsStatus;
  comAutomation: OfficeComAutomation;
  needsAttention: boolean;
}) {
  const label = OFFICE_APP_LABELS[app];
  if (status === "MISSING") {
    return `Microsoft ${label} is not installed or registered.`;
  }
  if (comAutomation === "UNAVAILABLE") {
    return `${label} COM automation is unavailable.`;
  }
  if (needsAttention) {
    return `Hidden ${label} automation processes were detected.`;
  }
  if (comAutomation === "UNKNOWN") {
    return `${label} diagnostics could not complete.`;
  }
}

function getOfficeRecommendedAction({
  app,
  status,
  needsAttention,
}: {
  app: OfficeAppKey;
  status: OfficeDiagnosticsStatus;
  needsAttention: boolean;
}) {
  const label = OFFICE_APP_LABELS[app];
  if (status === "MISSING") {
    return `Install Microsoft ${label}, then restart Desktop Agent.`;
  }
  return needsAttention
    ? `Close hidden ${label} automation processes or repair Office.`
    : undefined;
}

function normalizeWindowsOfficeProbeResult(
  probe: WindowsOfficeProbeResult
): NormalizedOfficeProbeResult {
  if (probe.excel || probe.word || probe.powerPoint) {
    return {
      excel: probe.excel ?? {},
      word: probe.word ?? {},
      powerPoint: probe.powerPoint ?? {},
      pdfEditor: probe.pdfEditor,
    };
  }

  return {
    excel: {
      installed: probe.excelInstalled,
      comAvailable: probe.comAvailable,
      hresult: probe.hresult,
      error: probe.error,
      hiddenAutomationProcessIds: probe.hiddenAutomationProcessIds,
    },
    pdfEditor: probe.pdfEditor,
  };
}

async function runWindowsOfficeProbe(
  run: ExecFileLike,
  timeoutMs: number
): Promise<WindowsOfficeProbeResult> {
  const stdout = await new Promise<string>((resolve, reject) => {
    run(
      "powershell.exe",
      [
        "-NoProfile",
        "-NonInteractive",
        "-ExecutionPolicy",
        "Bypass",
        "-Command",
        WINDOWS_OFFICE_PROBE_SCRIPT,
      ],
      { timeout: timeoutMs, windowsHide: true },
      (error, output, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve(output);
      }
    );
  });

  return JSON.parse(stdout) as WindowsOfficeProbeResult;
}

const WINDOWS_OFFICE_PROBE_SCRIPT = `
function Get-AutomationProcessIds {
  param([string]$ProcessName)
  @(Get-CimInstance Win32_Process -Filter "Name='$ProcessName'" -ErrorAction SilentlyContinue |
    Where-Object {
      ($_.CommandLine -match '(?i)[/-]automation') -and
      ($_.CommandLine -like '*-Embedding*')
    } |
    Select-Object -ExpandProperty ProcessId)
}

function Test-OfficeRegistration {
  param(
    [string]$Label,
    [string]$ProgId,
    [string]$ProcessName
  )

  $preexistingAutomationProcessIds = @(Get-AutomationProcessIds -ProcessName $ProcessName)
  $appType = $null
  $installed = $false
  $errorMessage = $null
  $hresult = $null

  try {
    $appType = [type]::GetTypeFromProgID($ProgId)
    $installed = $appType -ne $null
    if (-not $installed) {
      $errorMessage = "Microsoft $Label is not installed or registered."
    }
  } catch {
    $errorMessage = $_.Exception.Message
    $hresult = $_.Exception.HResult
  }

  [pscustomobject]@{
    installed = $installed
    hresult = $hresult
    error = $errorMessage
    hiddenAutomationProcessIds = $preexistingAutomationProcessIds
  }
}

${WINDOWS_TRUSTED_PDF_EDITOR_DISCOVERY_SCRIPT}

function Test-PdfMasterEditor {
  $configuredPath = [string]$env:PROJECT_WING_PDF_MASTER_EDITOR_EXE_PATH
  if ($configuredPath) {
    if (Test-Path -LiteralPath $configuredPath -PathType Leaf) {
      return [pscustomobject]@{
        installed = $true
        trustedEditor = $true
        editorPath = [System.IO.Path]::GetFullPath($configuredPath)
        error = $null
      }
    }
    return [pscustomobject]@{
      installed = $false
      trustedEditor = $false
      editorPath = $configuredPath
      error = "The configured PDF Master editor could not be found."
    }
  }

  $candidatePaths = @(Find-ProjectWingTrustedPdfEditorCandidatePaths)
  $editorPath = if ($candidatePaths.Count -gt 0) { [string]$candidatePaths[0] } else { $null }
  $trustedEditor = [bool]$editorPath

  [pscustomobject]@{
    installed = $trustedEditor
    trustedEditor = $trustedEditor
    editorPath = $editorPath
    error = if ($trustedEditor) { $null } else { "A supported PDF editor is not installed or configured." }
  }
}

[pscustomobject]@{
  excel = Test-OfficeRegistration -Label "Excel" -ProgId "Excel.Application" -ProcessName "EXCEL.EXE"
  word = Test-OfficeRegistration -Label "Word" -ProgId "Word.Application" -ProcessName "WINWORD.EXE"
  powerPoint = Test-OfficeRegistration -Label "PowerPoint" -ProgId "PowerPoint.Application" -ProcessName "POWERPNT.EXE"
  pdfEditor = Test-PdfMasterEditor
} | ConvertTo-Json -Compress -Depth 4
`;
