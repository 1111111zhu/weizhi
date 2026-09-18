using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed record DesktopAgentHealth
{
    public required bool Ok { get; init; }
    public required string App { get; init; }
    public required string Version { get; init; }
    public required string ManagerVersion { get; init; }
    public required string AgentVersion { get; init; }
    public required string AgentState { get; init; }
    public required string UpdateState { get; init; }
    public required string RestoreState { get; init; }
    public required int AttentionCount { get; init; }
    public required int QuarantineCount { get; init; }
}

public sealed record DesktopAgentAuthStatus
{
    public required bool Ok { get; init; }
    public required bool Authenticated { get; init; }
    public required bool Pairing { get; init; }
    public string? LastError { get; init; }
    public DesktopAgentAuthUser? User { get; init; }
}

public sealed record DesktopAgentAuthUser
{
    public required string Id { get; init; }
    public required string Email { get; init; }
    public required string Name { get; init; }
    public string? GlobalRole { get; init; }
}

public sealed record DesktopAgentPairRequest
{
    public string? ClientId { get; init; }
    public string? DeviceCode { get; init; }
    public string? AuthBaseUrl { get; init; }
    public int ExpiresInSeconds { get; init; }
    public int IntervalSeconds { get; init; }
}

public sealed record DesktopAgentOpenRequest
{
    public string? RequestId { get; init; }
    public string? Mode { get; init; }
    public string? ProjectId { get; init; }
    public string? AttachmentId { get; init; }
    public string? FileName { get; init; }
    public string? DownloadUrl { get; init; }
    public string? CheckInUrl { get; init; }
    public string? ReleaseUrl { get; init; }
    public string? LockSessionId { get; init; }
    public int? BaseVersion { get; init; }
    public string? BaseVersionId { get; init; }
    public int? LockEpoch { get; init; }
    public string? CacheVersionId { get; init; }
    public string? CacheOwnerId { get; init; }
    public long? FileSize { get; init; }
    public string? ContentToken { get; init; }
    public string? ContentHash { get; init; }
    public string? GrantSecret { get; init; }
    public bool? DirectUploadSupported { get; init; }
    public string? MimeType { get; init; }
}

public sealed record DesktopAgentOpenResponse
{
    public required bool Ok { get; init; }
    public string? RequestId { get; init; }
    public required string SessionId { get; init; }
    public required string LocalPath { get; init; }
    public required string OpenedAt { get; init; }
}

