using System.Diagnostics;
using System.IO.Compression;
using System.Reflection;
using System.Text.Json;

// In-process policy/package tests only. Never install, register protocols, open
// Office, listen on Agent ports, or use a real state/cache directory.
var assembly = Assembly.Load("ProjectWing.AgentManager");
var generations = assembly.GetType("ProjectWing.NativeRuntime.ProcessGenerationIdentity")!;
var capture = generations.GetMethod("Capture")!;
var parseLinux = generations.GetMethod("FromLinuxStat")!;
string Identity(Process process) => (string)capture.Invoke(null, [process])!;
if (args.Length == 1 && args[0] == "--generation-exit-probe")
{
    Console.WriteLine("ready");
    Console.Out.Flush();
    Console.In.ReadLine();
    return;
}
if (args.Length == 4 && args[0] == "--verify-parent-identity")
{
    using var parent = Process.GetProcessById(int.Parse(args[1]));
    Assert(Identity(parent) == args[2], "cross-process generation remains exact");
    var childPolicy = assembly.GetType("ProjectWing.AgentManager.RecoveryMaintenancePolicy")!;
    Assert(!(bool)childPolicy.GetMethod("AllowsRecovery")!.Invoke(null, [args[3]])!, "another process cannot clear a live owner");
    Assert((string)childPolicy.GetMethod("GetState")!.Invoke(null, [args[3]])! == "ACTIVE", "cross-process owner remains active");
    return;
}
var root = Path.Combine(Path.GetTempPath(), $"project-wing-control-safety-{Guid.NewGuid():N}");
Directory.CreateDirectory(root);
var policy = assembly.GetType("ProjectWing.AgentManager.RecoveryMaintenancePolicy")!;
var allows = policy.GetMethod("AllowsRecovery", BindingFlags.Static | BindingFlags.Public)!;
var inspect = policy.GetMethod("GetState", BindingFlags.Static | BindingFlags.Public)!;
bool Allows(string directory) => (bool)allows.Invoke(null, [directory])!;
var current = Process.GetCurrentProcess();
// Capture a real process generation before it exits; do not manufacture a PID.
var exitProbeInfo = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardInput = true, RedirectStandardOutput = true };
exitProbeInfo.ArgumentList.Add(Assembly.GetExecutingAssembly().Location);
exitProbeInfo.ArgumentList.Add("--generation-exit-probe");
var helper = Process.Start(exitProbeInfo)!;
Assert(helper.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(10)).GetAwaiter().GetResult() == "ready", "owned exit probe ready");
var exitedPid = helper.Id;
var exitedTicks = helper.StartTime.ToUniversalTime().Ticks.ToString();
var exitedIdentity = Identity(helper);
helper.StandardInput.WriteLine("exit");
helper.StandardInput.Close();
_ = helper.StandardOutput.ReadToEnd();
helper.WaitForExit();
helper.Dispose();
foreach (var scenario in new[] { "live-owner", "dead-download", "unknown-install", "legacy-install", "live-updater", "dead-updater", "prepare-cancel" })
{
    var directory = Path.Combine(root, scenario);
    Directory.CreateDirectory(directory);
    var liveOwner = scenario == "live-owner";
    var status = new Dictionary<string, object?>
    {
        ["status"] = scenario is "dead-download" or "live-owner" ? "DOWNLOADING" : scenario == "prepare-cancel" ? "REPAIRING_ENVIRONMENT" : "INSTALLING",
        ["ownerKind"] = scenario is "live-updater" or "dead-updater" or "prepare-cancel" ? "velopack-handoff-v1" : "native-manager-v1",
        ["ownerPid"] = liveOwner ? current.Id : exitedPid,
        ["ownerStartTimeUtcTicks"] = liveOwner ? current.StartTime.ToUniversalTime().Ticks.ToString() : exitedTicks,
        ["ownerProcessIdentity"] = liveOwner ? Identity(current) : exitedIdentity,
        ["installerPid"] = scenario == "live-updater" ? current.Id : exitedPid,
        ["installerStartTimeUtcTicks"] = scenario == "live-updater" ? current.StartTime.ToUniversalTime().Ticks.ToString() : exitedTicks,
        ["installerProcessIdentity"] = scenario == "live-updater" ? Identity(current) : exitedIdentity,
    };
    if (scenario == "unknown-install") status.Remove("ownerKind");
    var original = JsonSerializer.Serialize(status);
    var statusPath = Path.Combine(directory, "update-status.json");
    File.WriteAllText(statusPath, original);
    var expected = scenario is "dead-download" or "dead-updater" or "prepare-cancel";
    Assert(Allows(directory) == expected, scenario);
    if (expected)
    {
        using var changed = JsonDocument.Parse(File.ReadAllText(statusPath));
        Assert(changed.RootElement.GetProperty("status").GetString() == "FAILED", scenario + " interrupted state");
        Assert(File.ReadAllText(Directory.GetFiles(directory, "interrupted-update-*.json").Single()) == original, scenario + " audit preserved");
    }
    else Assert(File.ReadAllText(statusPath) == original, scenario + " active status untouched");
    Assert((string)inspect.Invoke(null, [directory])! == (expected ? "IDLE" : scenario is "live-owner" or "live-updater" ? "ACTIVE" : "REVIEW_REQUIRED"), scenario + " truthful maintenance state");
}

