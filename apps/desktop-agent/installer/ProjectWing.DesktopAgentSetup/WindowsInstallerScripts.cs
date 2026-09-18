namespace ProjectWing.DesktopAgentSetup;

internal static class WindowsInstallerScripts
{
    private const string RunValueName = "ProjectWingDesktopAgent";
    private const string StartProtocolName = "projectwing-agent";
    private const string WatchdogTaskName = "ProjectWingDesktopAgentWatchdog";
    private const string DevelopmentEmpOrigin = "https://emp.superfx.cn";
    private const string ProductionEmpOrigin = "https://emp.wzcpa.hk";
    private const string LegacyEmpOrigin = "https://wing.superfx.cn";
    private const string DevelopmentApiBaseUrl = "https://emp.superfx.cn/api";
    private const string DevelopmentAuthBaseUrl = "https://auth.superfx.cn";
    private const string ProductionAuthBaseUrl = "https://auth.wzcpa.hk";

    public static void WriteStartScript(
        string scriptPath,
        string appDirectory,
        string installRoot,
        string version,
        string managerPath,
        string stateRoot
    )
    {
        var context = new StartScriptContext(
            AppDirectory: appDirectory,
            Version: version,
            ManagerPath: managerPath,
            StateRoot: stateRoot,
            CacheRoot: Path.Combine(
                Path.GetDirectoryName(stateRoot) ?? stateRoot,
                "agent-cache"
            ),
            BundleExtractRoot: Path.Combine(stateRoot, "dotnet-bundle"),
            WatcherPath: Path.Combine(
                appDirectory,
                "managed",
                "ProjectWing.ExcelWatcher.exe"
            ),
            RuntimePath: Path.Combine(
                appDirectory,
                "managed",
                "ProjectWing.DesktopAgent.Runtime.exe"
            ),
            LogPath: Path.Combine(installRoot, "agent.log"),
            AllowedDownloads: $"{DevelopmentEmpOrigin},{ProductionEmpOrigin},{LegacyEmpOrigin},http://localhost:3000,http://127.0.0.1:3000,http://localhost:3020,http://127.0.0.1:3020",
            AllowedWebOrigins: $"{DevelopmentEmpOrigin},{ProductionEmpOrigin},{LegacyEmpOrigin},http://localhost:3001,http://127.0.0.1:3001,http://localhost:3021,http://127.0.0.1:3021",
            AllowedAuthOrigins: $"{DevelopmentAuthBaseUrl},{ProductionAuthBaseUrl},http://localhost:3000,http://127.0.0.1:3000,http://localhost:3020,http://127.0.0.1:3020"
        );
        File.WriteAllText(scriptPath, BuildStartScript(context));
    }

    public static void WriteHiddenPowerShellScript(
        string scriptPath,
        string powerShellScriptPath
    )
    {
        var escapedPath = powerShellScriptPath.Replace("\"", "\"\"");
        var script = string.Join(
            Environment.NewLine,
            [
                "Set shell = CreateObject(\"WScript.Shell\")",
                "shell.Run \"powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File \"\""
                    + escapedPath
                    + "\"\"\", 0, False",
                "",
            ]
        );
        File.WriteAllText(scriptPath, script);
    }

    public static void WriteUninstallScript(string scriptPath)
    {
        File.WriteAllText(scriptPath, BuildUninstallScript());
    }

