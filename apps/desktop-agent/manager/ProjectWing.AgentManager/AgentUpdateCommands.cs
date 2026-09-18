using System.Security.Cryptography;
using static ProjectWing.AgentManager.AgentManagerOptions;
using static ProjectWing.AgentManager.ManagerStatusStore;

namespace ProjectWing.AgentManager;

internal static class AgentUpdateCommands
{
    public static int PrintStatus(string statusPath)
    {
        if (File.Exists(statusPath))
        {
            Console.WriteLine(File.ReadAllText(statusPath));
            return 0;
        }
        Console.WriteLine(SerializeStatus(new UpdateStatus("FAILED")
        {
            ErrorCode = "UNKNOWN_ERROR",
            Message = "No update status is available.",
        }));
        return 1;
    }

    public static int Repair(string statusPath)
    {
        return Fail(statusPath, "REPAIR_REQUIRES_RECOVERY", "Use the installed Agent recovery action. This command did not modify installation files.");
    }

    public static int Install(string[] args, string statusPath)
    {
        var installerPath = RequireOption(args, "--installer");
        var expectedVersion = NormalizeVersion(ReadOption(args, "--expected-version"));
        using var mutex = new Mutex(false, GetMutexName());
        if (!TryOwnUpdateMutex(mutex)) return UpdateAlreadyRunning(statusPath);
        try
        {
            WriteStatus(statusPath, new UpdateStatus("INSTALLING")
            {
                ExpectedVersion = expectedVersion,
                InstallerPath = installerPath,
                Message = "Starting Desktop Agent installer.",
            });
            return AgentInstallerRunner.Run(statusPath, installerPath, expectedVersion);
        }
        finally
        {
            mutex.ReleaseMutex();
        }
    }

    public static int Update(string[] args, string statusPath)
    {
        var downloadUrl = RequireOption(args, "--download-url");
        var expectedVersion = RequireVersion(ReadOption(args, "--expected-version"));
        var expectedSha256 = RequireSha256(ReadOption(args, "--expected-sha256"));
        var expectedFileSize = RequireFileSize(ReadOption(args, "--expected-file-size"));
        var signaturePolicy = RequireSignaturePolicy(
            ReadOption(args, "--signature-policy")
        );
        using var mutex = new Mutex(false, GetMutexName());
        if (!TryOwnUpdateMutex(mutex)) return UpdateAlreadyRunning(statusPath);
        try
        {
            return RunUpdate(
                statusPath,
                downloadUrl,
                expectedVersion,
                expectedSha256,
                expectedFileSize,
                signaturePolicy
            );
        }
        finally
        {
            mutex.ReleaseMutex();
        }
    }

    private static int RunUpdate(
        string statusPath,
        string downloadUrl,
        string expectedVersion,
        string expectedSha256,
        long expectedFileSize,
        string signaturePolicy
    )
    {
        var health = AgentInstallerRunner.ReadDesktopAgentHealth();
        if (health.IsReady && health.Version == expectedVersion)
        {
            WriteStatus(statusPath, new UpdateStatus("READY")
            {
                ExpectedVersion = expectedVersion,
                CurrentVersion = health.Version,
                Message = "Desktop Agent already reports the expected version.",
            });
            return 0;
        }
        var installerPath = DownloadAndVerify(
            statusPath,
            downloadUrl,
            expectedVersion,
            expectedSha256,
            expectedFileSize,
            signaturePolicy
        );
        if (installerPath is null) return 1;
        WriteStatus(statusPath, new UpdateStatus("INSTALLING")
        {
            ExpectedVersion = expectedVersion,
            DownloadUrl = downloadUrl,
            InstallerPath = installerPath,
            Message = "Starting Desktop Agent installer.",
        });
        return AgentInstallerRunner.Run(statusPath, installerPath, expectedVersion);
    }

    private static string? DownloadAndVerify(
        string statusPath,
        string downloadUrl,
        string expectedVersion,
        string expectedSha256,
        long expectedFileSize,
        string signaturePolicy
    )
    {
        var updatesRoot = Path.Combine(Path.GetDirectoryName(statusPath)!, "updates");
        Directory.CreateDirectory(updatesRoot);
        var installerPath = Path.Combine(updatesRoot, GetInstallerFileName());
        WriteStatus(statusPath, new UpdateStatus("DOWNLOADING")
        {
            ExpectedVersion = expectedVersion,
            DownloadUrl = downloadUrl,
            InstallerPath = installerPath,
            Message = "Downloading Desktop Agent installer.",
        });
        if (!TryDownload(statusPath, downloadUrl, installerPath)) return null;
        var installer = new FileInfo(installerPath);
        if (
            installer.Exists
            && installer.Length >= GetMinimumInstallerBytes()
            && installer.Length == expectedFileSize
            && string.Equals(
                ComputeSha256(installerPath),
                expectedSha256,
                StringComparison.OrdinalIgnoreCase
            )
        )
        {
            try
            {
                InstallerSignatureVerifier.Verify(installerPath, signaturePolicy);
                return installerPath;
            }
            catch (InvalidDataException error)
            {
                Fail(statusPath, "INSTALLER_VERIFY_FAILED", error.Message);
                return null;
            }
        }
        Fail(
            statusPath,
            "INSTALLER_VERIFY_FAILED",
            "Downloaded Desktop Agent installer failed its size or SHA-256 check."
        );
        return null;
    }

    private static string RequireSignaturePolicy(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "required"
            : value.Trim().ToLowerInvariant();
        return normalized is "required" or "optional"
            ? normalized
            : throw new InvalidOperationException("--signature-policy is invalid.");
    }

    private static bool TryDownload(string statusPath, string url, string installerPath)
    {
        try
        {
            AgentInstallerRunner.Download(url, installerPath);
            return true;
        }
        catch (IOException error) when (IsDiskFull(error))
        {
            Fail(statusPath, "DISK_FULL", error.Message);
        }
        catch (Exception error) when (error is HttpRequestException or OperationCanceledException)
        {
            Fail(statusPath, "DOWNLOAD_FAILED", error.Message);
        }
        return false;
    }

    private static int UpdateAlreadyRunning(string statusPath)
    {
        Console.Error.WriteLine("Another Desktop Agent update is already running. Its status was preserved.");
        return 1;
    }

    private static bool TryOwnUpdateMutex(Mutex mutex)
    {
        try { return mutex.WaitOne(TimeSpan.Zero); }
        catch (AbandonedMutexException) { return true; }
    }

    private static string? NormalizeVersion(string? version)
    {
        return string.IsNullOrWhiteSpace(version) ? null : version;
    }

    private static string RequireVersion(string? value)
    {
        return NormalizeVersion(value)
            ?? throw new InvalidOperationException("--expected-version is required.");
    }

    private static string RequireSha256(string? value)
    {
        return NormalizeSha256(value)
            ?? throw new InvalidOperationException("--expected-sha256 is required.");
    }

    private static long RequireFileSize(string? value)
    {
        return long.TryParse(value, out var parsed) && parsed > 0
            ? parsed
            : throw new InvalidOperationException("--expected-file-size is required.");
    }

    private static string? NormalizeSha256(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) return null;
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length != 64 || normalized.Any(character => !Uri.IsHexDigit(character)))
        {
            throw new InvalidOperationException("--expected-sha256 is invalid.");
        }
        return normalized;
    }

    private static string ComputeSha256(string path)
    {
        using var stream = File.OpenRead(path);
        return Convert.ToHexString(SHA256.HashData(stream)).ToLowerInvariant();
    }
}
