using System.Diagnostics;
using System.Net;
using System.Net.Sockets;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using ProjectWing.DesktopAgent.Runtime;

internal static class StateDirectoryChecks
{
    public static async Task ProbePackagedRuntimeAsync(string executable)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Windows junction fixture");
        var root = Path.Combine(Path.GetTempPath(), "project-wing-packaged-state-" + Guid.NewGuid().ToString("N"));
        var physical = Path.Combine(root, "physical");
        var alias = Path.Combine(root, "redirect");
        var stateRoot = Path.Combine(physical, "state");
        var cacheRoot = Path.Combine(physical, "cache");
        Directory.CreateDirectory(stateRoot);
        Directory.CreateDirectory(cacheRoot);
        await CreateJunctionAsync(alias, physical);
        // A deliberately malformed synthetic record exercises quarantine creation
        // as well as the session and cache-index atomic writes at startup.
        await File.WriteAllTextAsync(Path.Combine(stateRoot, "sessions.json"), "[{\"fixture\":true}]");
        using var allocation = new TcpListener(IPAddress.Loopback, 0);
        allocation.Start();
        var port = ((IPEndPoint)allocation.LocalEndpoint).Port;
        allocation.Stop();
        var start = new ProcessStartInfo(Path.GetFullPath(executable))
        { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add("--urls"); start.ArgumentList.Add($"http://127.0.0.1:{port}");
        start.Environment["PROJECT_WING_AGENT_STATE_ROOT"] = Path.Combine(alias, "state");
        start.Environment["PROJECT_WING_AGENT_CACHE_ROOT"] = cacheRoot;
        start.Environment["PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH"] = "true";
        start.Environment["PROJECT_WING_AGENT_API_BASE_URL"] = "https://fixture.invalid/api";
        foreach (var key in start.Environment.Keys.Where(key => key.StartsWith("PROJECT_WING_AGENT_MANAGER_", StringComparison.Ordinal)).ToArray())
            start.Environment.Remove(key);
        using var process = Process.Start(start)!;
        var stdout = process.StandardOutput.ReadToEndAsync();
        var stderr = process.StandardError.ReadToEndAsync();
        try
        {
            await Task.Delay(TimeSpan.FromSeconds(12));
            Require(!process.HasExited, "packaged worker exited during redirected-state startup");
            using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
            using var health = JsonDocument.Parse(await client.GetStringAsync($"http://127.0.0.1:{port}/health"));
            Require(health.RootElement.GetProperty("ok").GetBoolean(), "packaged worker health is available");
            Require(health.RootElement.GetProperty("quarantineCount").GetInt32() == 1, "invalid synthetic record retained in quarantine");
            Require(File.Exists(Path.Combine(stateRoot, "cache-index.json")), "packaged worker writes cache index");
            Require(await File.ReadAllTextAsync(Path.Combine(stateRoot, "sessions.json.bak")) == "[{\"fixture\":true}]",
                "packaged worker retains the original synthetic record in backup");
            Console.WriteLine($"PASS packaged-state-junction health=200 version={health.RootElement.GetProperty("version").GetString()} root={root}");
        }
        finally
        {
            if (!process.HasExited) process.Kill(); // Only the exact isolated child created above.
            await process.WaitForExitAsync();
            var output = await stdout;
            var errors = await stderr;
            if (output.Contains("BackgroundService failed", StringComparison.Ordinal) || errors.Length > 0)
                Console.WriteLine(output + errors);
        }
    }

