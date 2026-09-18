import { readFile } from "node:fs/promises";
import pathModule from "node:path";

import {
  assertFileContains,
  repositoryRoot,
} from "./native-verifier-support.mjs";
import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

const trayHostRequirements = [
  "Shell_NotifyIconW",
  "TogglePanel",
  "TaskbarCreated",
  "RequestRuntimeShutdown",
  'L"/control/shutdown"',
  "WINHTTP_QUERY_STATUS_CODE",
  "HTTP_STATUS_ACCEPTED",
  "StopManagedRuntimeProcessesForCurrentInstall",
  "Quit",
  "hasPositionedPanel",
  "IsDesktopAgentWindowMinimized",
  "QuitDesktopAgentWindow",
];
const processLifecycleRequirements = [
  "CreateToolhelp32Snapshot",
  "QueryFullProcessImageNameW",
  "CurrentInstallRoot",
  "IsInsideInstallRoot",
  'L"ProjectWing.AgentManager.exe"',
  'L"ProjectWing.DesktopAgent.Runtime.exe"',
  'L"shutdown.flag"',
  "TerminateProcess",
];

export async function verifyWindowsHost() {
  await verifyTrayLifecycle();
  await verifyNativeProject();
  await verifyInstallerLifecycle();
}

async function verifyTrayLifecycle() {
  const trayPath =
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent/TrayHost.cpp";
  await assertFileContains(trayPath, trayHostRequirements);
  const trayHost = await readFile(join(repositoryRoot, trayPath), "utf-8");
  assertEqual(trayHost.includes("taskkill"), false);
  await assertFileContains(
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent/ProcessLifecycle.cpp",
    processLifecycleRequirements
  );
}

async function verifyNativeProject() {
  await assertFileContains(
    "apps/desktop-agent-windows/react-native.config.js",
    ['require("react-native-windows/react-native.config.js")']
  );
  await assertFileContains(
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent/ProjectWingDesktopAgent.cpp",
    [
      "ReactNativeAppBuilder",
      "CreateTrayHost",
      "GetDpiForWindow",
      "USER_DEFAULT_SCREEN_DPI",
      "SetBorderAndTitleBar(false, false)",
      "InputNonClientPointerSource::GetForWindowId",
      "NonClientRegionKind::Caption",
      "DesktopAgentWindowModule.h",
      "ResetDesktopAgentWindowToCompact",
      "presenter.IsMaximizable(true)",
      "presenter.IsMinimizable(true)",
      String.raw`L"Local\\ProjectWingDesktopAgentUi"`,
    ]
  );
  await assertFileContains(
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent/DesktopAgentWindowModule.h",
    ['REACT_EVENT(windowStateChanged, L"desktopAgentWindowStateChanged")']
  );
  await assertFileContains(
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent/ProjectWingDesktopAgent.vcxproj",
    [
      "winhttp.lib",
      "<WindowsPackageType>None</WindowsPackageType>",
      "<WindowsAppSDKSelfContained>true</WindowsAppSDKSelfContained>",
      "<DebugInformationFormat>None</DebugInformationFormat>",
      "<GenerateDebugInformation>false</GenerateDebugInformation>",
      'ClCompile Include="ProcessLifecycle.cpp"',
      'ClCompile Include="DesktopAgentWindowModule.cpp"',
      'ClCompile Include="WindowControls.cpp"',
      "<PrecompiledHeader>NotUsing</PrecompiledHeader>",
    ]
  );
  await assertFileContains(
    "apps/desktop-agent-windows/windows/ProjectWingDesktopAgent.Package/Package.appxmanifest",
    ['Version="0.2.1.0"', "Project Wing Desktop Agent"]
  );
}

async function verifyInstallerLifecycle() {
  await assertFileContains(
    "scripts/desktop-agent/build-windows-installer.ps1",
    [
      "react-native run-windows",
      "Resolve-WindowsSdkVersion",
      "Sort-Object Version -Descending",
      '--msbuildprops "WindowsTargetPlatformVersion=$SdkVersion,TargetPlatformVersion=$SdkVersion"',
      "Copy-DesktopUiPayload",
      '".html"',
      '".xbf"',
      "merge-dotnet-publish.mjs",
      "--destination $managedPublish",
      "/p:PublishSingleFile=false",
      "/p:PublishAot=true",
      "report-package-size.mjs",
    ]
  );
  await assertFileContains(
    "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/Program.cs",
    ["DefaultJsonTypeInfoResolver", "TypeInfoResolverChain.Add"]
  );
  await verifyInstallerScripts();
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/WindowsProcessLifecycle.cs",
    [
      "StopExistingProcesses",
      "NormalizeInstallRoot",
      "Path.DirectorySeparatorChar",
      "$_.ProcessId -ne $PID",
      "$_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0",
    ]
  );
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/Program.cs",
    [
      "RegisterStartup(hiddenStartScriptPath)",
      "RegisterUninstallEntry",
      "shutdown.flag",
      "TimeSpan.FromSeconds(30)",
    ],
    false
  );
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/InstallStatusStore.cs",
    [
      "JsonSourceGenerationOptions",
      "InstallerJsonContext.Default.InstallReport",
    ]
  );
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/WindowsLifecycleScripts.cs",
    [
      "param([switch] $Automatic)",
      "Test-ProjectWingAgentUi",
      "PROJECT_WING_AGENT_STATE_ROOT",
      "__SHUTDOWN_FLAG__",
      "-Automatic",
    ]
  );
  await assertFileContains(
    "apps/desktop-agent/manager/ProjectWing.AgentManager/RuntimeRequestHandler.cs",
    [
      'path == "/control/shutdown"',
      "NATIVE_CONTROL_REQUIRED",
      'Path.Combine(config.StateRoot, "shutdown.flag")',
    ]
  );
  await assertFileContains(
    "apps/desktop-agent/manager/ProjectWing.AgentManager/WorkerHealthProbeService.cs",
    ["TimeSpan.FromMilliseconds(1_500)"]
  );
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/InstallerHealthProbe.cs",
    ["TimeSpan.FromSeconds(3)", 'or "UPDATING"']
  );
}

async function verifyInstallerScripts() {
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/WindowsInstallerScripts.cs",
    [
      '"{{context.ManagerPath}}" run',
      "ProjectWing.DesktopAgent.Runtime.exe",
      '"managed"',
      "PROJECT_WING_AGENT_CACHE_ROOT={{context.CacheRoot}}",
      "DOTNET_BUNDLE_EXTRACT_BASE_DIR={{context.BundleExtractRoot}}",
      "http://localhost:3020",
      "http://localhost:3021",
      "Join-Path $env:LOCALAPPDATA",
      "$_.ProcessId -ne $PID",
      "$_.ExecutablePath.IndexOf($installRoot, [System.StringComparison]::OrdinalIgnoreCase) -eq 0",
      String.raw`CurrentVersion\Uninstall\ProjectWingDesktopAgent`,
    ],
    false
  );
  await assertFileContains(
    "apps/desktop-agent/installer/ProjectWing.DesktopAgentSetup/WindowsInstallerRegistration.cs",
    [
      String.raw`CurrentVersion\Uninstall`,
      "DisplayName",
      "DisplayVersion",
      "DisplayIcon",
      "UninstallString",
      "NoModify",
      "NoRepair",
    ]
  );
}
