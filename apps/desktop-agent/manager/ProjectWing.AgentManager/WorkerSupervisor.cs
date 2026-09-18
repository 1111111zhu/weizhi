using System.Diagnostics;

namespace ProjectWing.AgentManager;

internal sealed record WorkerRuntimeSnapshot(
    Process? Worker,
    string State,
    int RestartCount,
    string? FailureReason
);

internal sealed class WorkerSupervisor : IDisposable
{
    private static readonly TimeSpan RestartWindow = TimeSpan.FromMinutes(5);
    private static readonly TimeSpan[] RestartDelays =
    [
        TimeSpan.FromSeconds(1),
        TimeSpan.FromSeconds(2),
        TimeSpan.FromSeconds(4),
        TimeSpan.FromSeconds(8),
        TimeSpan.FromSeconds(16),
    ];

    private readonly object gate = new();
    private readonly Queue<DateTimeOffset> restartHistory = new();
    private readonly RuntimeConfig config;
    private readonly Func<RuntimeConfig, Process> startWorker;
    private Process? worker;
    private bool stopping;
    private bool watchdogStarted;
    private string state = "STARTING";
    private string? failureReason;
    private int restartCount;
    private long restartGeneration;
    private DateTimeOffset lastRecoveryAt = DateTimeOffset.MinValue;
    private DateTimeOffset workerStartedAt;
    private int consecutiveHealthFailures;
    public string InstanceId { get; } = Guid.NewGuid().ToString("N");

    public bool TryRecover(int? expectedWorkerPid)
    {
        lock (gate)
        {
            if (stopping || worker?.Id != expectedWorkerPid
                || DateTimeOffset.UtcNow - lastRecoveryAt < TimeSpan.FromSeconds(10)) return false;
            lastRecoveryAt = DateTimeOffset.UtcNow;
            restartGeneration++;
            if (worker is not null)
            {
                // This is the exact child Process owned by this supervisor;
                // never discover or terminate an arbitrary PID from the caller.
                var retired = worker;
                worker = null;
                retired.Exited -= OnWorkerExited;
                ManagedRuntimeHost.TerminateWorker(retired);
                if (!retired.HasExited)
                {
                    worker = retired;
                    retired.Exited += OnWorkerExited;
                    return false;
                }
                _ = Task.Run(() =>
                {
                    retired.Exited -= OnWorkerExited;
                    retired.Dispose();
                });
            }
            restartHistory.Clear();
            StartWorkerLocked(recovering: true, maintenanceOwned: true);
            return true;
        }
    }

    public WorkerSupervisor(RuntimeConfig config, Func<RuntimeConfig, Process> startWorker)
    {
        this.config = config;
        this.startWorker = startWorker;
    }

    public void Start()
    {
        lock (gate)
        {
            if (stopping || worker is not null) return;
            StartWorkerLocked(recovering: false);
            StartWatchdogLocked();
        }
    }

    public WorkerRuntimeSnapshot GetSnapshot()
    {
        lock (gate)
        {
            return new WorkerRuntimeSnapshot(worker, state, restartCount, failureReason);
        }
    }

    private void StartWorkerLocked(bool recovering, bool maintenanceOwned = false)
    {
        using var startPermission = maintenanceOwned ? null : ProjectWing.NativeRuntime.RuntimeOwnershipLease.TryAcquire(config.StateRoot, "maintenance");
        var maintenanceState = !maintenanceOwned && startPermission is null ? "ACTIVE" : RecoveryMaintenancePolicy.GetStateWhileOwned(config.StateRoot);
        if (maintenanceState == "REVIEW_REQUIRED")
        {
            state = "DEGRADED_NEEDS_ATTENTION";
            failureReason = "PREVIOUS_UPDATE_NEEDS_REVIEW";
            return;
        }
        if (maintenanceState == "ACTIVE")
        {
            state = "UPDATING";
            failureReason = "Waiting for the current installation transaction to release maintenance.";
            var generation = ++restartGeneration;
            _ = Task.Run(async () =>
            {
                await Task.Delay(1000);
                lock (gate)
                {
                    if (!stopping && worker is null && generation == restartGeneration) StartWorkerLocked(recovering);
                }
            });
            return;
        }
        try
        {
            worker = startWorker(config);
            workerStartedAt = DateTimeOffset.UtcNow;
            consecutiveHealthFailures = 0;
            worker.EnableRaisingEvents = true;
            worker.Exited += OnWorkerExited;
            state = recovering ? "RECOVERING" : "STARTING";
            failureReason = null;
        }
        catch (Exception error)
        {
            worker = null;
            ScheduleRestartLocked(error.Message);
        }
    }

