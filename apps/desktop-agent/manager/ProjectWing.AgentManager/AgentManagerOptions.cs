namespace ProjectWing.AgentManager;

internal static class AgentManagerOptions
{
    public static string RequireOption(string[] args, string name)
    {
        return ReadOption(args, name)
            ?? throw new InvalidOperationException($"{name} is required.");
    }

    public static int ReadIntOption(string[] args, string name, int fallback)
    {
        var raw = ReadOption(args, name);
        return int.TryParse(raw, out var parsed) && parsed > 0 && parsed <= 65_535
            ? parsed
            : fallback;
    }

    public static long? ReadLongOption(string[] args, string name)
    {
        var raw = ReadOption(args, name);
        return long.TryParse(raw, out var parsed) && parsed > 0 ? parsed : null;
    }

    public static string? ReadOption(string[] args, string name)
    {
        for (var index = 0; index < args.Length - 1; index++)
        {
            if (args[index] == name) return args[index + 1];
        }
        return null;
    }

    public static string GetMutexName()
    {
        return OperatingSystem.IsWindows()
            ? "Global\\ProjectWingDesktopAgentUpdate"
            : "ProjectWingDesktopAgentUpdate";
    }

    public static string GetInstallerFileName()
    {
        return OperatingSystem.IsMacOS()
            ? "desktop-agent-macos-arm64.pkg"
            : "desktop-agent-win-x64.exe";
    }

    public static long GetMinimumInstallerBytes()
    {
        const long windowsMinimumBytes = 50_000_000;
        const long macMinimumBytes = 5_000_000;
        return OperatingSystem.IsMacOS() ? macMinimumBytes : windowsMinimumBytes;
    }

    public static string GetWatcherFileName()
    {
        return OperatingSystem.IsWindows()
            ? "ProjectWing.ExcelWatcher.exe"
            : "ProjectWing.ExcelWatcher";
    }

    public static string GetManagerFileName()
    {
        return OperatingSystem.IsWindows()
            ? "ProjectWing.AgentManager.exe"
            : "ProjectWing.AgentManager";
    }

    public static string GetRuntimeFileName()
    {
        return OperatingSystem.IsWindows()
            ? "ProjectWing.DesktopAgent.Runtime.exe"
            : "ProjectWing.DesktopAgent.Runtime";
    }
}
