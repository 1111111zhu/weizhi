using System.Text.Json;
using System.Text.Json.Nodes;
using static ProjectWing.DesktopAgent.Runtime.DesktopAgentSessionSyncPolicy;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentSessionSyncService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentRuntimeState state,
    DesktopAgentSessionRemoteClient remoteClient,
    DesktopAgentUploadSnapshotService snapshotService,
    DesktopAgentCacheService cache,
    DesktopAgentTransferDiagnosticLog diagnosticLog
)
{
    private readonly System.Collections.Concurrent.ConcurrentDictionary<
        string,
        SemaphoreSlim
    > sessionLocks = new();

    public async Task<DesktopAgentSessionResponse> CheckInAsync(
        string sessionId,
        DesktopAgentCheckInRequest request,
        CancellationToken cancellationToken
    )
    {
        var gate = sessionLocks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            try
            {
                return await CheckInCoreAsync(sessionId, request, cancellationToken);
            }
            catch (Exception error) when (!cancellationToken.IsCancellationRequested)
            {
                await RecoverUnexpectedFailureAsync(
                    sessionId,
                    error,
                    CancellationToken.None
                );
                throw;
            }
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<DesktopAgentSessionResponse> CheckInCoreAsync(
        string sessionId,
        DesktopAgentCheckInRequest request,
        CancellationToken cancellationToken
    )
    {
        var session = await ReadSessionAsync(sessionId, cancellationToken);
        var releaseUrl = ReadAllowedUrl(request.ReleaseUrl);
        // The tray uses check-in for safe sync-and-release, including recovery
        // states whose server lease was already released by an earlier attempt.
        if (session.LifecycleState is "CLEANUP_PENDING" or "CLEANUP_FAILED")
            return await RecoverCleanupCoreAsync(sessionId, cancellationToken) ?? throw StateChanged();
        if (session.LifecycleState == "LEASE_LOST")
        {
            var recovered = await RecoverUnchangedLeaseLostAsync(session, cancellationToken);
            if (recovered is not null) return recovered;
        }
        if (session.LifecycleState is not ("RELEASE_PENDING" or "RELEASE_FAILED"))
        {
            session = await PrepareCheckInAsync(session, request, cancellationToken);
        }
        return await ReleaseAndCleanupAsync(
            BuildReleaseOperation(session, releaseUrl),
            cancellationToken
        );
    }

    public async Task<DesktopAgentSessionResponse> ReleaseAsync(
        string sessionId,
        DesktopAgentReleaseRequest request,
        CancellationToken cancellationToken
    )
    {
        var gate = sessionLocks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            try
            {
                return await ReleaseCoreAsync(sessionId, request, cancellationToken);
            }
            catch (Exception error) when (!cancellationToken.IsCancellationRequested)
            {
                await RecoverUnexpectedFailureAsync(
                    sessionId,
                    error,
                    CancellationToken.None
                );
                throw;
            }
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task<DesktopAgentSessionResponse?> RecoverCleanupAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        var gate = sessionLocks.GetOrAdd(sessionId, _ => new SemaphoreSlim(1, 1));
        await gate.WaitAsync(cancellationToken);
        try
        {
            return await RecoverCleanupCoreAsync(sessionId, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task RecoverUnexpectedFailureAsync(
        string sessionId,
        Exception error,
        CancellationToken cancellationToken
    )
    {
        var message = $"Unexpected local failure: {error.Message}";
        await state.MutateSessionAsync(
            sessionId,
            new DesktopAgentSessionMutation(
                node => ReadString(node, "lifecycleState")
                    is "CHECKING_IN" or "RELEASING" or "CLEANUP_PENDING",
                node =>
                {
                    var lifecycle = ReadString(node, "lifecycleState") switch
                    {
                        "CHECKING_IN" => "CHECKIN_FAILED",
                        "RELEASING" => "RELEASE_FAILED",
                        _ => "CLEANUP_FAILED",
                    };
                    node["lifecycleState"] = lifecycle;
                    node["status"] = lifecycle;
                    node["lastError"] = message;
                    node["retryCount"] = ReadRetryCount(node) + 1;
                }
            ),
            cancellationToken
        );
    }

    private async Task<DesktopAgentSessionResponse> ReleaseCoreAsync(
        string sessionId,
        DesktopAgentReleaseRequest request,
        CancellationToken cancellationToken
    )
    {
        var session = await ReadSessionAsync(sessionId, cancellationToken);
        var releaseUrl = ReadAllowedUrl(request.ReleaseUrl);
        if (session.LifecycleState is "CLEANUP_PENDING" or "CLEANUP_FAILED")
        {
            return await RecoverCleanupCoreAsync(sessionId, cancellationToken)
                ?? throw StateChanged();
        }
        if (session.LifecycleState == "LEASE_LOST")
        {
            var recovered = await RecoverUnchangedLeaseLostAsync(
                session,
                cancellationToken
            );
            if (recovered is not null) return recovered;
        }
        if (session.LifecycleState is not ("RELEASE_PENDING" or "RELEASE_FAILED"))
        {
            // Release is not discard. The same upload/verification rules apply
            // whether synchronization is requested by the tray or background worker.
            var value = await state.ReadSessionAsync(sessionId, cancellationToken)
                ?? throw StateChanged();
            var checkInUrl = value.TryGetProperty("checkInUrl", out var url)
                && url.ValueKind == JsonValueKind.String ? url.GetString() : null;
            session = await PrepareCheckInAsync(session, new DesktopAgentCheckInRequest
            {
                CheckInUrl = checkInUrl,
                ReleaseUrl = request.ReleaseUrl,
            }, cancellationToken);
        }
        return await ReleaseAndCleanupAsync(
            BuildReleaseOperation(session, releaseUrl),
            cancellationToken
        );
    }

    private async Task<DesktopAgentSessionResponse?> RecoverCleanupCoreAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        var value = await state.ReadSessionAsync(sessionId, cancellationToken);
        if (value is null) return null;
        var session = DesktopAgentSyncSession.From(value.Value);
        if (session.LifecycleState is not ("CLEANUP_PENDING" or "CLEANUP_FAILED"))
        {
            return null;
        }
        var removed = await CompleteLocalCleanupAsync(
            session,
            ["CLEANUP_PENDING", "CLEANUP_FAILED"],
            cancellationToken
        ) ?? throw StateChanged();
        var closed = JsonNode.Parse(removed.GetRawText())!.AsObject();
        closed["lifecycleState"] = "CLOSED";
        closed["status"] = "CLOSED";
        await state.TryRecordRecentSessionAsync(closed, cancellationToken);
        return new DesktopAgentSessionResponse(
            true,
            JsonSerializer.SerializeToElement(closed)
        );
    }

    private async Task<DesktopAgentSessionResponse?> RecoverUnchangedLeaseLostAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        if (await HashLocalFileAsync(session, cancellationToken) != session.OriginalHash)
        {
            return null;
        }
        if (session.SnapshotPath is not null && File.Exists(session.SnapshotPath)
            && (session.SnapshotHash is null
                || session.SnapshotHash != session.OriginalHash
                    && session.SnapshotHash != session.LastUploadedHash))
            throw new DesktopAgentRuntimeException("LOCAL_CHANGES_PRESERVED",
                "The working file is unchanged, but an unconfirmed upload snapshot remains. Both copies are retained for review.",
                StatusCodes.Status409Conflict);
        // This route has no release checkpoint: bind cleanup to the original
        // bytes just verified, then let its locked recheck catch later changes.
        session = session with { PendingReleaseHash = session.OriginalHash };
        var removed = await CompleteLocalCleanupAsync(
            session,
            ["LEASE_LOST"],
            cancellationToken
        ) ?? throw StateChanged();
        var closed = JsonNode.Parse(removed.GetRawText())!.AsObject();
        closed["lifecycleState"] = "CLOSED";
        closed["status"] = "CLOSED";
        await state.TryRecordRecentSessionAsync(closed, cancellationToken);
        return new DesktopAgentSessionResponse(
            true,
            JsonSerializer.SerializeToElement(closed)
        );
    }

    private async Task<DesktopAgentSyncSession> PrepareCheckInAsync(
        DesktopAgentSyncSession session,
        DesktopAgentCheckInRequest request,
        CancellationToken cancellationToken
    )
    {
        EnsureLifecycle(session, [
            "CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST",
        ]);
        var hasSnapshot = session.SnapshotPath is not null
            && session.SnapshotHash is not null
            && File.Exists(session.SnapshotPath);
        var hash = hasSnapshot
            ? session.SnapshotHash!
            : await HashLocalFileAsync(session, cancellationToken);
        var changed = hash != session.OriginalHash && hash != session.LastUploadedHash;
        if (changed)
        {
            var uploadUrl = ReadAllowedUrl(request.CheckInUrl ?? request.UploadUrl);
            var snapshot = await GetOrCreateSnapshotAsync(session, hash, cancellationToken);
            session = session with
            {
                SnapshotPath = snapshot.Path,
                SnapshotHash = snapshot.Sha256,
                SnapshotCrc64 = snapshot.Crc64,
            };
            await UploadChangedFileAsync(
                session,
                uploadUrl,
                snapshot.Path,
                snapshot.Sha256,
                cancellationToken
            );
            hash = snapshot.Sha256;
        }
        var latestHash = await HashLocalFileAsync(session, cancellationToken);
        if (latestHash != hash)
        {
            // The committed snapshot is safe, but the source was edited again.
            // Keep the lease and let the persisted retry upload the newer bytes.
            await MutateAsync(session, new DesktopAgentSyncMutation
            {
                AllowedLifecycles = ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST"],
                Apply = node =>
                {
                    node["lastUploadedHash"] = hash;
                    node["lastKnownHash"] = latestHash;
                    node["lifecycleState"] = "CHECKIN_FAILED";
                    node["status"] = "CHECKIN_FAILED";
                    node["lastError"] = "Newer local changes were detected after uploading. They are preserved and will synchronize automatically; the editing lease has not been released.";
                    ClearCompletedSnapshot(node);
                },
            }, cancellationToken);
            throw new DesktopAgentRuntimeException("LOCAL_CHANGES_PENDING",
                "Newer local changes are preserved and queued for automatic synchronization.",
                StatusCodes.Status409Conflict);
        }
        var reason = hash == session.OriginalHash ? "UNCHANGED_RELEASE" : "CHECKED_IN";
        return await SetReleaseDecisionAsync(session, hash, reason, cancellationToken);
    }

    private async Task UploadChangedFileAsync(
        DesktopAgentSyncSession session,
        Uri uploadUrl,
        string sourcePath,
        string hash,
        CancellationToken cancellationToken
    )
    {
        await MutateAsync(session, new DesktopAgentSyncMutation
        {
            AllowedLifecycles = [
                "CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST",
            ],
            Apply = node => ApplyCheckingIn(node, hash),
        }, cancellationToken);
        try
        {
            var context = BuildUploadContext(session, uploadUrl, hash, sourcePath) with
            {
                SaveCheckpointAsync = async (attemptId, uploadId) =>
                {
                    await state.MutateSessionAsync(
                        session.SessionId,
                        new DesktopAgentSessionMutation(
                            session.Matches,
                            node =>
                            {
                                node["uploadAttemptId"] = attemptId;
                                if (uploadId is null) node.Remove("uploadId");
                                else node["uploadId"] = uploadId;
                            }
                        ),
                        cancellationToken
                    );
                },
                VerifySnapshotAsync = async () =>
                    await DesktopAgentFileTransfer.HashFileAsync(
                        sourcePath,
                        cancellationToken
                    ) == hash,
            };
            await remoteClient.UploadAsync(
                context,
                cancellationToken
            );
        }
        catch (DesktopAgentRuntimeException error)
        {
            await RecordRemoteFailureAsync(session, "CHECK_IN", error, cancellationToken);
            throw;
        }
    }

    private async Task<DesktopAgentUploadSnapshot> GetOrCreateSnapshotAsync(
        DesktopAgentSyncSession session,
        string currentHash,
        CancellationToken cancellationToken
    )
    {
        if (
            session.SnapshotPath is not null
            && session.SnapshotHash == currentHash
            && File.Exists(session.SnapshotPath)
        )
        {
            var crc64 =
                session.SnapshotCrc64Algorithm == OssCrc64.Algorithm
                && session.SnapshotCrc64 is not null
                    ? session.SnapshotCrc64
                    : await ComputeSnapshotCrc64Async(
                        session.SnapshotPath,
                        cancellationToken
                    );
            if (session.SnapshotCrc64Algorithm != OssCrc64.Algorithm)
            {
                await MutateAsync(session, new DesktopAgentSyncMutation
                {
                    AllowedLifecycles = [
                        "CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST",
                    ],
                    Apply = node =>
                    {
                        node["snapshotCrc64"] = crc64;
                        node["snapshotCrc64Algorithm"] = OssCrc64.Algorithm;
                    },
                }, cancellationToken);
            }
            return new DesktopAgentUploadSnapshot(
                session.SnapshotPath,
                currentHash,
                new FileInfo(session.SnapshotPath).Length,
                crc64
            );
        }
        var snapshot = await snapshotService.CreateAsync(session, cancellationToken);
        if (snapshot.Sha256 != currentHash)
        {
            snapshotService.Delete(snapshot.Path);
            throw new DesktopAgentRuntimeException(
                "LOCAL_FILE_CHANGED_DURING_CHECKIN",
                "The local file changed while the immutable upload snapshot was created.",
                StatusCodes.Status409Conflict
            );
        }
        await MutateAsync(session, new DesktopAgentSyncMutation
        {
            AllowedLifecycles = ["CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST"],
            Apply = node =>
            {
                node["snapshotPath"] = snapshot.Path;
                node["snapshotHash"] = snapshot.Sha256;
                node["snapshotSize"] = snapshot.Size;
                node["snapshotCrc64"] = snapshot.Crc64;
                node["snapshotCrc64Algorithm"] = OssCrc64.Algorithm;
            },
        }, cancellationToken);
        return snapshot;
    }

    private static async Task<string> ComputeSnapshotCrc64Async(
        string path,
        CancellationToken cancellationToken
    )
    {
        var crc = new OssCrc64();
        await using var stream = File.OpenRead(path);
        var buffer = new byte[1024 * 1024];
        int count;
        while ((count = await stream.ReadAsync(buffer, cancellationToken)) > 0)
        {
            crc.Update(buffer.AsSpan(0, count));
        }
        return crc.Decimal;
    }

    private async Task<DesktopAgentSyncSession> SetReleaseDecisionAsync(
        DesktopAgentSyncSession session,
        string hash,
        string reason,
        CancellationToken cancellationToken
    )
    {
        var updated = await MutateAsync(session, new DesktopAgentSyncMutation
        {
            AllowedLifecycles = [
                "CLOSE_DETECTED", "CHECKING_IN", "CHECKIN_FAILED", "LEASE_LOST",
            ],
            Apply = node => ApplyReleasePending(node, hash, reason),
        }, cancellationToken);
        return DesktopAgentSyncSession.From(updated);
    }

    private async Task<DesktopAgentSessionResponse> ReleaseAndCleanupAsync(
        DesktopAgentReleaseOperation operation,
        CancellationToken cancellationToken
    )
    {
        var session = operation.Session;
        await MutateAsync(session, new DesktopAgentSyncMutation
        {
            AllowedLifecycles = ["RELEASE_PENDING", "RELEASE_FAILED"],
            Apply = ApplyReleasing,
        }, cancellationToken);
        try
        {
            await remoteClient.ReleaseAsync(BuildReleaseContext(operation), cancellationToken);
        }
        catch (DesktopAgentRuntimeException error) when (
            error.Code is "LOCK_REVOKED" or "LOCK_SESSION_MISMATCH"
        )
        {
            // The server no longer owns this client's lock. At this point any
            // required upload/check-in has already completed, so retaining the
            // controlled local copy would only create an unrecoverable orphan.
            return await CleanupAsync(operation, cancellationToken);
        }
        catch (DesktopAgentRuntimeException error)
        {
            await RecordRemoteFailureAsync(session, "RELEASE", error, cancellationToken);
            throw;
        }
        return await CleanupAsync(operation, cancellationToken);
    }

    private async Task<DesktopAgentSessionResponse> CleanupAsync(
        DesktopAgentReleaseOperation operation,
        CancellationToken cancellationToken
    )
    {
        var session = operation.Session;
        await MutateAsync(session, new DesktopAgentSyncMutation
        {
            AllowedLifecycles = ["RELEASING"],
            Apply = ApplyCleanupPending,
        }, cancellationToken);
        var removed = await CompleteLocalCleanupAsync(
            session,
            ["CLEANUP_PENDING", "CLEANUP_FAILED"],
            cancellationToken
        ) ?? throw StateChanged();
        var closed = JsonNode.Parse(removed.GetRawText())!.AsObject();
        closed["lifecycleState"] = "CLOSED";
        closed["status"] = "CLOSED";
        closed["lastKnownHash"] = operation.ReleaseHash;
        if (operation.Reason == "CHECKED_IN")
        {
            closed["contentState"] = "UPLOADED";
            closed["lastUploadedHash"] = operation.ReleaseHash;
        }
        await state.TryRecordRecentSessionAsync(closed, cancellationToken);
        return new DesktopAgentSessionResponse(
            true,
            JsonSerializer.SerializeToElement(closed)
        );
    }

    private async Task<JsonElement?> CompleteLocalCleanupAsync(
        DesktopAgentSyncSession session,
        IReadOnlyCollection<string> allowedLifecycles,
        CancellationToken cancellationToken
    )
    {
        try
        {
            // Windows sharing rules prevent a new writer from entering between
            // verification and delete. An already-open writer makes cleanup retry.
            using var cleanupReadLock = File.Exists(session.LocalPath)
                ? new FileStream(session.LocalPath, FileMode.Open, FileAccess.Read, FileShare.Read | FileShare.Delete)
                : null;
            // A file may have been reopened or externally edited after the upload
            // snapshot was taken. Never delete bytes not covered by the release.
            if (File.Exists(session.LocalPath))
            {
                var currentHash = await HashLocalFileAsync(session, cancellationToken);
                if (currentHash != session.PendingReleaseHash)
                {
                    await state.MutateSessionAsync(session.SessionId,
                        new DesktopAgentSessionMutation(session.Matches, node =>
                        {
                            node["lastUploadedHash"] = session.PendingReleaseHash;
                            node["lastKnownHash"] = currentHash;
                            node["lifecycleState"] = "LEASE_LOST";
                            node["status"] = "LEASE_LOST";
                            node["lastError"] = "Newer local changes were preserved after release. Automatic synchronization will retain them as a conflict candidate if the server version has changed.";
                            node.Remove("pendingReleaseHash");
                            node.Remove("pendingReleaseReason");
                            ClearCompletedSnapshot(node);
                        }), cancellationToken);
                    throw new DesktopAgentRuntimeException("LOCAL_CHANGES_PRESERVED",
                        "Newer local changes are preserved and queued for recovery; they were not deleted.",
                        StatusCodes.Status409Conflict);
                }
            }
            DeleteControlledFile(session.SnapshotPath);
            DeleteControlledFile(session.LocalPath);
            await cache.RemoveAsync(session.SnapshotPath, cancellationToken);
            await cache.RemoveAsync(session.LocalPath, cancellationToken);
            if (session.SnapshotPath is not null)
            {
                DeleteEmptyControlledParents(session.SnapshotPath);
            }
            DeleteEmptyControlledParents(session.LocalPath);
            return await state.RemoveSessionAsync(
                session.SessionId,
                node => session.Matches(node)
                    && allowedLifecycles.Contains(ReadString(node, "lifecycleState")),
                cancellationToken
            );
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            await state.MutateSessionAsync(
                session.SessionId,
                new DesktopAgentSessionMutation(
                    session.Matches,
                    node =>
                    {
                        node["lifecycleState"] = "CLEANUP_FAILED";
                        node["status"] = "CLEANUP_FAILED";
                        node["lastError"] = $"Local cleanup failed: {error.Message}";
                        node["retryCount"] = ReadRetryCount(node) + 1;
                        node["lastCleanupAttemptAt"] = DateTime.UtcNow.ToString("O");
                    }
                ),
                cancellationToken
            );
            throw new DesktopAgentRuntimeException(
                "LOCAL_CLEANUP_FAILED",
                "The server lock was released, but controlled local files could not be removed. Desktop Agent will retry.",
                StatusCodes.Status503ServiceUnavailable
            );
        }
    }

    private void DeleteControlledFile(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        var fullPath = Path.GetFullPath(path);
        var cacheRoot = Path.GetFullPath(options.CacheRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
            + Path.DirectorySeparatorChar;
        if (!fullPath.StartsWith(cacheRoot, PathComparison))
        {
            throw new IOException("Refusing to delete a file outside the controlled cache.");
        }
        File.Delete(fullPath);
    }

    private void DeleteEmptyControlledParents(string path)
    {
        var cacheRoot = Path.GetFullPath(options.CacheRoot)
            .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        var directory = Path.GetDirectoryName(Path.GetFullPath(path));
        while (
            directory is not null
            && !string.Equals(directory, cacheRoot, PathComparison)
            && directory.StartsWith(
                cacheRoot + Path.DirectorySeparatorChar,
                PathComparison
            )
        )
        {
            if (Directory.EnumerateFileSystemEntries(directory).Any()) break;
            Directory.Delete(directory);
            directory = Path.GetDirectoryName(directory);
        }
    }

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows()
            ? StringComparison.OrdinalIgnoreCase
            : StringComparison.Ordinal;

    private static int ReadRetryCount(JsonObject node)
    {
        return node["retryCount"]?.GetValue<int>() ?? 0;
    }

    private static void ClearCompletedSnapshot(JsonObject node)
    {
        // Detach only: retained snapshot bytes are never erased by this transition.
        foreach (var key in new[] { "snapshotPath", "snapshotHash", "snapshotCrc64", "snapshotCrc64Algorithm", "snapshotSize", "uploadAttemptId", "uploadId" })
            node.Remove(key);
    }

    private async Task<JsonElement> MutateAsync(
        DesktopAgentSyncSession session,
        DesktopAgentSyncMutation mutation,
        CancellationToken cancellationToken
    )
    {
        return await state.MutateSessionAsync(
            session.SessionId,
            new DesktopAgentSessionMutation(
                node => session.Matches(node)
                    && mutation.AllowedLifecycles.Contains(ReadString(node, "lifecycleState")),
                mutation.Apply
            ),
            cancellationToken
        ) ?? throw StateChanged();
    }

    private async Task RecordRemoteFailureAsync(
        DesktopAgentSyncSession session,
        string stage,
        DesktopAgentRuntimeException error,
        CancellationToken cancellationToken
    )
    {
        diagnosticLog.RecordSyncFailure(stage, error);
        await state.MutateSessionAsync(
            session.SessionId,
            new DesktopAgentSessionMutation(
                session.Matches,
                node => ApplyRemoteFailure(node, stage, error)
            ),
            cancellationToken
        );
    }

    private async Task<DesktopAgentSyncSession> ReadSessionAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        var value = await state.ReadSessionAsync(sessionId, cancellationToken)
            ?? throw new DesktopAgentRuntimeException(
                "SESSION_NOT_FOUND",
                "Tracked file session was not found.",
                StatusCodes.Status404NotFound
            );
        return DesktopAgentSyncSession.From(value);
    }

    private Uri ReadAllowedUrl(string? value)
    {
        if (!Uri.TryCreate(value, UriKind.Absolute, out var uri)
            || uri.Scheme is not ("http" or "https"))
        {
            throw InvalidRequest();
        }
        if (!options.AllowedDownloadOrigins.Contains(uri.GetLeftPart(UriPartial.Authority)))
        {
            throw new DesktopAgentRuntimeException(
                "ORIGIN_NOT_ALLOWED",
                "Upload URL origin is not allowed.",
                StatusCodes.Status403Forbidden
            );
        }
        return uri;
    }

    private static DesktopAgentRuntimeException InvalidRequest()
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            "Session synchronization request is invalid.",
            StatusCodes.Status400BadRequest
        );
    }

}
