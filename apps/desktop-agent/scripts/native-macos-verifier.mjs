import { readFile, stat } from "node:fs/promises";
import pathModule from "node:path";

import {
  assertFileContains,
  parsePlist,
  repositoryRoot,
} from "./native-verifier-support.mjs";
import { assertEqual } from "./runtime-test-support.mjs";

const { join } = pathModule;

const managedRuntimeRequirements = [
  "startManagedRuntime",
  "ProjectWing.AgentManager",
  "requestManagedRuntimeShutdown",
  "kShutdownAcceptedStatusCode = 202",
  "kShutdownAcceptedStatusCode;",
  'stringByAppendingPathComponent:@"shutdown.flag"',
  "terminationHandler",
  "scheduleManagedRuntimeRestart",
  "runtimeProcessPattern",
  "escapedPatternForString",
  "scheduleManagedRuntimeHealthCheck",
  'stringByAppendingPathComponent:@"manager/ProjectWing.AgentManager"',
  'stringByAppendingPathComponent:@"runtime/ProjectWing.DesktopAgent.Runtime"',
];
const buildScriptRequirements = [
  `version="\${1:-0.2.1}"`,
  "xcodebuild",
  "DesktopRuntime",
  "codesign",
  "pkgbuild",
  "productbuild",
  `desktop-agent-macos-\${package_architecture}-\${version}.pkg`,
  "PROJECT_WING_INSTALLER_SIGN_IDENTITY",
  "PROJECT_WING_REQUIRE_SIGNED_RELEASE",
  "notarytool submit",
  "stapler staple",
  `runtime_identifier="\${3:-osx-arm64}"`,
  "PROJECT_WING_BUILD_APP_ARCHIVE",
];
const launchAgentRequirements = [
  "CFBundleShortVersionString",
  '"status":"READY"',
  "ProjectWing.AgentManager",
  "cn.superfx.projectwing.desktopagent",
  "LaunchAgents",
  "/bin/sh",
  "if [ ! -x",
  String.raw`/bin/rm -f "\$HOME/Library/LaunchAgents/`,
  "RunAtLoad",
  "KeepAlive",
  "SuccessfulExit",
  "AssociatedBundleIdentifiers",
  `launchctl bootstrap "gui/\${console_uid}"`,
];

export async function verifyMacOSHost() {
  await verifyAppLifecycle();
  await verifyXcodeProject();
  await verifyInfoPlist();
  await verifyPackaging();
  await verifyLaunchAgent();
  await verifyManagerAndLaunchers();
}

async function verifyAppLifecycle() {
  await assertFileContains(
    "apps/desktop-agent-macos/macos/ProjectWingDesktopAgent-macOS/AppDelegate.mm",
    [
      "NSStatusItem",
      "NSPopover",
      "ManagedRuntimeController",
      "applicationShouldTerminate",
      "[button.image setTemplate:YES];",
    ]
  );
  const appDelegate = await readFile(
    join(
      repositoryRoot,
      "apps/desktop-agent-macos/macos/ProjectWingDesktopAgent-macOS/AppDelegate.mm"
    ),
    "utf-8"
  );
  assertEqual(appDelegate.includes("button.image.template"), false);
  await assertFileContains(
    "apps/desktop-agent-macos/macos/ProjectWingDesktopAgent-macOS/ManagedRuntimeController.mm",
    managedRuntimeRequirements
  );
}

async function verifyXcodeProject() {
  const projectPath =
    "apps/desktop-agent-macos/macos/ProjectWingDesktopAgent.xcodeproj/project.pbxproj";
  await assertFileContains(projectPath, [
    "ManagedRuntimeController.h",
    "ManagedRuntimeController.mm",
    "ManagedRuntimeController.mm in Sources",
  ]);
  const project = await readFile(join(repositoryRoot, projectPath), "utf-8");
  assertEqual(
    project.match(/ManagedRuntimeController\.mm in Sources/g)?.length,
    2
  );
}

async function verifyInfoPlist() {
  const infoPath =
    "apps/desktop-agent-macos/macos/ProjectWingDesktopAgent-macOS/Info.plist";
  await assertFileContains(infoPath, [
    "LSUIElement",
    "$(MARKETING_VERSION)",
    "NSAllowsLocalNetworking",
  ]);
  const infoPlist = await readFile(join(repositoryRoot, infoPath), "utf-8");
  assertEqual(parsePlist(infoPlist).status, 0);
  for (const key of [
    "NSSupportsAutomaticTermination",
    "NSSupportsSuddenTermination",
  ]) {
    assertEqual(
      new RegExp(`<key>${key}</key>\\s*<false/>`).test(infoPlist),
      true
    );
  }
}

async function verifyPackaging() {
  await assertFileContains(
    "scripts/desktop-agent/build-macos-app.sh",
    buildScriptRequirements
  );
}

async function verifyLaunchAgent() {
  const scriptPath = "scripts/desktop-agent/macos-package-scripts/postinstall";
  await assertFileContains(scriptPath, launchAgentRequirements);
  const script = await stat(join(repositoryRoot, scriptPath));
  assertEqual((script.mode & 0o111) !== 0, true);
  const contents = await readFile(join(repositoryRoot, scriptPath), "utf-8");
  const template = contents.match(/<<PLIST\n([\s\S]*?)\nPLIST/);
  assertEqual(template !== null, true);
  const plist = template[1]
    .replaceAll(`\${launch_agent_label}`, "cn.superfx.projectwing.desktopagent")
    .replaceAll(`\${app_path}`, "/Applications/Project Wing Desktop Agent.app");
  assertEqual(parsePlist(plist).status, 0);
}

async function verifyManagerAndLaunchers() {
  await assertFileContains(
    "apps/desktop-agent/manager/ProjectWing.AgentManager/AgentManagerOptions.cs",
    ['"desktop-agent-macos-arm64.pkg"']
  );
  await assertFileContains(
    "apps/desktop-agent/manager/ProjectWing.AgentManager/AgentInstallerRunner.cs",
    [
      'new ProcessStartInfo("/usr/bin/osascript")',
      "/usr/sbin/installer -pkg",
      "with administrator privileges",
    ]
  );
  for (const launcher of [
    "scripts/desktop-agent/macos-runtime-launchers/ProjectWing.AgentManager",
    "scripts/desktop-agent/macos-runtime-launchers/ProjectWing.DesktopAgent.Runtime",
  ]) {
    await assertFileContains(launcher, ["osx-arm64", "osx-x64", "exec"]);
    const launcherStat = await stat(join(repositoryRoot, launcher));
    assertEqual((launcherStat.mode & 0o111) !== 0, true);
  }
}
