import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const legacyTaskName = "ProjectWingDesktopAgentWatchdog";
const migrationMarkerName = "electron-host-v1.done";

type MigrationOptions = {
  isPackaged: boolean;
  localAppDataPath?: string;
  platform: NodeJS.Platform;
};

type CommandResult = {
  error?: Error;
  status: number | null;
  stderr?: string | null;
  stdout?: string | null;
};

type MigrationDependencies = {
  pathExists: (targetPath: string) => boolean;
  run: (command: string, args: string[]) => CommandResult;
  writeMarker: (markerPath: string) => void;
};

export function cleanupLegacyWindowsInstall(
  options: MigrationOptions,
  dependencies: MigrationDependencies = defaultDependencies
) {
  const paths = resolveMigrationPaths(options);
  if (!paths) {
    return false;
  }
  const migrationComplete = dependencies.pathExists(paths.markerPath);
  if (migrationComplete) {
    return false;
  }

  cleanupLegacyProcessesAndRegistry(paths.legacyRoot, dependencies.run);
  // Retain exact paths: sessions may use a custom cache below the old install.
  dependencies.writeMarker(paths.markerPath);
  return true;
}

function resolveMigrationPaths(options: MigrationOptions) {
  if (
    options.platform !== "win32" ||
    !options.isPackaged ||
    !options.localAppDataPath
  ) {
    return null;
  }
  return {
    legacyRoot: path.win32.join(
      options.localAppDataPath,
      "ProjectWing",
      "DesktopAgent"
    ),
    markerPath: path.win32.join(
      options.localAppDataPath,
      "ProjectWing",
      "AgentState",
      "migrations",
      migrationMarkerName
    ),
  };
}

function cleanupLegacyProcessesAndRegistry(
  legacyRoot: string,
  run: MigrationDependencies["run"]
) {
  const encodedRoot = Buffer.from(legacyRoot, "utf-8").toString("base64");
  const result = run("powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-Command",
    buildLegacyWindowsCleanupScript(encodedRoot),
  ]);
  if (result.error || result.status !== 0) {
    throw new Error(formatCommandFailure(result));
  }
}

function formatCommandFailure(result: CommandResult) {
  const detail = result.error?.message ?? result.stderr?.trim();
  const suffix = detail
    ? `: ${detail.slice(0, 1000)}`
    : ` with exit code ${result.status}`;
  return `Legacy Windows cleanup failed${suffix}.`;
}

const registryCleanupScript = String.raw`
function Test-LegacyReference([object] $Value) {
  return $null -ne $Value -and $Value.ToString().IndexOf($normalizedRoot, [StringComparison]::OrdinalIgnoreCase) -ge 0
}
function Get-DefaultRegistryValue([string] $Path) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  return (Get-Item -LiteralPath $Path).GetValue('')
}
function Get-RegistryValue([string] $Path, [string] $Name) {
  if (-not (Test-Path -LiteralPath $Path)) { return $null }
  $item = Get-ItemProperty -LiteralPath $Path
  $property = $item.PSObject.Properties[$Name]
  if ($null -eq $property) { return $null }
  return $property.Value
}
$runPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = Get-RegistryValue $runPath 'ProjectWingDesktopAgent'
if (Test-LegacyReference $runValue) {
  Remove-ItemProperty -LiteralPath $runPath -Name 'ProjectWingDesktopAgent' -Force -ErrorAction SilentlyContinue
}
$protocolPath = 'HKCU:\Software\Classes\projectwing-agent'
$protocolCommand = Get-DefaultRegistryValue (Join-Path $protocolPath 'shell\open\command')
if (Test-LegacyReference $protocolCommand) {
  Remove-Item -LiteralPath $protocolPath -Recurse -Force -ErrorAction SilentlyContinue
}
$uninstallPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProjectWingDesktopAgent'
$uninstallLocation = Get-RegistryValue $uninstallPath 'InstallLocation'
$uninstallCommand = Get-RegistryValue $uninstallPath 'UninstallString'
if ((Test-LegacyReference $uninstallLocation) -or (Test-LegacyReference $uninstallCommand)) {
  Remove-Item -LiteralPath $uninstallPath -Recurse -Force -ErrorAction SilentlyContinue
}
`;

const processCleanupScript = String.raw`
$processFilter = "Name = 'ProjectWingDesktopAgent.exe' OR Name = 'ProjectWing.AgentManager.exe' OR Name = 'ProjectWing.DesktopAgent.Runtime.exe' OR Name = 'powershell.exe' OR Name = 'pwsh.exe' OR Name = 'cmd.exe'"
function Get-LegacyProcesses {
  return @(Get-CimInstance Win32_Process -Filter $processFilter | Where-Object {
    $_.ExecutablePath -and $_.ExecutablePath.IndexOf($normalizedRoot, [StringComparison]::OrdinalIgnoreCase) -eq 0
  })
}
$legacyProcesses = @(Get-LegacyProcesses)
$legacyProcessIds = @($legacyProcesses | ForEach-Object { $_.ProcessId })
$legacyProcesses | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
if ($legacyProcessIds.Count -gt 0) {
  Wait-Process -Id $legacyProcessIds -Timeout 5 -ErrorAction SilentlyContinue
}
$remainingProcesses = @(Get-LegacyProcesses)
if ($remainingProcesses.Count -gt 0) { throw 'Legacy Desktop Agent processes are still running.' }
`;

export function buildLegacyWindowsCleanupScript(encodedRoot: string) {
  return String.raw`
$ErrorActionPreference = 'Stop'
$legacyRoot = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encodedRoot}'))
$normalizedRoot = [IO.Path]::GetFullPath($legacyRoot).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar
$task = Get-ScheduledTask -ErrorAction Stop | Where-Object { $_.TaskName -eq '${legacyTaskName}' -and $_.TaskPath -eq '\' }
if ($null -ne $task) {
  $actions = @($task.Actions)
  if ($actions.Count -eq 0) { throw 'Legacy task ownership cannot be verified.' }
  foreach ($action in $actions) {
    # Never remove a task merely because its display name matches. Legacy
    # script hosts are ambiguous; leave them for an explicit migration tool.
    $executable = [IO.Path]::GetFullPath($action.Execute.Trim('"'))
    if (-not $executable.StartsWith($normalizedRoot, [StringComparison]::OrdinalIgnoreCase)) {
      throw 'Scheduled task belongs to an unverified installation; it was not stopped.'
    }
  }
  Stop-ScheduledTask -InputObject $task
  Unregister-ScheduledTask -InputObject $task -Confirm:$false
}
${registryCleanupScript}
${processCleanupScript}`;
}

const defaultDependencies: MigrationDependencies = {
  pathExists: existsSync,
  run: (command, args) =>
    spawnSync(command, args, {
      encoding: "utf-8",
      timeout: 15_000,
      windowsHide: true,
    }),
  writeMarker: (markerPath) => {
    mkdirSync(path.win32.dirname(markerPath), { recursive: true });
    writeFileSync(markerPath, `${new Date().toISOString()}\n`, "utf-8");
  },
};
