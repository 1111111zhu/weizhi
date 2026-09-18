using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentLocalObservationService(
    DesktopAgentRuntimeState state,
    DesktopAgentLocalFileProbe probe,
    DesktopAgentSessionEvents sessionEvents,
    DesktopAgentBackgroundSyncService backgroundSync,
    ILogger<DesktopAgentLocalObservationService> logger
) : BackgroundService
{
    private static readonly TimeSpan ScanInterval = TimeSpan.FromSeconds(1);
    private static readonly TimeSpan CloseObservationGrace = TimeSpan.FromSeconds(3);
    private const int RequiredClosedConfirmations = 2;
    private readonly ConcurrentDictionary<string, int> closedConfirmations = new();

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(ScanInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await ObserveAllAsync(stoppingToken);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(
                    error,
                    "Local lifecycle observation failed; the next scan will retry."
                );
            }
        }
    }

    private async Task ObserveAllAsync(CancellationToken cancellationToken)
    {
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        foreach (var session in sessions)
        {
            if (!ShouldObserve(session))
            {
                RemoveConfirmation(session);
                continue;
            }
            await ObserveOneAsync(session, cancellationToken);
        }
    }

    private async Task ObserveOneAsync(
        JsonElement session,
        CancellationToken cancellationToken
    )
    {
        var sessionId = ReadString(session, "sessionId");
        if (sessionId is null) return;
        var result = await probe.ProbeAsync(session, cancellationToken);
        if (result.State == "MISSING")
        {
            closedConfirmations.TryRemove(sessionId, out _);
            await RecordMissingAsync(session, cancellationToken);
            return;
        }

        var openObservedAt = ReadString(session, "openObservedAt");
        if (openObservedAt is null)
        {
            if (!result.Busy || result.OpenObservedSource is null) return;
            await sessionEvents.RecordOpenObservedAsync(
                sessionId,
                new DesktopAgentOpenObservedRequest(
                    ReadInt(session, "generation") ?? 0,
                    ReadString(session, "openSignalToken"),
                    result.OpenObservedSource
                ),
                cancellationToken
            );
            return;
        }

        if (result.Busy || InsideCloseGrace(openObservedAt))
        {
            closedConfirmations.TryRemove(sessionId, out _);
            return;
        }
        var count = closedConfirmations.AddOrUpdate(sessionId, 1, (_, current) => current + 1);
        if (count < RequiredClosedConfirmations) return;
        closedConfirmations.TryRemove(sessionId, out _);

        var closed = await sessionEvents.RecordClosedAsync(
            sessionId,
            new DesktopAgentClosedRequest(
                ReadInt(session, "generation") ?? 0,
                ReadString(session, "closeSignalToken"),
                "MONITOR"
            ),
            cancellationToken
        );
        if (
            closed.StatusCode == StatusCodes.Status200OK
            && closed.Response.Session is not null
        )
        {
            backgroundSync.Enqueue(closed.Response.Session.Value);
        }
    }

    private async Task RecordMissingAsync(
        JsonElement session,
        CancellationToken cancellationToken
    )
    {
        var sessionId = ReadString(session, "sessionId");
        if (sessionId is null) return;
        await state.MutateSessionAsync(
            sessionId,
            new DesktopAgentSessionMutation(
                node => ReadInt(node, "generation") == ReadInt(session, "generation")
                    && ReadString(node, "lifecycleState")
                        == ReadString(session, "lifecycleState"),
                node =>
                {
                    node["lifecycleState"] = "LOCAL_FILE_MISSING";
                    node["contentState"] = "MISSING";
                    node["status"] = "LOCAL_FILE_MISSING";
                    node["lastObservationAt"] = DateTime.UtcNow.ToString("O");
                    node["lastError"] =
                        "The tracked local file is no longer in the controlled cache.";
                }
            ),
            cancellationToken
        );
    }

    private static bool ShouldObserve(JsonElement session)
    {
        return ReadString(session, "mode") == "MASTER"
            && ReadString(session, "lifecycleState") is (
                "LAUNCHING" or "OPEN_NOT_OBSERVED" or "OPEN" or "LEASE_LOST"
            );
    }

    private static bool InsideCloseGrace(string observedAt)
    {
        return DateTimeOffset.TryParse(observedAt, out var parsed)
            && DateTimeOffset.UtcNow - parsed < CloseObservationGrace;
    }

    private void RemoveConfirmation(JsonElement session)
    {
        var sessionId = ReadString(session, "sessionId");
        if (sessionId is not null) closedConfirmations.TryRemove(sessionId, out _);
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static string? ReadString(JsonObject value, string name)
    {
        return value[name]?.GetValue<string>();
    }

    private static int? ReadInt(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var result)
            ? result
            : null;
    }

    private static int? ReadInt(JsonObject value, string name)
    {
        return value[name]?.GetValue<int>();
    }
}
