using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using ProjectWing.DesktopAgent.Runtime;

if (args is ["--probe-packaged-runtime", var executable])
{
    await StateDirectoryChecks.ProbePackagedRuntimeAsync(executable);
    return;
}

// In-process tests only: no listeners, browser, OS registration or Office.
// Every state/cache path is generated under this test's own temporary root.
var root = Path.Combine(Path.GetTempPath(), $"project-wing-data-safety-{Guid.NewGuid():N}");
Directory.CreateDirectory(root);
foreach (var scenario in new[] { "cache-delete", "cache-protected", "cache-reclaimed", "cache-orphan", "cache-changed", "cache-readonly", "end-missing", "end-readonly", "end-dirty", "end-network", "end-old-server", "end-open", "end-outside", "end-changed", "release-dirty", "release-failed", "release-open", "upload-new-bytes", "cleanup-new-bytes", "cleanup-release-new-bytes", "cleanup-checkin-response", "lease-unchanged-release", "lease-unchanged-checkin", "lease-unchanged-snapshot", "backup-missing", "backup-corrupt", "quarantine-capacity", "cache-switch" })
{
    var directory = Path.Combine(root, scenario);
    var configuration = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
    {
        ["PROJECT_WING_AGENT_STATE_ROOT"] = Path.Combine(directory, "state"),
        ["PROJECT_WING_AGENT_CACHE_ROOT"] = Path.Combine(directory, "cache"),
        ["PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH"] = "true",
        ["PROJECT_WING_AGENT_ALLOWED_DOWNLOAD_ORIGINS"] = "https://fixture.invalid",
        ["PROJECT_WING_AGENT_CACHE_MAX_BYTES"] = "1073741824",
    }).Build();
    var options = DesktopAgentRuntimeOptions.FromConfiguration(configuration);
    Directory.CreateDirectory(options.StateRoot);
    Directory.CreateDirectory(options.CacheRoot);
    var state = new DesktopAgentRuntimeState(options);
    var cache = new DesktopAgentCacheService(options, state, NullLogger<DesktopAgentCacheService>.Instance);
    var path = Path.Combine(options.CacheRoot, "synthetic.txt");
    await File.WriteAllTextAsync(path, "unuploaded edits");
    var session = Session(path) with { LifecycleState = scenario == "release-open" ? "OPEN" : "CHECKIN_FAILED" };
    await state.UpsertSessionAsync(session, default);
    var handler = new FixtureHandler { FailUpload = scenario == "release-failed" };
    using var http = new HttpClient(handler);
    var diagnostics = new DesktopAgentTransferDiagnosticLog(options);
    var remote = new DesktopAgentSessionRemoteClient(http, diagnostics);
    var service = new DesktopAgentSessionSyncService(options, state, remote, new DesktopAgentUploadSnapshotService(options, cache), cache, diagnostics);

    if (scenario.StartsWith("cache-") && scenario != "cache-switch")
    {
        if (scenario != "cache-protected") await state.RemoveSessionAsync("s", _ => true, default);
        await cache.RecordAsync(path, scenario == "cache-orphan" ? "ORPHAN" : "CONTENT", default);
        if (scenario == "cache-readonly") File.SetAttributes(path, FileAttributes.ReadOnly);
        var listing = await cache.ReadFilesAsync(default);
        var row = listing.Files.Single();
        Require(row.FileName == "synthetic.txt" && row.Size > 0, "cache listing exposes filenames and byte sizes");
        Require(row.CanDelete == (scenario != "cache-protected" && scenario != "cache-orphan"), "only disposable untracked copies are deletable");
        if (scenario == "cache-reclaimed") await state.UpsertSessionAsync(session, default);
        if (scenario == "cache-changed") await File.WriteAllTextAsync(path, "newer cached content");
        var shouldDelete = scenario is "cache-delete" or "cache-readonly";
        try { await cache.DeleteFileAsync(row.Id, default); Require(shouldDelete, "unsafe deletion must fail"); }
        catch (DesktopAgentRuntimeException) when (!shouldDelete) { }
        Require(File.Exists(path) != shouldDelete, "protected, reclaimed, changed and orphan files are retained");
        if (shouldDelete) Require((await cache.ReadFilesAsync(default)).Files.Count == 0, "deleted cache is removed from the refreshed listing");
    }
    else if (scenario.StartsWith("end-"))
    {
        await state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node =>
        {
            node["lifecycleState"] = scenario == "end-open" ? "OPEN" : "LOCAL_FILE_MISSING";
            if (scenario == "end-readonly") node["mode"] = "READ_ONLY";
            if (scenario == "end-outside") node["localPath"] = Path.Combine(directory, "outside.txt");
        }), default);
        if (scenario is "end-missing" or "end-readonly") File.Delete(path);
        if (scenario == "end-outside") await File.WriteAllTextAsync(Path.Combine(directory, "outside.txt"), "outside data");
        handler.FailResolution = scenario == "end-network";
        handler.OldResolution = scenario == "end-old-server";
        handler.OnResolution = scenario == "end-changed" ? () => state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node => node["generation"] = 2), default).GetAwaiter().GetResult() : null;
        var shouldSucceed = scenario is "end-missing" or "end-readonly" or "end-dirty";
        var succeeded = false;
        try { await service.EndTrackingAsync("s", default); succeeded = true; }
        catch (DesktopAgentRuntimeException) when (!shouldSucceed) { }
        Require(succeeded == shouldSucceed, "resolution result must reflect durable completion");
        Require(((await state.ReadSessionAsync("s", default)) is null) == shouldSucceed, "only confirmed resolution removes the active row");
        if (scenario == "end-dirty")
        {
            Require(await File.ReadAllTextAsync(path) == "unuploaded edits", "resolution never deletes originals");
            var preserved = Directory.GetFiles(Path.Combine(options.StateRoot, "resolved-sessions"), "localPath-*", SearchOption.AllDirectories);
            Require(preserved.Length == 1 && await File.ReadAllTextAsync(preserved[0]) == "unuploaded edits", "resolution preserves dirty bytes outside evictable cache");
        }
        Require(!handler.Paths.Contains("/check-in"), "resolution must not upload or overwrite server data");
        if (scenario == "end-readonly") Require(handler.Paths.Count == 0, "readonly record has no server editing lease to release");
        if (scenario == "end-network")
        {
            handler.FailResolution = false;
            await service.EndTrackingAsync("s", default);
            Require(await state.ReadSessionAsync("s", default) is null, "failed resolution can be retried");
        }
    }
    else if (scenario.StartsWith("release-"))
    {
        try { await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default); }
        catch (DesktopAgentRuntimeException) when (scenario is "release-failed" or "release-open") { }
        if (scenario == "release-dirty")
        {
            Require(handler.Paths.SequenceEqual(new[] { "/check-in", "/release" }), "dirty bytes must upload before release");
            Require(!File.Exists(path), "successfully uploaded file should clean up");
        }
        else
        {
            Require(File.Exists(path) && await File.ReadAllTextAsync(path) == "unuploaded edits", "failed/open release must retain bytes");
            Require(!handler.Paths.Contains("/release"), "failed/open upload must not release lease");
        }
    }
    else if (scenario == "upload-new-bytes")
    {
        handler.OnUpload = () => File.WriteAllText(path, "even newer edits");
        try { await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default); }
        catch (DesktopAgentRuntimeException error) when (error.Code == "LOCAL_CHANGES_PENDING") { }
        Require(handler.Paths.SequenceEqual(new[] { "/check-in" }), "newer source must retain lease for retry");
        Require(await File.ReadAllTextAsync(path) == "even newer edits", "newer bytes must remain available");
        handler.OnUpload = null;
        await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default);
        Require(handler.Paths.SequenceEqual(new[] { "/check-in", "/check-in", "/release" }), "retry must upload latest bytes before releasing");
    }
    else if (scenario is "cleanup-new-bytes" or "cleanup-release-new-bytes")
    {
        await state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node =>
        {
            node["lifecycleState"] = "CLEANUP_PENDING";
            node["pendingReleaseHash"] = Hash("older uploaded bytes");
        }), default);
        try
        {
            if (scenario == "cleanup-release-new-bytes")
                await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default);
            else await service.RecoverCleanupAsync("s", default);
        }
        catch (DesktopAgentRuntimeException) { }
        Require(await File.ReadAllTextAsync(path) == "unuploaded edits", "cleanup must not delete newer bytes");
        Require((await state.ReadSessionAsync("s", default))?.GetProperty("lifecycleState").GetString() == "LEASE_LOST", "newer cleanup bytes must enter automatic recovery");
    }
    else if (scenario == "cleanup-checkin-response")
    {
        await state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node =>
        {
            node["lifecycleState"] = "CLEANUP_FAILED";
            node["pendingReleaseHash"] = Hash("unuploaded edits");
        }), default);
        var result = await service.CheckInAsync("s", new DesktopAgentCheckInRequest { CheckInUrl = "https://fixture.invalid/check-in", ReleaseUrl = "https://fixture.invalid/release" }, default);
        Require(result.Session.GetProperty("status").GetString() == "CLOSED", "check-in cleanup route must return the closed response");
        Require(!File.Exists(path) && handler.Paths.Count == 0, "already-released cleanup must be local only");
    }
    else if (scenario == "lease-unchanged-snapshot")
    {
        var snapshot = Path.Combine(options.CacheRoot, "unconfirmed-snapshot.txt");
        await File.WriteAllTextAsync(path, "original");
        await File.WriteAllTextAsync(snapshot, "snapshot-only edits");
        await state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node =>
        {
            node["lifecycleState"] = "LEASE_LOST";
            node["snapshotPath"] = snapshot;
            node["snapshotHash"] = Hash("snapshot-only edits");
        }), default);
        var preserved = false;
        try { await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default); }
        catch (DesktopAgentRuntimeException error) when (error.Code == "LOCAL_CHANGES_PRESERVED") { preserved = true; }
        Require(preserved && File.Exists(path) && await File.ReadAllTextAsync(snapshot) == "snapshot-only edits", "unchanged local file must not authorize deletion of an unconfirmed snapshot");
    }
    else if (scenario is "lease-unchanged-release" or "lease-unchanged-checkin")
    {
        await File.WriteAllTextAsync(path, "original");
        await state.MutateSessionAsync("s", new DesktopAgentSessionMutation(_ => true, node => node["lifecycleState"] = "LEASE_LOST"), default);
        var result = scenario == "lease-unchanged-release"
            ? await service.ReleaseAsync("s", new DesktopAgentReleaseRequest { ReleaseUrl = "https://fixture.invalid/release" }, default)
            : await service.CheckInAsync("s", new DesktopAgentCheckInRequest { CheckInUrl = "https://fixture.invalid/check-in", ReleaseUrl = "https://fixture.invalid/release" }, default);
        Require(result.Session.GetProperty("status").GetString() == "CLOSED", "unchanged lease-lost route must close locally");
        Require(!File.Exists(path) && handler.Paths.Count == 0, "unchanged lease-lost cleanup must not call the expired remote lease");
    }
    else if (scenario == "backup-missing")
    {
        var main = Path.Combine(options.StateRoot, "sessions.json");
        File.Move(main, main + ".bak2");
        Require((await state.ReadSessionsAsync(default)).Count == 1, "missing primary and first backup must restore second backup");
        Require(File.Exists(main), "restoration should persist primary");
    }
    else if (scenario == "backup-corrupt")
    {
        foreach (var suffix in new[] { "", ".bak", ".bak2" })
            await File.WriteAllTextAsync(Path.Combine(options.StateRoot, "sessions.json" + suffix), "not valid json");
        Require((await state.ReadSessionsAsync(default)).Count == 0, "unreadable records must not crash the runtime");
        Require(state.ReadDiagnostics().QuarantineCount > 0, "unreadable records must be reported as unresolved");
        Require(await File.ReadAllTextAsync(path) == "unuploaded edits", "quarantine must preserve local work");
    }
    else if (scenario == "quarantine-capacity")
    {
        Directory.CreateDirectory(Path.Combine(options.StateRoot, "session-quarantine"));
        await File.WriteAllTextAsync(Path.Combine(options.StateRoot, "session-quarantine", "audit.json"), "{}");
        await cache.EnsureCapacityAsync(1, Path.Combine(options.CacheRoot, "next.txt"), default);
        Require(File.Exists(path), "quarantine must preserve files while allowing safe allocation");
    }
    else if (scenario == "cache-switch")
    {
        var blocked = false;
        try { await state.BeginCacheChangeAsync(default); }
        catch (DesktopAgentRuntimeException e) when (e.Code == "CACHE_CHANGE_REQUIRES_IDLE") { blocked = true; }
        Require(blocked, "active sessions must prevent root switch");
        await state.RemoveSessionAsync("s", _ => true, default);
        await state.BeginCacheChangeAsync(default);
        blocked = false;
        try { await state.UpsertSessionAsync(session, default); }
        catch (DesktopAgentRuntimeException e) when (e.Code == "CACHE_CHANGE_IN_PROGRESS") { blocked = true; }
        Require(blocked, "reserved root switch must prevent concurrent new session");
        await state.CancelCacheChangeAsync();
        await state.UpsertSessionAsync(session, default);
    }
    Console.WriteLine($"PASS {scenario}");
}
Console.WriteLine($"Isolated fixture evidence retained at {root}");
await CacheReplacementChecks.RunAsync(root);
await StateDirectoryChecks.RunAsync(root, Session);

