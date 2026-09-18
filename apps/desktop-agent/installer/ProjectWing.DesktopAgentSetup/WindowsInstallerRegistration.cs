using System.Diagnostics;
using Microsoft.Win32;

namespace ProjectWing.DesktopAgentSetup;

internal static class WindowsInstallerRegistration
{
    private const string RunValueName = "ProjectWingDesktopAgent";
    private const string StartProtocolName = "projectwing-agent";
    private const string WatchdogTaskName = "ProjectWingDesktopAgentWatchdog";
    private const string UninstallEntryName = "ProjectWingDesktopAgent";
    private const string UninstallRegistryPath =
        @"Software\Microsoft\Windows\CurrentVersion\Uninstall\" + UninstallEntryName;

    public static void RegisterStartup(string hiddenStartScriptPath)
    {
        using var runKey = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run",
            writable: true
        ) ?? throw new InvalidOperationException("Cannot open the user startup registry key.");
        runKey.SetValue(
            RunValueName,
            $"wscript.exe \"{hiddenStartScriptPath}\"",
            RegistryValueKind.String
        );
    }

    public static void RegisterStartProtocol(string hiddenStartScriptPath)
    {
        using var protocolKey = Registry.CurrentUser.CreateSubKey(
            $@"Software\Classes\{StartProtocolName}"
        ) ?? throw new InvalidOperationException("Cannot register Desktop Agent protocol.");
        protocolKey.SetValue(null, "URL:Project Wing Desktop Agent");
        protocolKey.SetValue("URL Protocol", string.Empty, RegistryValueKind.String);
        using var commandKey = protocolKey.CreateSubKey(@"shell\open\command")
            ?? throw new InvalidOperationException("Cannot register Desktop Agent command.");
        commandKey.SetValue(
            null,
            $"wscript.exe \"{hiddenStartScriptPath}\" \"%1\"",
            RegistryValueKind.String
        );
    }

    public static void RegisterUninstallEntry(
        string uninstallScriptPath,
        string installRoot,
        string applicationPath,
        string version
    )
    {
        using var uninstallKey = Registry.CurrentUser.CreateSubKey(UninstallRegistryPath)
            ?? throw new InvalidOperationException("Cannot register Desktop Agent uninstall entry.");
        uninstallKey.SetValue("DisplayName", "Project Wing Desktop Agent");
        uninstallKey.SetValue("DisplayVersion", version);
        uninstallKey.SetValue("Publisher", "Project Wing");
        uninstallKey.SetValue("InstallLocation", installRoot);
        uninstallKey.SetValue("DisplayIcon", applicationPath);
        uninstallKey.SetValue("UninstallString", $"cmd.exe /d /c \"\"{uninstallScriptPath}\"\"");
        uninstallKey.SetValue("NoModify", 1, RegistryValueKind.DWord);
        uninstallKey.SetValue("NoRepair", 1, RegistryValueKind.DWord);
    }

    public static void TryRegisterWatchdogTask(string hiddenWatchdogScriptPath)
    {
        var registered = TryRunProcess(
            "schtasks.exe",
            [
                "/Create", "/TN", WatchdogTaskName, "/SC", "MINUTE", "/MO", "1",
                "/TR", $"wscript.exe \"{hiddenWatchdogScriptPath}\"", "/F",
            ]
        );
        if (!registered)
        {
            Console.Error.WriteLine(
                "Warning: Could not register watchdog task. Startup recovery remains installed."
            );
        }
    }

    public static void StartHiddenScript(string hiddenScriptPath)
    {
        Process.Start(new ProcessStartInfo
        {
            FileName = "wscript.exe",
            Arguments = $"\"{hiddenScriptPath}\"",
            CreateNoWindow = true,
            UseShellExecute = false,
            WindowStyle = ProcessWindowStyle.Hidden,
        });
    }

    public static InstallerRegistrationSnapshot Verify(
        string hiddenStartScriptPath,
        string uninstallScriptPath
    )
    {
        using var runKey = Registry.CurrentUser.OpenSubKey(
            @"Software\Microsoft\Windows\CurrentVersion\Run"
        );
        var startup = runKey?.GetValue(RunValueName)?.ToString();
        using var protocolCommandKey = Registry.CurrentUser.OpenSubKey(
            $@"Software\Classes\{StartProtocolName}\shell\open\command"
        );
        var protocol = protocolCommandKey?.GetValue(null)?.ToString();
        using var uninstallKey = Registry.CurrentUser.OpenSubKey(UninstallRegistryPath);
        var uninstall = uninstallKey?.GetValue("UninstallString")?.ToString();
        return new InstallerRegistrationSnapshot(
            ContainsPath(startup, hiddenStartScriptPath),
            ContainsPath(protocol, hiddenStartScriptPath),
            TryRunProcess("schtasks.exe", ["/Query", "/TN", WatchdogTaskName]),
            ContainsPath(uninstall, uninstallScriptPath)
        );
    }

    private static bool ContainsPath(string? command, string path)
    {
        return !string.IsNullOrWhiteSpace(command)
            && command.Contains(path, StringComparison.OrdinalIgnoreCase);
    }

    private static bool TryRunProcess(string fileName, IReadOnlyList<string> arguments)
    {
        try
        {
            using var process = new Process
            {
                StartInfo = new ProcessStartInfo
                {
                    FileName = fileName,
                    CreateNoWindow = true,
                    UseShellExecute = false,
                    WindowStyle = ProcessWindowStyle.Hidden,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true,
                },
            };
            foreach (var argument in arguments) process.StartInfo.ArgumentList.Add(argument);
            process.Start();
            process.WaitForExit(10_000);
            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }
}

internal sealed record InstallerRegistrationSnapshot(
    bool StartupRegistered,
    bool ProtocolRegistered,
    bool WatchdogRegistered,
    bool UninstallRegistered
)
{
    public bool IsComplete =>
        StartupRegistered && ProtocolRegistered && WatchdogRegistered && UninstallRegistered;
}