    private static string BuildStartScript(StartScriptContext context)
    {
        var escapedLogPath = context.LogPath.Replace("'", "''");
        return $$"""
@echo off
setlocal
set "PROJECT_WING_AGENT_API_BASE_URL={{DevelopmentApiBaseUrl}}"
set "PROJECT_WING_AGENT_AUTH_BASE_URL={{DevelopmentAuthBaseUrl}}"
set "PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS={{context.AllowedDownloads}}"
set "PROJECT_WING_AGENT_ALLOWED_WEB_ORIGINS={{context.AllowedWebOrigins}}"
set "PROJECT_WING_AGENT_ALLOWED_AUTH_ORIGINS={{context.AllowedAuthOrigins}}"
set "PROJECT_WING_AGENT_VERSION={{context.Version}}"
set "PROJECT_WING_EXCEL_WATCHER_EXE_PATH={{context.WatcherPath}}"
set "PROJECT_WING_AGENT_MANAGER_EXE_PATH={{context.ManagerPath}}"
set "PROJECT_WING_AGENT_RUNTIME_EXE_PATH={{context.RuntimePath}}"
set "PROJECT_WING_AGENT_STATE_ROOT={{context.StateRoot}}"
set "PROJECT_WING_AGENT_CACHE_ROOT={{context.CacheRoot}}"
set "DOTNET_BUNDLE_EXTRACT_BASE_DIR={{context.BundleExtractRoot}}"
set "PROJECT_WING_AGENT_PORT=17862"
set "PROJECT_WING_AGENT_WORKER_PORT=17863"
if not defined PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL set "PROJECT_WING_AGENT_DIAGNOSTIC_LOG_LEVEL=normal"
if not defined PROJECT_WING_AGENT_LOG_MAX_BYTES set "PROJECT_WING_AGENT_LOG_MAX_BYTES=104857600"
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; $p='{{escapedLogPath}}'; $max=[int64]($env:PROJECT_WING_AGENT_LOG_MAX_BYTES); if ((Test-Path -LiteralPath $p) -and ((Get-Item -LiteralPath $p).Length -gt $max)) { Remove-Item -LiteralPath ($p + '.2') -Force; if (Test-Path -LiteralPath ($p + '.1')) { Move-Item -LiteralPath ($p + '.1') -Destination ($p + '.2') -Force }; Move-Item -LiteralPath $p -Destination ($p + '.1') -Force }"
cd /d "{{context.AppDirectory}}"
"{{context.ManagerPath}}" run --app-directory "{{context.AppDirectory}}" --agent-version "{{context.Version}}" --state-root "{{context.StateRoot}}" --api-base-url "{{DevelopmentApiBaseUrl}}" --auth-base-url "{{DevelopmentAuthBaseUrl}}" --allowed-download-origins "{{context.AllowedDownloads}}" --allowed-web-origins "{{context.AllowedWebOrigins}}" --allowed-auth-origins "{{context.AllowedAuthOrigins}}" --watcher-path "{{context.WatcherPath}}" --manager-path "{{context.ManagerPath}}" --runtime-path "{{context.RuntimePath}}" --runtime-port 17862 --worker-port 17863 >> "{{context.LogPath}}" 2>&1
""";
    }

    private static string BuildUninstallScript()
    {
        return $$"""
@echo off
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Run" /v "{{RunValueName}}" /f >nul 2>nul
reg delete "HKCU\Software\Classes\{{StartProtocolName}}" /f >nul 2>nul
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\ProjectWingDesktopAgent" /f >nul 2>nul
schtasks /delete /tn "{{WatchdogTaskName}}" /f >nul 2>nul
powershell -NoProfile -ExecutionPolicy Bypass -Command "$installRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ProjectWing\DesktopAgent')).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and ($_.CommandLine -like '*StartProjectWingDesktopAgent*' -or $_.CommandLine -like '*WatchProjectWingDesktopAgent*') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$installRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ProjectWing\DesktopAgent')).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and ($_.Name -in @('ProjectWingDesktopAgent.exe','ProjectWing.AgentManager.exe','ProjectWing.DesktopAgent.Runtime.exe')) -and $_.ExecutablePath -and $_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0 } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$installRoot=[IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA 'ProjectWing\DesktopAgent')).TrimEnd([IO.Path]::DirectorySeparatorChar) + [IO.Path]::DirectorySeparatorChar; Get-CimInstance Win32_Process | Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -like '*ProjectWing*DesktopAgent*agent*dist*index.js*' -and $_.CommandLine.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"
cd /d "%LOCALAPPDATA%"
rmdir /s /q "%LOCALAPPDATA%\ProjectWing\DesktopAgent"
echo Project Wing Desktop Agent has been uninstalled.
""";
    }

    private sealed record StartScriptContext(
        string AppDirectory,
        string Version,
        string ManagerPath,
        string StateRoot,
        string CacheRoot,
        string BundleExtractRoot,
        string WatcherPath,
        string RuntimePath,
        string LogPath,
        string AllowedDownloads,
        string AllowedWebOrigins,
        string AllowedAuthOrigins
    );
}
