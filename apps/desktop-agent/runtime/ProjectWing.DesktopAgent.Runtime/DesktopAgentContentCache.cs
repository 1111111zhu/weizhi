using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentContentCache(
    DesktopAgentRuntimeOptions options,
    DesktopAgentCacheService cache,
    ILogger<DesktopAgentContentCache> logger
)
{
    private const int ManifestVersion = 1;
    private const string ManifestFileName = ".project-wing-content-cache.json";
    private const string LegacyManifestFileName = ".project-wing-cache.json";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
        WriteIndented = true,
    };

    public async Task<DesktopAgentCacheRestoreResult?> TryRestoreAsync(
        DesktopAgentValidatedOpenRequest request,
        string destinationPath,
        bool makeReadOnly,
        CancellationToken cancellationToken
    )
    {
        var identity = ReadContentIdentity(request);
        if (identity is null) return null;

        var contentPath = BuildContentPath(request, identity);
        var entry = await ReadValidEntryAsync(
            request,
            identity,
            contentPath,
            cancellationToken
        );
        if (entry is null && request.Mode == "MASTER" && request.CacheVersionId is not null)
        {
            entry = await TryPromoteLegacyEntryAsync(
                request,
                identity,
                contentPath,
                cancellationToken
            );
        }
        if (entry is null)
        {
            await cache.RecordMissAsync(cancellationToken);
            return null;
        }

        await cache.EnsureCapacityAsync(
            entry.Size,
            destinationPath,
            cancellationToken,
            [contentPath]
        );
        if (!await DestinationMatchesAsync(
            destinationPath,
            entry,
            cancellationToken
        ))
        {
            await CopyAtomicallyAsync(
                contentPath,
                destinationPath,
                makeReadOnly,
                cancellationToken
            );
        }
        else
        {
            File.SetAttributes(
                destinationPath,
                makeReadOnly ? FileAttributes.ReadOnly : FileAttributes.Normal
            );
        }
        await cache.RecordAsync(
            contentPath,
            "CONTENT",
            cancellationToken,
            [destinationPath]
        );
        await cache.RecordAsync(
            destinationPath,
            makeReadOnly ? "READ_ONLY" : "MASTER",
            cancellationToken,
            [contentPath]
        );
        await cache.RecordHitAsync(entry.Size, cancellationToken);
        return new DesktopAgentCacheRestoreResult(entry.Sha256, entry.Size);
    }

    public async Task StoreAsync(
        DesktopAgentValidatedOpenRequest request,
        string sourcePath,
        string sha256,
        CancellationToken cancellationToken
    )
    {
        var identity = ReadContentIdentity(request);
        if (identity is null) return;
        if (
            request.ContentHash is not null
            && !string.Equals(request.ContentHash, sha256, StringComparison.OrdinalIgnoreCase)
        )
        {
            throw new DesktopAgentRuntimeException(
                "DOWNLOAD_INTEGRITY_FAILED",
                "The downloaded file did not match the server content hash.",
                StatusCodes.Status502BadGateway
            );
        }

        var source = new FileInfo(sourcePath);
        if (!source.Exists) return;
        var contentPath = BuildContentPath(request, identity);
        await cache.EnsureCapacityAsync(
            source.Length,
            contentPath,
            cancellationToken,
            [sourcePath]
        );
        await CopyAtomicallyAsync(sourcePath, contentPath, makeReadOnly: true, cancellationToken);
        var stored = new FileInfo(contentPath);
        var manifest = new DesktopAgentContentCacheManifest
        {
            Version = ManifestVersion,
            ProjectId = request.ProjectId,
            AttachmentId = request.AttachmentId,
            FileName = request.FileName,
            ContentIdentity = identity,
            CacheVersionId = request.CacheVersionId,
            ContentHash = request.ContentHash,
            Sha256 = sha256,
            Size = stored.Length,
            LastWriteTimeUtcTicks = stored.LastWriteTimeUtc.Ticks,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        await WriteManifestAsync(contentPath, manifest, cancellationToken);
        await cache.RecordAsync(
            contentPath,
            "CONTENT",
            cancellationToken,
            [sourcePath]
        );
    }

    private async Task<DesktopAgentContentCacheManifest?> TryPromoteLegacyEntryAsync(
        DesktopAgentValidatedOpenRequest request,
        string identity,
        string contentPath,
        CancellationToken cancellationToken
    )
    {
        var legacyPath = DesktopAgentPathPolicy.BuildLegacyVersionedMasterPath(
            options.CacheRoot,
            BuildPathRequest(request),
            request.CacheVersionId!
        );
        var legacyManifestPath = Path.Combine(
            Path.GetDirectoryName(legacyPath)!,
            LegacyManifestFileName
        );
        if (!File.Exists(legacyPath) || !File.Exists(legacyManifestPath)) return null;

        try
        {
            using var document = JsonDocument.Parse(
                await File.ReadAllTextAsync(legacyManifestPath, cancellationToken)
            );
            var root = document.RootElement;
            if (
                ReadString(root, "projectId") != request.ProjectId
                || ReadString(root, "attachmentId") != request.AttachmentId
                || ReadString(root, "fileName") != request.FileName
                || ReadString(root, "cacheVersionId") != request.CacheVersionId
                || ReadString(root, "originalHash") is not { Length: 64 } expectedHash
            )
            {
                return null;
            }
            var actualHash = await DesktopAgentFileTransfer.HashFileAsync(
                legacyPath,
                cancellationToken
            );
            if (
                !string.Equals(actualHash, expectedHash, StringComparison.OrdinalIgnoreCase)
                || (
                    request.ContentHash is not null
                    && !string.Equals(
                        request.ContentHash,
                        actualHash,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
            )
            {
                logger.LogWarning(
                    "Legacy cache entry for {AttachmentId} contains local changes and was not reused.",
                    request.AttachmentId
                );
                return null;
            }

            var legacyFile = new FileInfo(legacyPath);
            await cache.EnsureCapacityAsync(
                legacyFile.Length,
                contentPath,
                cancellationToken,
                [legacyPath]
            );
            await CopyAtomicallyAsync(
                legacyPath,
                contentPath,
                makeReadOnly: true,
                cancellationToken
            );
            var stored = new FileInfo(contentPath);
            var promoted = new DesktopAgentContentCacheManifest
            {
                Version = ManifestVersion,
                ProjectId = request.ProjectId,
                AttachmentId = request.AttachmentId,
                FileName = request.FileName,
                ContentIdentity = identity,
                CacheVersionId = request.CacheVersionId,
                ContentHash = request.ContentHash,
                Sha256 = actualHash,
                Size = stored.Length,
                LastWriteTimeUtcTicks = stored.LastWriteTimeUtc.Ticks,
                CreatedAt = DateTimeOffset.UtcNow,
            };
            await WriteManifestAsync(contentPath, promoted, cancellationToken);
            await cache.RecordAsync(
                contentPath,
                "CONTENT",
                cancellationToken,
                [legacyPath]
            );
            return promoted;
        }
        catch (Exception error) when (
            error is IOException
                or UnauthorizedAccessException
                or JsonException
                or CryptographicException
        )
        {
            logger.LogDebug(
                error,
                "Legacy cache entry for {AttachmentId} could not be promoted.",
                request.AttachmentId
            );
            return null;
        }
    }

    private async Task<DesktopAgentContentCacheManifest?> ReadValidEntryAsync(
        DesktopAgentValidatedOpenRequest request,
        string identity,
        string contentPath,
        CancellationToken cancellationToken
    )
    {
        var manifestPath = GetManifestPath(contentPath);
        if (!File.Exists(contentPath) || !File.Exists(manifestPath)) return null;
        try
        {
            var manifest = JsonSerializer.Deserialize<DesktopAgentContentCacheManifest>(
                await File.ReadAllTextAsync(manifestPath, cancellationToken),
                JsonOptions
            );
            var file = new FileInfo(contentPath);
            if (
                manifest is null
                || manifest.Version != ManifestVersion
                || manifest.ProjectId != request.ProjectId
                || manifest.AttachmentId != request.AttachmentId
                || manifest.FileName != request.FileName
                || manifest.ContentIdentity != identity
                || manifest.Size != file.Length
                || manifest.LastWriteTimeUtcTicks != file.LastWriteTimeUtc.Ticks
                || (
                    request.ContentHash is not null
                    && !string.Equals(
                        request.ContentHash,
                        manifest.Sha256,
                        StringComparison.OrdinalIgnoreCase
                    )
                )
            )
            {
                return null;
            }
            return manifest;
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException or JsonException
        )
        {
            logger.LogDebug(error, "Content cache entry {Path} is invalid.", contentPath);
            return null;
        }
    }

    private string BuildContentPath(
        DesktopAgentValidatedOpenRequest request,
        string identity
    )
    {
        return DesktopAgentPathPolicy.BuildContentCachePath(
            options.CacheRoot,
            BuildPathRequest(request),
            identity
        );
    }

    private static DesktopAgentPathRequest BuildPathRequest(
        DesktopAgentValidatedOpenRequest request
    )
    {
        return new DesktopAgentPathRequest
        {
            ProjectId = request.ProjectId,
            AttachmentId = request.AttachmentId,
            FileName = request.FileName,
            SessionSegment = request.LockSessionId ?? "read-only",
        };
    }

    private static string? ReadContentIdentity(
        DesktopAgentValidatedOpenRequest request
    )
    {
        return request.ContentToken ?? request.CacheVersionId ?? request.BaseVersionId;
    }

    private static string? ReadString(JsonElement value, string name)
    {
        return value.TryGetProperty(name, out var property)
            && property.ValueKind == JsonValueKind.String
            ? property.GetString()
            : null;
    }

    private static async Task CopyAtomicallyAsync(
        string sourcePath,
        string destinationPath,
        bool makeReadOnly,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
        var temporary = $"{destinationPath}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        try
        {
            await using (var source = new FileStream(
                sourcePath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan
            ))
            await using (var destination = new FileStream(
                temporary,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan | FileOptions.WriteThrough
            ))
            {
                await source.CopyToAsync(destination, cancellationToken);
                await destination.FlushAsync(cancellationToken);
                destination.Flush(flushToDisk: true);
            }
            if (File.Exists(destinationPath))
            {
                File.SetAttributes(destinationPath, FileAttributes.Normal);
            }
            File.Move(temporary, destinationPath, overwrite: true);
            File.SetAttributes(
                destinationPath,
                makeReadOnly ? FileAttributes.ReadOnly : FileAttributes.Normal
            );
        }
        catch
        {
            try { File.Delete(temporary); } catch (IOException) { }
            throw;
        }
    }

    private static async Task<bool> DestinationMatchesAsync(
        string destinationPath,
        DesktopAgentContentCacheManifest entry,
        CancellationToken cancellationToken
    )
    {
        try
        {
            var file = new FileInfo(destinationPath);
            if (!file.Exists || file.Length != entry.Size) return false;
            await using var stream = new FileStream(
                destinationPath,
                FileMode.Open,
                FileAccess.Read,
                FileShare.ReadWrite | FileShare.Delete,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan
            );
            var hash = await SHA256.HashDataAsync(stream, cancellationToken);
            return string.Equals(
                Convert.ToHexString(hash),
                entry.Sha256,
                StringComparison.OrdinalIgnoreCase
            );
        }
        catch (Exception error) when (
            error is IOException or UnauthorizedAccessException
        )
        {
            return false;
        }
    }

    private static async Task WriteManifestAsync(
        string contentPath,
        DesktopAgentContentCacheManifest manifest,
        CancellationToken cancellationToken
    )
    {
        var path = GetManifestPath(contentPath);
        var temporary = $"{path}.{Environment.ProcessId}.{Guid.NewGuid():N}.tmp";
        Directory.CreateDirectory(Path.GetDirectoryName(path)!);
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
                    manifest,
                    JsonOptions,
                    cancellationToken
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

    private static string GetManifestPath(string contentPath)
    {
        return Path.Combine(Path.GetDirectoryName(contentPath)!, ManifestFileName);
    }
}

public sealed record DesktopAgentCacheRestoreResult(string Sha256, long Size);

public sealed record DesktopAgentContentCacheManifest
{
    public required int Version { get; init; }
    public required string ProjectId { get; init; }
    public required string AttachmentId { get; init; }
    public required string FileName { get; init; }
    public required string ContentIdentity { get; init; }
    public string? CacheVersionId { get; init; }
    public string? ContentHash { get; init; }
    public required string Sha256 { get; init; }
    public required long Size { get; init; }
    public required long LastWriteTimeUtcTicks { get; init; }
    public required DateTimeOffset CreatedAt { get; init; }
}
