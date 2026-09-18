using System.Diagnostics;
using ProjectWing.NativeRuntime;

namespace ProjectWing.DesktopAgent.Runtime;

// A Manager crash must not leave a Runtime permanently holding state/cache locks.
// Never enumerate children or terminate Office: the bounded fallback kills only us.
internal sealed class DesktopAgentManagerLifetimeGuard : IDisposable
{
    private readonly Process parent;
    private readonly string identity;
    private volatile bool disposed;

    private DesktopAgentManagerLifetimeGuard(Process parent, string identity, IHostApplicationLifetime lifetime)
    {
        this.parent = parent;
        this.identity = identity;
        new Thread(() => Watch(lifetime)) { IsBackground = true, Name = "Manager lifetime" }.Start();
    }

    public static DesktopAgentManagerLifetimeGuard? Start(IHostApplicationLifetime lifetime)
    {
        var pidValue = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_MANAGER_PID");
        var ticksValue = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_MANAGER_START_TICKS");
        var identity = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_MANAGER_PROCESS_IDENTITY");
        if (pidValue is null && ticksValue is null && identity is null) return null; // Explicit standalone tools/tests.
        if (!int.TryParse(pidValue, out var pid) || pid <= 0 || pid == Environment.ProcessId)
            throw new InvalidOperationException("Manager lifetime identity is invalid.");
        // Only Windows has a stable legacy UTC creation-time contract. Missing
        // Linux generation evidence must not be replaced by a permissive tolerance.
        if (identity is null && OperatingSystem.IsWindows() && long.TryParse(ticksValue, out var ticks) && ticks > 0)
            identity = ProcessGenerationIdentity.FromStartTime(pid, ticks);
        if (identity is null || !ProcessGenerationIdentity.IsSupported(identity, pid))
            throw new InvalidOperationException("Manager lifetime generation is missing or invalid.");
        var parent = Process.GetProcessById(pid);
        if (parent.HasExited || ProcessGenerationIdentity.Capture(parent) != identity)
        {
            parent.Dispose();
            throw new InvalidOperationException("Manager lifetime identity no longer owns this Runtime.");
        }
        return new DesktopAgentManagerLifetimeGuard(parent, identity, lifetime);
    }

    private void Watch(IHostApplicationLifetime lifetime)
    {
        try
        {
            while (!disposed && ParentStillOwnsRuntime()) { }
            if (disposed) return;
            Console.Error.WriteLine("Manager exited; stopping only this Runtime and preserving local files.");
            // StopApplication callbacks can block; keep the forced self-exit deadline independent.
            _ = Task.Run(lifetime.StopApplication);
            Thread.Sleep(TimeSpan.FromSeconds(8));
            if (!disposed) Process.GetCurrentProcess().Kill();
        }
        catch (Exception error) when (disposed && error is InvalidOperationException or ObjectDisposedException)
        {
            // Normal application shutdown released the watched process handle.
        }
    }

    private bool ParentStillOwnsRuntime()
    {
        try { return !parent.WaitForExit(500) && ProcessGenerationIdentity.Capture(parent) == identity; }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            if (!disposed) Console.Error.WriteLine($"Manager generation could not be verified; stopping this Runtime safely: {error.Message}");
            return false;
        }
    }

    public void Dispose()
    {
        disposed = true;
        parent.Dispose();
    }
}