static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
static string Hash(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value))).ToLowerInvariant();
static DesktopAgentSession Session(string path) => new()
{
    SessionId = "s", Generation = 1, Mode = "MASTER", ProjectId = "p", AttachmentId = "a", FileName = "synthetic.txt", LocalPath = path,
    OriginalHash = Hash("original"), LastKnownHash = Hash("unuploaded edits"), Status = "CHECKIN_FAILED", LifecycleState = "CHECKIN_FAILED", ContentState = "DIRTY",
    OpenedAt = DateTime.UtcNow.ToString("O"), LaunchStartedAt = DateTime.UtcNow.ToString("O"), LastSeenAt = DateTime.UtcNow.ToString("O"), CloseDetectedAt = DateTime.UtcNow.ToString("O"),
    CheckInUrl = "https://fixture.invalid/check-in", ReleaseUrl = "https://fixture.invalid/release", DirectUploadSupported = false,
};
sealed class FixtureHandler : HttpMessageHandler
{
    public bool FailResolution { get; set; }
    public bool OldResolution { get; set; }
    public Action? OnResolution { get; set; }
    public bool FailUpload { get; init; }
    public Action? OnUpload { get; set; }
    public List<string> Paths { get; } = [];
    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.RequestUri?.Host != "fixture.invalid") throw new Exception("Unexpected network target");
        Paths.Add(request.RequestUri.AbsolutePath);
        if (request.RequestUri.AbsolutePath == "/end-tracking")
        {
            OnResolution?.Invoke();
            return Task.FromResult(new HttpResponseMessage(FailResolution ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK)
            { Content = new StringContent(JsonSerializer.Serialize(new { ok = !FailResolution, recoveryEnded = !OldResolution, code = "RELEASE_FAILED" }), Encoding.UTF8, "application/json") });
        }
        if (request.RequestUri.AbsolutePath == "/check-in") OnUpload?.Invoke();
        return Task.FromResult(new HttpResponseMessage(FailUpload ? HttpStatusCode.ServiceUnavailable : HttpStatusCode.OK)
        { Content = new StringContent(JsonSerializer.Serialize(new { ok = !FailUpload, code = "UPLOAD_FAILED", message = "Synthetic upload failure" }), Encoding.UTF8, "application/json") });
    }
}
