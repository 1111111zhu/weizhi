using System.Diagnostics;
using System.Text.Json;

namespace ProjectWing.AgentManager;

internal static class WorkerHealthProbeService
{
    public static async Task<WorkerHealthProbe> ProbeAsync(
        RuntimeConfig config,
        Process worker
    )
    {
        if (worker.HasExited) return Unavailable("FAILED");
        try
        {
            using var deadline = new CancellationTokenSource(TimeSpan.FromMilliseconds(1_500));
            using var http = new HttpClient { Timeout = Timeout.InfiniteTimeSpan };
            using var response = await http.GetAsync(
                $"http://127.0.0.1:{config.WorkerPort}/health",
                HttpCompletionOption.ResponseHeadersRead, deadline.Token
            );
            if (!response.IsSuccessStatusCode)
            {
                return Unavailable(worker.HasExited ? "FAILED" : "STARTING");
            }
            if (response.Content.Headers.ContentLength is > 65536) return Unavailable("STARTING");
            using var stream = await response.Content.ReadAsStreamAsync(deadline.Token);
            var buffer = new byte[65537];
            var count = 0;
            while (count < buffer.Length)
            {
                var read = await stream.ReadAsync(buffer.AsMemory(count), deadline.Token);
                if (read == 0) return Read(System.Text.Encoding.UTF8.GetString(buffer, 0, count));
                count += read;
            }
            return Unavailable("STARTING");
        }
        catch (Exception error) when (
            error is HttpRequestException or IOException or OperationCanceledException
        )
        {
            return Unavailable(worker.HasExited ? "FAILED" : "STARTING");
        }
    }

    public static bool IsHealthTimeoutFailure(string statusJson)
    {
        try
        {
            using var document = JsonDocument.Parse(statusJson);
            return IsString(document.RootElement, "status", "FAILED")
                && IsString(document.RootElement, "errorCode", "HEALTH_TIMEOUT");
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static bool TryCreateRecoveredReadyStatus(
        string statusJson,
        WorkerHealthProbe workerHealth,
        out UpdateStatus recoveredStatus
    )
    {
        recoveredStatus = new UpdateStatus("READY");
        var currentVersion = workerHealth.AgentVersion;
        if (
            !string.Equals(workerHealth.AgentState, "READY", StringComparison.OrdinalIgnoreCase)
            || string.IsNullOrWhiteSpace(currentVersion)
        )
        {
            return false;
        }
        try
        {
            using var document = JsonDocument.Parse(statusJson);
            return TryRecover(document.RootElement, currentVersion, out recoveredStatus);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    private static bool TryRecover(
        JsonElement root,
        string currentVersion,
        out UpdateStatus recoveredStatus
    )
    {
        recoveredStatus = new UpdateStatus("READY");
        if (!IsString(root, "status", "FAILED") || !IsString(root, "errorCode", "HEALTH_TIMEOUT"))
        {
            return false;
        }
        var expectedVersion = ReadString(root, "expectedVersion");
        if (!string.IsNullOrWhiteSpace(expectedVersion)
            && !string.Equals(expectedVersion, currentVersion, StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        recoveredStatus = new UpdateStatus("READY")
        {
            Stage = "READY",
            TaskId = ReadString(root, "taskId"),
            Message = "Desktop Agent update is ready.",
            ExpectedVersion = string.IsNullOrWhiteSpace(expectedVersion)
                ? currentVersion
                : expectedVersion,
            CurrentVersion = currentVersion,
            StartedAt = ReadString(root, "startedAt"),
        };
        return true;
    }

    private static WorkerHealthProbe Read(string json)
    {
        try
        {
            using var document = JsonDocument.Parse(json);
            var root = document.RootElement;
            if (root.ValueKind != JsonValueKind.Object || ReadString(root, "app") != "project-wing-desktop-runtime") return Unavailable("STARTING");
            return new WorkerHealthProbe
            {
                AgentState = ReadString(root, "agentState") ?? "STARTING",
                AgentVersion = ReadString(root, "version"),
                UpdateState = ReadString(root, "updateState") ?? "IDLE",
                RestoreState = ReadString(root, "restoreState") ?? "READY",
                AttentionCount = ReadInt(root, "attentionCount"),
                QuarantineCount = ReadInt(root, "quarantineCount"),
            };
        }
        catch (JsonException)
        {
            return Unavailable("STARTING");
        }
    }

    public static WorkerHealthProbe Unavailable(string agentState)
    {
        return new WorkerHealthProbe
        {
            AgentState = agentState,
            UpdateState = "IDLE",
            RestoreState = "READY",
            AttentionCount = 0,
            QuarantineCount = 0,
        };
    }

    private static bool IsString(JsonElement root, string name, string expected)
    {
        return string.Equals(ReadString(root, name), expected, StringComparison.OrdinalIgnoreCase);
    }

    private static string? ReadString(JsonElement root, string name)
    {
        return root.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;
    }

    private static int ReadInt(JsonElement root, string name)
    {
        return root.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.Number
            && value.TryGetInt32(out var result)
            ? result
            : 0;
    }
}
