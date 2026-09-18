using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentUpdateSessionResolver(
    DesktopAgentSessionReconciler reconciler,
    DesktopAgentSessionSyncService syncService
)
{
    public async Task<DesktopAgentUpdateResolution> ResolveOnceAsync(
        CancellationToken cancellationToken
    )
    {
        var sessions = await reconciler.RefreshAsync(cancellationToken);
        var masters = sessions.Where(IsBlockingMaster).ToArray();
        if (masters.Length == 0)
        {
            return DesktopAgentUpdateResolution.Ready;
        }
        if (masters.Any(IsOpenOrLaunching))
        {
            return DesktopAgentUpdateResolution.WaitingForClose;
        }
        var session = masters[0];
        await ResolveSessionAsync(session, cancellationToken);
        return DesktopAgentUpdateResolution.Progressed;
    }

    private async Task ResolveSessionAsync(
        JsonElement session,
        CancellationToken cancellationToken
    )
    {
        var lifecycle = ReadString(session, "lifecycleState");
        var sessionId = ReadString(session, "sessionId") ?? throw ReleaseFailed();
        var releaseUrl = ReadString(session, "releaseUrl") ?? throw ReleaseFailed();
        if (lifecycle is "CLOSE_DETECTED" or "CHECKING_IN" or "CHECKIN_FAILED"
            or "RELEASE_PENDING" or "RELEASE_FAILED")
        {
            await syncService.CheckInAsync(
                sessionId,
                new DesktopAgentCheckInRequest
                {
                    CheckInUrl = ReadString(session, "checkInUrl"),
                    ReleaseUrl = releaseUrl,
                },
                cancellationToken
            );
            return;
        }
        if (lifecycle == "LAUNCH_FAILED")
        {
            await syncService.ReleaseAsync(
                sessionId,
                new DesktopAgentReleaseRequest { ReleaseUrl = releaseUrl },
                cancellationToken
            );
            return;
        }
        throw ReleaseFailed();
    }

    private static bool IsBlockingMaster(JsonElement session)
    {
        if (ReadString(session, "mode") != "MASTER")
        {
            return false;
        }
        return ReadString(session, "lifecycleState") is not (
            "CLOSED" or "CLEANUP_PENDING" or "CLEANUP_FAILED"
        );
    }

    private static bool IsOpenOrLaunching(JsonElement session)
    {
        return ReadString(session, "lifecycleState") is (
            "LAUNCHING" or "OPEN_NOT_OBSERVED" or "OPEN"
        );
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static DesktopAgentRuntimeException ReleaseFailed()
    {
        return new DesktopAgentRuntimeException(
            "MASTER_RELEASE_FAILED",
            "Desktop Agent could not safely release all Master sessions.",
            StatusCodes.Status409Conflict
        );
    }
}

public enum DesktopAgentUpdateResolution
{
    Ready,
    WaitingForClose,
    Progressed,
}
