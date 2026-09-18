namespace ProjectWing.DesktopAgent.Runtime;

internal static class DesktopAgentStateDirectory
{
    // Resolve redirected ancestors before creating/writing state. In particular,
    // Windows profile junctions can fail CREATE_NEW through the logical path.
    // Keep this separate from cache containment: existing session file paths and
    // the manager's logical ownership identity must not be rewritten.
    public static string Resolve(string path)
    {
        var fullPath = Path.GetFullPath(path);
        if (!OperatingSystem.IsWindows()) return fullPath;

        var root = Path.GetPathRoot(fullPath)
            ?? throw new IOException("State directory has no filesystem root.");
        var current = root;
        foreach (var segment in fullPath[root.Length..].Split(
            [Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar],
            StringSplitOptions.RemoveEmptyEntries))
        {
            current = Path.Combine(current, segment);
            var directory = new DirectoryInfo(current);
            if (directory.LinkTarget is null) continue;
            var target = directory.ResolveLinkTarget(returnFinalTarget: true);
            if (target is not DirectoryInfo || !target.Exists)
                throw new IOException("State directory redirect does not resolve to an existing directory.");
            current = target.FullName;
        }
        return Path.GetFullPath(current);
    }
}
