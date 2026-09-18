using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentUpdateStatusReader(DesktopAgentRuntimeOptions options)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };
    private readonly SemaphoreSlim writeLock = new(1, 1);
    private static readonly IReadOnlySet<string> UpdateStatuses = new HashSet<string>(
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
            "READY",
            "FAILED",
        ],
        StringComparer.Ordinal
    );

    public async Task<object> ReadAsync(CancellationToken cancellationToken)
    {
        var statusFile = Path.Combine(options.StateRoot, "update-status.json");
        if (!File.Exists(statusFile))
        {
            return ReadyStatus();
        }

        try
        {
            var json = await File.ReadAllTextAsync(statusFile, cancellationToken);
            using var document = JsonDocument.Parse(StripUtf8Bom(json));
            return IsValid(document.RootElement)
                ? document.RootElement.Clone()
                : FailedStatus();
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or JsonException
        )
        {
            return FailedStatus();
        }
    }

    public async Task WriteAsync(
        DesktopAgentUpdateStatus status,
        CancellationToken cancellationToken
    )
    {
        await writeLock.WaitAsync(cancellationToken);
        try
        {
            Directory.CreateDirectory(options.StateRoot);
            var statusFile = Path.Combine(options.StateRoot, "update-status.json");
            var temporaryFile = $"{statusFile}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
            try
            {
                var json = JsonSerializer.Serialize(status, JsonOptions);
                await File.WriteAllTextAsync(temporaryFile, json, cancellationToken);
                File.Move(temporaryFile, statusFile, overwrite: true);
            }
            catch
            {
                TryDelete(temporaryFile);
                throw;
            }
        }
        finally
        {
            writeLock.Release();
        }
    }

    private static bool IsValid(JsonElement root)
    {
        return root.ValueKind == JsonValueKind.Object
            && root.TryGetProperty("ok", out var ok)
            && ok.ValueKind == JsonValueKind.True
            && root.TryGetProperty("status", out var status)
            && status.ValueKind == JsonValueKind.String
            && UpdateStatuses.Contains(status.GetString()!);
    }

    private static string StripUtf8Bom(string value)
    {
        return value.Length > 0 && value[0] == '\uFEFF' ? value[1..] : value;
    }

    private static DesktopAgentUpdateStatus ReadyStatus()
    {
        return new DesktopAgentUpdateStatus
        {
            Ok = true,
            Status = "READY",
            Stage = "READY",
            Message = "Desktop runtime is ready.",
        };
    }

    private static DesktopAgentUpdateStatus FailedStatus()
    {
        return new DesktopAgentUpdateStatus
        {
            Ok = true,
            Status = "FAILED",
            Message = "Desktop Agent update status is unavailable.",
            ErrorCode = "UNKNOWN_ERROR",
            UpdatedAt = DateTimeOffset.UtcNow.ToString("O"),
        };
    }

    private static void TryDelete(string path)
    {
        try
        {
            File.Delete(path);
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            // Preserve the original persistence failure.
        }
    }
}