    private void OnWorkerExited(object? sender, EventArgs eventArgs)
    {
        if (sender is Process exited) HandleWorkerExited(exited);
    }

    private void HandleWorkerExited(Process exited)
    {
        var shouldDispose = false;
        lock (gate)
        {
            if (!ReferenceEquals(worker, exited)) return;
            worker = null;
            shouldDispose = true;
            if (!stopping)
            {
                ScheduleRestartLocked("Desktop Agent worker exited unexpectedly.");
            }
        }
        if (shouldDispose)
        {
            // Process event cleanup can block from inside Exited on Unix. Run it
            // after the callback returns; the watchdog covers missed events too.
            _ = Task.Run(() =>
            {
                try
                {
                    exited.Exited -= OnWorkerExited;
                    exited.Dispose();
                }
                catch (InvalidOperationException)
                {
                    // A concurrent shutdown may already have released the handle.
                }
            });
        }
    }

    private void StartWatchdogLocked()
    {
        if (watchdogStarted) return;
        watchdogStarted = true;
        _ = Task.Run(WatchWorkerAsync);
    }

    private async Task WatchWorkerAsync()
    {
        while (true)
        {
            await Task.Delay(TimeSpan.FromSeconds(1));
            Process? current;
            lock (gate)
            {
                if (stopping) return;
                current = worker;
            }
            if (current is null) continue;
            try
            {
                if (current.HasExited)
                {
                    HandleWorkerExited(current);
                    continue;
                }
                var health = await WorkerHealthProbeService.ProbeAsync(config, current);
                lock (gate)
                {
                    if (stopping || !ReferenceEquals(current, worker)) continue;
                    if (health.AgentState is "READY" or "READY_WITH_ATTENTION" or "UPDATING")
                    {
                        consecutiveHealthFailures = 0;
                        continue;
                    }
                    if (DateTimeOffset.UtcNow - workerStartedAt < TimeSpan.FromSeconds(30)) continue;
                    if (++consecutiveHealthFailures < 3) continue;
                    using var maintenance = ProjectWing.NativeRuntime.RuntimeOwnershipLease.TryAcquire(config.StateRoot, "maintenance");
                    if (maintenance is null || !RecoveryMaintenancePolicy.AllowsRecovery(config.StateRoot)) continue;
                    // Sustained liveness failure, not one slow request. Use the same
                    // bounded crash budget and terminate only our exact child handle.
                    worker = null;
                    current.Exited -= OnWorkerExited;
                    ManagedRuntimeHost.TerminateWorker(current);
                    if (!current.HasExited)
                    {
                        worker = current;
                        current.Exited += OnWorkerExited;
                        continue;
                    }
                    _ = Task.Run(current.Dispose);
                    ScheduleRestartLocked("Desktop Agent worker stopped responding to repeated bounded health checks.");
                }
            }
            catch (InvalidOperationException)
            {
                // Malformed state/IO is not evidence that a live child exited.
                // A concurrent owner operation may already have disposed it.
                try { if (current.HasExited) HandleWorkerExited(current); }
                catch (InvalidOperationException) { }
            }
        }
    }

    private void ScheduleRestartLocked(string reason)
    {
        var now = DateTimeOffset.UtcNow;
        while (restartHistory.TryPeek(out var oldest) && now - oldest > RestartWindow)
        {
            restartHistory.Dequeue();
        }
        if (restartHistory.Count >= RestartDelays.Length)
        {
            state = "DEGRADED_NEEDS_ATTENTION";
            failureReason = reason;
            return;
        }
        var delay = RestartDelays[restartHistory.Count];
        restartHistory.Enqueue(now);
        restartCount++;
        state = "RECOVERING";
        failureReason = reason;
        var generation = ++restartGeneration;
        _ = Task.Run(async () =>
        {
            await Task.Delay(delay);
            lock (gate)
            {
                if (!stopping && worker is null && generation == restartGeneration)
                    StartWorkerLocked(recovering: true);
            }
        });
    }

    public void Dispose()
    {
        Process? current;
        lock (gate)
        {
            stopping = true;
            current = worker;
            worker = null;
        }
        if (current is null) return;
        current.Exited -= OnWorkerExited;
        ManagedRuntimeHost.TerminateWorker(current);
        current.Dispose();
    }
}