public sealed record DesktopAgentSession
{
    public int SchemaVersion { get; init; } = 1;
    public required string SessionId { get; init; }
    public required int Generation { get; init; }
    public required string Mode { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string FileName { get; init; }
    public required string LocalPath { get; init; }
    public required string OriginalHash { get; init; }
    public required string LastKnownHash { get; init; }
    public required string Status { get; init; }
    public required string LifecycleState { get; init; }
    public required string ContentState { get; init; }
    public required string OpenedAt { get; init; }
    public required string LaunchStartedAt { get; init; }
    public required string LastSeenAt { get; init; }
    public string? CheckInUrl { get; init; }
    public string? ReleaseUrl { get; init; }
    public string? LockSessionId { get; init; }
    public int? BaseVersion { get; init; }
    public string? BaseVersionId { get; init; }
    public int? LockEpoch { get; init; }
    public string? CacheVersionId { get; init; }
    public string? CacheOwnerId { get; init; }
    public long? FileSize { get; init; }
    public string? ContentToken { get; init; }
    public string? ContentHash { get; init; }
    public string? GrantSecret { get; init; }
    public bool? DirectUploadSupported { get; init; }
    public string? MimeType { get; init; }
    public string? OpenSignalToken { get; init; }
    public string? CloseSignalToken { get; init; }
    public string? OpenObservedAt { get; init; }
    public string? OpenObservedSource { get; init; }
    public string? LaunchFailedReason { get; init; }
    public string? CloseDetectedAt { get; init; }
    public string? CloseDetectedSource { get; init; }
    public string? LastObservationAt { get; init; }
    public string? LastObservationDiagnostic { get; init; }
    public string? LastError { get; init; }
    public int? ExcelHelperProcessId { get; init; }
    public int? ObserverProcessId { get; init; }
    public string? ObserverKind { get; init; }
    public string? ObserverExecutablePath { get; init; }
    public int? RetryCount { get; init; }
}

public sealed record DesktopAgentOpenObservedRequest(
    int Generation,
    string? OpenSignalToken,
    string? Source
);

public sealed record DesktopAgentLaunchFailedRequest
{
    public required int Generation { get; init; }
    public string? OpenSignalToken { get; init; }
    public string? Reason { get; init; }
    public string? Message { get; init; }
}

public sealed record DesktopAgentClosedRequest(
    int Generation,
    string? CloseSignalToken,
    string? Source
);

public sealed record DesktopAgentLaunchAbortReleaseRequest
{
    public required int Generation { get; init; }
    public string? CloseSignalToken { get; init; }
    public required bool ConfirmNoUserVisibleWorkbook { get; init; }
}

public sealed record DesktopAgentSessionEventResponse
{
    public required bool Ok { get; init; }
    public JsonElement? Session { get; init; }
    public DesktopAgentError? SyncError { get; init; }
    public string? Code { get; init; }
    public string? Message { get; init; }
}

public sealed record DesktopAgentSessionEventResult(
    int StatusCode,
    DesktopAgentSessionEventResponse Response
);

public sealed record DesktopAgentSessions(
    bool Ok,
    IReadOnlyList<JsonElement> Sessions,
    IReadOnlyList<DesktopAgentRecentSession> RecentSessions
);

public sealed record DesktopAgentRecentSession(
    string ProjectId,
    string AttachmentId,
    string FileName,
    string Mode,
    string OpenedAt,
    string ClosedAt
);

public sealed record DesktopAgentCheckInRequest
{
    public string? CheckInUrl { get; init; }
    public string? ReleaseUrl { get; init; }
    public string? UploadUrl { get; init; }
}

public sealed record DesktopAgentReleaseRequest
{
    public string? ReleaseUrl { get; init; }
}

public sealed record DesktopAgentSessionResponse(
    bool Ok,
    JsonElement Session
);

public sealed record DesktopAgentUpdateStatus
{
    public required bool Ok { get; init; }
    public required string Status { get; init; }
    public string? TaskId { get; init; }
    public string? Stage { get; init; }
    public string? Message { get; init; }
    public string? ErrorCode { get; init; }
    public string? ExpectedVersion { get; init; }
    public string? CurrentVersion { get; init; }
    public string? StartedAt { get; init; }
    public string? UpdatedAt { get; init; }
    public string? DownloadUrl { get; init; }
    public string? ReportPath { get; init; }
}

public sealed record DesktopAgentUpdateRequest
{
    public string? ExpectedVersion { get; init; }
    public string? ExpectedSha256 { get; init; }
    public long? ExpectedFileSize { get; init; }
    public string? DownloadUrl { get; init; }
    public string? SignaturePolicy { get; init; }
}

public sealed record DesktopAgentError(
    bool Ok,
    string Code,
    string Message
);

public sealed record DesktopAgentPrinter(
    string Name,
    bool IsDefault,
    bool IsOffline
);

public sealed record DesktopAgentPrinters(
    bool Ok,
    IReadOnlyList<DesktopAgentPrinter> Printers
);

public sealed record DesktopAgentPrintDocument
{
    public string? Id { get; init; }
    public string? FileName { get; init; }
    public string? DownloadUrl { get; init; }
}

public sealed record DesktopAgentPrintRequest
{
    public string? PrinterName { get; init; }
    public IReadOnlyList<DesktopAgentPrintDocument>? Documents { get; init; }
}

public sealed record DesktopAgentPrintedDocument(
    string Id,
    string FileName
);

public sealed record DesktopAgentPrintResponse
{
    public required bool Ok { get; init; }
    public required string PrinterName { get; init; }
    public required IReadOnlyList<DesktopAgentPrintedDocument> Printed { get; init; }
}
