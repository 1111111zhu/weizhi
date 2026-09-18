using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentHeartbeatService(
    DesktopAgentRuntimeState state,
    DesktopAgentSessionRemoteClient remoteClient,
    ILogger<DesktopAgentHeartbeatService> logger
) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(30);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await HeartbeatAllAsync(stoppingToken);
            }
            catch (Exception error) when (
                !stoppingToken.IsCancellationRequested
                && error is IOException or UnauthorizedAccessException)
            {
                logger.LogError(error, "Heartbeat could not access persisted sessions; the next heartbeat will retry.");
            }
            await Task.Delay(Interval, stoppingToken);
        }
    }

    private async Task HeartbeatAllAsync(CancellationToken cancellationToken)
    {
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        foreach (var value in sessions)
        {
            DesktopAgentSyncSession session;
            try { session = DesktopAgentSyncSession.From(value); }
            catch (DesktopAgentRuntimeException) { continue; }
            if (!NeedsHeartbeat(session) || !TryHeartbeatUrl(value, out var url)) continue;
            try
            {
                await remoteClient.HeartbeatAsync(session, url, cancellationToken);
            }
            catch (DesktopAgentRuntimeException error) when (
                error.Code is "LOCK_REVOKED" or "LOCK_SESSION_MISMATCH" or "SERVER_FILE_REMOVED"
            )
            {
                await state.MutateSessionAsync(
                    session.SessionId,
                    new DesktopAgentSessionMutation(
                        session.Matches,
                        node => ApplyLeaseLost(node, error)
                    ),
                    cancellationToken
                );
            }
            catch (DesktopAgentRuntimeException)
            {
                // A transient heartbeat failure must not discard local edits.
            }
        }
    }

    private static bool NeedsHeartbeat(DesktopAgentSyncSession session) =>
        session.LockSessionId is not null
        && session.GrantSecret is not null
        && session.LifecycleState is not (
            "LEASE_LOST" or "LOCK_REVOKED" or "SERVER_FILE_REMOVED" or "CLOSED" or "CLEANUP_PENDING"
        );

    private static bool TryHeartbeatUrl(
        System.Text.Json.JsonElement value,
        out Uri uri
    )
    {
        uri = null!;
        if (!value.TryGetProperty("releaseUrl", out var property)
            || property.ValueKind != System.Text.Json.JsonValueKind.String)
        {
            return false;
        }
        var release = property.GetString();
        if (string.IsNullOrWhiteSpace(release) || !release.EndsWith("/release"))
        {
            return false;
        }
        if (!Uri.TryCreate(
            $"{release[..^"/release".Length]}/heartbeat",
            UriKind.Absolute,
            out var parsed
        ))
        {
            return false;
        }
        uri = parsed;
        return true;
    }

    private static void ApplyLeaseLost(
        JsonObject node,
        DesktopAgentRuntimeException error
    )
    {
        var removed = error.Code == "SERVER_FILE_REMOVED";
        node["lifecycleState"] = removed ? "SERVER_FILE_REMOVED" : "LEASE_LOST";
        node["status"] = removed ? "SERVER_FILE_REMOVED" : "LEASE_LOST";
        node["leaseLostAt"] = DateTime.UtcNow.ToString("O");
        node["lastError"] = error.Message;
    }
}
