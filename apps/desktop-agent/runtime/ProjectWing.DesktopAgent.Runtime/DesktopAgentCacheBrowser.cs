using System.Security.Cryptography;
using System.Text;

namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentCacheService
{
    public async Task<DesktopAgentCacheFiles> ReadFilesAsync(CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            DiscoverUnindexedFiles(entries);
            PruneMissing(entries);
            await WriteIndexAsync(entries, cancellationToken);
            var protectedPaths = await ReadProtectedPathsAsync(cancellationToken);
            var openPaths = new HashSet<string>(PathComparer);
            foreach (var session in await state.ReadSessionsAsync(cancellationToken))
            {
                if (session.TryGetProperty("lifecycleState", out var lifecycle)
                    && lifecycle.GetString() is "OPEN" or "LAUNCHING" or "OPEN_NOT_OBSERVED")
                    AddPath(session, "localPath", openPaths);
            }
            var diagnostics = state.ReadDiagnostics();
            var recovery = diagnostics.QuarantineCount != 0 || diagnostics.RestoreState != "READY";
            var files = entries.Where(entry => IsSafeBrowserPath(entry.Path)).Select(entry =>
            {
                var file = new FileInfo(entry.Path);
                var reason = recovery ? "RECOVERY_REQUIRED" : protectedPaths.Contains(Normalize(entry.Path))
                    ? openPaths.Contains(Normalize(entry.Path)) ? "IN_USE" : "RETAINED_WORK"
                    : !CanEvict(entry) ? "RETAINED_WORK" : null;
                return new DesktopAgentCacheFile(CacheFileId(file), file.Name, file.Length, entry.Kind, reason is null, reason);
            }).OrderBy(file => file.FileName).ToArray();
            return new DesktopAgentCacheFiles(true, files.Sum(file => file.Size), files);
        }
        finally { gate.Release(); }
    }

    public async Task DeleteFileAsync(string id, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            var entries = await ReadIndexAsync(cancellationToken);
            var selected = entries.FirstOrDefault(entry => IsSafeBrowserPath(entry.Path)
                && File.Exists(entry.Path) && CacheFileId(new FileInfo(entry.Path)) == id);
            if (selected is null) throw new DesktopAgentRuntimeException("CACHE_FILE_CHANGED", "The cache file changed. Refresh the list before deleting.", 409);
            if (!CanEvict(selected)) throw new DesktopAgentRuntimeException("CACHE_FILE_PROTECTED", "This file may contain unsynchronized or recovery work. Resolve its session first.", 409);
            // Same cache->state lock ordering as capacity management. Prevent a
            // session from claiming this file between the check and deletion.
            await state.WithUntrackedCacheFileAsync(selected.Path, () =>
            {
                if (!IsSafeBrowserPath(selected.Path) || CacheFileId(new FileInfo(selected.Path)) != id)
                    throw new DesktopAgentRuntimeException("CACHE_FILE_CHANGED", "The cache file changed. Refresh the list.", 409);
                DeleteDisposableFile(selected.Path);
            }, cancellationToken);
            entries.RemoveAll(entry => PathEquals(entry.Path, selected.Path));
            await WriteIndexAsync(entries, cancellationToken);
        }
        finally { gate.Release(); }
    }

    private bool IsSafeBrowserPath(string candidate)
    {
        var root = Normalize(options.CacheRoot).TrimEnd(Path.DirectorySeparatorChar);
        var full = Normalize(candidate);
        if (!full.StartsWith(root + Path.DirectorySeparatorChar, PathComparison)) return false;
        for (FileSystemInfo? entry = new FileInfo(full); entry is not null && !PathEquals(entry.FullName, root); entry = Directory.GetParent(entry.FullName))
            if (entry.Exists && (entry.Attributes & FileAttributes.ReparsePoint) != 0) return false;
        return true;
    }

    private void DeleteDisposableFile(string filePath)
    {
        var attributes = File.GetAttributes(filePath);
        try
        {
            File.SetAttributes(filePath, attributes & ~FileAttributes.ReadOnly);
            using (var removal = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.None, 1, FileOptions.DeleteOnClose)) { }
            // Removal of the selected file succeeded; a leftover content
            // manifest can safely be retried by ordinary cache maintenance.
            TryDeleteControlledFile(filePath);
        }
        catch
        {
            if (File.Exists(filePath)) File.SetAttributes(filePath, attributes);
            throw;
        }
    }

    private static string CacheFileId(FileInfo file) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{Normalize(file.FullName)}\0{file.Length}\0{file.LastWriteTimeUtc.Ticks}"))).ToLowerInvariant();
}

public sealed record DesktopAgentCacheFile(string Id, string FileName, long Size, string Kind, bool CanDelete, string? ProtectedReason);
public sealed record DesktopAgentCacheFiles(bool Ok, long UsedBytes, IReadOnlyList<DesktopAgentCacheFile> Files);
