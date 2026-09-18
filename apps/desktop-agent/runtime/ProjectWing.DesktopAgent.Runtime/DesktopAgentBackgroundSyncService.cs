using System.Collections.Concurrent;
using System.Text.Json;
using System.Threading.Channels;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentBackgroundSyncService(
    DesktopAgentRuntimeState state,
    DesktopAgentSessionReconciler reconciler,
    DesktopAgentSessionSyncService syncService,
    ILogger<DesktopAgentBackgroundSyncService> logger
) : BackgroundService
{
    private static readonly TimeSpan ScanInterval = TimeSpan.FromSeconds(5);
    private const long SmallFileThresholdBytes = 32L * 1024 * 1024;
    private const int ReleaseWorkerCount = 2;
    private const int SmallFileWorkerCount = 3;
    private readonly Channel<SyncWork> releaseWork = Channel.CreateUnbounded<SyncWork>(
        new UnboundedChannelOptions { SingleReader = false, SingleWriter = false }
    );
    private readonly Channel<SyncWork> smallFileWork = Channel.CreateUnbounded<SyncWork>(
        new UnboundedChannelOptions { SingleReader = false, SingleWriter = false }
    );
    private readonly Channel<SyncWork> largeFileWork = Channel.CreateUnbounded<SyncWork>(
        new UnboundedChannelOptions { SingleReader = true, SingleWriter = false }
    );
    private readonly ConcurrentDictionary<string, SyncPriority> pending = new();
    private readonly ConcurrentDictionary<string, byte> active = new();

    public void Enqueue(JsonElement session)
    {
        var sessionId = ReadString(session, "sessionId");
        if (sessionId is not null) Queue(sessionId, ReadPriority(session));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (true)
        {
            try
            {
                await reconciler.RefreshAsync(stoppingToken);
                await EnqueuePersistedWorkAsync(stoppingToken);
                break;
            }
            catch (Exception error) when (
                !stoppingToken.IsCancellationRequested
                && error is IOException or UnauthorizedAccessException)
            {
                logger.LogError(error, "Background sync could not initialize persisted sessions; initialization will retry.");
                await Task.Delay(ScanInterval, stoppingToken);
            }
        }
        var scan = ScanPersistedWorkAsync(stoppingToken);
        var workers = Enumerable
            .Range(0, ReleaseWorkerCount)
            .Select(_ => RunWorkerAsync(releaseWork.Reader, stoppingToken))
            .Concat(
                Enumerable
                    .Range(0, SmallFileWorkerCount)
                    .Select(_ => RunWorkerAsync(smallFileWork.Reader, stoppingToken))
            )
            .Append(RunWorkerAsync(largeFileWork.Reader, stoppingToken))
            .ToArray();
        await Task.WhenAll(workers.Prepend(scan));
    }

    private async Task ScanPersistedWorkAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(ScanInterval);
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                await EnqueuePersistedWorkAsync(stoppingToken);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogError(
                    error,
                    "Background sync could not scan persisted sessions; the next scan will retry."
                );
            }
        }
    }

    private async Task RunWorkerAsync(
        ChannelReader<SyncWork> reader,
        CancellationToken stoppingToken
    )
    {
        await foreach (var work in reader.ReadAllAsync(stoppingToken))
        {
            if (!TryClaim(work)) continue;
            if (!active.TryAdd(work.SessionId, 0)) continue;
            try
            {
                await TrySyncAsync(work.SessionId, stoppingToken);
            }
            finally
            {
                active.TryRemove(work.SessionId, out _);
            }
        }
    }

    private async Task EnqueuePersistedWorkAsync(CancellationToken cancellationToken)
    {
        var sessions = await state.ReadSessionsAsync(cancellationToken);
        foreach (var session in sessions)
        {
            var lifecycle = ReadString(session, "lifecycleState");
            var closed = session.TryGetProperty("closeDetectedAt", out var closeDetectedAt)
                && closeDetectedAt.ValueKind == JsonValueKind.String;
            if (
                lifecycle is "CLOSE_DETECTED" or "CHECKIN_FAILED"
                    or "RELEASE_PENDING" or "RELEASE_FAILED"
                    or "CLEANUP_PENDING" or "CLEANUP_FAILED"
                || (lifecycle == "LEASE_LOST" && closed)
            )
            {
                if (!IsRetryDue(session)) continue;
                var sessionId = ReadString(session, "sessionId");
                if (sessionId is not null) Queue(sessionId, ReadPriority(session));
            }
        }
    }

    private void Queue(string sessionId, SyncPriority priority)
    {
        while (true)
        {
            if (pending.TryGetValue(sessionId, out var current))
            {
                if (current <= priority) return;
                if (!pending.TryUpdate(sessionId, priority, current)) continue;
            }
            else if (!pending.TryAdd(sessionId, priority))
            {
                continue;
            }
            var work = new SyncWork(sessionId, priority);
            if (!SelectWriter(priority).TryWrite(work))
            {
                TryClaim(work);
                logger.LogWarning(
                    "Background sync queue rejected session {SessionId}; persisted work remains available for recovery.",
                    sessionId
                );
            }
            return;
        }
    }

    private bool TryClaim(SyncWork work)
    {
        return ((ICollection<KeyValuePair<string, SyncPriority>>)pending).Remove(
            new KeyValuePair<string, SyncPriority>(work.SessionId, work.Priority)
        );
    }

    private ChannelWriter<SyncWork> SelectWriter(SyncPriority priority)
    {
        return priority switch
        {
            SyncPriority.Cleanup => releaseWork.Writer,
            SyncPriority.Release => releaseWork.Writer,
            SyncPriority.SmallFile => smallFileWork.Writer,
            _ => largeFileWork.Writer,
        };
    }

    private static SyncPriority ReadPriority(JsonElement session)
    {
        var lifecycle = ReadString(session, "lifecycleState");
        if (lifecycle is "RELEASE_PENDING" or "RELEASE_FAILED")
        {
            return SyncPriority.Release;
        }
        if (lifecycle is "CLEANUP_PENDING" or "CLEANUP_FAILED")
        {
            return SyncPriority.Cleanup;
        }
        var size = ReadInt64(session, "snapshotSize")
            ?? ReadLocalFileSize(ReadString(session, "localPath"));
        return size is null || size <= SmallFileThresholdBytes
            ? SyncPriority.SmallFile
            : SyncPriority.LargeFile;
    }

    private static bool IsRetryDue(JsonElement session)
    {
        var retryCount = session.TryGetProperty("retryCount", out var retry)
            && retry.TryGetInt32(out var value)
            ? value
            : 0;
        if (retryCount <= 0) return true;
        var lifecycle = ReadString(session, "lifecycleState");
        var lastAttempt = lifecycle is "CLEANUP_PENDING" or "CLEANUP_FAILED"
            ? ReadString(session, "lastCleanupAttemptAt")
            : ReadString(session, "lastUploadAttemptAt")
                ?? ReadString(session, "lastReleaseAttemptAt");
        if (!DateTimeOffset.TryParse(lastAttempt, out var attemptedAt)) return true;
        var delaySeconds = Math.Min(300, 5 * Math.Pow(2, Math.Min(retryCount - 1, 6)));
        return DateTimeOffset.UtcNow >= attemptedAt.AddSeconds(delaySeconds);
    }

    private async Task TrySyncAsync(
        string sessionId,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var session = await state.ReadSessionAsync(sessionId, cancellationToken);
            if (session is null) return;
            var lifecycle = ReadString(session.Value, "lifecycleState");
            if (lifecycle is "CLEANUP_PENDING" or "CLEANUP_FAILED")
            {
                await syncService.RecoverCleanupAsync(sessionId, cancellationToken);
                return;
            }
            var checkInUrl = ReadString(session.Value, "checkInUrl");
            var releaseUrl = ReadString(session.Value, "releaseUrl");
            if (releaseUrl is null) return;
            await syncService.CheckInAsync(
                sessionId,
                new DesktopAgentCheckInRequest
                {
                    CheckInUrl = checkInUrl,
                    ReleaseUrl = releaseUrl,
                },
                cancellationToken
            );
        }
        catch (DesktopAgentRuntimeException)
        {
            // The persisted failure state is retried by the next scan.
        }
        catch (Exception error) when (
            !cancellationToken.IsCancellationRequested
        )
        {
            try
            {
                await syncService.RecoverUnexpectedFailureAsync(
                    sessionId,
                    error,
                    CancellationToken.None
                );
            }
            catch (Exception recoveryError)
            {
                logger.LogError(
                    recoveryError,
                    "Background sync could not persist recovery state for session {SessionId}.",
                    sessionId
                );
            }
            logger.LogError(
                error,
                "Background sync failed unexpectedly for session {SessionId}; persisted work will be retried.",
                sessionId
            );
        }
    }

    private static long? ReadInt64(JsonElement value, string name) =>
        value.TryGetProperty(name, out var property)
        && property.ValueKind == JsonValueKind.Number
        && property.TryGetInt64(out var result)
            ? result
            : null;

    private static long? ReadLocalFileSize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return null;
        try
        {
            return new FileInfo(path).Length;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or NotSupportedException
        )
        {
            return null;
        }
    }

    private static string? ReadString(JsonElement value, string name) =>
        value.TryGetProperty(name, out var property)
        && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;

    private readonly record struct SyncWork(string SessionId, SyncPriority Priority);

    private enum SyncPriority
    {
        Cleanup = 0,
        Release = 1,
        SmallFile = 2,
        LargeFile = 3,
    }
}
