using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentSessionEvents(DesktopAgentRuntimeState state)
{
    private readonly ConcurrentDictionary<string, OpenObservationTracker> _openObservationWaiters = new();
    private static readonly IReadOnlySet<string> ObservationSources = new HashSet<string>(
        [
            "WATCHER_COM",
            "WATCHER_FILE_LOCK",
            "MONITOR_COM",
            "MONITOR_FILE_LOCK",
            "MONITOR_PROCESS",
            "LAUNCHER_PROCESS",
            "MANUAL",
        ],
        StringComparer.Ordinal
    );
    private static readonly IReadOnlySet<string> LaunchFailureReasons = new HashSet<string>(
        [
            "COM_CREATE_FAILED",
            "COM_OPEN_FAILED",
            "VISIBILITY_FAILED",
            "OPEN_OBSERVED_POST_FAILED",
            "SHELL_OPEN_FAILED",
            "SHELL_OPEN_NOT_OBSERVED",
            "OPEN_OBSERVATION_TIMEOUT",
            "SESSION_NOT_FOUND_AFTER_LAUNCH",
            "SESSION_NO_LONGER_LAUNCHABLE",
            "WATCHER_START_FAILED",
        ],
        StringComparer.Ordinal
    );
    private static readonly IReadOnlySet<string> CloseSources = new HashSet<string>(
        ["WATCHER", "MONITOR", "MANUAL"],
        StringComparer.Ordinal
    );

    public async Task<DesktopAgentSessionEventResult> RecordOpenObservedAsync(
        string sessionId,
        DesktopAgentOpenObservedRequest input,
        CancellationToken cancellationToken
    )
    {
        if (!ValidTokenInput(input.Generation, input.OpenSignalToken)
            || input.Source is null
            || !ObservationSources.Contains(input.Source))
        {
            return Invalid("Open observation payload is invalid.");
        }
        var observedAt = DateTime.UtcNow.ToString("O");
        var mutation = new DesktopAgentSessionMutation(
            node => Matches(node, input.Generation, "openSignalToken", input.OpenSignalToken!)
                && ReadString(node, "lifecycleState") is "LAUNCHING" or "OPEN_NOT_OBSERVED",
            node => ApplyOpenObserved(node, input.Source, observedAt)
        );
        var result = await MutateAsync(
            sessionId,
            mutation,
            current => Matches(
                    current,
                    input.Generation,
                    "openSignalToken",
                    input.OpenSignalToken!
                )
                && ReadString(current, "openObservedAt") is not null,
            cancellationToken
        );
        if (result.StatusCode == StatusCodes.Status200OK
            && _openObservationWaiters.TryGetValue(sessionId, out var tracker))
        {
            tracker.MarkObserved();
        }
        return result;
    }

    public async Task<DesktopAgentSessionEventResult> RecordLaunchFailedAsync(
        string sessionId,
        DesktopAgentLaunchFailedRequest input,
        CancellationToken cancellationToken
    )
    {
        if (!ValidTokenInput(input.Generation, input.OpenSignalToken)
            || input.Reason is null
            || !LaunchFailureReasons.Contains(input.Reason)
            || input.Message?.Length > 500)
        {
            return Invalid("Launch failure payload is invalid.");
        }
        var observedAt = DateTime.UtcNow.ToString("O");
        var mutation = new DesktopAgentSessionMutation(
            node => Matches(node, input.Generation, "openSignalToken", input.OpenSignalToken!)
                && (ReadString(node, "lifecycleState") is "LAUNCHING" or "OPEN_NOT_OBSERVED")
                && ReadString(node, "openObservedAt") is null,
            node => ApplyLaunchFailed(node, input, observedAt)
        );
        var result = await MutateAsync(
            sessionId,
            mutation,
            current => Matches(
                    current,
                    input.Generation,
                    "openSignalToken",
                    input.OpenSignalToken!
                )
                && ReadString(current, "lifecycleState") == "LAUNCH_FAILED"
                && ReadString(current, "launchFailedReason") == input.Reason,
            cancellationToken
        );
        return result;
    }

    public void BeginOpenObservationWait(string sessionId)
    {
        _openObservationWaiters[sessionId] = new OpenObservationTracker();
    }

    public OpenObservationReceipt? ReadOpenObservationReceipt(string sessionId)
    {
        return _openObservationWaiters.TryGetValue(sessionId, out var tracker)
            ? tracker.Read()
            : null;
    }

    public void EndOpenObservationWait(string sessionId)
    {
        _openObservationWaiters.TryRemove(sessionId, out _);
    }

    public async Task<DesktopAgentSessionEventResult> RecordClosedAsync(
        string sessionId,
        DesktopAgentClosedRequest input,
        CancellationToken cancellationToken
    )
    {
        if (!ValidTokenInput(input.Generation, input.CloseSignalToken)
            || input.Source is null
            || !CloseSources.Contains(input.Source))
        {
            return Invalid("Close detection payload is invalid.");
        }
        var closedAt = DateTime.UtcNow.ToString("O");
        var mutation = new DesktopAgentSessionMutation(
            node => Matches(node, input.Generation, "closeSignalToken", input.CloseSignalToken!)
                && ReadString(node, "lifecycleState") is "OPEN" or "LEASE_LOST"
                && ReadString(node, "openObservedAt") is not null,
            node => ApplyClosed(node, input.Source, closedAt)
        );
        var result = await MutateAsync(
            sessionId,
            mutation,
            current => Matches(
                    current,
                    input.Generation,
                    "closeSignalToken",
                    input.CloseSignalToken!
                )
                && ReadString(current, "closeDetectedAt") is not null,
            cancellationToken
        );
        if (result.StatusCode == StatusCodes.Status200OK
            && _openObservationWaiters.TryGetValue(sessionId, out var tracker))
        {
            tracker.MarkClosed();
        }
        return result;
    }

    private async Task<DesktopAgentSessionEventResult> MutateAsync(
        string sessionId,
        DesktopAgentSessionMutation mutation,
        Func<JsonElement, bool> isAlreadyApplied,
        CancellationToken cancellationToken
    )
    {
        var updated = await state.MutateSessionAsync(sessionId, mutation, cancellationToken);
        if (updated is not null)
        {
            return new DesktopAgentSessionEventResult(
                StatusCodes.Status200OK,
                new DesktopAgentSessionEventResponse
                {
                    Ok = true,
                    Session = updated,
                }
            );
        }
        var current = await state.ReadSessionAsync(sessionId, cancellationToken);
        if (current is not null && isAlreadyApplied(current.Value))
        {
            return new DesktopAgentSessionEventResult(
                StatusCodes.Status200OK,
                new DesktopAgentSessionEventResponse
                {
                    Ok = true,
                    Session = current,
                }
            );
        }
        return new DesktopAgentSessionEventResult(
            StatusCodes.Status409Conflict,
            new DesktopAgentSessionEventResponse
            {
                Ok = false,
                Code = "SESSION_STATE_CHANGED",
                Message = "Tracked file session state changed.",
            }
        );
    }

    private static void ApplyOpenObserved(JsonObject node, string source, string observedAt)
    {
        node["lifecycleState"] = "OPEN";
        node["status"] = CompatibilityStatus(node);
        node["openObservedAt"] = observedAt;
        node["openObservedSource"] = source;
        node["lastObservationAt"] = observedAt;
        node.Remove("lastObservationDiagnostic");
        node.Remove("lastError");
    }

    private static void ApplyLaunchFailed(
        JsonObject node,
        DesktopAgentLaunchFailedRequest input,
        string observedAt
    )
    {
        node["lifecycleState"] = "LAUNCH_FAILED";
        node["status"] = CompatibilityStatus(node);
        node["launchFailedReason"] = input.Reason;
        node["lastObservationAt"] = observedAt;
        node["lastObservationDiagnostic"] = input.Message;
        node["lastError"] = input.Message ?? $"Office launch failed: {input.Reason}.";
    }

    private static void ApplyClosed(JsonObject node, string source, string closedAt)
    {
        var leaseLost = ReadString(node, "lifecycleState") == "LEASE_LOST";
        node["lifecycleState"] = leaseLost ? "LEASE_LOST" : "CLOSE_DETECTED";
        node["status"] = CompatibilityStatus(node);
        node["closeDetectedAt"] = closedAt;
        node["closeDetectedSource"] = source;
        node["lastObservationAt"] = closedAt;
    }

    private static bool Matches(
        JsonObject node,
        int generation,
        string tokenName,
        string token
    )
    {
        return ReadInt(node, "generation") == generation
            && ReadString(node, tokenName) == token;
    }

    private static bool Matches(
        JsonElement node,
        int generation,
        string tokenName,
        string token
    )
    {
        return ReadInt(node, "generation") == generation
            && ReadString(node, tokenName) == token;
    }

    private static bool ValidTokenInput(int generation, string? token)
    {
        return generation > 0 && !string.IsNullOrWhiteSpace(token);
    }

    private static string CompatibilityStatus(JsonObject node)
    {
        return ReadString(node, "contentState") == "DIRTY"
            ? "DIRTY_PENDING_CHECKIN"
            : "OPEN_UNCHANGED";
    }

    private static string? ReadString(JsonObject node, string name)
    {
        return node[name]?.GetValue<string>();
    }

    private static int? ReadInt(JsonObject node, string name)
    {
        return node[name]?.GetValue<int>();
    }

    private static string? ReadString(JsonElement node, string name)
    {
        return node.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static int? ReadInt(JsonElement node, string name)
    {
        return node.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var result)
            ? result
            : null;
    }

    private static DesktopAgentSessionEventResult Invalid(string message)
    {
        return new DesktopAgentSessionEventResult(
            StatusCodes.Status400BadRequest,
            new DesktopAgentSessionEventResponse
            {
                Ok = false,
                Code = "VALIDATION_FAILED",
                Message = message,
            }
        );
    }
}

public sealed record OpenObservationReceipt(bool Observed, bool Closed);

internal sealed class OpenObservationTracker
{
    private int _observed;
    private int _closed;

    public void MarkObserved()
    {
        Interlocked.Exchange(ref _observed, 1);
    }

    public void MarkClosed()
    {
        Interlocked.Exchange(ref _observed, 1);
        Interlocked.Exchange(ref _closed, 1);
    }

    public OpenObservationReceipt Read()
    {
        return new OpenObservationReceipt(
            Volatile.Read(ref _observed) == 1,
            Volatile.Read(ref _closed) == 1
        );
    }
}

public sealed class DesktopAgentSessionEventServices(
    DesktopAgentSessionEvents events,
    DesktopAgentSessionSyncService syncService
)
{
    public DesktopAgentSessionEvents Events { get; } = events;
    public DesktopAgentSessionSyncService SyncService { get; } = syncService;
}
