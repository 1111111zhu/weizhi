namespace ProjectWing.NativeRuntime;

// Kernel-held ownership, not a PID file. A crashed owner releases the lock.
// Never delete this file to "unlock" it: that can create two owners on Unix.
internal sealed class RuntimeOwnershipLease : IDisposable
{
    private readonly FileStream stream;

    private RuntimeOwnershipLease(FileStream stream) => this.stream = stream;

    public static RuntimeOwnershipLease? TryAcquire(string stateRoot, string component)
    {
        try { return Acquire(stateRoot, component); }
        catch (InvalidOperationException error) when (error.InnerException is IOException) { return null; }
    }

    public static RuntimeOwnershipLease Acquire(string stateRoot, string component)
    {
        Directory.CreateDirectory(stateRoot);
        var path = Path.Combine(Path.GetFullPath(stateRoot), $".{component}-owner.lock");
        try
        {
            return new RuntimeOwnershipLease(new FileStream(
                path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.None));
        }
        catch (IOException error)
        {
            throw new InvalidOperationException(
                $"INSTANCE_OWNERSHIP_UNAVAILABLE: cannot acquire {component} ownership. Another instance may be using this state directory. No state was changed.", error);
        }
    }

    public void Dispose() => stream.Dispose();
}
