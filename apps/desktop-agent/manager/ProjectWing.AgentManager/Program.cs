using ProjectWing.AgentManager;
using static ProjectWing.AgentManager.ManagerStatusStore;

var command = args.Length > 0 ? args[0].Trim().ToLowerInvariant() : "status";
var stateRoot = AgentManagerOptions.ReadOption(args, "--state-root")
    ?? Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_STATE_ROOT");
if (string.IsNullOrWhiteSpace(stateRoot))
{
    stateRoot = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
        "ProjectWing",
        "AgentState"
    );
}

Directory.CreateDirectory(stateRoot);
var statusPath = Path.Combine(stateRoot, "update-status.json");

try
{
    using var maintenance = command is "install" or "update" or "repair"
        ? ProjectWing.NativeRuntime.RuntimeOwnershipLease.TryAcquire(stateRoot, "maintenance") : null;
    if (command is "install" or "update" or "repair" && maintenance is null)
    {
        Console.Error.WriteLine("Another installation or recovery operation owns maintenance. Its state was not changed.");
        return 1;
    }
    return command switch
    {
        "run" => ManagedRuntimeHost.Run(args, statusPath),
        "status" => AgentUpdateCommands.PrintStatus(statusPath),
        "repair" => AgentUpdateCommands.Repair(statusPath),
        "install" => AgentUpdateCommands.Install(args, statusPath),
        "update" => AgentUpdateCommands.Update(args, statusPath),
        "maintenance-handoff" => MaintenanceHandoff.Run(args, statusPath),
        _ => Fail(statusPath, "UNKNOWN_ERROR", $"Unknown command: {command}"),
    };
}
catch (Exception error)
{
    Console.Error.WriteLine($"Desktop Agent manager failed: {error.Message}");
    // A rejected duplicate start must not poison the active owner's update log.
    if (command is "run" or "maintenance-handoff") return 1;
    return Fail(statusPath, "UNKNOWN_ERROR", error.Message);
}
