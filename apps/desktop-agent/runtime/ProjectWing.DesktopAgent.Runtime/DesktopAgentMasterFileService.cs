using System.Diagnostics;
using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentMasterFileService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentRuntimeState state,
    DesktopAgentFileTransfer transfer,
    DesktopAgentFileLauncher launcher,
    DesktopAgentSessionEvents sessionEvents,
    ILogger<DesktopAgentMasterFileService> logger
)
{
    private const int InitialSessionGeneration = 1;
    private const int ObservationPollMilliseconds = 100;

    public async Task<DesktopAgentOpenResponse> OpenAsync(
        DesktopAgentValidatedOpenRequest request,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var timer = Stopwatch.StartNew();
        await GuardMasterSessionAsync(request, cancellationToken);
        var guardedAt = timer.ElapsedMilliseconds;
        var seed = await PrepareSessionAsync(request, authorization, cancellationToken);
        var preparedAt = timer.ElapsedMilliseconds;
        sessionEvents.BeginOpenObservationWait(seed.SessionId);
        try
        {
            DesktopAgentMasterLaunchResult launch;
            try
            {
                launch = await launcher.LaunchMasterAsync(
                    BuildLaunchContext(seed),
                    cancellationToken
                );
            }
            catch (DesktopAgentRuntimeException error)
            {
                await RecordLaunchFailureAsync(seed, error.Message, cancellationToken);
                throw;
            }
            await RecordLaunchResultAsync(seed, launch, cancellationToken);
            var launchedAt = timer.ElapsedMilliseconds;
            await WaitForOpenObservationAsync(seed, cancellationToken);
            logger.LogInformation(
                "Desktop open {RequestId} stages for attachment {AttachmentId}: guard={GuardMs} ms, prepare={PrepareMs} ms, launch={LaunchMs} ms, observation={ObservationMs} ms.",
                request.RequestId,
                request.AttachmentId,
                guardedAt,
                preparedAt - guardedAt,
                launchedAt - preparedAt,
                timer.ElapsedMilliseconds - launchedAt
            );
        }
        finally
        {
            sessionEvents.EndOpenObservationWait(seed.SessionId);
        }
        return new DesktopAgentOpenResponse
        {
            Ok = true,
            RequestId = request.RequestId,
            SessionId = seed.SessionId,
            LocalPath = seed.LocalPath,
            OpenedAt = seed.OpenedAt,
        };
    }

    private async Task<MasterSessionSeed> PrepareSessionAsync(
        DesktopAgentValidatedOpenRequest request,
        string authorization,
        CancellationToken cancellationToken
    )
    {
        var localPath = DesktopAgentPathPolicy.BuildMasterPath(
            options.CacheRoot,
            new DesktopAgentPathRequest
            {
                ProjectId = request.ProjectId,
                AttachmentId = request.AttachmentId,
                FileName = request.FileName,
                SessionSegment = request.LockSessionId!,
            }
        );
        var transferResult = await transfer.DownloadForOpenAsync(
            request,
            localPath,
            authorization,
            makeReadOnly: false,
            cancellationToken
        );
        var seed = new MasterSessionSeed
        {
            SessionId = Guid.NewGuid().ToString(),
            LocalPath = localPath,
            Hash = transferResult.Sha256,
            OpenSignalToken = Guid.NewGuid().ToString(),
            CloseSignalToken = Guid.NewGuid().ToString(),
            OpenedAt = DateTime.UtcNow.ToString("O"),
        };
        await PersistSessionAsync(request, seed, cancellationToken);
        return seed;
    }

    private async Task GuardMasterSessionAsync(
        DesktopAgentValidatedOpenRequest request,
        CancellationToken cancellationToken
    )
    {
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        var matching = sessions.Where(session =>
            ReadString(session, "mode") == "MASTER"
            && ReadString(session, "projectId") == request.ProjectId
            && ReadString(session, "attachmentId") == request.AttachmentId
            && IsActiveSession(session)
        ).ToArray();
        if (matching.Any(session =>
            ReadString(session, "lockSessionId") == request.LockSessionId))
        {
            throw new DesktopAgentRuntimeException(
                "SESSION_ALREADY_OPEN",
                "This Master file is already being tracked locally.",
                StatusCodes.Status409Conflict
            );
        }
        foreach (var session in matching)
        {
            await RevokeSessionAsync(ReadString(session, "sessionId")!, cancellationToken);
        }
    }

    private async Task PersistSessionAsync(
        DesktopAgentValidatedOpenRequest request,
        MasterSessionSeed seed,
        CancellationToken cancellationToken
    )
    {
        await state.UpsertSessionAsync(
            new DesktopAgentSession
            {
                SessionId = seed.SessionId,
                Generation = InitialSessionGeneration,
                Mode = "MASTER",
                ProjectId = request.ProjectId,
                AttachmentId = request.AttachmentId,
                FileName = request.FileName,
                LocalPath = seed.LocalPath,
                OriginalHash = seed.Hash,
                LastKnownHash = seed.Hash,
                Status = "OPEN_UNCHANGED",
                LifecycleState = "LAUNCHING",
                ContentState = "UNCHANGED",
                OpenedAt = seed.OpenedAt,
                LaunchStartedAt = seed.OpenedAt,
                LastSeenAt = seed.OpenedAt,
                CheckInUrl = request.CheckInUrl,
                ReleaseUrl = request.ReleaseUrl,
                LockSessionId = request.LockSessionId,
                BaseVersion = request.BaseVersion,
                BaseVersionId = request.BaseVersionId,
                LockEpoch = request.LockEpoch,
                CacheVersionId = request.CacheVersionId,
                CacheOwnerId = request.CacheOwnerId,
                FileSize = request.FileSize,
                ContentToken = request.ContentToken,
                ContentHash = request.ContentHash,
                GrantSecret = request.GrantSecret,
                DirectUploadSupported = request.DirectUploadSupported,
                MimeType = request.MimeType,
                OpenSignalToken = seed.OpenSignalToken,
                CloseSignalToken = seed.CloseSignalToken,
                RetryCount = 0,
            },
            cancellationToken
        );
    }

    private async Task RecordLaunchResultAsync(
        MasterSessionSeed seed,
        DesktopAgentMasterLaunchResult launch,
        CancellationToken cancellationToken
    )
    {
        if (launch.HelperProcessId is not null)
        {
            await state.MutateSessionAsync(
                seed.SessionId,
                new DesktopAgentSessionMutation(
                    _ => true,
                    node =>
                    {
                        node["excelHelperProcessId"] = launch.HelperProcessId;
                        node["observerProcessId"] = launch.HelperProcessId;
                        node["observerKind"] = launch.ObserverKind;
                        node["observerExecutablePath"] =
                            launch.ObserverExecutablePath;
                    }
                ),
                cancellationToken
            );
        }
        if (launch.OpenObservedOnLaunch)
        {
            await sessionEvents.RecordOpenObservedAsync(
                seed.SessionId,
                new DesktopAgentOpenObservedRequest(
                    InitialSessionGeneration,
                    seed.OpenSignalToken,
                    "LAUNCHER_PROCESS"
                ),
                cancellationToken
            );
        }
    }

    private async Task WaitForOpenObservationAsync(
        MasterSessionSeed seed,
        CancellationToken cancellationToken
    )
    {
        var deadline = DateTime.UtcNow + options.MasterOpenObservationTimeout;
        while (DateTime.UtcNow <= deadline)
        {
            var session = await state.ReadSessionAsync(seed.SessionId, cancellationToken);
            var receipt = sessionEvents.ReadOpenObservationReceipt(seed.SessionId);
            if (receipt?.Observed == true)
            {
                if (receipt.Closed) throw EditorClosedAfterOpen();
                if (session is null || ReadString(session.Value, "lifecycleState") == "OPEN")
                {
                    return;
                }
            }
            if (session is not null)
            {
                var lifecycle = ReadString(session.Value, "lifecycleState");
                if (ReadString(session.Value, "openObservedAt") is not null)
                {
                    if (lifecycle == "OPEN") return;
                    throw EditorClosedAfterOpen();
                }
                if (lifecycle == "LAUNCH_FAILED")
                {
                    throw OpenFailed(ReadString(session.Value, "lastError"));
                }
            }
            await Task.Delay(ObservationPollMilliseconds, cancellationToken);
        }
        await sessionEvents.RecordLaunchFailedAsync(
            seed.SessionId,
            new DesktopAgentLaunchFailedRequest
            {
                Generation = InitialSessionGeneration,
                OpenSignalToken = seed.OpenSignalToken,
                Reason = "OPEN_OBSERVATION_TIMEOUT",
                Message = "Desktop Agent could not confirm that the file became visible.",
            },
            cancellationToken
        );
        var finalSession = await state.ReadSessionAsync(seed.SessionId, cancellationToken);
        var finalReceipt = sessionEvents.ReadOpenObservationReceipt(seed.SessionId);
        if (finalReceipt?.Observed == true)
        {
            if (finalReceipt.Closed) throw EditorClosedAfterOpen();
            if (finalSession is null || ReadString(finalSession.Value, "lifecycleState") == "OPEN")
            {
                return;
            }
        }
        if (finalSession is not null
            && ReadString(finalSession.Value, "openObservedAt") is not null)
        {
            if (ReadString(finalSession.Value, "lifecycleState") == "OPEN") return;
            throw EditorClosedAfterOpen();
        }
        if (finalSession is not null
            && ReadString(finalSession.Value, "lifecycleState") == "LAUNCH_FAILED")
        {
            throw OpenFailed(ReadString(finalSession.Value, "lastError"));
        }
        throw OpenObservationTimedOut();
    }

    private async Task RecordLaunchFailureAsync(
        MasterSessionSeed seed,
        string message,
        CancellationToken cancellationToken
    )
    {
        await sessionEvents.RecordLaunchFailedAsync(
            seed.SessionId,
            new DesktopAgentLaunchFailedRequest
            {
                Generation = InitialSessionGeneration,
                OpenSignalToken = seed.OpenSignalToken,
                Reason = "WATCHER_START_FAILED",
                Message = message,
            },
            cancellationToken
        );
    }

    private async Task RevokeSessionAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        await state.MutateSessionAsync(
            sessionId,
            new DesktopAgentSessionMutation(
                _ => true,
                node =>
                {
                    node["status"] = "LOCK_REVOKED";
                    node["lifecycleState"] = "LOCK_REVOKED";
                    node["lastError"] = "A newer Master session was opened for this file.";
                }
            ),
            cancellationToken
        );
    }

    private static DesktopAgentMasterLaunchContext BuildLaunchContext(MasterSessionSeed seed)
    {
        return new DesktopAgentMasterLaunchContext
        {
            LocalPath = seed.LocalPath,
            SessionId = seed.SessionId,
            Generation = InitialSessionGeneration,
            OpenSignalToken = seed.OpenSignalToken,
            CloseSignalToken = seed.CloseSignalToken,
        };
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static bool IsActiveSession(JsonElement session)
    {
        return ReadString(session, "lifecycleState") is not (
            "CLOSED" or "LOCAL_FILE_MISSING" or "LOCK_REVOKED"
        );
    }

    private static DesktopAgentRuntimeException OpenFailed(string? message)
    {
        return new DesktopAgentRuntimeException(
            "OPEN_FAILED",
            message ?? "Could not open the selected file.",
            StatusCodes.Status500InternalServerError
        );
    }

    private static DesktopAgentRuntimeException OpenObservationTimedOut()
    {
        return new DesktopAgentRuntimeException(
            "OPEN_OBSERVATION_TIMEOUT",
            "Desktop Agent could not confirm that the file became visible.",
            StatusCodes.Status504GatewayTimeout
        );
    }

    private static DesktopAgentRuntimeException EditorClosedAfterOpen()
    {
        return new DesktopAgentRuntimeException(
            "EDITOR_CLOSED_AFTER_OPEN",
            "The file opened, but the Office window closed before Desktop Agent could finish confirming it.",
            StatusCodes.Status409Conflict
        );
    }

    private sealed record MasterSessionSeed
    {
        public required string SessionId { get; init; }
        public required string LocalPath { get; init; }
        public required string Hash { get; init; }
        public required string OpenSignalToken { get; init; }
        public required string CloseSignalToken { get; init; }
        public required string OpenedAt { get; init; }
    }
}
