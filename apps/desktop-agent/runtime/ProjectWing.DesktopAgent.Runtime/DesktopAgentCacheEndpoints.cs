using System.Text.Json;

namespace ProjectWing.DesktopAgent.Runtime;

public static class DesktopAgentCacheEndpoints
{
    public static void MapDesktopAgentCacheEndpoints(this WebApplication app)
    {
        app.MapGet("/cache/settings", ReadSettings);
        app.MapPost("/cache/settings", UpdateSettings);
        app.MapGet("/cache/files", async (DesktopAgentCacheService cache, CancellationToken token) => Results.Ok(await cache.ReadFilesAsync(token)));
        app.MapPost("/cache/files/delete", DeleteFile);
    }

    private static async Task<IResult> DeleteFile(HttpRequest request, DesktopAgentCacheService cache,
        DesktopAgentDeviceAuthSession auth, CancellationToken cancellationToken)
    {
        if (auth.ReadAuthorization() is null) return Results.Json(new DesktopAgentError(false, "DEVICE_AUTH_REQUIRED", "Connect your account before managing cached files."), statusCode: 401);
        DesktopAgentCacheDeleteRequest? input;
        try { input = await request.ReadFromJsonAsync<DesktopAgentCacheDeleteRequest>(cancellationToken); }
        catch (JsonException) { return InvalidSettings("Invalid cache deletion request."); }
        if (input?.Confirmed != true || string.IsNullOrWhiteSpace(input.Id)) return InvalidSettings("Confirm the selected cache file before deleting.");
        try { await cache.DeleteFileAsync(input.Id, cancellationToken); return Results.Ok(await cache.ReadFilesAsync(cancellationToken)); }
        catch (DesktopAgentRuntimeException error) { return Results.Json(new DesktopAgentError(false, error.Code, error.Message), statusCode: error.StatusCode); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        { return Results.Json(new DesktopAgentError(false, "CACHE_FILE_BUSY", "The file is in use or unavailable. Refresh and retry."), statusCode: 409); }
    }

    private sealed record DesktopAgentCacheDeleteRequest(string Id, bool Confirmed);

    private static async Task<IResult> ReadSettings(
        DesktopAgentCacheSettingsService settings,
        CancellationToken cancellationToken
    )
    {
        return Results.Ok(await settings.ReadAsync(cancellationToken));
    }

    private static async Task<IResult> UpdateSettings(
        HttpRequest request,
        DesktopAgentCacheSettingsService settings,
        CancellationToken cancellationToken
    )
    {
        DesktopAgentCacheSettingsRequest? input;
        try
        {
            input = await request.ReadFromJsonAsync<DesktopAgentCacheSettingsRequest>(
                cancellationToken
            );
        }
        catch (Exception error) when (
            error is JsonException or BadHttpRequestException or NotSupportedException
        )
        {
            input = null;
        }
        if (input is null)
        {
            return InvalidSettings("Cache settings are invalid.");
        }
        try
        {
            return Results.Ok(await settings.UpdateAsync(input, cancellationToken));
        }
        catch (DesktopAgentRuntimeException error)
        {
            return Results.Json(
                new DesktopAgentError(false, error.Code, error.Message),
                statusCode: error.StatusCode
            );
        }
    }

    private static IResult InvalidSettings(string message)
    {
        return Results.BadRequest(
            new DesktopAgentError(false, "VALIDATION_FAILED", message)
        );
    }
}

public sealed class DesktopAgentCacheSettingsService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentCacheService cache,
    DesktopAgentRuntimeState state,
    IHostApplicationLifetime lifetime
)
{
    private static readonly JsonSerializerOptions JsonOptions =
        new(JsonSerializerDefaults.Web);

    public async Task<DesktopAgentCacheSettingsResponse> ReadAsync(
        CancellationToken cancellationToken
    )
    {
        var metrics = await cache.ReadMetricsAsync(cancellationToken);
        return BuildResponse(options.CacheRoot, options.CacheMaxBytes, metrics, false, options.CacheEvictionPolicy, Math.Max(1, (int)options.CacheTtl.TotalDays));
    }

    public async Task<DesktopAgentCacheSettingsResponse> UpdateAsync(
        DesktopAgentCacheSettingsRequest input,
        CancellationToken cancellationToken
    )
    {
        var cacheRoot = input.CacheRoot?.Trim();
        var policy = input.EvictionPolicy ?? options.CacheEvictionPolicy;
        var idleDays = input.IdleDays ?? Math.Max(1, (int)options.CacheTtl.TotalDays);
        if (policy is not ("LRU" or "FIFO") || idleDays is < 1 or > 3650)
            throw InvalidSettings("Choose LRU or FIFO and an idle retention between 1 and 3650 days.");
        if (
            string.IsNullOrWhiteSpace(cacheRoot)
            || !Path.IsPathFullyQualified(cacheRoot)
            || input.MaxBytes <= 0
        )
        {
            throw InvalidSettings("Cache location must be an absolute local path.");
        }
        string resolvedRoot;
        try
        {
            resolvedRoot = Path.GetFullPath(cacheRoot);
            Directory.CreateDirectory(resolvedRoot);
            await VerifyWritableAsync(resolvedRoot, cancellationToken);
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or ArgumentException
                or NotSupportedException
        )
        {
            throw InvalidSettings($"Cache location is not writable: {error.Message}");
        }

        // Share the state gate with session creation: a check-then-write without
        // this reservation lets a new Master start in the old root during switch.
        var rootChanged = !string.Equals(resolvedRoot.TrimEnd(Path.DirectorySeparatorChar),
            Path.GetFullPath(options.CacheRoot).TrimEnd(Path.DirectorySeparatorChar),
            OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
        await state.BeginCacheChangeAsync(cancellationToken, requireIdle: rootChanged);
        try
        {
            if (rootChanged)
            {
                try
                {
                    using var targetOwnership = ProjectWing.NativeRuntime.RuntimeOwnershipLease.Acquire(resolvedRoot, "cache");
                }
                catch (InvalidOperationException)
                {
                    throw new DesktopAgentRuntimeException("CACHE_LOCATION_IN_USE",
                        "Another local service is using this cache location. The current location has not changed; choose a different folder.",
                        StatusCodes.Status409Conflict);
                }
            }
            if (rootChanged && ReadDirectoryMetrics(resolvedRoot).UsedBytes > input.MaxBytes)
                throw InvalidSettings("The selected folder exceeds the new limit. Choose an empty cache folder or raise the limit; its contents were not removed.");
            if (!rootChanged && input.MaxBytes < options.CacheMaxBytes)
                await cache.ApplyReducedLimitAsync(input.MaxBytes, policy, idleDays, input.CapacityReductionConfirmed,
                    () => WriteSettingsAsync(resolvedRoot, input.MaxBytes, policy, idleDays, cancellationToken), cancellationToken);
            else
                await WriteSettingsAsync(resolvedRoot, input.MaxBytes, policy, idleDays, cancellationToken);
        }
        catch
        {
            await state.CancelCacheChangeAsync();
            throw;
        }
        var metrics = ReadDirectoryMetrics(resolvedRoot);
        _ = Task.Run(async () =>
        {
            await Task.Delay(350);
            lifetime.StopApplication();
        });
        return BuildResponse(resolvedRoot, input.MaxBytes, metrics, true, policy, idleDays);
    }

    private async Task WriteSettingsAsync(
        string cacheRoot,
        long maxBytes,
        string policy,
        int idleDays,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(options.StateRoot);
        var path = Path.Combine(options.StateRoot, "cache-settings.json");
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
                await JsonSerializer.SerializeAsync(
                    stream,
                    new DesktopAgentPersistedCacheSettings(cacheRoot, maxBytes, policy, idleDays),
                    JsonOptions,
                    cancellationToken: cancellationToken
                );
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

    private static async Task VerifyWritableAsync(
        string cacheRoot,
        CancellationToken cancellationToken
    )
    {
        var probe = Path.Combine(cacheRoot, $".project-wing-write-test-{Guid.NewGuid():N}.tmp");
        try
        {
            await File.WriteAllTextAsync(probe, "ok", cancellationToken);
        }
        finally
        {
            try { File.Delete(probe); } catch (IOException) { }
        }
    }

    private static DesktopAgentCacheMetrics ReadDirectoryMetrics(string cacheRoot)
    {
        long usedBytes = 0;
        var entryCount = 0;
        try
        {
            foreach (var path in Directory.EnumerateFiles(cacheRoot, "*", SearchOption.AllDirectories))
            {
                if (Path.GetFileName(path).StartsWith(".project-wing-", StringComparison.Ordinal)
                    || Path.GetFileName(path) == ".cache-owner.lock"
                    || path.EndsWith(".tmp", StringComparison.OrdinalIgnoreCase))
                {
                    continue;
                }
                usedBytes += new FileInfo(path).Length;
                entryCount++;
            }
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            // A successful write probe is sufficient; metrics will be rebuilt after restart.
        }
        return new DesktopAgentCacheMetrics
        {
            UsedBytes = usedBytes,
            EntryCount = entryCount,
            OrphanBytes = 0,
            OrphanCount = 0,
            HitCount = 0,
            MissCount = 0,
            BytesSaved = 0,
        };
    }

    private static DesktopAgentCacheSettingsResponse BuildResponse(
        string cacheRoot,
        long maxBytes,
        DesktopAgentCacheMetrics metrics,
        bool restartRequired,
        string policy,
        int idleDays
    )
    {
        return new DesktopAgentCacheSettingsResponse
        {
            Ok = true,
            CacheRoot = cacheRoot,
            MaxBytes = maxBytes,
            UsedBytes = metrics.UsedBytes,
            EntryCount = metrics.EntryCount,
            OrphanBytes = metrics.OrphanBytes,
            OrphanCount = metrics.OrphanCount,
            HitCount = metrics.HitCount,
            MissCount = metrics.MissCount,
            BytesSaved = metrics.BytesSaved,
            RestartRequired = restartRequired,
            EvictionPolicy = policy,
            IdleDays = idleDays,
        };
    }

    private static DesktopAgentRuntimeException InvalidSettings(string message)
    {
        return new DesktopAgentRuntimeException(
            "VALIDATION_FAILED",
            message,
            StatusCodes.Status400BadRequest
        );
    }
}

public sealed record DesktopAgentCacheSettingsRequest
{
    public bool CapacityReductionConfirmed { get; init; }
    public string? EvictionPolicy { get; init; }
    public int? IdleDays { get; init; }
    public string? CacheRoot { get; init; }
    public long MaxBytes { get; init; }
}

public sealed record DesktopAgentPersistedCacheSettings(string CacheRoot, long MaxBytes, string EvictionPolicy = "LRU", int IdleDays = 30);

public sealed record DesktopAgentCacheSettingsResponse
{
    public string EvictionPolicy { get; init; } = "LRU";
    public int IdleDays { get; init; } = 30;
    public required bool Ok { get; init; }
    public required string CacheRoot { get; init; }
    public required long MaxBytes { get; init; }
    public required long UsedBytes { get; init; }
    public required int EntryCount { get; init; }
    public required long OrphanBytes { get; init; }
    public required int OrphanCount { get; init; }
    public required long HitCount { get; init; }
    public required long MissCount { get; init; }
    public required long BytesSaved { get; init; }
    public required bool RestartRequired { get; init; }
}