// A second .NET process has its own Linux UTC boot-time estimate. The stable
// identity and policy must agree across real process boundaries, not just mocks.
for (var attempt = 0; attempt < 2; attempt++)
{
    var info = new ProcessStartInfo("dotnet") { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = true, RedirectStandardError = true };
    foreach (var argument in new[] { Assembly.GetExecutingAssembly().Location, "--verify-parent-identity", current.Id.ToString(), Identity(current), Path.Combine(root, "live-owner") }) info.ArgumentList.Add(argument);
    using var probe = Process.Start(info)!;
    if (!probe.WaitForExit(10_000))
    {
        probe.Kill(); // Only this synthetic child process is owned by the test.
        throw new InvalidOperationException("Cross-process generation probe timed out.");
    }
    Assert(probe.ExitCode == 0, "cross-process identity: " + probe.StandardError.ReadToEnd());
}

string LinuxIdentity(int pid, string stat, string boot) => (string)parseLinux.Invoke(null, [pid, stat, boot])!;
string LinuxStat(int pid, string started) => $"{pid} (manager ) with spaces) S {string.Join(' ', Enumerable.Repeat("0", 18))} {started} 0";
var bootId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
var linuxToken = LinuxIdentity(123, LinuxStat(123, "9007199254740993"), bootId);
Assert(linuxToken == $"linux:{bootId}:123:9007199254740993", "raw kernel counter without floating point or UTC conversion");
Assert(LinuxIdentity(123, LinuxStat(123, "9007199254740993"), bootId.ToUpperInvariant() + "\n") == linuxToken, "boot identity normalized");
Assert(LinuxIdentity(123, LinuxStat(123, "9007199254740994"), bootId) != linuxToken, "PID generation reuse distinguished");
Assert(LinuxIdentity(123, LinuxStat(123, "9007199254740993"), "bbbbbbbb-bbbb-cccc-dddd-eeeeeeeeeeee") != linuxToken, "reboot distinguished");
foreach (var invalid in new[] { (124, LinuxStat(123, "1"), bootId), (123, "123 (short) S 0", bootId), (123, LinuxStat(123, "-1"), bootId), (123, LinuxStat(123, "1"), "bad-boot") })
{
    var refused = false;
    try { LinuxIdentity(invalid.Item1, invalid.Item2, invalid.Item3); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidDataException) { refused = true; }
    Assert(refused, "malformed process generation is refused");
}

