using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.AgentManager;

internal static class ManagerStatusStore
{
    public static int Fail(string statusPath, string errorCode, string message)
    {
        WriteStatus(statusPath, new UpdateStatus("FAILED")
        {
            ErrorCode = errorCode,
            Message = message,
        });
        return 1;
    }

    public static bool ExistingStatusIsFailedWithErrorCode(string statusPath)
    {
        try
        {
            if (!File.Exists(statusPath)) return false;
            using var document = JsonDocument.Parse(File.ReadAllText(statusPath));
            var root = document.RootElement;
            return IsString(root, "status", "FAILED")
                && root.TryGetProperty("errorCode", out var errorCode)
                && errorCode.ValueKind == JsonValueKind.String
                && !string.IsNullOrWhiteSpace(errorCode.GetString());
        }
        catch
        {
            return false;
        }
    }

    public static void WriteStatus(string statusPath, UpdateStatus status)
    {
        status.OwnerKind ??= "native-manager-v1";
        status.OwnerPid = Environment.ProcessId;
        status.OwnerStartTimeUtcTicks = System.Diagnostics.Process.GetCurrentProcess().StartTime.ToUniversalTime().Ticks.ToString();
        status.OwnerProcessIdentity = ProjectWing.NativeRuntime.ProcessGenerationIdentity.CaptureCurrent();
        Directory.CreateDirectory(Path.GetDirectoryName(statusPath)!);
        var tempPath = $"{statusPath}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        File.WriteAllText(tempPath, SerializeStatus(status) + Environment.NewLine);
        MoveWithRetry(tempPath, statusPath);
    }

    public static string SerializeStatus(UpdateStatus status)
    {
        var now = DateTimeOffset.UtcNow.UtcDateTime.ToString("O");
        status.Ok = true;
        status.UpdatedAt = now;
        status.StartedAt ??= now;
        status.Stage ??= status.Status;
        return JsonSerializer.Serialize(status, CreateJsonOptions());
    }

    public static JsonSerializerOptions CreateJsonOptions()
    {
        return new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            WriteIndented = true,
        };
    }

    public static bool IsDiskFull(IOException error)
    {
        return error.HResult == unchecked((int)0x80070070);
    }

    private static void MoveWithRetry(string tempPath, string statusPath)
    {
        const int maximumAttempts = 5;
        for (var attempt = 1; attempt <= maximumAttempts; attempt++)
        {
            try
            {
                File.Move(tempPath, statusPath, overwrite: true);
                return;
            }
            catch (Exception error) when (
                error is IOException or UnauthorizedAccessException
                && attempt < maximumAttempts
            )
            {
                Thread.Sleep(TimeSpan.FromMilliseconds(50 * attempt));
            }
            catch
            {
                TryDelete(tempPath);
                throw;
            }
        }
    }

    private static bool IsString(JsonElement root, string name, string expected)
    {
        return root.TryGetProperty(name, out var value)
            && value.ValueKind == JsonValueKind.String
            && string.Equals(value.GetString(), expected, StringComparison.Ordinal);
    }

    private static void TryDelete(string path)
    {
        try
        {
            if (File.Exists(path)) File.Delete(path);
        }
        catch
        {
            // The move failure is the actionable error.
        }
    }

}
