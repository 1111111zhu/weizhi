using System.Text.Json;
using System.Text.Json.Nodes;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed record DesktopAgentSyncSession
{
    public required string SessionId { get; init; }
    public required int Generation { get; init; }
    public required string LifecycleState { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string FileName { get; init; }
    public required string LocalPath { get; init; }
    public required string OriginalHash { get; init; }
    public required string LastKnownHash { get; init; }
    public string? LastUploadedHash { get; init; }
    public string? LockSessionId { get; init; }
    public int? BaseVersion { get; init; }
    public string? BaseVersionId { get; init; }
    public int? LockEpoch { get; init; }
    public string? GrantSecret { get; init; }
    public bool? DirectUploadSupported { get; init; }
    public string? MimeType { get; init; }
    public string? OpenSignalToken { get; init; }
    public string? CloseSignalToken { get; init; }
    public string? PendingReleaseReason { get; init; }
    public string? PendingReleaseHash { get; init; }
    public string? SnapshotPath { get; init; }
    public string? SnapshotHash { get; init; }
    public string? SnapshotCrc64 { get; init; }
    public string? SnapshotCrc64Algorithm { get; init; }
    public string? UploadAttemptId { get; init; }
    public string? UploadId { get; init; }

    public bool Matches(JsonObject node)
    {
        return ReadString(node, "sessionId") == SessionId
            && ReadString(node, "lockSessionId") == LockSessionId
            && ReadInt(node, "generation") == Generation
            && ReadString(node, "openSignalToken") == OpenSignalToken
            && ReadString(node, "closeSignalToken") == CloseSignalToken;
    }

    public static DesktopAgentSyncSession From(JsonElement value)
    {
        return new DesktopAgentSyncSession
        {
            SessionId = ReadRequiredString(value, "sessionId"),
            Generation = ReadRequiredInt(value, "generation"),
            LifecycleState = ReadRequiredString(value, "lifecycleState"),
            ProjectId = ReadRequiredString(value, "projectId"),
            AttachmentId = ReadRequiredString(value, "attachmentId"),
            FileName = ReadRequiredString(value, "fileName"),
            LocalPath = ReadRequiredString(value, "localPath"),
            OriginalHash = ReadRequiredString(value, "originalHash"),
            LastKnownHash = ReadRequiredString(value, "lastKnownHash"),
            LastUploadedHash = ReadOptionalString(value, "lastUploadedHash"),
            LockSessionId = ReadOptionalString(value, "lockSessionId"),
            BaseVersion = ReadOptionalInt(value, "baseVersion"),
            BaseVersionId = ReadOptionalString(value, "baseVersionId"),
            LockEpoch = ReadOptionalInt(value, "lockEpoch"),
            GrantSecret = ReadOptionalString(value, "grantSecret"),
            DirectUploadSupported = ReadOptionalBool(value, "directUploadSupported"),
            MimeType = ReadOptionalString(value, "mimeType"),
            OpenSignalToken = ReadOptionalString(value, "openSignalToken"),
            CloseSignalToken = ReadOptionalString(value, "closeSignalToken"),
            PendingReleaseReason = ReadOptionalString(value, "pendingReleaseReason"),
            PendingReleaseHash = ReadOptionalString(value, "pendingReleaseHash"),
            SnapshotPath = ReadOptionalString(value, "snapshotPath"),
            SnapshotHash = ReadOptionalString(value, "snapshotHash"),
            SnapshotCrc64 = ReadOptionalString(value, "snapshotCrc64"),
            SnapshotCrc64Algorithm = ReadOptionalString(
                value,
                "snapshotCrc64Algorithm"
            ),
            UploadAttemptId = ReadOptionalString(value, "uploadAttemptId"),
            UploadId = ReadOptionalString(value, "uploadId"),
        };
    }

    private static string ReadRequiredString(JsonElement value, string name)
    {
        return ReadOptionalString(value, name) ?? throw InvalidSession();
    }

    private static int ReadRequiredInt(JsonElement value, string name)
    {
        return ReadOptionalInt(value, name) ?? throw InvalidSession();
    }

    private static string? ReadOptionalString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static int? ReadOptionalInt(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.Number
            && property.TryGetInt32(out var result)
            ? result
            : null;
    }

    private static bool? ReadOptionalBool(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind is JsonValueKind.True or JsonValueKind.False
            ? property.GetBoolean()
            : null;
    }

    private static string? ReadString(JsonObject node, string name)
    {
        return node[name]?.GetValue<string>();
    }

    private static int? ReadInt(JsonObject node, string name)
    {
        return node[name]?.GetValue<int>();
    }

    private static DesktopAgentRuntimeException InvalidSession()
    {
        return new DesktopAgentRuntimeException(
            "SESSION_STATE_CHANGED",
            "Tracked file session is incomplete.",
            StatusCodes.Status409Conflict
        );
    }
}

public sealed record DesktopAgentSyncMutation
{
    public required IReadOnlyCollection<string> AllowedLifecycles { get; init; }
    public required Action<JsonObject> Apply { get; init; }
}

public sealed record DesktopAgentReleaseOperation
{
    public required DesktopAgentSyncSession Session { get; init; }
    public required Uri Url { get; init; }
    public required string Reason { get; init; }
    public required string ReleaseHash { get; init; }
}
