using System.Reflection;
using ProjectWing.DesktopAgentSetup;

const string appName = "Project Wing Desktop Agent";
const string updateMutexName = "Global\\ProjectWingDesktopAgentUpdate";

string? failureReportPath = null;
string? failureVersion = null;
string? failureInstallRoot = null;
string? rollbackStartScriptPath = null;
string? rollbackBackupPath = null;
string? rollbackHiddenStartScriptPath = null;
string? rollbackActiveAppDirectory = null;
string? rollbackAppDirectory = null;
var canWriteFailureReport = false;

try
{
    var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
    if (string.IsNullOrWhiteSpace(localAppData))
    {
        throw new InvalidOperationException("LOCALAPPDATA is not available.");
    }

    var version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "0.2.1";
    var installRoot = Path.Combine(localAppData, "ProjectWing", "DesktopAgent");
    var stateRoot = Environment.GetEnvironmentVariable("PROJECT_WING_AGENT_STATE_ROOT");
    if (string.IsNullOrWhiteSpace(stateRoot))
    {
        stateRoot = Path.Combine(localAppData, "ProjectWing", "AgentState");
    }

    var reportPath = Path.Combine(stateRoot, "update-status.json");
    failureReportPath = reportPath;
    failureVersion = version;
    failureInstallRoot = installRoot;
    var appDirectory = Path.Combine(installRoot, $"app-{version}");
    var stagingAppDirectory = Path.Combine(
        installRoot,
        $".staging-app-{version}-{Environment.ProcessId}"
    );
    var previousAppDirectory = Path.Combine(
        installRoot,
        $".rollback-app-{version}-{Environment.ProcessId}"
    );
    var payloadZipPath = Path.Combine(installRoot, "payload.zip");
    var startScriptPath = Path.Combine(installRoot, "StartProjectWingDesktopAgent.cmd");
    var starterScriptPath = Path.Combine(installRoot, "StartProjectWingDesktopAgent.ps1");
    var hiddenStartScriptPath = Path.Combine(installRoot, "StartProjectWingDesktopAgent.vbs");
    var watchdogScriptPath = Path.Combine(installRoot, "WatchProjectWingDesktopAgent.ps1");
    var hiddenWatchdogScriptPath = Path.Combine(installRoot, "WatchProjectWingDesktopAgent.vbs");
    var uninstallScriptPath = Path.Combine(installRoot, "Uninstall Project Wing Desktop Agent.cmd");
    var managerPath = Path.Combine(appDirectory, "managed", "ProjectWing.AgentManager.exe");
    var uiPath = Path.Combine(appDirectory, "ui", "ProjectWingDesktopAgent.exe");
    var shutdownFlagPath = Path.Combine(stateRoot, "shutdown.flag");
    rollbackStartScriptPath = startScriptPath;
    rollbackBackupPath = Path.Combine(stateRoot, "previous-start-script.cmd");
    rollbackHiddenStartScriptPath = hiddenStartScriptPath;
    rollbackActiveAppDirectory = appDirectory;
    rollbackAppDirectory = previousAppDirectory;

    Console.WriteLine($"{appName} setup");
    Console.WriteLine($"Installing to {installRoot}");

    using var updateLock = InstallStatusStore.AcquireUpdateLockIfNeeded(updateMutexName);
    canWriteFailureReport = true;
    Directory.CreateDirectory(stateRoot);
    InstallStatusStore.CleanupStaleSessionTempFiles(stateRoot);
    if (File.Exists(startScriptPath))
    {
        File.Copy(startScriptPath, rollbackBackupPath, overwrite: true);
    }
    else if (File.Exists(rollbackBackupPath))
    {
        File.Delete(rollbackBackupPath);
    }
    InstallStatusStore.Write(
        reportPath,
        new InstallReport("STARTED")
        {
            Message = "Desktop Agent installer started.",
            ExpectedVersion = version,
            Details = new InstallReportDetails { InstallRoot = installRoot },
        }
    );

    Directory.CreateDirectory(installRoot);
    WindowsProcessLifecycle.StopExistingProcesses(installRoot);
    if (Directory.Exists(stagingAppDirectory))
    {
        Directory.Delete(stagingAppDirectory, recursive: true);
    }
    if (Directory.Exists(previousAppDirectory))
    {
        Directory.Delete(previousAppDirectory, recursive: true);
    }
    Directory.CreateDirectory(stagingAppDirectory);
    InstallerPayload.Extract(payloadZipPath, stagingAppDirectory);
    ValidateStagedPayload(stagingAppDirectory);
    if (Directory.Exists(appDirectory))
    {
        Directory.Move(appDirectory, previousAppDirectory);
    }
    Directory.Move(stagingAppDirectory, appDirectory);
    WindowsInstallerScripts.WriteStartScript(
        startScriptPath,
        appDirectory,
        installRoot,
        version,
        managerPath,
        stateRoot
    );
    WindowsLifecycleScripts.WriteStarter(
        starterScriptPath,
        startScriptPath,
        uiPath,
        shutdownFlagPath
    );
    WindowsInstallerScripts.WriteHiddenPowerShellScript(
        hiddenStartScriptPath,
        starterScriptPath
    );
    WindowsLifecycleScripts.WriteWatchdog(
        watchdogScriptPath,
        starterScriptPath,
        uiPath,
        shutdownFlagPath
    );
    WindowsInstallerScripts.WriteHiddenPowerShellScript(
        hiddenWatchdogScriptPath,
        watchdogScriptPath
    );
    WindowsInstallerScripts.WriteUninstallScript(uninstallScriptPath);
    WindowsInstallerRegistration.RegisterStartup(hiddenStartScriptPath);
    WindowsInstallerRegistration.RegisterStartProtocol(hiddenStartScriptPath);
    WindowsInstallerRegistration.RegisterUninstallEntry(
        uninstallScriptPath,
        installRoot,
        uiPath,
        version
    );
    WindowsInstallerRegistration.TryRegisterWatchdogTask(hiddenWatchdogScriptPath);
    var registration = WindowsInstallerRegistration.Verify(
        hiddenStartScriptPath,
        uninstallScriptPath
    );
    if (!registration.IsComplete)
    {
        InstallStatusStore.Write(
            reportPath,
            new InstallReport("FAILED")
            {
                ErrorCode = "REGISTRATION_FAILED",
                ExpectedVersion = version,
                Message =
                    "Desktop Agent startup, protocol, watchdog, or uninstall registration is incomplete.",
                Details = new InstallReportDetails
                {
                    InstallRoot = installRoot,
                    StartupRegistered = registration.StartupRegistered,
                    ProtocolRegistered = registration.ProtocolRegistered,
                    WatchdogRegistered = registration.WatchdogRegistered,
                    UninstallRegistered = registration.UninstallRegistered,
                },
            }
        );
        TryRestorePreviousStartScript(
            rollbackStartScriptPath,
            rollbackBackupPath,
            rollbackHiddenStartScriptPath,
            rollbackActiveAppDirectory,
            rollbackAppDirectory
        );
        return 3;
    }
    WindowsInstallerRegistration.StartHiddenScript(hiddenStartScriptPath);
    WindowsInstallerRegistration.StartHiddenScript(hiddenWatchdogScriptPath);

    if (InstallerHealthProbe.WaitForReady(
        TimeSpan.FromSeconds(30),
        version,
        out var currentVersion
    ))
    {
        InstallStatusStore.Write(
            reportPath,
            new InstallReport("READY")
            {
                Message = "Desktop Agent is installed and running.",
                CurrentVersion = currentVersion,
                ExpectedVersion = version,
                Details = new InstallReportDetails
                {
                    InstallRoot = installRoot,
                    StartupRegistered = registration.StartupRegistered,
                    ProtocolRegistered = registration.ProtocolRegistered,
                    WatchdogRegistered = registration.WatchdogRegistered,
                    UninstallRegistered = registration.UninstallRegistered,
                },
            }
        );
        InstallerPayload.CleanupOldDirectories(installRoot, appDirectory);
        if (File.Exists(rollbackBackupPath)) File.Delete(rollbackBackupPath);
        if (Directory.Exists(previousAppDirectory))
        {
            Directory.Delete(previousAppDirectory, recursive: true);
        }
        Console.WriteLine("Desktop Agent is installed and running.");
        return 0;
    }

    InstallStatusStore.Write(
        reportPath,
        new InstallReport("FAILED")
        {
            ErrorCode = "HEALTH_TIMEOUT",
            Message = string.IsNullOrWhiteSpace(currentVersion)
                ? "Desktop Agent was installed, but health check did not become ready."
                : $"Desktop Agent reported version {currentVersion}, expected {version}.",
            CurrentVersion = currentVersion,
            ExpectedVersion = version,
            Details = new InstallReportDetails { InstallRoot = installRoot },
        }
    );
    Console.Error.WriteLine("Desktop Agent was installed, but health check did not become ready.");
    TryRestorePreviousStartScript(
        rollbackStartScriptPath,
        rollbackBackupPath,
        rollbackHiddenStartScriptPath,
        rollbackActiveAppDirectory,
        rollbackAppDirectory
    );
    Console.Error.WriteLine($"Run this file to start it manually: {startScriptPath}");
    return 2;
}
catch (Exception error)
{
    Console.Error.WriteLine($"Installation failed: {error.Message}");
    TryRestorePreviousStartScript(
        rollbackStartScriptPath,
        rollbackBackupPath,
        rollbackHiddenStartScriptPath,
        rollbackActiveAppDirectory,
        rollbackAppDirectory
    );
    InstallStatusStore.TryWriteFailure(
        canWriteFailureReport ? failureReportPath : null,
        failureVersion,
        failureInstallRoot,
        error.Message
    );
    return 1;
}

