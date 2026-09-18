using System.Diagnostics;
using System.Text.RegularExpressions;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentUpdateOrchestrator(
    DesktopAgentRuntimeOptions options,
    DesktopAgentUpdateServices services
)
{
    private static readonly TimeSpan SessionPollInterval = TimeSpan.FromSeconds(1);
    private readonly object stateLock = new();
    private DesktopAgentUpdateStatus? current;

    public async Task<DesktopAgentUpdateStatus> StartAsync(
        DesktopAgentUpdateRequest request,
        CancellationToken cancellationToken
    )
    {
        var expectedVersion = RequireVersion(request.ExpectedVersion);
        var expectedSha256 = RequireSha256(request.ExpectedSha256);
        var expectedFileSize = RequireFileSize(request.ExpectedFileSize);
        var signaturePolicy = RequireSignaturePolicy(request.SignaturePolicy);
        var downloadUrl = NormalizeDownloadUrl(
            request.DownloadUrl,
            options.UpdateDownloadUrl
        );
        var task = CreateTask(
            expectedVersion,
            expectedSha256,
            expectedFileSize,
            downloadUrl,
            signaturePolicy
        );
        var initial = expectedVersion == options.Version
            ? BuildStatus(
                task,
                "READY",
                "Desktop Agent already reports the expected version."
            )
            : task.Status;
        lock (stateLock)
        {
            if (current is not null && IsActive(current.Status))
            {
                return current with
                {
                    Status = "IN_PROGRESS",
                    Stage = "IN_PROGRESS",
                    Message = "Desktop Agent update is already running.",
                };
            }
            current = initial;
        }
        await services.StatusStore.WriteAsync(initial, cancellationToken);
        if (expectedVersion == options.Version)
        {
            return initial;
        }
        _ = Task.Run(() => RunAsync(task), CancellationToken.None);
        return initial;
    }

    private async Task RunAsync(DesktopAgentUpdateTask task)
    {
        var cancellationToken = services.ApplicationLifetime.ApplicationStopping;
        try
        {
            while (true)
            {
                var resolution = await services.SessionResolver.ResolveOnceAsync(cancellationToken);
                if (resolution == DesktopAgentUpdateResolution.Ready)
                {
                    break;
                }
                var status = resolution == DesktopAgentUpdateResolution.WaitingForClose
                    ? "WAITING_FOR_WORKBOOK_CLOSE"
                    : "RELEASING_SESSIONS";
                var message = resolution == DesktopAgentUpdateResolution.WaitingForClose
                    ? "Close open Master files before Desktop Agent updates."
                    : "Desktop Agent is releasing local Master sessions.";
                await WriteTaskStatusAsync(new DesktopAgentUpdateTransition
                {
                    Task = task,
                    Status = status,
                    Message = message,
                }, cancellationToken);
                await Task.Delay(SessionPollInterval, cancellationToken);
            }
            await WriteTaskStatusAsync(new DesktopAgentUpdateTransition
            {
                Task = task,
                Status = "IN_PROGRESS",
                Message = "Desktop Agent manager is taking over the update.",
            }, cancellationToken);
            StartManagerUpdate(
                task.DownloadUrl,
                task.ExpectedVersion,
                task.ExpectedSha256,
                task.ExpectedFileSize,
                task.SignaturePolicy
            );
        }
        catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
        {
            // Application shutdown owns the final persisted state.
        }
        catch (DesktopAgentRuntimeException error)
        {
            await WriteFailureAsync(task, error.Code, error.Message);
        }
        catch (Exception error)
        {
            await WriteFailureAsync(task, "UNKNOWN_ERROR", error.Message);
        }
    }

    private void StartManagerUpdate(
        string downloadUrl,
        string expectedVersion,
        string expectedSha256,
        long expectedFileSize,
        string signaturePolicy
    )
    {
        if (!OperatingSystem.IsWindows() && !OperatingSystem.IsMacOS())
        {
            throw new DesktopAgentRuntimeException(
                "UNKNOWN_ERROR",
                "Automatic updates are not yet configured for this platform.",
                StatusCodes.Status501NotImplemented
            );
        }
        var isDll = options.ManagerPath.EndsWith(".dll", StringComparison.OrdinalIgnoreCase);
        var startInfo = new ProcessStartInfo(isDll ? "dotnet" : options.ManagerPath)
        {
            UseShellExecute = false,
            CreateNoWindow = true,
        };
        if (isDll)
        {
            startInfo.ArgumentList.Add(options.ManagerPath);
        }
        startInfo.ArgumentList.Add("update");
        AddOption(startInfo, "download-url", downloadUrl);
        AddOption(startInfo, "expected-version", expectedVersion);
        AddOption(startInfo, "expected-sha256", expectedSha256);
        AddOption(startInfo, "expected-file-size", expectedFileSize.ToString());
        AddOption(startInfo, "signature-policy", signaturePolicy);
        startInfo.Environment["PROJECT_WING_AGENT_STATE_ROOT"] = options.StateRoot;
        using var process = Process.Start(startInfo)
            ?? throw new InvalidOperationException("Could not start Desktop Agent manager.");
    }

    private async Task WriteTaskStatusAsync(
        DesktopAgentUpdateTransition transition,
        CancellationToken cancellationToken
    )
    {
        await SetStatusAsync(
            BuildStatus(transition.Task, transition.Status, transition.Message),
            cancellationToken
        );
    }

    private async Task WriteFailureAsync(
        DesktopAgentUpdateTask task,
        string errorCode,
        string message
    )
    {
        var failed = BuildStatus(task, "FAILED", message) with { ErrorCode = errorCode };
        await SetStatusAsync(failed, CancellationToken.None);
    }

    private async Task SetStatusAsync(
        DesktopAgentUpdateStatus status,
        CancellationToken cancellationToken
    )
    {
        lock (stateLock)
        {
            current = status;
        }
        await services.StatusStore.WriteAsync(status, cancellationToken);
    }

    private DesktopAgentUpdateTask CreateTask(
        string expectedVersion,
        string expectedSha256,
        long expectedFileSize,
        string downloadUrl,
        string signaturePolicy
    )
    {
        var now = DateTime.UtcNow.ToString("O");
        var taskId = Guid.NewGuid().ToString();
        return new DesktopAgentUpdateTask
        {
            TaskId = taskId,
            ExpectedVersion = expectedVersion,
            ExpectedSha256 = expectedSha256,
            ExpectedFileSize = expectedFileSize,
            DownloadUrl = downloadUrl,
            SignaturePolicy = signaturePolicy,
            StartedAt = now,
            Status = new DesktopAgentUpdateStatus
            {
                Ok = true,
                Status = "STARTED",
                Stage = "STARTED",
                TaskId = taskId,
                ExpectedVersion = expectedVersion,
                CurrentVersion = options.Version,
                DownloadUrl = downloadUrl,
                Message = "Desktop Agent update started.",
                StartedAt = now,
                UpdatedAt = now,
            },
        };
    }

    private static DesktopAgentUpdateStatus BuildStatus(
        DesktopAgentUpdateTask task,
        string status,
        string message
    )
    {
        return task.Status with
        {
            Status = status,
            Stage = status,
            Message = message,
            UpdatedAt = DateTime.UtcNow.ToString("O"),
        };
    }

    private static string RequireVersion(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw InvalidUpdateRequest();
        }
        var normalized = value.Trim();
        if (!VersionPattern().IsMatch(normalized))
        {
            throw new DesktopAgentRuntimeException(
                "VALIDATION_FAILED",
                "Update request is invalid.",
                StatusCodes.Status400BadRequest
            );
        }
        return normalized;
    }

    private static string RequireSha256(string? value)
    {
        if (string.IsNullOrWhiteSpace(value)) throw InvalidUpdateRequest();
        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length != 64 || normalized.Any(character => !Uri.IsHexDigit(character)))
        {
            throw new DesktopAgentRuntimeException(
                "VALIDATION_FAILED",
                "Update request is invalid.",
                StatusCodes.Status400BadRequest
            );
        }
        return normalized;
    }

    private static long RequireFileSize(long? value)
    {
        if (value is null || value <= 0)
        {
            throw InvalidUpdateRequest();
        }
        return value.Value;
    }

    private static string RequireSignaturePolicy(string? value)
    {
        var normalized = string.IsNullOrWhiteSpace(value)
            ? "required"
            : value.Trim().ToLowerInvariant();
        if (normalized is not ("required" or "optional"))
        {
            throw InvalidUpdateRequest();
        }
        return normalized;
    }

    private static DesktopAgentRuntimeException InvalidUpdateRequest()
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            "Update request is invalid.",
            StatusCodes.Status400BadRequest
        );
    }

    private static string NormalizeDownloadUrl(
        string? requestedUrl,
        string configuredUrl
    )
    {
        if (
            string.IsNullOrWhiteSpace(requestedUrl)
            || !Uri.TryCreate(requestedUrl, UriKind.Absolute, out var requested)
            || !Uri.TryCreate(configuredUrl, UriKind.Absolute, out var configured)
            || !string.Equals(
                requested.Scheme,
                configured.Scheme,
                StringComparison.OrdinalIgnoreCase
            )
            || !string.Equals(
                requested.Authority,
                configured.Authority,
                StringComparison.OrdinalIgnoreCase
            )
            || !requested.AbsolutePath.Contains(
                "/downloads/desktop-agent/windows/releases/",
                StringComparison.Ordinal
            )
        )
        {
            throw new DesktopAgentRuntimeException(
                "VALIDATION_FAILED",
                "Update download URL is not trusted.",
                StatusCodes.Status400BadRequest
            );
        }
        return requested.ToString();
    }

    private static bool IsActive(string status)
    {
        return status is not ("READY" or "FAILED");
    }

    private static void AddOption(ProcessStartInfo startInfo, string name, string value)
    {
        startInfo.ArgumentList.Add($"--{name}");
        startInfo.ArgumentList.Add(value);
    }

    [GeneratedRegex(@"^\d+\.\d+\.\d+(?:[-+].*)?$")]
    private static partial Regex VersionPattern();
}

public sealed record DesktopAgentUpdateTask
{
    public required string TaskId { get; init; }
    public required string ExpectedVersion { get; init; }
    public required string ExpectedSha256 { get; init; }
    public required long ExpectedFileSize { get; init; }
    public required string DownloadUrl { get; init; }
    public required string SignaturePolicy { get; init; }
    public required string StartedAt { get; init; }
    public required DesktopAgentUpdateStatus Status { get; init; }
}

public sealed record DesktopAgentUpdateTransition
{
    public required DesktopAgentUpdateTask Task { get; init; }
    public required string Status { get; init; }
    public required string Message { get; init; }
}

public sealed class DesktopAgentUpdateServices(
    DesktopAgentUpdateStatusReader statusStore,
    DesktopAgentUpdateSessionResolver sessionResolver,
    IHostApplicationLifetime applicationLifetime
)
{
    public DesktopAgentUpdateStatusReader StatusStore { get; } = statusStore;
    public DesktopAgentUpdateSessionResolver SessionResolver { get; } = sessionResolver;
    public IHostApplicationLifetime ApplicationLifetime { get; } = applicationLifetime;
}
