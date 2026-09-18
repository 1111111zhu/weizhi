using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentCacheService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentRuntimeState state,
    ILogger<DesktopAgentCacheService> logger
)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };
    private readonly SemaphoreSlim gate = new(1, 1);
    private bool indexedScanComplete;
    private string IndexPath => Path.Combine(options.StateRoot, "cache-index.json");
    private string MetricsPath => Path.Combine(options.StateRoot, "cache-metrics.json");

    public async Task EnsureCapacityAsync(
        long incomingBytes,
        string destinationPath,
        CancellationToken cancellationToken,
        IEnumerable<string>? additionalProtectedPaths = null
    )
    {
        AssertFitsCache(incomingBytes);
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            var protectedPaths = await ReadProtectedPathsAsync(cancellationToken);
            var diagnostics = state.ReadDiagnostics();
            var evictionPaused = diagnostics.QuarantineCount != 0 || diagnostics.RestoreState != "READY";
            protectedPaths.Add(Normalize(destinationPath));
            if (additionalProtectedPaths is not null)
            {
                foreach (var path in additionalProtectedPaths)
                {
                    protectedPaths.Add(Normalize(path));
                }
            }
            if (!indexedScanComplete)
            {
                DiscoverUnindexedFiles(entries);
                indexedScanComplete = true;
            }
            PruneMissing(entries);

            // Unresolved recovery forbids eviction, not safe allocation. Otherwise
            // one historical quarantined record prevents all future check-ins.
            if (evictionPaused)
            {
                if (entries.Sum(entry => entry.Size) + incomingBytes > options.CacheMaxBytes
                    || !HasDiskReserve(incomingBytes))
                    throw new DesktopAgentRuntimeException("CACHE_RECOVERY_REQUIRED",
                        "Local work is preserved. More cache capacity is needed, but unresolved recovery files cannot be automatically removed.",
                        StatusCodes.Status409Conflict);
                await WriteIndexAsync(entries, cancellationToken);
                return;
            }

            var now = DateTimeOffset.UtcNow;
            var protectedBytes = entries.Where(entry => !CanEvict(entry) || protectedPaths.Contains(Normalize(entry.Path))).Sum(entry => entry.Size);
            if (incomingBytes > 0 && protectedBytes > options.CacheMaxBytes - incomingBytes)
                throw new DesktopAgentRuntimeException("DISK_FULL", "Protected working or recovery files leave insufficient cache capacity. Finish synchronization or increase the limit; no cached files were evicted.", 507);
            foreach (
                var expired in entries
                    .Where(entry =>
                        entry.ExpiresAt <= now
                        && CanEvict(entry)
                        && !protectedPaths.Contains(Normalize(entry.Path))
                    )
                    .ToArray()
            )
            {
                if (TryDeleteControlledFile(expired.Path)) entries.Remove(expired);
            }
            if (protectedBytes > options.CacheMaxBytes - incomingBytes)
            {
                // Expired disposable copies are still cleaned during routine
                // maintenance, even if protected work alone exceeds the limit.
                await WriteIndexAsync(entries, cancellationToken);
                throw new DesktopAgentRuntimeException("DISK_FULL", "Protected working or recovery files exceed the cache capacity. Increase the limit or finish synchronization.", 507);
            }
            foreach (
                var entry in entries
                    .Where(entry => CanEvict(entry) && !protectedPaths.Contains(Normalize(entry.Path)))
                    .OrderBy(entry => options.CacheEvictionPolicy == "FIFO" ? entry.CachedAt ?? entry.LastAccessAt : entry.LastAccessAt)
                    .ToArray()
            )
            {
                var indexedBytes = entries.Sum(item => item.Size);
                if (
                    indexedBytes + incomingBytes <= options.CacheMaxBytes
                    && HasDiskReserve(incomingBytes)
                )
                {
                    break;
                }
                if (TryDeleteControlledFile(entry.Path))
                {
                    entries.Remove(entry);
                }
            }

            if (
                entries.Sum(entry => entry.Size) + incomingBytes > options.CacheMaxBytes
                || !HasDiskReserve(incomingBytes)
            )
            {
                throw new DesktopAgentRuntimeException(
                    "DISK_FULL",
                    "There is not enough controlled cache capacity for this file.",
                    StatusCodes.Status507InsufficientStorage
                );
            }
            await WriteIndexAsync(entries, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task RecordAsync(
        string path,
        string kind,
        CancellationToken cancellationToken,
        IEnumerable<string>? additionalProtectedPaths = null
    )
    {
        var file = new FileInfo(path);
        if (!file.Exists) return;
        AssertFitsCache(file.Length);
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            var previous = entries.FirstOrDefault(entry => PathEquals(entry.Path, file.FullName));
            entries.RemoveAll(entry => PathEquals(entry.Path, file.FullName));
            entries.Add(new DesktopAgentCacheEntry
            {
                Path = file.FullName,
                Kind = kind,
                Size = file.Length,
                CachedAt = previous?.CachedAt ?? previous?.LastAccessAt ?? DateTimeOffset.UtcNow,
                LastAccessAt = DateTimeOffset.UtcNow,
                ExpiresAt = DateTimeOffset.UtcNow.Add(options.CacheTtl),
            });
            await WriteIndexAsync(entries, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
        await EnsureCapacityAsync(
            0,
            file.FullName,
            cancellationToken,
            additionalProtectedPaths
        );
    }

    public async Task RemoveAsync(string? path, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            if (entries.RemoveAll(entry => PathEquals(entry.Path, path)) > 0)
            {
                await WriteIndexAsync(entries, cancellationToken);
            }
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task RecordHitAsync(long savedBytes, CancellationToken cancellationToken)
    {
        await UpdateCountersAsync(hitBytes: Math.Max(0, savedBytes), miss: false, cancellationToken);
    }

    public async Task RecordMissAsync(CancellationToken cancellationToken)
    {
        await UpdateCountersAsync(hitBytes: 0, miss: true, cancellationToken);
    }

    public async Task<DesktopAgentCacheMetrics> ReadMetricsAsync(
        CancellationToken cancellationToken
    )
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            if (!indexedScanComplete)
            {
                DiscoverUnindexedFiles(entries);
                indexedScanComplete = true;
            }
            PruneMissing(entries);
            await WriteIndexAsync(entries, cancellationToken);
            var counters = await ReadCountersAsync(cancellationToken);
            return new DesktopAgentCacheMetrics
            {
                UsedBytes = entries.Sum(entry => entry.Size),
                EntryCount = entries.Count,
                OrphanBytes = entries
                    .Where(entry => entry.Kind == "ORPHAN")
                    .Sum(entry => entry.Size),
                OrphanCount = entries.Count(entry => entry.Kind == "ORPHAN"),
                HitCount = counters.HitCount,
                MissCount = counters.MissCount,
                BytesSaved = counters.BytesSaved,
            };
        }
        finally
        {
            gate.Release();
        }
    }

    public async Task CollectGarbageAsync(CancellationToken cancellationToken)
    {
        await EnsureCapacityAsync(0, Path.Combine(options.CacheRoot, ".maintenance"), cancellationToken);
    }

    private async Task<HashSet<string>> ReadProtectedPathsAsync(
        CancellationToken cancellationToken
    )
    {
        var comparer = PathComparer;
        var result = new HashSet<string>(comparer);
        foreach (var session in await state.ReadSessionsAsync(cancellationToken))
        {
            AddPath(session, "localPath", result);
            AddPath(session, "snapshotPath", result);
        }
        return result;
    }

    private static void AddPath(
        JsonElement session,
        string propertyName,
        HashSet<string> paths
    )
    {
        if (
            session.TryGetProperty(propertyName, out var property)
            && property.ValueKind == JsonValueKind.String
            && property.GetString() is { Length: > 0 } path
        )
        {
            paths.Add(Normalize(path));
        }
    }

    private async Task<List<DesktopAgentCacheEntry>> ReadIndexAsync(
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(IndexPath)) return [];
        try
        {
            var json = await File.ReadAllTextAsync(IndexPath, cancellationToken);
            var entries = JsonSerializer.Deserialize<List<DesktopAgentCacheEntry>>(json, JsonOptions) ?? [];
            return entries.Select(entry => entry with {
                CachedAt = entry.CachedAt ?? entry.LastAccessAt,
                ExpiresAt = entry.LastAccessAt.Add(options.CacheTtl),
            }).ToList();
        }
        catch (Exception error) when (error is IOException or JsonException or ArgumentException)
        {
            logger.LogWarning(error, "Cache index is unreadable and will be rebuilt.");
            return [];
        }
    }

    private async Task WriteIndexAsync(
        IReadOnlyCollection<DesktopAgentCacheEntry> entries,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(options.StateRoot);
        var temporary = $"{IndexPath}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            ))
            {
                await JsonSerializer.SerializeAsync(
                    stream,
                    entries,
                    JsonOptions,
                    cancellationToken
                );
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporary, IndexPath, overwrite: true);
        }
        catch
        {
            try { File.Delete(temporary); } catch (IOException) { }
            throw;
        }
    }

    private async Task UpdateCountersAsync(
        long hitBytes,
        bool miss,
        CancellationToken cancellationToken
    )
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var counters = await ReadCountersAsync(cancellationToken);
            var updated = counters with
            {
                HitCount = counters.HitCount + (miss ? 0 : 1),
                MissCount = counters.MissCount + (miss ? 1 : 0),
                BytesSaved = counters.BytesSaved + hitBytes,
            };
            await WriteJsonAtomicallyAsync(MetricsPath, updated, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    private async Task<DesktopAgentCacheCounters> ReadCountersAsync(
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(MetricsPath)) return new DesktopAgentCacheCounters();
        try
        {
            var json = await File.ReadAllTextAsync(MetricsPath, cancellationToken);
            return JsonSerializer.Deserialize<DesktopAgentCacheCounters>(json, JsonOptions)
                ?? new DesktopAgentCacheCounters();
        }
        catch (Exception error) when (error is IOException or JsonException)
        {
            logger.LogWarning(error, "Cache metrics are unreadable and will be rebuilt.");
            return new DesktopAgentCacheCounters();
        }
    }

    private static async Task WriteJsonAtomicallyAsync<T>(
        string path,
        T value,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
        var temporary = $"{path}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var stream = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                16 * 1024,
                FileOptions.Asynchronous | FileOptions.WriteThrough
            ))
            {
                await JsonSerializer.SerializeAsync(stream, value, JsonOptions, cancellationToken);
                await stream.FlushAsync(cancellationToken);
                stream.Flush(flushToDisk: true);
            }
            File.Move(temporary, path, overwrite: true);
        }
        catch
        {
            try { File.Delete(temporary); } catch (IOException) { }
            throw;
        }
    }

    private bool HasDiskReserve(long incomingBytes)
    {
        var root = Path.GetPathRoot(Path.GetFullPath(options.CacheRoot));
        if (root is null) return true;
        var reserve = Math.Clamp(options.CacheMaxBytes / 10, 1024L * 1024 * 1024, 5L * 1024 * 1024 * 1024);
        return new DriveInfo(root).AvailableFreeSpace - incomingBytes >= reserve;
    }

    private static void PruneMissing(List<DesktopAgentCacheEntry> entries)
    {
        entries.RemoveAll(entry =>
            !File.Exists(entry.Path)
            || IsCacheManifest(entry.Path)
        );
    }

    private void DiscoverUnindexedFiles(List<DesktopAgentCacheEntry> entries)
    {
        if (!Directory.Exists(options.CacheRoot)) return;
        var known = entries
            .Select(entry => Normalize(entry.Path))
            .ToHashSet(PathComparer);
        foreach (
            var path in Directory.EnumerateFiles(
                options.CacheRoot,
                "*",
                SearchOption.AllDirectories
            )
        )
        {
            if (path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase)) continue;
            if (Path.GetFileName(path) == ".cache-owner.lock") continue;
            if (IsCacheManifest(path)) continue;
            var normalized = Normalize(path);
            if (!known.Add(normalized)) continue;
            try
            {
                var file = new FileInfo(normalized);
                var lastAccess = new DateTimeOffset(
                    file.LastWriteTimeUtc,
                    TimeSpan.Zero
                );
                entries.Add(new DesktopAgentCacheEntry
                {
                    Path = normalized,
                    Kind = normalized.Contains(
                        $"{Path.DirectorySeparatorChar}.check-in-staging{Path.DirectorySeparatorChar}",
                        PathComparison
                    ) ? "SNAPSHOT" : "ORPHAN",
                    Size = file.Length,
                    LastAccessAt = lastAccess,
                    ExpiresAt = lastAccess.Add(options.CacheTtl),
                });
            }
            catch (Exception error) when (
                error is IOException or UnauthorizedAccessException
            )
            {
                logger.LogDebug(error, "Could not index cache file {Path}.", path);
            }
        }
    }

    // Missing ownership/receipts are not evidence that work is disposable.
    // Master files and upload snapshots are removed only by their completed
    // session cleanup, never by age or disk pressure.
    private static bool CanEvict(DesktopAgentCacheEntry entry) =>
        entry.Kind is "CONTENT" or "READ_ONLY";

    private void AssertFitsCache(long bytes)
    {
        if (bytes < 0) throw new DesktopAgentRuntimeException("VALIDATION_FAILED", "Incoming cache size must be non-negative.", 400);
        if (bytes > options.CacheMaxBytes) throw new DesktopAgentRuntimeException("CACHE_FILE_TOO_LARGE", "This file exceeds the cache capacity limit. Increase the limit before opening it; existing cache was retained.", 507);
    }

    private bool TryDeleteControlledFile(string path)
    {
        try
        {
            var fullPath = Normalize(path);
            var root = Normalize(options.CacheRoot)
                .TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)
                + Path.DirectorySeparatorChar;
            if (!fullPath.StartsWith(root, PathComparison)) return false;
            if (File.Exists(fullPath))
            {
                File.SetAttributes(fullPath, FileAttributes.Normal);
                File.Delete(fullPath);
            }
            if (fullPath.Contains(
                $"{Path.DirectorySeparatorChar}.content-cache{Path.DirectorySeparatorChar}",
                PathComparison
            ))
            {
                var manifest = Path.Combine(
                    Path.GetDirectoryName(fullPath)!,
                    ".project-wing-content-cache.json"
                );
                if (File.Exists(manifest)) File.Delete(manifest);
            }
            return true;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            logger.LogDebug(error, "Could not evict cache file {Path}.", path);
            return false;
        }
    }

    private static bool PathEquals(string left, string right) =>
        string.Equals(Normalize(left), Normalize(right), PathComparison);

    private static bool IsCacheManifest(string path)
    {
        var name = Path.GetFileName(path);
        return name is ".project-wing-cache.json" or ".project-wing-content-cache.json";
    }

    private static string Normalize(string path) => Path.GetFullPath(path);

    private static StringComparer PathComparer =>
        OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal;

    private static StringComparison PathComparison =>
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;
}

