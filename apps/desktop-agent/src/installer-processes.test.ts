import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const installerProgram = readFileSync(
  new URL(
    "../installer/ProjectWing.DesktopAgentSetup/Program.cs",
    import.meta.url
  ),
  "utf-8"
);
const processLifecycle = readFileSync(
  new URL(
    "../installer/ProjectWing.DesktopAgentSetup/WindowsProcessLifecycle.cs",
    import.meta.url
  ),
  "utf-8"
);
const installerScripts = readFileSync(
  new URL(
    "../installer/ProjectWing.DesktopAgentSetup/WindowsInstallerScripts.cs",
    import.meta.url
  ),
  "utf-8"
);

describe("desktop agent installer process handling", () => {
  it("stops the old agent without terminating the update manager chain", () => {
    expect(processLifecycle).not.toContain("Kill(entireProcessTree: true)");
    expect(processLifecycle).toContain("Kill(entireProcessTree: false)");
  });

  it("falls back to command-line matching when module paths are unavailable", () => {
    expect(processLifecycle).toContain("StopLegacyNodeProcessesByCommandLine");
    expect(processLifecycle).toContain(
      "*ProjectWing*DesktopAgent*agent*dist*index.js*"
    );
  });

  it("scopes native and launcher cleanup to the current installation", () => {
    expect(processLifecycle).toContain("StopManagedProcesses");
    expect(processLifecycle).toContain(
      "@('ProjectWing.AgentManager.exe', 'ProjectWing.DesktopAgent.Runtime.exe')"
    );
    expect(processLifecycle).toContain(
      "TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar)"
    );
    expect(processLifecycle).toContain("$_.ProcessId -ne $PID");
    expect(processLifecycle).toContain(
      "$_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0"
    );
    expect(processLifecycle).not.toContain("-like ($installRoot + '*')");
    expect(processLifecycle).not.toContain("AgentManager.exe* update");
    expect(installerProgram).toContain(
      "WindowsProcessLifecycle.StopExistingProcesses(installRoot)"
    );
  });

  it("starts AgentManager as the runtime owner instead of launching node directly", () => {
    expect(installerProgram).toContain("ProjectWing.AgentManager.exe");
    expect(installerScripts).toContain('"{{context.ManagerPath}}" run');
    expect(installerScripts).toContain("--runtime-port");
    expect(installerScripts).toContain("--worker-port");
    expect(installerScripts).toContain("PROJECT_WING_AGENT_WORKER_PORT");
  });

  it("keeps uninstall process cleanup scoped and excludes its own shell", () => {
    expect(installerScripts).toContain("$_.ProcessId -ne $PID");
    expect(installerScripts).toContain("Join-Path $env:LOCALAPPDATA");
    expect(installerScripts).toContain(
      "$_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0"
    );
    expect(installerScripts).not.toContain("-like ($installRoot + '*')");
  });
});