    public static async Task RunAsync(string root, Func<string, DesktopAgentSession> sessionFactory)
    {
        if (!OperatingSystem.IsWindows())
        {
            Console.WriteLine("SKIP state-directory-junction (Windows only)");
            return;
        }
        var fixture = Path.Combine(root, "state-directory");
        var physical = Path.Combine(fixture, "physical");
        var alias = Path.Combine(fixture, "redirect");
        var cacheRoot = Path.Combine(fixture, "cache");
        Directory.CreateDirectory(physical);
        Directory.CreateDirectory(cacheRoot);
        await CreateJunctionAsync(alias, physical);
        foreach (var existing in new[] { false, true })
        {
            var relative = existing ? "existing" : "new/nested";
            var expected = Path.GetFullPath(Path.Combine(physical, relative));
            if (existing) Directory.CreateDirectory(expected);
            var options = Options(Path.Combine(alias, relative), cacheRoot);
            Require(options.StateRoot == expected, "redirected ancestor resolves before state directory creation");
            Require(options.CacheRoot == cacheRoot, "state resolution does not rewrite cache identity");
            var state = new DesktopAgentRuntimeState(options);
            var file = Path.Combine(cacheRoot, $"synthetic-{existing}.txt");
            await File.WriteAllTextAsync(file, "unuploaded edits");
            var session = sessionFactory(file);
            await state.UpsertSessionAsync(session, default);
            await state.UpsertSessionAsync(session, default);
            Require((await state.ReadSessionAsync("s", default))?.GetProperty("localPath").GetString() == file,
                "existing session local path is preserved");
            Require(File.Exists(Path.Combine(expected, "sessions.json.bak")), "backup is retained in the same physical directory");
            var cache = new DesktopAgentCacheService(options, state, NullLogger<DesktopAgentCacheService>.Instance);
            await cache.RecordAsync(file, "CONTENT", default);
            Require(File.Exists(Path.Combine(expected, "cache-index.json")), "cache index writes through redirected state root");
            Require(!Directory.GetFiles(expected, "*.tmp").Any(), "atomic writes leave no temporary files");
            Require(await File.ReadAllTextAsync(file) == "unuploaded edits", "working bytes are untouched");
            Console.WriteLine($"PASS state-directory-junction-{(existing ? "existing" : "new")}");
        }

        // Upgrade compatibility: read pre-existing state through the logical name,
        // then update it in place rather than starting a second empty state store.
        var legacyRoot = Path.Combine(physical, "legacy");
        Directory.CreateDirectory(legacyRoot);
        var legacyOptions = Options(legacyRoot, cacheRoot);
        var legacyState = new DesktopAgentRuntimeState(legacyOptions);
        await legacyState.UpsertSessionAsync(sessionFactory(Path.Combine(cacheRoot, "legacy.txt")), default);
        var upgraded = new DesktopAgentRuntimeState(Options(Path.Combine(alias, "legacy"), cacheRoot));
        Require((await upgraded.ReadSessionsAsync(default)).Count == 1, "redirected upgrade retains existing records");
        await upgraded.UpsertSessionAsync(sessionFactory(Path.Combine(cacheRoot, "legacy.txt")), default);
        Require((await legacyState.ReadSessionsAsync(default)).Count == 1, "logical and physical paths share one state store");
        Console.WriteLine("PASS state-directory-upgrade-preserves-records");

        // A persistence failure must be retried without faulting the host.
        var retryOptions = Options(Path.Combine(physical, "retry"), cacheRoot);
        Directory.CreateDirectory(retryOptions.StateRoot);
        var retryState = new DesktopAgentRuntimeState(retryOptions);
        var retryPath = Path.Combine(retryOptions.StateRoot, "sessions.json");
        await File.WriteAllTextAsync(retryPath, "[]");
        var syncLogger = new ObservedLogger<DesktopAgentBackgroundSyncService>();
        var heartbeatLogger = new ObservedLogger<DesktopAgentHeartbeatService>();
        using var sync = new DesktopAgentBackgroundSyncService(retryState,
            new DesktopAgentSessionReconciler(retryState, retryOptions), null!, syncLogger);
        using var heartbeat = new DesktopAgentHeartbeatService(retryState, null!, heartbeatLogger);
        using (var locked = new FileStream(retryPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None))
        {
            await sync.StartAsync(default);
            await heartbeat.StartAsync(default);
            await Task.WhenAll(syncLogger.Seen.Task, heartbeatLogger.Seen.Task).WaitAsync(TimeSpan.FromSeconds(3));
            Require(sync.ExecuteTask?.IsCompleted == false && heartbeat.ExecuteTask?.IsCompleted == false,
                "transient IO errors do not terminate background services");
        }
        var missing = sessionFactory(Path.Combine(cacheRoot, "retry-missing.txt")) with
        { Mode = "READ_ONLY", LifecycleState = "OPEN", Status = "OPEN", CloseDetectedAt = null };
        await retryState.UpsertSessionAsync(missing, default);
        await Task.Delay(TimeSpan.FromSeconds(6));
        var recovered = await retryState.ReadSessionAsync("s", default);
        Require(recovered?.GetProperty("lifecycleState").GetString() == "LOCAL_FILE_MISSING",
            "initial reconciliation is retried after the lock is released");
        Require(sync.ExecuteTask?.IsCompleted == false, "sync remains alive after recovery");
        using var stop = new CancellationTokenSource(TimeSpan.FromSeconds(3));
        await sync.StopAsync(stop.Token);
        await heartbeat.StopAsync(stop.Token);
        Console.WriteLine("PASS state-io-startup-retry-and-cancellation");
    }

    private static DesktopAgentRuntimeOptions Options(string state, string cache) =>
        DesktopAgentRuntimeOptions.FromConfiguration(new ConfigurationBuilder().AddInMemoryCollection(
            new Dictionary<string, string?>
            {
                ["PROJECT_WING_AGENT_STATE_ROOT"] = state,
                ["PROJECT_WING_AGENT_CACHE_ROOT"] = cache,
                ["PROJECT_WING_AGENT_DISABLE_FILE_LAUNCH"] = "true",
                ["PROJECT_WING_AGENT_API_BASE_URL"] = "https://fixture.invalid/api",
            }).Build());

    private static async Task CreateJunctionAsync(string alias, string target)
    {
        var start = new ProcessStartInfo("powershell.exe")
        { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
        start.ArgumentList.Add("-NoProfile");
        start.ArgumentList.Add("-NonInteractive");
        start.ArgumentList.Add("-Command");
        start.ArgumentList.Add($"New-Item -ItemType Junction -Path '{alias.Replace("'", "''")}' -Target '{target.Replace("'", "''")}' -ErrorAction Stop | Out-Null");
        using var process = Process.Start(start)!;
        var errors = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        Require(process.ExitCode == 0, $"isolated junction creation failed: {await errors}");
    }

    private static void Require(bool condition, string message)
    { if (!condition) throw new Exception(message); }

    private sealed class ObservedLogger<T> : ILogger<T>
    {
        public TaskCompletionSource Seen { get; } = new(TaskCreationOptions.RunContinuationsAsynchronously);
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel level) => true;
        public void Log<TState>(LogLevel level, EventId id, TState state, Exception? error, Func<TState, Exception?, string> formatter)
        { if (error is IOException) Seen.TrySetResult(); }
    }
}