public sealed record DesktopAgentCacheEntry
{
    public DateTimeOffset? CachedAt { get; init; }
    public required string Path { get; init; }
    public required string Kind { get; init; }
    public required long Size { get; init; }
    public required DateTimeOffset LastAccessAt { get; init; }
    public required DateTimeOffset ExpiresAt { get; init; }
}

public sealed record DesktopAgentCacheMetrics
{
    public required long UsedBytes { get; init; }
    public required int EntryCount { get; init; }
    public required long OrphanBytes { get; init; }
    public required int OrphanCount { get; init; }
    public required long HitCount { get; init; }
    public required long MissCount { get; init; }
    public required long BytesSaved { get; init; }
}

public sealed record DesktopAgentCacheCounters
{
    public long HitCount { get; init; }
    public long MissCount { get; init; }
    public long BytesSaved { get; init; }
}

public sealed class DesktopAgentCacheMaintenanceService(
    DesktopAgentCacheService cache,
    ILogger<DesktopAgentCacheMaintenanceService> logger
) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(10));
        do
        {
            try
            {
                await cache.CollectGarbageAsync(stoppingToken);
            }
            catch (Exception error) when (!stoppingToken.IsCancellationRequested)
            {
                logger.LogWarning(error, "Controlled cache maintenance failed.");
            }
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }
}
