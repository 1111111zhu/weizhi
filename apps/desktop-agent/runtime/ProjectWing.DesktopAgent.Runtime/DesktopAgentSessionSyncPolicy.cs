using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentSessionSyncPolicy
{
    public static async Task<string> HashLocalFileAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        try
        {
            return await DesktopAgentFileTransfer.HashFileAsync(session.LocalPath, cancellationToken);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            throw new DesktopAgentRuntimeException(
                "LOCAL_FILE_MISSING",
                "The tracked local file is no longer in the controlled cache.",
                StatusCodes.Status409Conflict
            );
        }
    }

    public static void EnsureLifecycle(
        DesktopAgentSyncSession session,
        IReadOnlyCollection<string> allowed
    )
    {
        if (!allowed.Contains(session.LifecycleState))
        {
            throw new DesktopAgentRuntimeException(
                "LOCAL_FILE_BUSY_OR_OPEN",
                "The tracked local file has not been closed.",
                StatusCodes.Status409Conflict
            );
        }
    }

    public static DesktopAgentReleaseOperation BuildReleaseOperation(
        DesktopAgentSyncSession session,
        Uri releaseUrl
    )
    {
        return new DesktopAgentReleaseOperation
        {
            Session = session,
            Url = releaseUrl,
            Reason = session.PendingReleaseReason ?? throw StateChanged(),
            ReleaseHash = session.PendingReleaseHash ?? throw StateChanged(),
        };
    }

    public static DesktopAgentUploadContext BuildUploadContext(
        DesktopAgentSyncSession session,
        Uri url,
        string hash,
        string? sourcePath = null
    )
    {
        return new DesktopAgentUploadContext
        {
            Url = url,
            ProjectId = session.ProjectId,
            AttachmentId = session.AttachmentId,
            BaseVersion = session.BaseVersion ?? 1,
            BaseVersionId = session.BaseVersionId,
            LockEpoch = session.LockEpoch,
            LocalContentHash = hash,
            IdempotencyKey = $"{session.LockSessionId ?? session.SessionId}:{hash}",
            LocalPath = sourcePath ?? session.LocalPath,
            FileName = session.FileName,
            MimeType = session.MimeType ?? "application/octet-stream",
            DirectUploadSupported = session.DirectUploadSupported,
            UploadAttemptId = session.UploadAttemptId,
            ResumeUploadId = session.UploadId,
            LocalContentCrc64 = session.SnapshotCrc64,
            GrantSecret = session.GrantSecret,
        };
    }

    public static DesktopAgentReleaseContext BuildReleaseContext(
        DesktopAgentReleaseOperation operation
    )
    {
        return new DesktopAgentReleaseContext
        {
            Url = operation.Url,
            ProjectId = operation.Session.ProjectId,
            AttachmentId = operation.Session.AttachmentId,
            GrantSecret = operation.Session.GrantSecret,
            LockEpoch = operation.Session.LockEpoch,
            Reason = operation.Reason,
        };
    }

    public static void ApplyCheckingIn(JsonObject node, string hash)
    {
        node["lifecycleState"] = "CHECKING_IN";
        node["status"] = "CHECKING_IN";
        node["contentState"] = "DIRTY";
        node["lastKnownHash"] = hash;
        node["lastUploadAttemptAt"] = DateTime.UtcNow.ToString("O");
    }

    public static void ApplyReleasePending(JsonObject node, string hash, string reason)
    {
        node["lifecycleState"] = "RELEASE_PENDING";
        node["status"] = "RELEASE_PENDING";
        node["contentState"] = reason == "CHECKED_IN" ? "UPLOADED" : "UNCHANGED";
        node["lastKnownHash"] = hash;
        node["pendingReleaseReason"] = reason;
        node["pendingReleaseHash"] = hash;
        node["retryCount"] = 0;
        node.Remove("uploadAttemptId");
        node.Remove("uploadId");
        node.Remove("lastError");
    }

    public static void ApplyReleasing(JsonObject node)
    {
        node["lifecycleState"] = "RELEASING";
        node["status"] = "RELEASING";
        node["lastReleaseAttemptAt"] = DateTime.UtcNow.ToString("O");
    }

    public static void ApplyCleanupPending(JsonObject node)
    {
        node["lifecycleState"] = "CLEANUP_PENDING";
        node["status"] = "CLEANUP_PENDING";
        node["lastCleanupAttemptAt"] = DateTime.UtcNow.ToString("O");
        node["retryCount"] = 0;
        node.Remove("lastError");
    }

    public static void ApplyRemoteFailure(
        JsonObject node,
        string stage,
        DesktopAgentRuntimeException error
    )
    {
        var lifecycle = error.Code switch
        {
            "CONFLICT_RISK" => "CONFLICT_RISK",
            "LOCK_REVOKED" or "LOCK_SESSION_MISMATCH" => "LEASE_LOST",
            _ when stage == "CHECK_IN" => "CHECKIN_FAILED",
            _ => "RELEASE_FAILED",
        };
        node["lifecycleState"] = lifecycle;
        node["status"] = lifecycle;
        node["lastError"] = error.Message;
        node["retryCount"] = ReadInt(node, "retryCount") + 1;
    }

    public static string ReadString(JsonObject node, string name)
    {
        return node[name]?.GetValue<string>() ?? string.Empty;
    }

    public static DesktopAgentRuntimeException StateChanged()
    {
        return new DesktopAgentRuntimeException(
            "SESSION_STATE_CHANGED",
            "Tracked file session state changed.",
            StatusCodes.Status409Conflict
        );
    }

    private static int ReadInt(JsonObject node, string name)
    {
        return node[name]?.GetValue<int>() ?? 0;
    }
}
