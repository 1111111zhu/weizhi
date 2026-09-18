using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;
using System.IO.Compression;
using ProjectWing.NativeRuntime;
using static ProjectWing.AgentManager.AgentManagerOptions;
using static ProjectWing.AgentManager.ManagerStatusStore;

namespace ProjectWing.AgentManager;

// Copied with its runtime dependencies to an immutable state-root helper directory.
// Owns maintenance independently of Electron and launches the exact updater it waits for.
internal static class MaintenanceHandoff
{
    public static int Run(string[] args, string statusPath)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Native update handoff currently requires the standard Windows installation layout.");
        var stateRoot = Path.GetDirectoryName(statusPath)!;
        var handoffId = RequireOption(args, "--handoff-id");
        if (!Guid.TryParse(handoffId, out _)) throw new InvalidDataException("The update handoff identity is invalid.");
        void Write(UpdateStatus status)
        {
            status.TaskId = handoffId;
            WriteHandoffStatus(statusPath, status);
        }
        int FailHandoff(string code, string message)
        {
            Write(new UpdateStatus("FAILED") { ErrorCode = code, Message = message });
            return 1;
        }
        using var lease = RuntimeOwnershipLease.TryAcquire(stateRoot, "maintenance")
            ?? throw new InvalidOperationException("Another installation or recovery operation owns maintenance.");
        var root = Path.GetFullPath(RequireOption(args, "--install-root"));
        var packageName = RequireOption(args, "--package-name");
        var expectedHash = RequireOption(args, "--package-sha256");
        var signaturePolicy = RequireOption(args, "--signature-policy");
        if (signaturePolicy is not ("required" or "optional"))
            throw new InvalidDataException("The installed update trust policy is invalid.");
        if (Path.GetFileName(packageName) != packageName || packageName.IndexOfAny(['/', '\\', ':']) >= 0
            || !packageName.EndsWith(".nupkg", StringComparison.OrdinalIgnoreCase)
            || expectedHash.Length != 64 || !expectedHash.All(Uri.IsHexDigit))
            throw new InvalidDataException("The update package identity is invalid.");
        var package = Path.Combine(root, "packages", packageName);
        var helperDirectory = Path.GetFullPath(AppContext.BaseDirectory);
        var allowedHelperRoot = Path.Combine(Path.GetFullPath(stateRoot), "recovery-helper") + Path.DirectorySeparatorChar;
        if (!helperDirectory.StartsWith(allowedHelperRoot, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("Update handoff must run from its independent recovery helper directory.");
        foreach (var directory in new[] { root, Path.Combine(root, "current"), Path.Combine(root, "packages") })
            if (!Directory.Exists(directory) || (File.GetAttributes(directory) & FileAttributes.ReparsePoint) != 0)
                throw new InvalidDataException("The installation layout is missing or redirected; no updater was started.");
        if (!File.Exists(Path.Combine(root, "current", "sq.version")))
            throw new InvalidDataException("The standard installed application identity is missing.");
        VerifyPackage(package, expectedHash);
        // Velopack may have cached the package while failing to replace root/Update.exe.
        // Run the verified package's updater from our immutable helper directory;
        // do not overwrite a locked/mismatched installation updater or redownload.
        var updater = ExtractUpdater(package, helperDirectory);
        VerifyUpdaterFromPackage(package, updater);
        InstallerSignatureVerifier.Verify(updater, signaturePolicy);
        if (!int.TryParse(RequireOption(args, "--parent-pid"), out var parentPid) || parentPid <= 0 || parentPid == Environment.ProcessId)
            throw new InvalidDataException("The update caller identity is invalid.");
        using var parent = Process.GetProcessById(parentPid);
        var parentExecutable = parent.MainModule?.FileName;
        if (parent.HasExited || parentExecutable is null || !Path.GetFullPath(parentExecutable).StartsWith(Path.Combine(root, "current") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("The update caller does not belong to this installation.");
        var version = RequireOption(args, "--target-version");
        Write(new UpdateStatus("REPAIRING_ENVIRONMENT") { ExpectedVersion = version, Message = "Preparing the installed application update." });
        Console.WriteLine(JsonSerializer.Serialize(new { status = "PREPARED", taskId = handoffId }));
        Console.Out.Flush();
        string? command;
        try { command = Console.In.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(60)).GetAwaiter().GetResult(); }
        catch (TimeoutException) { command = null; }
        if (command is null || parent.HasExited || !IsCommit(command))
            return FailHandoff("UPDATE_CANCELLED", "Update preparation ended before commit. The installed application can continue normally.");
        VerifyPackage(package, expectedHash);
        VerifyUpdaterFromPackage(package, updater);
        var gate = MaintenanceExitGate.Arm(
            () => Write(new UpdateStatus("REPAIRING_ENVIRONMENT")
            {
                HandoffPhase = "AWAITING_APP_EXIT",
                ExpectedVersion = version,
                Message = "The verified update is ready; waiting for the application to exit.",
            }),
            () =>
            {
                Console.WriteLine(JsonSerializer.Serialize(new { status = "COMMITTED", taskId = handoffId }));
                Console.Out.Flush();
            });
        var nextInput = Console.In.ReadLineAsync();
        var elapsed = Stopwatch.StartNew();
        MaintenanceExitDecision decision;
        do
        {
            string? input = null;
            var inputFaulted = nextInput.IsFaulted || nextInput.IsCanceled;
            if (nextInput.IsCompletedSuccessfully) input = nextInput.GetAwaiter().GetResult();
            decision = gate.Observe(parent.HasExited, nextInput.IsCompleted, input, inputFaulted, elapsed.Elapsed);
            if (decision == MaintenanceExitDecision.Waiting) Thread.Sleep(25);
        } while (decision == MaintenanceExitDecision.Waiting);
        if (decision != MaintenanceExitDecision.ParentExited)
            return FailHandoff("UPDATE_CANCELLED", "The application did not exit for the update, or cancelled it. No updater was started.");
        return ApplyAfterParentExit(() =>
        {
            // The exact caller has exited and its pending input has been consumed.
            // Revalidate after the waiting window; an updater never waits for, kills,
            // or unexpectedly applies after a caller that reports cancellation.
            VerifyPackage(package, expectedHash);
            VerifyUpdaterFromPackage(package, updater);
            // Persist INSTALLING before spawn: a crash in the spawn/record window
            // remains conservative, never mistaken for a safely cancelled update.
            Write(new UpdateStatus("INSTALLING") { ExpectedVersion = version, Message = "The installed updater is applying the verified package." });
            var start = new ProcessStartInfo(updater) { UseShellExecute = false, CreateNoWindow = true, WorkingDirectory = root };
            foreach (var argument in new[] { "apply", "--package", package, "--root", root, "--packageDir", Path.Combine(root, "packages") }) start.ArgumentList.Add(argument);
            using var updaterProcess = Process.Start(start)
                ?? throw new InvalidOperationException("The installed updater could not start.");
            // Once spawned, all error paths await our exact updater's lifetime
            // before reopening the application or releasing maintenance.
            try
            {
                Write(new UpdateStatus("INSTALLING")
                {
                    ExpectedVersion = version,
                    InstallerPid = updaterProcess.Id,
                    InstallerStartTimeUtcTicks = updaterProcess.StartTime.ToUniversalTime().Ticks.ToString(),
                    InstallerProcessIdentity = ProcessGenerationIdentity.Capture(updaterProcess),
                    Message = "The installed updater is applying the verified package.",
                });
            }
            catch (Exception error) when (error is IOException or UnauthorizedAccessException or InvalidOperationException)
            {
                // The UI may have exited or lost its pipe. Its disappearance must
                // not release maintenance, kill the updater, or skip its final result.
            }
            finally { updaterProcess.WaitForExit(); }
            if (updaterProcess.ExitCode != 0) throw new InvalidOperationException($"The installed updater exited with code {updaterProcess.ExitCode}.");
            Write(new UpdateStatus("READY") { ExpectedVersion = version, Message = "The installer completed; the application is starting its local service." });
            return 0;
        }, error => FailHandoff("INSTALLER_APPLY_FAILED", $"{error.Message} Working files were retained; reopening the installed application."),
            () => ReopenInstalledApplication(parentExecutable, root));
    }

    private static int ApplyAfterParentExit(Func<int> apply, Func<Exception, int> recordFailure, Action reopen)
    {
        try { return apply(); }
        catch (Exception error)
        {
            // A failed status write must never skip reopening a stopped UI.
            try { return recordFailure(error); }
            finally { reopen(); }
        }
    }

    private static bool IsCommit(string command)
    {
        try
        {
            using var document = JsonDocument.Parse(command);
            return document.RootElement.ValueKind == JsonValueKind.Object
                && document.RootElement.TryGetProperty("command", out var value) && value.GetString() == "commit";
        }
        catch (JsonException) { return false; }
    }

    private static void ReopenInstalledApplication(string executable, string root)
    {
        if (!File.Exists(executable) || !Path.GetFullPath(executable).StartsWith(Path.Combine(root, "current") + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return;
        try
        {
            using var reopened = Process.Start(new ProcessStartInfo(executable)
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WorkingDirectory = Path.GetDirectoryName(executable)!,
            });
        }
        catch (Exception error) when (error is IOException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            // The durable failure remains available to the local recovery launcher.
        }
    }

    private static void WriteHandoffStatus(string path, UpdateStatus status)
    {
        status.OwnerKind = "velopack-handoff-v1";
        WriteStatus(path, status);
    }

    private static void VerifyUpdaterFromPackage(string package, string updater)
    {
        using var archive = ZipFile.OpenRead(package);
        var entries = archive.Entries.Where(entry => entry.FullName.Replace('\\', '/').Split('/').Last() == "Squirrel.exe").ToArray();
        if (entries.Length != 1 || entries[0].Length > 100_000_000)
            throw new InvalidDataException("The verified package must contain exactly one bounded updater executable.");
        using var input = entries[0].Open();
        VerifyPackage(updater, Convert.ToHexString(SHA256.HashData(input)));
    }

    private static string ExtractUpdater(string package, string directory)
    {
        using var archive = ZipFile.OpenRead(package);
        var entries = archive.Entries.Where(entry => entry.FullName.Replace('\\', '/').Split('/').Last() == "Squirrel.exe").ToArray();
        if (entries.Length != 1 || entries[0].Length > 100_000_000) throw new InvalidDataException("The verified package updater is missing, ambiguous or too large.");
        var target = Path.Combine(directory, $"VerifiedUpdate-{Guid.NewGuid():N}.exe");
        using var input = entries[0].Open();
        using var output = new FileStream(target, FileMode.CreateNew, FileAccess.Write, FileShare.None);
        var buffer = new byte[81920];
        long total = 0;
        int read;
        while ((read = input.Read(buffer)) > 0)
        {
            total += read;
            if (total > 100_000_000) throw new InvalidDataException("The verified package updater exceeded its size limit.");
            output.Write(buffer, 0, read);
        }
        output.Flush(flushToDisk: true);
        return target;
    }

    private static void VerifyPackage(string path, string expectedHash)
    {
        if (!File.Exists(path) || (File.GetAttributes(path) & FileAttributes.ReparsePoint) != 0) throw new InvalidDataException("The update package is missing or redirected.");
        using var stream = File.OpenRead(path);
        if (!Convert.ToHexString(SHA256.HashData(stream)).Equals(expectedHash, StringComparison.OrdinalIgnoreCase))
            throw new InvalidDataException("The downloaded update package changed; the installed application was not modified.");
    }
}
