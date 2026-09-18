namespace ProjectWing.AgentManager;

internal sealed record RuntimeConfig(
    string AppDirectory,
    string AgentVersion,
    string StateRoot,
    string ApiBaseUrl,
    string AuthBaseUrl,
    string AllowedDownloadOrigins,
    string AllowedWebOrigins,
    string AllowedAuthOrigins,
    string WatcherPath,
    string ManagerPath,
    string RuntimePath,
    int RuntimePort,
    int WorkerPort
);

internal sealed record WorkerHealthProbe
{
    public required string AgentState { get; init; }
    public string? AgentVersion { get; init; }
    public required string UpdateState { get; init; }
    public required string RestoreState { get; init; }
    public required int AttentionCount { get; init; }
    public required int QuarantineCount { get; init; }
}

internal sealed record DesktopAgentHealthSnapshot(string? Version, bool IsReady);

internal sealed class UpdateStatus(string status)
{
    public bool Ok { get; set; }
    public string Status { get; set; } = status;
    public string? Stage { get; set; }
    public string? TaskId { get; set; }
    public string? Message { get; set; }
    public string? ErrorCode { get; set; }
    public string? ExpectedVersion { get; set; }
    public string? CurrentVersion { get; set; }
    public string? StartedAt { get; set; }
    public string? UpdatedAt { get; set; }
    public string? DownloadUrl { get; set; }
    public string? InstallerPath { get; set; }
    public string? ReportPath { get; set; }
    public string? OwnerKind { get; set; }
    public int? OwnerPid { get; set; }
    public string? OwnerStartTimeUtcTicks { get; set; }
    public string? OwnerProcessIdentity { get; set; }
    public int? InstallerPid { get; set; }
    public string? InstallerStartTimeUtcTicks { get; set; }
    public string? InstallerProcessIdentity { get; set; }
    public string? HandoffPhase { get; set; }
}
