using System.Text.Json;
using System.Diagnostics;
using ProjectWing.NativeRuntime;

namespace ProjectWing.AgentManager;

internal static class RecoveryMaintenancePolicy
{
    public static void ReconcileInterruptedStatus(string stateRoot)
    {
        using var lease = RuntimeOwnershipLease.TryAcquire(stateRoot, "maintenance");
        if (lease is not null) AllowsRecovery(stateRoot);
    }

    public static string GetState(string stateRoot)
    {
        using var lease = RuntimeOwnershipLease.TryAcquire(stateRoot, "maintenance");
        return lease is null ? "ACTIVE" : GetStateWhileOwned(stateRoot);
    }

    public static string GetStateWhileOwned(string stateRoot)
    {
        if (AllowsRecovery(stateRoot)) return "IDLE";
        try
        {
            using var status = JsonDocument.Parse(File.ReadAllText(Path.Combine(stateRoot, "update-status.json")));
            var root = status.RootElement;
            if (!root.TryGetProperty("ownerKind", out var kind) || kind.ValueKind != JsonValueKind.String
                || kind.GetString() is not ("native-manager-v1" or "velopack-handoff-v1")) return "REVIEW_REQUIRED";
            if (RecordedProcessIsAlive(root, "ownerPid", "ownerStartTimeUtcTicks", "ownerProcessIdentity")
                || RecordedProcessIsAlive(root, "installerPid", "installerStartTimeUtcTicks", "installerProcessIdentity")) return "ACTIVE";
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException) { }
        return "REVIEW_REQUIRED";
    }

    private static bool RecordedProcessIsAlive(JsonElement root, string pidName, string ticksName, string identityName)
    {
        if (!TryReadGeneration(root, pidName, ticksName, identityName, out var pid, out var identity) || identity is null) return false;
        try
        {
            using var process = Process.GetProcessById(pid);
            return !process.HasExited && ProcessGenerationIdentity.Capture(process) == identity;
        }
        catch (Exception error) when (error is ArgumentException or IOException or UnauthorizedAccessException or InvalidOperationException or System.ComponentModel.Win32Exception) { return false; }
    }

    // Caller holds maintenance ownership across checking state and taking action.
    public static bool AllowsRecovery(string stateRoot)
    {
        var statusPath = Path.Combine(stateRoot, "update-status.json");
        try
        {
            if (!File.Exists(statusPath)) return true;
            using var status = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = status.RootElement;
            if (!(root.TryGetProperty("status", out var value)
                && value.ValueKind == JsonValueKind.String
                )) return false;
            if (value.GetString() is "IDLE" or "READY" or "FAILED") return true;
            if (!root.TryGetProperty("ownerKind", out var kind) || kind.ValueKind != JsonValueKind.String
                || kind.GetString() is not ("native-manager-v1" or "velopack-handoff-v1")
                || !RecordedProcessDefinitelyExited(root, "ownerPid", "ownerStartTimeUtcTicks", "ownerProcessIdentity")) return false;
            if (value.GetString() == "INSTALLING")
            {
                // Only our fixed, standard-layout Velopack invocation has a known
                // lifetime. A legacy setup may detach children: never guess its end.
                if (kind.GetString() != "velopack-handoff-v1"
                    || !RecordedProcessDefinitelyExited(root, "installerPid", "installerStartTimeUtcTicks", "installerProcessIdentity")) return false;
            }
            else if (value.GetString() is not ("DOWNLOADING" or "VERIFYING_HEALTH" or "REPAIRING_ENVIRONMENT" or "PREPARING_UPDATE")) return false;
            var original = File.ReadAllText(statusPath);
            File.WriteAllText(Path.Combine(stateRoot, $"interrupted-update-{Guid.NewGuid():N}.json"), original);
            ManagerStatusStore.WriteStatus(statusPath, new UpdateStatus("FAILED")
            {
                ErrorCode = "UPDATE_INTERRUPTED",
                Message = "The previous update owner exited. Local service recovery is available; working files were retained.",
            });
            return true;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
        {
            return false;
        }
    }

    private static bool TryReadGeneration(JsonElement root, string pidName, string ticksName, string identityName, out int pid, out string? identity)
    {
        pid = 0;
        identity = null;
        if (!root.TryGetProperty(pidName, out var pidValue) || pidValue.ValueKind != JsonValueKind.Number
            || !pidValue.TryGetInt32(out pid) || pid <= 0) return false;
        if (root.TryGetProperty(identityName, out var token))
        {
            if (token.ValueKind != JsonValueKind.String || token.GetString() is not { } value
                || !ProcessGenerationIdentity.IsSupported(value, pid)) return false;
            identity = value;
            return true;
        }
        if (!root.TryGetProperty(ticksName, out var ticksValue) || ticksValue.ValueKind != JsonValueKind.String
            || !long.TryParse(ticksValue.GetString(), out var ticks) || ticks <= 0) return false;
        // Legacy Linux UTC estimates cannot prove that an existing PID was recycled.
        // Absence can still prove exit; otherwise preserve the record for review.
        if (OperatingSystem.IsWindows()) identity = ProcessGenerationIdentity.FromStartTime(pid, ticks);
        return true;
    }

    private static bool RecordedProcessDefinitelyExited(JsonElement root, string pidName, string ticksName, string identityName)
    {
        if (!TryReadGeneration(root, pidName, ticksName, identityName, out var pid, out var identity)) return false;
        try
        {
            using var owner = Process.GetProcessById(pid);
            return owner.HasExited || identity is not null && ProcessGenerationIdentity.Capture(owner) != identity;
        }
        catch (ArgumentException) { return true; }
        catch (IOException) { return false; }
        catch (UnauthorizedAccessException) { return false; }
        catch (InvalidOperationException) { return false; }
        catch (System.ComponentModel.Win32Exception) { return false; }
    }
}
