using System.Diagnostics;

namespace ProjectWing.DesktopAgentSetup;

internal static class WindowsProcessLifecycle
{
    public static void StopExistingProcesses(string installRoot)
    {
        var normalizedRoot = NormalizeInstallRoot(installRoot);
        StopLauncherProcesses(normalizedRoot);
        StopManagedProcesses(normalizedRoot);
        StopUiProcesses(normalizedRoot);
        StopLegacyNodeProcessesByModulePath(normalizedRoot);
        StopLegacyNodeProcessesByCommandLine(normalizedRoot);
    }

    private static void StopUiProcesses(string installRoot)
    {
        foreach (var process in Process.GetProcessesByName("ProjectWingDesktopAgent"))
        {
            try
            {
                var processPath = process.MainModule?.FileName;
                if (IsInsideInstallRoot(processPath, installRoot))
                {
                    process.Kill(entireProcessTree: false);
                    process.WaitForExit(5_000);
                }
            }
            catch
            {
                // A later install attempt reports a locked directory if this process persists.
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void StopLegacyNodeProcessesByModulePath(string installRoot)
    {
        foreach (var process in Process.GetProcessesByName("node"))
        {
            try
            {
                var processPath = process.MainModule?.FileName;
                if (IsInsideInstallRoot(processPath, installRoot))
                {
                    process.Kill(entireProcessTree: false);
                    process.WaitForExit(5_000);
                }
            }
            catch
            {
                // Command-line matching below handles inaccessible module paths.
            }
            finally
            {
                process.Dispose();
            }
        }
    }

    private static void StopManagedProcesses(string installRoot)
    {
        var command = PowerShellRootPrefix(installRoot)
            + "Get-CimInstance Win32_Process | "
            + "Where-Object { $_.ProcessId -ne $PID -and "
            + "($_.Name -in @('ProjectWing.AgentManager.exe', 'ProjectWing.DesktopAgent.Runtime.exe')) -and "
            + "$_.ExecutablePath -and $_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0 } | "
            + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
        RunPowerShell(command);
    }

    private static void StopLegacyNodeProcessesByCommandLine(string installRoot)
    {
        var command = PowerShellRootPrefix(installRoot)
            + "Get-CimInstance Win32_Process | "
            + "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and "
            + "$_.CommandLine -like '*ProjectWing*DesktopAgent*agent*dist*index.js*' -and "
            + "$_.CommandLine.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 } | "
            + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
        RunPowerShell(command);
    }

    private static void StopLauncherProcesses(string installRoot)
    {
        var command = PowerShellRootPrefix(installRoot)
            + "Get-CimInstance Win32_Process | "
            + "Where-Object { $_.ProcessId -ne $PID -and $_.CommandLine -and "
            + "$_.CommandLine.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -ge 0 -and "
            + "($_.CommandLine -like '*StartProjectWingDesktopAgent*' -or "
            + "$_.CommandLine -like '*WatchProjectWingDesktopAgent*') } | "
            + "ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
        RunPowerShell(command);
    }

    private static bool IsInsideInstallRoot(string? processPath, string installRoot)
    {
        return !string.IsNullOrWhiteSpace(processPath)
            && Path.GetFullPath(processPath).StartsWith(
                installRoot,
                StringComparison.OrdinalIgnoreCase
            );
    }

    private static string NormalizeInstallRoot(string installRoot)
    {
        return Path.GetFullPath(installRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
    }

    private static string PowerShellRootPrefix(string installRoot)
    {
        return "$installRoot = '" + installRoot.Replace("'", "''") + "'; ";
    }

    private static void RunPowerShell(string command)
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "powershell.exe",
                UseShellExecute = false,
                CreateNoWindow = true,
                ArgumentList =
                {
                    "-NoProfile",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    command,
                },
            });
            process?.WaitForExit();
        }
        catch
        {
            // Locked files produce the authoritative installation failure later.
        }
    }
}
