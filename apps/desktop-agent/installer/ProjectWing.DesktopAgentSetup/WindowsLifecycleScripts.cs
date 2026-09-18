namespace ProjectWing.DesktopAgentSetup;

internal static class WindowsLifecycleScripts
{
    private const string HealthUrl = "http://127.0.0.1:17862/health";
    private const string StarterMutexName = "Global\\ProjectWingDesktopAgentStarter";
    private const string WatchdogMutexName = "Global\\ProjectWingDesktopAgentWatchdog";

    public static void WriteStarter(
        string scriptPath,
        string startScriptPath,
        string uiPath,
        string shutdownFlagPath
    )
    {
        var script = StarterTemplate
            .Replace("__START_SCRIPT__", Escape(startScriptPath))
            .Replace("__UI_PATH__", Escape(uiPath))
            .Replace("__SHUTDOWN_FLAG__", Escape(shutdownFlagPath))
            .Replace("__HEALTH_URL__", HealthUrl)
            .Replace("__STARTER_MUTEX__", StarterMutexName);
        File.WriteAllText(scriptPath, script);
    }

    public static void WriteWatchdog(
        string scriptPath,
        string starterScriptPath,
        string uiPath,
        string shutdownFlagPath
    )
    {
        var script = WatchdogTemplate
            .Replace("__STARTER_SCRIPT__", Escape(starterScriptPath))
            .Replace("__UI_PATH__", Escape(uiPath))
            .Replace("__SHUTDOWN_FLAG__", Escape(shutdownFlagPath))
            .Replace("__HEALTH_URL__", HealthUrl)
            .Replace("__WATCHDOG_MUTEX__", WatchdogMutexName);
        File.WriteAllText(scriptPath, script);
    }

    private static string Escape(string value) => value.Replace("'", "''");

    private const string StarterTemplate = """
param([switch] $Automatic)
$ErrorActionPreference = "SilentlyContinue"
$startScript = '__START_SCRIPT__'
$uiPath = '__UI_PATH__'
$shutdownFlag = '__SHUTDOWN_FLAG__'
$env:PROJECT_WING_AGENT_STATE_ROOT = Split-Path -Parent $shutdownFlag
$hasLock = $false
$mutex = New-Object System.Threading.Mutex($false, '__STARTER_MUTEX__')

function Test-ProjectWingAgentHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri '__HEALTH_URL__' -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-ProjectWingAgentUi {
  $process = Get-CimInstance Win32_Process -Filter "Name = 'ProjectWingDesktopAgent.exe'" |
    Where-Object { $_.ExecutablePath -eq $uiPath } |
    Select-Object -First 1
  return $null -ne $process
}

try {
  $hasLock = $mutex.WaitOne(0)
  if (-not $hasLock) { exit 0 }
  if (-not $Automatic -and (Test-Path -LiteralPath $shutdownFlag)) {
    Remove-Item -LiteralPath $shutdownFlag -Force
  }
  if (Test-Path -LiteralPath $shutdownFlag) { exit 0 }
  if (-not (Test-ProjectWingAgentUi)) {
    Start-Process -FilePath $uiPath
  }
  if (Test-ProjectWingAgentHealth) { exit 0 }

  Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', ('"' + $startScript + '"')) -WindowStyle Hidden

  $deadline = (Get-Date).AddSeconds(12)
  while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 500
    if (Test-ProjectWingAgentHealth) { break }
  }
} finally {
  if ($hasLock) { $mutex.ReleaseMutex() | Out-Null }
  if ($mutex) { $mutex.Dispose() }
}
""";

    private const string WatchdogTemplate = """
$ErrorActionPreference = "SilentlyContinue"
$starterScript = '__STARTER_SCRIPT__'
$uiPath = '__UI_PATH__'
$shutdownFlag = '__SHUTDOWN_FLAG__'
$quotedStarterScript = '"' + $starterScript + '"'
$created = $false
$mutex = New-Object System.Threading.Mutex($true, '__WATCHDOG_MUTEX__', [ref]$created)
if (-not $created) { exit 0 }

function Test-ProjectWingAgentHealth {
  try {
    $response = Invoke-WebRequest -UseBasicParsing -Uri '__HEALTH_URL__' -TimeoutSec 1
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Test-ProjectWingAgentUi {
  $process = Get-CimInstance Win32_Process -Filter "Name = 'ProjectWingDesktopAgent.exe'" |
    Where-Object { $_.ExecutablePath -eq $uiPath } |
    Select-Object -First 1
  return $null -ne $process
}

try {
  while ($true) {
    if (Test-Path -LiteralPath $shutdownFlag) { exit 0 }
    if (-not (Test-ProjectWingAgentHealth) -or -not (Test-ProjectWingAgentUi)) {
      Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', $quotedStarterScript, '-Automatic') -WindowStyle Hidden
    }
    Start-Sleep -Seconds 10
  }
} finally {
  $mutex.ReleaseMutex() | Out-Null
  $mutex.Dispose()
}
""";
}
