import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveReleaseOutputRoot } from "./release-output-root.mjs";
import { createRuntimeIntegrityManifest } from "./runtime-integrity.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const packageJson = JSON.parse(
  readFileSync(path.join(appRoot, "package.json"), "utf-8")
);
const dotnetCommand =
  process.env.PROJECT_WING_DESKTOP_DOTNET?.trim() || "dotnet";
const version = process.env.PROJECT_WING_DESKTOP_VERSION ?? packageJson.version;
const outputRoot = resolveReleaseOutputRoot(
  repoRoot,
  process.env.PROJECT_WING_DESKTOP_RELEASE_ROOT,
  "output/desktop-agent/velopack"
);
const managedRoot = process.env.PROJECT_WING_DESKTOP_MANAGED_SOURCE
  ? path.resolve(process.env.PROJECT_WING_DESKTOP_MANAGED_SOURCE)
  : path.join(outputRoot, "managed");
const electronRoot = path.join(outputRoot, "electron");
const releasesRoot = path.join(outputRoot, "releases");
const publishRoot = path.join(outputRoot, "vpk-tool");
const releaseConfigPath = path.join(outputRoot, "desktop-release.json");
const updateUrl = process.env.PROJECT_WING_DESKTOP_UPDATE_URL?.trim();
const webBaseUrl = process.env.PROJECT_WING_DESKTOP_WEB_BASE_URL?.trim();
const windowsSignParams =
  process.env.PROJECT_WING_DESKTOP_WINDOWS_SIGN_PARAMS?.trim();
const packAuthors =
  process.env.PROJECT_WING_DESKTOP_PUBLISHER_NAME?.trim() || "Project Wing";
const signaturePolicy =
  process.env.DESKTOP_AGENT_WINDOWS_SIGNATURE_POLICY ??
  (isTruthy(process.env.PROJECT_WING_WINDOWS_SIGNING_REQUIRED)
    ? "required"
    : "optional");
if (!["optional", "required"].includes(signaturePolicy)) {
  throw new Error("Invalid Windows signature policy.");
}
const requireUpdateUrl = isTruthy(
  process.env.PROJECT_WING_DESKTOP_RELEASE_REQUIRE_UPDATE_URL
);
const managedProjects = [
  [
    "watcher",
    "apps/desktop-agent/watcher/ProjectWing.ExcelWatcher/ProjectWing.ExcelWatcher.csproj",
  ],
  [
    "manager",
    "apps/desktop-agent/manager/ProjectWing.AgentManager/ProjectWing.AgentManager.csproj",
  ],
  [
    "runtime",
    "apps/desktop-agent/runtime/ProjectWing.DesktopAgent.Runtime/ProjectWing.DesktopAgent.Runtime.csproj",
  ],
];

if (process.platform !== "win32") {
  throw new Error(
    "Windows packaging must run on Windows. Build the Electron payload in WSL if needed, then run this script from Windows."
  );
}

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
if (requireUpdateUrl && !updateUrl) {
  throw new Error(
    "PROJECT_WING_DESKTOP_UPDATE_URL is required for a published Windows update feed."
  );
}
await writeFile(
  releaseConfigPath,
  `${JSON.stringify({ updateUrl: updateUrl || null, webBaseUrl: webBaseUrl || null, signaturePolicy }, null, 2)}\n`,
  "utf-8"
);

await run(
  process.platform === "win32" ? "corepack.cmd" : "corepack",
  ["pnpm", "build"],
  {
    cwd: appRoot,
    shell: process.platform === "win32",
  }
);
if (!process.env.PROJECT_WING_DESKTOP_MANAGED_SOURCE) {
  await publishManagedRuntime();
}
await writeFile(
  path.join(outputRoot, "desktop-runtime-integrity.json"),
  `${JSON.stringify(await createRuntimeIntegrityManifest(managedRoot))}\n`,
  "utf-8"
);

await run(
  process.platform === "win32" ? "electron-builder.cmd" : "electron-builder",
  ["--win", "--dir", "--config", "electron-builder.config.mjs"],
  {
    cwd: appRoot,
    env: {
      PROJECT_WING_DESKTOP_OUTPUT_DIR: electronRoot,
      PROJECT_WING_DESKTOP_RELEASE_CONFIG: releaseConfigPath,
      PROJECT_WING_DESKTOP_RUNTIME_SOURCE: managedRoot,
    },
    shell: process.platform === "win32",
  }
);

const packDirectory = path.join(electronRoot, "win-unpacked");
if (!existsSync(path.join(packDirectory, "ProjectWingDesktopAgent.exe"))) {
  throw new Error(`Electron Windows payload is missing: ${packDirectory}`);
}