var driftDirectory = Path.Combine(root, "utc-drift");
Directory.CreateDirectory(driftDirectory);
var driftRecord = new Dictionary<string, object?> { ["status"] = "DOWNLOADING", ["ownerKind"] = "native-manager-v1", ["ownerPid"] = current.Id, ["ownerProcessIdentity"] = Identity(current), ["ownerStartTimeUtcTicks"] = (current.StartTime.ToUniversalTime().Ticks + 1).ToString() };
File.WriteAllText(Path.Combine(driftDirectory, "update-status.json"), JsonSerializer.Serialize(driftRecord));
Assert(!Allows(driftDirectory), "UTC diagnostic drift cannot retire a live stable generation");
driftRecord["ownerProcessIdentity"] = "invalid-token";
File.WriteAllText(Path.Combine(driftDirectory, "update-status.json"), JsonSerializer.Serialize(driftRecord));
Assert(!Allows(driftDirectory), "invalid new identity never falls back to weaker legacy time");
if (OperatingSystem.IsLinux())
{
    driftRecord.Remove("ownerProcessIdentity");
    File.WriteAllText(Path.Combine(driftDirectory, "update-status.json"), JsonSerializer.Serialize(driftRecord));
    Assert(!Allows(driftDirectory), "legacy Linux UTC drift cannot prove a live PID exited");
    Assert((string)inspect.Invoke(null, [driftDirectory])! == "REVIEW_REQUIRED", "legacy approximate identity needs review rather than guessed exit");
}

var ownership = assembly.GetType("ProjectWing.NativeRuntime.RuntimeOwnershipLease")!;
var acquire = ownership.GetMethod("Acquire")!;
var tryAcquire = ownership.GetMethod("TryAcquire")!;
using (var first = (IDisposable)acquire.Invoke(null, [root, "maintenance"])!)
    Assert(tryAcquire.Invoke(null, [root, "maintenance"]) is null, "maintenance excludes a second owner");
using (var next = (IDisposable)acquire.Invoke(null, [root, "maintenance"])!) { }

var verify = assembly.GetType("ProjectWing.AgentManager.MaintenanceHandoff")!.GetMethod("VerifyUpdaterFromPackage", BindingFlags.Static | BindingFlags.NonPublic)!;
var extract = assembly.GetType("ProjectWing.AgentManager.MaintenanceHandoff")!.GetMethod("ExtractUpdater", BindingFlags.Static | BindingFlags.NonPublic)!;
var updater = Path.Combine(root, "synthetic-Updater.exe");
File.WriteAllText(updater, "synthetic updater bytes; never executable");
foreach (var scenario in new[] { "match", "missing", "duplicate", "tampered" })
{
    var package = Path.Combine(root, scenario + ".nupkg");
    using (var zip = ZipFile.Open(package, ZipArchiveMode.Create))
    {
        if (scenario != "missing")
        {
            using (var writer = new StreamWriter(zip.CreateEntry("lib/net45/Squirrel.exe").Open())) writer.Write(scenario == "tampered" ? "different bytes" : File.ReadAllText(updater));
            if (scenario == "duplicate") using (var writer = new StreamWriter(zip.CreateEntry("other/Squirrel.exe").Open())) writer.Write(File.ReadAllText(updater));
        }
    }
    var accepted = true;
    try { verify.Invoke(null, [package, updater]); }
    catch (TargetInvocationException error) when (error.InnerException is InvalidDataException) { accepted = false; }
    Assert(accepted == (scenario == "match"), "package updater " + scenario);
    if (scenario == "match")
    {
        var extracted = (string)extract.Invoke(null, [package, root])!;
        Assert(File.ReadAllText(extracted) == File.ReadAllText(updater), "cached package updater recovery");
        Assert(extracted != updater, "do not overwrite installation updater");
    }
}
var readHealth = assembly.GetType("ProjectWing.AgentManager.WorkerHealthProbeService")!.GetMethod("Read", BindingFlags.Static | BindingFlags.NonPublic)!;
foreach (var json in new[] { "[]", "{}", "null", "{\"app\":\"foreign\",\"agentState\":\"READY\"}" })
{
    var result = readHealth.Invoke(null, [json])!;
    Assert((string)result.GetType().GetProperty("AgentState")!.GetValue(result)! == "STARTING", "malformed health never implies readiness");
}
var gateType = assembly.GetType("ProjectWing.AgentManager.MaintenanceExitGate")!;
var arm = gateType.GetMethod("Arm")!;
var observe = gateType.GetMethod("Observe")!;
object Arm(Action? persist = null, Action? acknowledge = null) => arm.Invoke(null, [persist ?? (() => { }), acknowledge ?? (() => { })])!;
string Observe(object gate, bool parentExited, bool inputCompleted, string? input, double seconds, bool inputFaulted = false) =>
    observe.Invoke(gate, [parentExited, inputCompleted, input, inputFaulted, TimeSpan.FromSeconds(seconds)])!.ToString()!;
