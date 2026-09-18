using System.Security.Cryptography;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed class DesktopAgentUploadSnapshotService(
    DesktopAgentRuntimeOptions options,
    DesktopAgentCacheService cache
)
{
    public async Task<DesktopAgentUploadSnapshot> CreateAsync(
        DesktopAgentSyncSession session,
        CancellationToken cancellationToken
    )
    {
        var source = new FileInfo(session.LocalPath);
        if (!source.Exists) throw LocalFileMissing();
        await cache.EnsureCapacityAsync(
            source.Length,
            Path.Combine(
                options.CacheRoot,
                ".check-in-staging",
                session.SessionId,
                session.FileName
            ),
            cancellationToken
        );
        var directory = Path.Combine(
            options.CacheRoot,
            ".check-in-staging",
            session.SessionId
        );
        Directory.CreateDirectory(directory);
        var path = Path.Combine(directory, $"{Guid.NewGuid():N}-{session.FileName}");
        try
        {
            await using var input = new FileStream(
                source.FullName,
                FileMode.Open,
                FileAccess.Read,
                FileShare.Read,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan
            );
            await using var output = new FileStream(
                path,
                FileMode.CreateNew,
                FileAccess.Write,
                FileShare.None,
                1024 * 1024,
                FileOptions.Asynchronous | FileOptions.SequentialScan
            );
            using var sha = IncrementalHash.CreateHash(HashAlgorithmName.SHA256);
            var crc64 = new OssCrc64();
            var buffer = new byte[1024 * 1024];
            int count;
            while ((count = await input.ReadAsync(buffer, cancellationToken)) > 0)
            {
                await output.WriteAsync(buffer.AsMemory(0, count), cancellationToken);
                sha.AppendData(buffer, 0, count);
                crc64.Update(buffer.AsSpan(0, count));
            }
            await output.FlushAsync(cancellationToken);
            output.Flush(flushToDisk: true);
            var snapshot = new DesktopAgentUploadSnapshot(
                path,
                Convert.ToHexString(sha.GetHashAndReset()).ToLowerInvariant(),
                source.Length,
                crc64.Decimal
            );
            await cache.RecordAsync(path, "SNAPSHOT", cancellationToken);
            return snapshot;
        }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
        {
            TryDelete(path);
            throw new DesktopAgentRuntimeException(
                error is UnauthorizedAccessException ? "LOCAL_FILE_ACCESS_DENIED" : "SNAPSHOT_FAILED",
                error.Message,
                StatusCodes.Status409Conflict
            );
        }
    }

    public void Delete(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return;
        TryDelete(path);
        var directory = Path.GetDirectoryName(path);
        try
        {
            if (directory is not null && Directory.Exists(directory)
                && !Directory.EnumerateFileSystemEntries(directory).Any())
            {
                Directory.Delete(directory);
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }

    private static DesktopAgentRuntimeException LocalFileMissing() => new(
        "LOCAL_FILE_MISSING",
        "The tracked local file is no longer in the controlled cache.",
        StatusCodes.Status409Conflict
    );

    private static void TryDelete(string path)
    {
        try { File.Delete(path); }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
    }
}

public sealed record DesktopAgentUploadSnapshot(
    string Path,
    string Sha256,
    long Size,
    string Crc64
);

internal sealed class OssCrc64
{
    public const string Algorithm = "CRC64_XZ";
    private const ulong Polynomial = 0xC96C5795D7870F42UL;
    private static readonly ulong[] Table = CreateTable();
    private ulong value = ulong.MaxValue;

    public void Update(ReadOnlySpan<byte> bytes)
    {
        foreach (var item in bytes)
        {
            value = (value >> 8) ^ Table[(value ^ item) & 0xff];
        }
    }

    public string Decimal => (value ^ ulong.MaxValue).ToString(
        System.Globalization.CultureInfo.InvariantCulture
    );

    private static ulong[] CreateTable()
    {
        var result = new ulong[256];
        for (var index = 0; index < result.Length; index++)
        {
            var item = (ulong)index;
            for (var bit = 0; bit < 8; bit++)
            {
                item = (item & 1) != 0
                    ? (item >> 1) ^ Polynomial
                    : item >> 1;
            }
            result[index] = item;
        }
        return result;
    }
}
