using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging.Abstractions;
using ProjectWing.DesktopAgent.Runtime;

internal static class CacheReplacementChecks
{
    public static async Task RunAsync(string testRoot)
    {
        foreach (var scenario in new[] { "shrink-confirmation", "shrink-LRU", "shrink-FIFO", "shrink-protected", "shrink-active", "shrink-busy", "shrink-room", "LRU", "FIFO", "expired", "expired-with-protected-capacity", "oversized", "unknown-length", "protected-capacity", "fifo-touch", "persist-policy", "legacy-default", "malformed-policy" })
        {
            var directory = Path.Combine(testRoot, $"replacement-{scenario}");
            var config = new ConfigurationBuilder().AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["PROJECT_WING_AGENT_STATE_ROOT"] = Path.Combine(directory, "state"),
                ["PROJECT_WING_AGENT_CACHE_ROOT"] = Path.Combine(directory, "cache"),
                ["PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH"] = "true",
                ["PROJECT_WING_AGENT_CACHE_MAX_BYTES"] = "12",
            }).Build();
            var defaults = DesktopAgentRuntimeOptions.FromConfiguration(config);
            var options = defaults with { CacheEvictionPolicy = scenario == "FIFO" || scenario == "fifo-touch" ? "FIFO" : "LRU", CacheTtl = TimeSpan.FromDays(30) };
            Directory.CreateDirectory(options.StateRoot); Directory.CreateDirectory(options.CacheRoot);
            var first = Path.Combine(options.CacheRoot, "first.txt");
            var second = Path.Combine(options.CacheRoot, "second.txt");
            await File.WriteAllTextAsync(first, "aaaa"); await File.WriteAllTextAsync(second, "bbbb");
            var now = DateTimeOffset.UtcNow;
            var entries = new[] {
                new DesktopAgentCacheEntry { Path = first, Kind = scenario is "protected-capacity" or "expired-with-protected-capacity" or "shrink-protected" ? "MASTER" : "CONTENT", Size = scenario == "expired-with-protected-capacity" ? 16 : 4, CachedAt = now.AddDays(-5), LastAccessAt = now.AddDays(-1), ExpiresAt = now.AddDays(30) },
                new DesktopAgentCacheEntry { Path = second, Kind = "CONTENT", Size = 4, CachedAt = now.AddDays(-3), LastAccessAt = scenario.StartsWith("expired") ? now.AddDays(-40) : now.AddDays(-2), ExpiresAt = now.AddDays(30) },
            };
            await File.WriteAllTextAsync(Path.Combine(options.StateRoot, "cache-index.json"), JsonSerializer.Serialize(entries, new JsonSerializerOptions(JsonSerializerDefaults.Web)));
            var state = new DesktopAgentRuntimeState(options);
            var cache = new DesktopAgentCacheService(options, state, NullLogger<DesktopAgentCacheService>.Instance);
            var destination = Path.Combine(options.CacheRoot, "incoming.txt");
            if (scenario.StartsWith("shrink-"))
            {
                if (scenario == "shrink-active") await state.UpsertSessionAsync(new DesktopAgentSession {
                    SessionId = "active", Generation = 1, Mode = "MASTER", ProjectId = "p", AttachmentId = "a", FileName = "first.txt", LocalPath = first,
                    OriginalHash = new string('a', 64), LastKnownHash = new string('a', 64), Status = "OPEN", LifecycleState = "OPEN", ContentState = "CLEAN",
                    OpenedAt = now.ToString("O"), LaunchStartedAt = now.ToString("O"), LastSeenAt = now.ToString("O"), CheckInUrl = "https://fixture.invalid/check-in", ReleaseUrl = "https://fixture.invalid/release",
                }, default);
                using var heldFirst = scenario == "shrink-busy" ? new FileStream(first, FileMode.Open, FileAccess.Read, FileShare.Read) : null;
                using var heldSecond = scenario == "shrink-busy" ? new FileStream(second, FileMode.Open, FileAccess.Read, FileShare.Read) : null;
                var service = new DesktopAgentCacheSettingsService(options, cache, state, new FixtureLifetime());
                var limit = scenario == "shrink-room" ? 10 : scenario is "shrink-protected" or "shrink-active" ? 2 : 4;
                var expected = scenario is "shrink-LRU" or "shrink-FIFO" or "shrink-room";
                var success = false;
                try { await service.UpdateAsync(new DesktopAgentCacheSettingsRequest { CacheRoot = options.CacheRoot, MaxBytes = limit, EvictionPolicy = scenario == "shrink-FIFO" ? "FIFO" : "LRU", IdleDays = 30, CapacityReductionConfirmed = scenario != "shrink-confirmation" }, default); success = true; }
                catch (DesktopAgentRuntimeException) when (!expected) { }
                Require(success == expected, "capacity reduction must report actual completion");
                var reloaded = DesktopAgentRuntimeOptions.FromConfiguration(config);
                Require(reloaded.CacheMaxBytes == (expected ? limit : 12), "only successful confirmed cleanup persists the lower limit");
                if (scenario == "shrink-LRU") Require(File.Exists(first) && !File.Exists(second), "confirmed shrink uses requested LRU");
                else if (scenario == "shrink-FIFO") Require(!File.Exists(first) && File.Exists(second), "confirmed shrink uses newly selected FIFO");
                else Require(File.Exists(first) && File.Exists(second), "cancelled, blocked, busy or no-cleanup reductions preserve files");
            }
            else if (scenario is "LRU" or "FIFO")
            {
                await cache.EnsureCapacityAsync(8, destination, default);
                Require(File.Exists(first) == (scenario == "LRU"), "LRU retains recently used; FIFO evicts earliest cached");
                Require(File.Exists(second) == (scenario == "FIFO"), "replacement strategy orders eligible copies correctly");
            }
            else if (scenario.StartsWith("expired"))
            {
                try { await cache.CollectGarbageAsync(default); }
                catch (DesktopAgentRuntimeException error) when (scenario == "expired-with-protected-capacity" && error.Code == "DISK_FULL") { }
                Require(File.Exists(first) && !File.Exists(second), "expired idle copy is cleaned without capacity pressure or UI confirmation");
            }
            else if (scenario is "oversized" or "unknown-length" or "protected-capacity")
            {
                var rejected = false;
                try
                {
                    if (scenario == "unknown-length")
                    {
                        await File.WriteAllTextAsync(destination, new string('x', 13));
                        await cache.RecordAsync(destination, "CONTENT", default);
                    }
                    else await cache.EnsureCapacityAsync(scenario == "protected-capacity" ? 9 : 13, destination, default);
                }
                catch (DesktopAgentRuntimeException error) when (error.Code is "CACHE_FILE_TOO_LARGE" or "DISK_FULL") { rejected = true; }
                Require(rejected && File.Exists(first) && File.Exists(second), "impossible allocation must not evict useful cached files");
            }
            else if (scenario == "fifo-touch")
            {
                await cache.RecordAsync(first, "CONTENT", default);
                await cache.EnsureCapacityAsync(8, destination, default);
                Require(!File.Exists(first) && File.Exists(second), "a cache hit must not reset FIFO insertion time");
            }
            else if (scenario == "persist-policy")
            {
                var settings = new DesktopAgentCacheSettingsService(options, cache, state, new FixtureLifetime());
                await settings.UpdateAsync(new DesktopAgentCacheSettingsRequest { CacheRoot = options.CacheRoot, MaxBytes = 12, EvictionPolicy = "FIFO", IdleDays = 7 }, default);
                var reloaded = DesktopAgentRuntimeOptions.FromConfiguration(config);
                Require(reloaded.CacheEvictionPolicy == "FIFO" && reloaded.CacheTtl == TimeSpan.FromDays(7), "policy and idle duration must survive restart");
                var rejected = false;
                try { await settings.UpdateAsync(new DesktopAgentCacheSettingsRequest { CacheRoot = options.CacheRoot, MaxBytes = 12, EvictionPolicy = "UNSAFE", IdleDays = 0 }, default); }
                catch (DesktopAgentRuntimeException error) when (error.Code == "VALIDATION_FAILED") { rejected = true; }
                Require(rejected, "unknown strategies and invalid retention must be rejected");
            }
            else if (scenario == "malformed-policy")
            {
                await File.WriteAllTextAsync(Path.Combine(options.StateRoot, "cache-settings.json"), JsonSerializer.Serialize(new { cacheRoot = options.CacheRoot, maxBytes = "bad", evictionPolicy = new { unknown = true }, idleDays = "bad" }));
                var reloaded = DesktopAgentRuntimeOptions.FromConfiguration(config);
                Require(reloaded.CacheEvictionPolicy == "LRU" && reloaded.CacheTtl == TimeSpan.FromDays(30), "malformed optional fields fall back without crashing startup");
            }
            else
            {
                await File.WriteAllTextAsync(Path.Combine(options.StateRoot, "cache-settings.json"), JsonSerializer.Serialize(new { cacheRoot = options.CacheRoot, maxBytes = 12 }));
                var reloaded = DesktopAgentRuntimeOptions.FromConfiguration(config);
                Require(reloaded.CacheEvictionPolicy == "LRU" && reloaded.CacheTtl == TimeSpan.FromDays(30), "older settings retain LRU and 30-day defaults");
            }
            Console.WriteLine($"PASS replacement-{scenario}");
        }
    }
    private static void Require(bool condition, string message) { if (!condition) throw new Exception(message); }
    private sealed class FixtureLifetime : IHostApplicationLifetime
    {
        public CancellationToken ApplicationStarted => CancellationToken.None;
        public CancellationToken ApplicationStopping => CancellationToken.None;
        public CancellationToken ApplicationStopped => CancellationToken.None;
        public void StopApplication() { }
    }
}
