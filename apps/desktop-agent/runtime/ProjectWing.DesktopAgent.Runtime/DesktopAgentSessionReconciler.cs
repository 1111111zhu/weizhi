using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentSessionReconciler(
    DesktopAgentRuntimeState state,
    DesktopAgentRuntimeOptions options
)
{
    private static readonly IReadOnlySet<string> NoFileCheckStates = new HashSet<string>(
        ["RELEASE_PENDING", "CLEANUP_PENDING", "CONFLICT_RISK", "CLOSED"],
        StringComparer.Ordinal
    );

    public async Task<IReadOnlyList<JsonElement>> RefreshAsync(
        CancellationToken cancellationToken
    )
    {
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        foreach (var value in sessions)
        {
            await RefreshOneAsync(value, cancellationToken);
        }
        return await state.ReadSessionsAsync(cancellationToken);
    }

    public async Task RefreshSessionAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        var value = await state.ReadSessionAsync(sessionId, cancellationToken);
        if (value is not null) await RefreshOneAsync(value.Value, cancellationToken);
    }

    private async Task RefreshOneAsync(
        JsonElement value,
        CancellationToken cancellationToken
    )
    {
        var session = DesktopAgentSyncSession.From(value);
        await BackfillRemoteUrlsAsync(session, cancellationToken);
        if (NoFileCheckStates.Contains(session.LifecycleState))
        {
            await TouchAsync(session, node => { }, cancellationToken);
            return;
        }
        if (session.LifecycleState is "RELEASING" or "RELEASE_FAILED")
        {
            await TouchAsync(session, ApplyReleasePending, cancellationToken);
            return;
        }
        if (session.LifecycleState == "CHECKING_IN")
        {
            await TouchAsync(session, ApplyCheckInPending, cancellationToken);
            return;
        }
        if (session.LifecycleState == "CLEANUP_FAILED")
        {
            await TouchAsync(session, ApplyCleanupPending, cancellationToken);
            return;
        }
        if (session.LifecycleState == "LOCK_REVOKED")
        {
            await RefreshRevokedSessionAsync(session, cancellationToken);
            return;
        }
        await RefreshFileStateAsync(session, cancellationToken);
    }

    private async Task BackfillRemoteUrlsAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        if (session.LockSessionId is null) return;
        await state.MutateSessionAsync(
            session.SessionId,
            new DesktopAgentSessionMutation(
                session.Matches,
                node =>
                {
                    if (string.IsNullOrWhiteSpace(ReadString(node, "checkInUrl")))
                    {
                        node["checkInUrl"] =
                            DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl(
                                options,
                                session.LockSessionId,
                                "check-in"
                            );
                    }
                    if (string.IsNullOrWhiteSpace(ReadString(node, "releaseUrl")))
                    {
                        node["releaseUrl"] =
                            DesktopAgentRemoteUrlPolicy.BuildMasterSessionUrl(
                                options,
                                session.LockSessionId,
                                "release"
                            );
                    }
                }
            ),
            cancellationToken
        );
    }

    private async Task RefreshRevokedSessionAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(session.LocalPath))
        {
            await TouchAsync(session, ApplyFileMissing, cancellationToken);
            return;
        }
        try
        {
            var hash = await DesktopAgentFileTransfer.HashFileAsync(
                session.LocalPath,
                cancellationToken
            );
            if (hash == session.OriginalHash || hash == session.LastUploadedHash)
            {
                await TouchAsync(
                    session,
                    node =>
                    {
                        node["lastKnownHash"] = hash;
                        node["contentState"] = hash == session.OriginalHash
                            ? "UNCHANGED"
                            : "UPLOADED";
                    },
                    cancellationToken
                );
                return;
            }
            await TouchAsync(
                session,
                node =>
                {
                    node["lastKnownHash"] = hash;
                    node["contentState"] = "DIRTY";
                    node["lifecycleState"] = "LEASE_LOST";
                    node["status"] = "LEASE_LOST";
                    node["lastError"] =
                        "The previous lock was revoked while local changes were pending; the changes will be preserved as a conflict candidate after the file closes.";
                },
                cancellationToken
            );
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            await TouchAsync(session, ApplyHashUnavailable, cancellationToken);
        }
    }

    private async Task RefreshFileStateAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(session.LocalPath))
        {
            await TouchAsync(session, ApplyFileMissing, cancellationToken);
            return;
        }
        try
        {
            var hash = await DesktopAgentFileTransfer.HashFileAsync(
                session.LocalPath,
                cancellationToken
            );
            await TouchAsync(
                session,
                node => ApplyHashResult(node, session, hash),
                cancellationToken
            );
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            await TouchAsync(session, ApplyHashUnavailable, cancellationToken);
        }
    }

    private async Task TouchAsync(
        DesktopAgentSyncSession session,
        Action<JsonObject> apply,
        CancellationToken cancellationToken
    )
    {
        await state.MutateSessionAsync(
            session.SessionId,
            new DesktopAgentSessionMutation(
                node => session.Matches(node)
                    && ReadString(node, "lifecycleState") == session.LifecycleState,
                apply
            ),
            cancellationToken
        );
    }

    private static void ApplyHashResult(
        JsonObject node,
        DesktopAgentSyncSession session,
        string hash
    )
    {
        var contentState = ReadContentState(session, hash);
        var lifecycleState = ReadLifecycleState(node, session.LifecycleState);
        node["lastKnownHash"] = hash;
        node["contentState"] = contentState;
        node["lifecycleState"] = lifecycleState;
        node["status"] = ReadStatus(lifecycleState, contentState);
        if (lifecycleState != "CHECKIN_FAILED")
        {
            node.Remove("lastError");
        }
    }

    private static void ApplyFileMissing(JsonObject node)
    {
        node["lifecycleState"] = "LOCAL_FILE_MISSING";
        node["contentState"] = "MISSING";
        node["status"] = "LOCAL_FILE_MISSING";
    }

    private static void ApplyHashUnavailable(JsonObject node)
    {
        var lifecycle = ReadLifecycleState(node, ReadString(node, "lifecycleState"));
        var content = ReadString(node, "contentState");
        node["lifecycleState"] = lifecycle;
        node["status"] = lifecycle == "CHECKING_IN"
            ? "CHECKING_IN"
            : ReadStatus(lifecycle, content);
        node["lastError"] = "Local file is temporarily unavailable; Desktop Agent will retry.";
    }

    private static void ApplyReleasePending(JsonObject node)
    {
        node["lifecycleState"] = "RELEASE_PENDING";
        node["status"] = "RELEASE_PENDING";
    }

    private static void ApplyCleanupPending(JsonObject node)
    {
        node["lifecycleState"] = "CLEANUP_PENDING";
        node["status"] = "CLEANUP_PENDING";
    }

    private static void ApplyCheckInPending(JsonObject node)
    {
        node["lifecycleState"] = "CHECKIN_FAILED";
        node["status"] = "CHECKIN_FAILED";
        node["lastError"] = "The previous check-in was interrupted and will resume.";
    }

    private static string ReadContentState(
        DesktopAgentSyncSession session,
        string hash
    )
    {
        if (hash == session.OriginalHash)
        {
            return "UNCHANGED";
        }
        return hash == session.LastUploadedHash ? "UPLOADED" : "DIRTY";
    }

    private static string ReadLifecycleState(JsonObject node, string current)
    {
        if (
            current is "LAUNCHING" or "OPEN_NOT_OBSERVED" or "LAUNCH_FAILED"
                or "CHECKING_IN" or "CHECKIN_FAILED" or "LEASE_LOST"
                or "SERVER_FILE_REMOVED"
        )
        {
            return current;
        }
        return node["closeDetectedAt"] is null ? "OPEN" : "CLOSE_DETECTED";
    }

    private static string ReadStatus(string lifecycle, string content)
    {
        return lifecycle switch
        {
            "CHECKING_IN" => "CHECKING_IN",
            "RELEASE_PENDING" => "RELEASE_PENDING",
            "CLEANUP_PENDING" => "CLEANUP_PENDING",
            "CONFLICT_RISK" => "CONFLICT_RISK",
            "LEASE_LOST" => "LEASE_LOST",
            "LOCK_REVOKED" => "LOCK_REVOKED",
            "SERVER_FILE_REMOVED" => "SERVER_FILE_REMOVED",
            "LOCAL_FILE_MISSING" => "LOCAL_FILE_MISSING",
            _ when content == "DIRTY" => "DIRTY_PENDING_CHECKIN",
            _ => "OPEN_UNCHANGED",
        };
    }

    private static string ReadString(JsonObject node, string name)
    {
        return node[name]?.GetValue<string>() ?? string.Empty;
    }
}