const vpk = await resolveVpk();
const vpkProvider = process.env.PROJECT_WING_DESKTOP_VPK_PROVIDER;
if (vpkProvider) {
  await mkdir(releasesRoot, { recursive: true });
  await downloadPreviousRelease(vpk, vpkProvider);
}
const packArguments = [
  "pack",
  "--packId",
  "com.superfx.projectwing.desktop-agent",
  "--packVersion",
  version,
  "--packDir",
  packDirectory,
  "--mainExe",
  "ProjectWingDesktopAgent.exe",
  "--packTitle",
  "Project Wing Desktop Agent",
  "--packAuthors",
  packAuthors,
  "--icon",
  path.join(appRoot, "resources/icon.ico"),
  "--shortcuts",
  "Desktop,StartMenuRoot,Startup",
  "--outputDir",
  releasesRoot,
  "--yes",
];
if (windowsSignParams) {
  packArguments.push("--signParams", windowsSignParams);
}
await runVpk(vpk, packArguments);

if (vpkProvider) {
  await runVpk(vpk, ["upload", vpkProvider, "--outputDir", releasesRoot]);
}

console.log(`Windows release created at ${releasesRoot}`);

async function publishManagedRuntime() {
  for (const [name, relativeProject] of managedProjects) {
    const publishDirectory = path.join(outputRoot, `${name}-publish`);
    await run(
      dotnetCommand,
      [
        "publish",
        path.join(repoRoot, relativeProject),
        "-c",
        "Release",
        "-r",
        "win-x64",
        "--self-contained",
        "true",
        "/p:PublishSingleFile=false",
        "/p:DebugType=None",
        "/p:DebugSymbols=false",
        "-o",
        publishDirectory,
      ],
      { cwd: repoRoot }
    );
  }
  await mergeManagedRuntime();
}

async function mergeManagedRuntime() {
  await run(
    process.execPath,
    [
      path.join(repoRoot, "scripts/desktop-agent/merge-dotnet-publish.mjs"),
      "--destination",
      managedRoot,
      "--source",
      path.join(outputRoot, "watcher-publish"),
      "--source",
      path.join(outputRoot, "manager-publish"),
      "--source",
      path.join(outputRoot, "runtime-publish"),
      "--prefer-first",
      "Microsoft.VisualBasic.dll",
      "--prefer-first",
      "System.Diagnostics.EventLog.Messages.dll",
      "--prefer-first",
      "System.Diagnostics.EventLog.dll",
      "--prefer-first",
      "System.Drawing.dll",
      "--prefer-first",
      "System.Security.Cryptography.Pkcs.dll",
      "--prefer-first",
      "System.Security.Cryptography.Xml.dll",
      "--prefer-first",
      "WindowsBase.dll",
      "--required",
      "ProjectWing.ExcelWatcher.exe",
      "--required",
      "ProjectWing.AgentManager.exe",
      "--required",
      "ProjectWing.DesktopAgent.Runtime.exe",
      "--report",
      path.join(outputRoot, "managed-runtime-merge.json"),
    ],
    { cwd: repoRoot }
  );
}

async function resolveVpk() {
  const configuredDll = process.env.VPK_DLL;
  if (configuredDll) {
    return { command: dotnetCommand, prefix: [configuredDll] };
  }

  const configured = process.env.VPK_BIN;
  if (configured) {
    return { command: configured, prefix: [] };
  }

  const command = "vpk.exe";
  try {
    await run(command, ["-h"], { cwd: repoRoot });
    return { command, prefix: [] };
  } catch {
    await run(
      dotnetCommand,
      [
        "tool",
        "install",
        "--tool-path",
        publishRoot,
        "vpk",
        "--version",
        "1.2.0",
      ],
      { cwd: repoRoot }
    );
    return { command: path.join(publishRoot, command), prefix: [] };
  }
}

async function downloadPreviousRelease(vpkTool, provider) {
  try {
    await runVpk(vpkTool, ["download", provider, "--outputDir", releasesRoot]);
  } catch (error) {
    console.warn(
      `No previous Windows release was downloaded; continuing with a full package. ${error}`
    );
  }
}

function runVpk(vpkTool, args) {
  return run(vpkTool.command, [...vpkTool.prefix, ...args], { cwd: repoRoot });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      shell: options.shell ?? false,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} failed with ${signal ?? `exit code ${code}`}`
        )
      );
    });
  });
}

function isTruthy(value) {
  return /^(1|true|yes|on)$/i.test(value?.trim() ?? "");
}
