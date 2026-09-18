namespace ProjectWing.AgentManager;

internal enum MaintenanceExitDecision { Waiting, ParentExited, Cancelled }

// A pure, terminal state machine: there is no updater while the caller is alive.
// EOF alone does not authorize an update, and cancellation cannot be undone by
// a later caller exit. Keep IO outside this class so adversarial ordering is tested.
internal sealed class MaintenanceExitGate
{
    private MaintenanceExitDecision decision = MaintenanceExitDecision.Waiting;
    private TimeSpan? eofAt;

    private MaintenanceExitGate() { }

    public static MaintenanceExitGate Arm(Action persistReceipt, Action acknowledge)
    {
        // If durable receipt creation fails, do not acknowledge and do not arm.
        persistReceipt();
        var gate = new MaintenanceExitGate();
        try { acknowledge(); }
        catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
        {
            // The caller may recover a lost acknowledgement from our durable
            // task/owner-bound receipt; it still must exit before an updater exists.
        }
        return gate;
    }

    public MaintenanceExitDecision Observe(bool parentExited, bool inputCompleted, string? input, bool inputFaulted, TimeSpan elapsed)
    {
        if (decision != MaintenanceExitDecision.Waiting) return decision;
        // Any post-commit command, including explicit cancel, aborts. Drain stdin
        // before interpreting parent exit so a queued cancellation wins the race.
        if (inputFaulted || inputCompleted && input is not null)
            return decision = MaintenanceExitDecision.Cancelled;
        if (elapsed >= TimeSpan.FromSeconds(30)) return decision = MaintenanceExitDecision.Cancelled;
        if (inputCompleted)
        {
            eofAt ??= elapsed;
            if (parentExited) return decision = MaintenanceExitDecision.ParentExited;
            if (elapsed - eofAt.Value >= TimeSpan.FromSeconds(2)) return decision = MaintenanceExitDecision.Cancelled;
        }
        // A live caller with a closed pipe gets a brief graceful-exit window;
        // a dead caller with unread input waits rather than bypassing cancellation.
        return decision;
    }
}