var ackCount = 0;
var persistFailure = false;
try { Arm(() => throw new IOException("synthetic status write failure"), () => ackCount++); }
catch (TargetInvocationException error) when (error.InnerException is IOException) { persistFailure = true; }
Assert(persistFailure && ackCount == 0, "status IO failure never arms or acknowledges an updater");
var ackLost = Arm(acknowledge: () => throw new IOException("synthetic acknowledgement loss"));
Assert(Observe(ackLost, false, false, null, 0) == "Waiting", "ACK loss leaves no updater while caller lives");
Assert(Observe(ackLost, true, true, null, 1) == "ParentExited", "durable receipt plus caller exit recovers ACK loss");
var cancelled = Arm();
Assert(Observe(cancelled, false, true, "{\"command\":\"cancel\"}", 0.2) == "Cancelled", "explicit cancel after arm");
Assert(Observe(cancelled, true, true, null, 1) == "Cancelled", "cancel is terminal even if caller later exits");
var ordinaryExit = Arm();
Assert(Observe(ordinaryExit, false, true, null, 0) == "Waiting", "EOF alone is not an application exit");
Assert(Observe(ordinaryExit, true, true, null, 0.5) == "ParentExited", "normal caller exit following stdin EOF proceeds");
var abandonedPipe = Arm();
Assert(Observe(abandonedPipe, false, true, null, 0) == "Waiting", "closed pipe begins bounded grace");
Assert(Observe(abandonedPipe, false, true, null, 2.1) == "Cancelled", "EOF with live caller cancels after grace");
Assert(Observe(abandonedPipe, true, true, null, 3) == "Cancelled", "closed-pipe cancellation cannot become a late apply");
var queuedCancel = Arm();
Assert(Observe(queuedCancel, true, false, null, 0) == "Waiting", "caller exit cannot bypass unread cancellation");
Assert(Observe(queuedCancel, true, true, "{\"command\":\"cancel\"}", 0.1) == "Cancelled", "queued cancel wins over caller exit");
var invalidPipe = Arm();
Assert(Observe(invalidPipe, true, true, null, 0, inputFaulted: true) == "Cancelled", "unreadable input never authorizes update");
var stayedAlive = Arm();
Assert(Observe(stayedAlive, false, false, null, 30) == "Cancelled", "caller exit wait has a deadline");
Assert(Observe(stayedAlive, true, true, null, 31) == "Cancelled", "timeout cannot later apply");
var applyAfterExit = assembly.GetType("ProjectWing.AgentManager.MaintenanceHandoff")!.GetMethod("ApplyAfterParentExit", BindingFlags.Static | BindingFlags.NonPublic)!;
foreach (var scenario in new[] { "verify", "installing-status", "spawn", "updater-nonzero", "terminal-status", "failure-status-unwritable" })
{
    var reopened = false;
    var failureRecorded = false;
    Func<int> apply = () => throw new IOException("synthetic " + scenario);
    Func<Exception, int> record = _ =>
    {
        failureRecorded = true;
        if (scenario == "failure-status-unwritable") throw new IOException("synthetic failure status write failure");
        return 1;
    };
    Action reopen = () => reopened = true;
    try { applyAfterExit.Invoke(null, [apply, record, reopen]); }
    catch (TargetInvocationException error) when (error.InnerException is IOException && scenario == "failure-status-unwritable") { }
    Assert(failureRecorded && reopened, "reopen after parent exit even when " + scenario + " fails");
}
Console.WriteLine($"Recovery control safety passed: stable cross-process identity, Linux stat parser and stale-identity checks; 7 owner-state scenarios, exclusive maintenance, 4 verified-package updater scenarios, malformed health, 8 parent-exit handoff sequences and 6 post-exit failure recovery scenarios. Fixtures: {root}");

static void Assert(bool passed, string scenario)
{
    if (!passed) throw new InvalidOperationException("FAILED: " + scenario);
}
