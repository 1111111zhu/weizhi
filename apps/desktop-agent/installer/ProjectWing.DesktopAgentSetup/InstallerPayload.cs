using System.IO.Compression;
using System.Reflection;

namespace ProjectWing.DesktopAgentSetup;

internal static class InstallerPayload
{
    public static void Extract(string payloadZipPath, string appDirectory)
    {
        using var payloadStream =
            Assembly.GetExecutingAssembly()
                .GetManifestResourceStream("ProjectWing.DesktopAgentSetup.payload.zip")
            ?? throw new InvalidOperationException("Installer payload is missing.");
        using (var output = File.Create(payloadZipPath))
        {
            payloadStream.CopyTo(output);
        }
        ZipFile.ExtractToDirectory(payloadZipPath, appDirectory, overwriteFiles: true);
        File.Delete(payloadZipPath);
    }

    public static void CleanupOldDirectories(string installRoot, string currentAppDirectory)
    {
        var currentPath = Path.GetFullPath(currentAppDirectory).TrimEnd(
            Path.DirectorySeparatorChar
        );
        foreach (var directory in Directory.EnumerateDirectories(installRoot, "app-*"))
        {
            try
            {
                var fullPath = Path.GetFullPath(directory).TrimEnd(Path.DirectorySeparatorChar);
                if (!string.Equals(fullPath, currentPath, StringComparison.OrdinalIgnoreCase))
                {
                    Directory.Delete(directory, recursive: true);
                }
            }
            catch
            {
                // A future install retries cleanup after stopping the old runtime.
            }
        }
    }
}
