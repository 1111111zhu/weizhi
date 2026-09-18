namespace ProjectWing.DesktopAgent.Runtime;

public sealed partial class DesktopAgentCacheService
{
    public async Task ApplyReducedLimitAsync(long maxBytes, string policy, int idleDays, bool confirmed,
        Func<Task> persistSettings, CancellationToken cancellationToken)
    {
        await gate.WaitAsync(cancellationToken);
        try
        {
            await state.WithReservedCacheChangeAsync(async sessions =>
            {
                var entries = await ReadIndexAsync(cancellationToken);
                DiscoverUnindexedFiles(entries);
                PruneMissing(entries);
                // Re-read actual sizes, not the possibly old metrics shown in
                // the confirmation. A settings reservation blocks new sessions.
                entries = entries.Select(entry => entry with { Size = new FileInfo(entry.Path).Length }).ToList();
                var used = entries.Sum(entry => entry.Size);
                if (used > maxBytes)
                {
                    if (!confirmed) throw new DesktopAgentRuntimeException("CACHE_SHRINK_CONFIRMATION_REQUIRED", "The new limit requires deleting idle cache copies. Confirm the capacity reduction before saving.", 409);
                    var protectedPaths = new HashSet<string>(PathComparer);
                    foreach (var session in sessions) { AddPath(session, "localPath", protectedPaths); AddPath(session, "snapshotPath", protectedPaths); }
                    var diagnostics = state.ReadDiagnostics();
                    var candidates = entries.Where(entry => CanEvict(entry) && IsSafeBrowserPath(entry.Path) && !protectedPaths.Contains(Normalize(entry.Path)))
                        .OrderBy(entry => entry.LastAccessAt.AddDays(idleDays) <= DateTimeOffset.UtcNow ? 0 : 1)
                        .ThenBy(entry => policy == "FIFO" ? entry.CachedAt ?? entry.LastAccessAt : entry.LastAccessAt).ToArray();
                    if (diagnostics.QuarantineCount != 0 || diagnostics.RestoreState != "READY" || used - candidates.Sum(entry => entry.Size) > maxBytes)
                        throw new DesktopAgentRuntimeException("CACHE_SHRINK_PROTECTED", "Protected working or recovery files exceed the new limit. The existing limit and files were retained.", 409);
                    foreach (var entry in candidates)
                    {
                        if (used <= maxBytes) break;
                        cancellationToken.ThrowIfCancellationRequested();
                        try { DeleteDisposableFile(entry.Path); }
                        catch (Exception error) when (error is IOException or UnauthorizedAccessException)
                        {
                            // Skip busy copies rather than interfering with a
                            // process outside Desktop Agent. Reconcile below.
                        }
                        if (!File.Exists(entry.Path)) { entries.Remove(entry); used -= entry.Size; }
                    }
                    await WriteIndexAsync(entries, cancellationToken);
                    if (used > maxBytes)
                        throw new DesktopAgentRuntimeException("CACHE_SHRINK_BUSY", "Some idle copies could not be removed. The cache limit was not changed; copies already removed can be downloaded again.", 409);
                }
                await persistSettings();
            }, cancellationToken);
        }
        finally { gate.Release(); }
    }
}
