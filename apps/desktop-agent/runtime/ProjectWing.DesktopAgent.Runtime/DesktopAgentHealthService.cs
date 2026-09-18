using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentHealthService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentUpdateStatusReader updateStatusReader,
    DesktopAgentRuntimeState state
)
{
    private static readonly IReadOnlySet<string> ActiveUpdateStates = new HashSet<string>(
        [
            "STARTED",
            "IN_PROGRESS",
            "WAITING_FOR_WORKBOOK_CLOSE",
            "CHECKING_IN",
            "RELEASING",
            "RELEASING_SESSIONS",
            "DOWNLOADING",
            "VERIFYING_INSTALLER",
            "STOPPING_AGENT",
            "REPAIRING_ENVIRONMENT",
            "INSTALLING",
            "STARTING_AGENT",
            "RESTARTING",
            "VERIFYING_HEALTH",
        ],
        StringComparer.Ordinal
    );
    private static readonly IReadOnlySet<string> AttentionStates = new HashSet<string>(
        [
            "CHECKIN_FAILED",
            "RELEASE_FAILED",
            "CLEANUP_FAILED",
            "LOCAL_FILE_MISSING",
            "CONFLICT_RISK",
            "LOCK_REVOKED",
            "SERVER_FILE_REMOVED",
            "LEASE_LOST",
            "CLEANUP_PENDING",
        ],
        StringComparer.Ordinal
    );

    public async Task<DesktopAgentHealth> ReadAsync(CancellationToken cancellationToken)
    {
        var update = await updateStatusReader.ReadAsync(cancellationToken);
        var rawUpdateState = ReadUpdateState(update);
        var updateState = ReadHealthUpdateState(rawUpdateState);
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        var attentionCount = sessions.Count(session =>
            ReadString(session, "status") is { } status
            && AttentionStates.Contains(status)
        );
        var diagnostics = state.ReadDiagnostics();
        if (diagnostics.QuarantineCount != 0)
        {
            attentionCount += diagnostics.QuarantineCount > 0
                ? diagnostics.QuarantineCount
                : 1;
        }
        else if (diagnostics.RestoreState != "READY")
        {
            attentionCount += 1;
        }
        var agentState = ActiveUpdateStates.Contains(rawUpdateState)
            ? "UPDATING"
            : attentionCount > 0 || rawUpdateState == "FAILED"
                ? "READY_WITH_ATTENTION"
                : "READY";
        return new DesktopAgentHealth
        {
            Ok = true,
            App = "project-wing-desktop-runtime",
            Version = options.Version,
            ManagerVersion = options.ManagerVersion,
            AgentVersion = options.Version,
            AgentState = agentState,
            UpdateState = updateState,
            RestoreState = diagnostics.RestoreState,
            AttentionCount = attentionCount,
            QuarantineCount = diagnostics.QuarantineCount,
        };
    }

    private static string ReadUpdateState(object value)
    {
        if (value is DesktopAgentUpdateStatus status)
        {
            return status.Status;
        }
        if (value is JsonElement element)
        {
            return ReadString(element, "status") ?? "FAILED";
        }
        return "FAILED";
    }

    private static string ReadHealthUpdateState(string status)
    {
        return status switch
        {
            "STARTED" => "UPDATE_REQUESTED",
            "IN_PROGRESS" or "WAITING_FOR_WORKBOOK_CLOSE" or "CHECKING_IN"
                or "RELEASING" or "RELEASING_SESSIONS" => "PREPARING_AGENT",
            "DOWNLOADING" => "STAGING_PAYLOAD",
            "VERIFYING_INSTALLER" => "VERIFYING_PAYLOAD",
            "STOPPING_AGENT" => "STOPPING_AGENT",
            "INSTALLING" => "SWITCHING_ACTIVE_VERSION",
            "STARTING_AGENT" or "RESTARTING" => "STARTING_AGENT",
            "VERIFYING_HEALTH" => "VERIFYING_READY",
            "READY" => "READY",
            "FAILED" => "FAILED",
            _ => "IDLE",
        };
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }
}
