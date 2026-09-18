using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.DesktopAgentSetup;

internal static class InstallStatusStore
{
    public static void Write(string reportPath, InstallReport report)
    {
        var reportDirectory = Path.GetDirectoryName(reportPath) ?? ".";
        Directory.CreateDirectory(reportDirectory);
        var now = DateTimeOffset.UtcNow.UtcDateTime.ToString("O");
        report.Ok = true;
        report.UpdatedAt = now;
        report.StartedAt ??= now;
        report.Stage ??= report.Status;
        var json = JsonSerializer.Serialize(report, InstallerJsonContext.Default.InstallReport);
        var tempPath = Path.Combine(
            reportDirectory,
            $"{Path.GetFileName(reportPath)}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp"
        );
        try
        {
            File.WriteAllText(tempPath, json + Environment.NewLine);
            MoveWithRetry(tempPath, reportPath);
        }
        catch
        {
            TryDelete(tempPath);
            throw;
        }
    }

    public static void TryWriteFailure(
        string? reportPath,
        string? version,
        string? installRoot,
        string message
    )
    {
        if (string.IsNullOrWhiteSpace(reportPath) || string.IsNullOrWhiteSpace(version)) return;
        try
        {
            Write(reportPath, new InstallReport("FAILED")
            {
                ErrorCode = "UNKNOWN_ERROR",
                ExpectedVersion = version,
                Message = message,
                Details = string.IsNullOrWhiteSpace(installRoot)
                    ? null
                    : new InstallReportDetails { InstallRoot = installRoot },
            });
        }
        catch
        {
            // The original installer error remains authoritative.
        }
    }

    public static IDisposable AcquireUpdateLockIfNeeded(string mutexName)
    {
        if (Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_UPDATE_LOCK_HELD") == "1")
        {
            return NoopDisposable.Instance;
        }
        var mutex = new Mutex(initiallyOwned: false, mutexName);
        try
        {
            if (!mutex.WaitOne(TimeSpan.FromSeconds(5)))
            {
                throw new InvalidOperationException("Another Desktop Agent update is running.");
            }
        }
        catch (AbandonedMutexException)
        {
            // The abandoned mutex is now owned by this process.
        }
        catch
        {
            mutex.Dispose();
            throw;
        }
        return new OwnedMutex(mutex);
    }

    public static void CleanupStaleSessionTempFiles(string stateRoot)
    {
        try
        {
            var staleBefore = DateTime.UtcNow.AddMinutes(-10);
            foreach (var tempFile in Directory.EnumerateFiles(stateRoot, "sessions.json.*.tmp"))
            {
                TryDeleteStale(tempFile, staleBefore);
            }
        }
        catch
        {
            // Report writing and installation should continue.
        }
    }

    private static void MoveWithRetry(string tempPath, string reportPath)
    {
        const int maximumAttempts = 5;
        for (var attempt = 1; attempt <= maximumAttempts; attempt++)
        {
            try
            {
                File.Move(tempPath, reportPath, overwrite: true);
                return;
            }
            catch (Exception error) when (
                error is IOException or UnauthorizedAccessException
                && attempt < maximumAttempts
            )
            {
                Thread.Sleep(TimeSpan.FromMilliseconds(50 * attempt));
            }
        }
    }

    private static void TryDeleteStale(string tempFile, DateTime staleBefore)
    {
        try
        {
            if (File.GetLastWriteTimeUtc(tempFile) < staleBefore) File.Delete(tempFile);
        }
        catch
        {
            // Active sessions are protected by age and file locks.
        }
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            // The move failure is the actionable error.
        }
    }

}

[JsonSourceGenerationOptions(
    PropertyNamingPolicy = JsonKnownNamingPolicy.CamelCase,
    DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    WriteIndented = true
)]
[JsonSerializable(typeof(InstallReport))]
internal sealed partial class InstallerJsonContext : JsonSerializerContext;

internal sealed class InstallReport(string status)
{
    public bool Ok { get; set; }
    public string Status { get; set; } = status;
    public string? Stage { get; set; }
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
    public string? ExpectedVersion { get; init; }
    public string? CurrentVersion { get; init; }
    public string? StartedAt { get; set; }
    public string? UpdatedAt { get; set; }
    public InstallReportDetails? Details { get; init; }
}

internal sealed class InstallReportDetails
{
    public string? InstallRoot { get; init; }
    public bool? StartupRegistered { get; init; }
    public bool? ProtocolRegistered { get; init; }
    public bool? WatchdogRegistered { get; init; }
    public bool? UninstallRegistered { get; init; }
}

internal sealed class OwnedMutex(Mutex mutex) : IDisposable
{
    public void Dispose()
    {
        mutex.ReleaseMutex();
        mutex.Dispose();
    }
}

internal sealed class NoopDisposable : IDisposable
{
    public static readonly NoopDisposable Instance = new();
    private NoopDisposable() { }
    public void Dispose() { }
}