static void TryRestorePreviousStartScript(
    string? startScriptPath,
    string? backupPath,
    string? hiddenStartScriptPath,
    string? activeAppDirectory,
    string? previousAppDirectory
)
{
    try
    {
        if (
            !string.IsNullOrWhiteSpace(activeAppDirectory)
            && !string.IsNullOrWhiteSpace(previousAppDirectory)
            && Directory.Exists(previousAppDirectory)
        )
        {
            var installRoot = Path.GetDirectoryName(activeAppDirectory);
            if (!string.IsNullOrWhiteSpace(installRoot))
            {
                WindowsProcessLifecycle.StopExistingProcesses(installRoot);
            }
            if (Directory.Exists(activeAppDirectory))
            {
                Directory.Delete(activeAppDirectory, recursive: true);
            }
            Directory.Move(previousAppDirectory, activeAppDirectory);
        }
        if (
            !string.IsNullOrWhiteSpace(startScriptPath)
            && !string.IsNullOrWhiteSpace(backupPath)
            && File.Exists(backupPath)
        )
        {
            File.Copy(backupPath, startScriptPath, overwrite: true);
        }
        if (!string.IsNullOrWhiteSpace(hiddenStartScriptPath))
        {
            WindowsInstallerRegistration.StartHiddenScript(hiddenStartScriptPath);
        }
    }
    catch (Exception rollbackError)
    {
        Console.Error.WriteLine(
            $"Desktop Agent rollback could not restart the previous version: {rollbackError.Message}"
        );
    }
}

static void ValidateStagedPayload(string appDirectory)
{
    var managerPath = Path.Combine(
        appDirectory,
        "managed",
        "ProjectWing.AgentManager.exe"
    );
    var uiPath = Path.Combine(
        appDirectory,
        "ui",
        "ProjectWingDesktopAgent.exe"
    );
    if (!File.Exists(managerPath) || !File.Exists(uiPath))
    {
        throw new InvalidOperationException(
            "Desktop Agent installer payload is incomplete."
        );
    }
}
