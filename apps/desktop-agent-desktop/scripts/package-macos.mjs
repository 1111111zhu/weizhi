import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveReleaseOutputRoot } from "./release-output-root.mjs";
import {
  resolveMacosAppBundle,
  resolveMacosMainExecutable,
} from "./resolve-macos-app-bundle.mjs";
import { createRuntimeIntegrityManifest } from "./runtime-integrity.mjs";

const appRoot = path.resolve(import.meta.dirname, "..");
const repoRoot = path.resolve(appRoot, "../..");
const packageJson = JSON.parse(
  await readFile(path.join(appRoot, "package.json"), "utf-8")
);
const version = process.env.PROJECT_WING_DESKTOP_VERSION ?? packageJson.version;
const runtimeIdentifier = resolveRuntimeIdentifier(
  process.env.PROJECT_WING_DESKTOP_MACOS_RUNTIME
);
const outputRoot = resolveReleaseOutputRoot(
  repoRoot,
  process.env.PROJECT_WING_DESKTOP_RELEASE_ROOT,
  path.join("output/desktop-agent/macos", runtimeIdentifier)
);
const runtimeRoot = path.join(outputRoot, "payload", "managed");
const releaseConfigPath = path.join(outputRoot, "desktop-release.json");
const iconPath = path.join(outputRoot, "ProjectWingDesktopAgent.icns");
const releasesRoot = path.join(outputRoot, "releases");
const vpkToolRoot = path.join(outputRoot, "vpk-tool");
const updateUrl = process.env.PROJECT_WING_DESKTOP_UPDATE_URL?.trim();

if (process.platform !== "darwin") {
  throw new Error("macOS Electron packaging must run on macOS.");
}

await rm(outputRoot, { force: true, recursive: true });
await mkdir(outputRoot, { recursive: true });
await run("bash", [
  path.join(repoRoot, "scripts/desktop-agent/build-macos-runtime.sh"),
  version,
  "Release",
  runtimeIdentifier,
]);
await createMacIcon(iconPath);
await writeFile(
  releaseConfigPath,
  `${JSON.stringify({ updateUrl: updateUrl || null })}\n`,
  "utf-8"
);
await run("corepack", ["pnpm", "build"], { cwd: appRoot });
await writeFile(
  path.join(outputRoot, "desktop-runtime-integrity.json"),
  `${JSON.stringify(await createRuntimeIntegrityManifest(runtimeRoot))}\n`,
  "utf-8"
);
await run(
  "electron-builder",
  [
    "--config",
    path.join(appRoot, "electron-builder.config.mjs"),
    "--mac",
    "--dir",
    `--${macArchitecture(runtimeIdentifier)}`,
  ],
  {
    cwd: appRoot,
    env: {
      PROJECT_WING_DESKTOP_MACOS_ICON: iconPath,
      PROJECT_WING_DESKTOP_OUTPUT_DIR: path.join(outputRoot, "electron"),
      PROJECT_WING_DESKTOP_RELEASE_CONFIG: releaseConfigPath,
      PROJECT_WING_DESKTOP_RUNTIME_SOURCE: runtimeRoot,
    },
  }
);
const appBundlePath = await resolveMacosAppBundle(
  outputRoot,
  macArchitecture(runtimeIdentifier)
);
const mainExecutable = await resolveMacosMainExecutable(appBundlePath);

const vpk = await resolveVpk();
const vpkProvider = process.env.PROJECT_WING_DESKTOP_VPK_PROVIDER;
if (vpkProvider) {
  await mkdir(releasesRoot, { recursive: true });
  await downloadPreviousRelease(vpk, vpkProvider);
}
await runVpk(vpk, [
  "pack",
  "--packId",
  "com.superfx.projectwing.desktop-agent",
  "--packVersion",
  version,
  "--packDir",
  appBundlePath,
  "--mainExe",
  mainExecutable,
  "--packTitle",
  "Project Wing Desktop Agent",
  "--runtime",
  runtimeIdentifier,
  "--outputDir",
  releasesRoot,
  "--yes",
]);
if (vpkProvider) {
  await runVpk(vpk, ["upload", vpkProvider, "--outputDir", releasesRoot]);
}

console.log(`macOS release created at ${releasesRoot}`);

function resolveRuntimeIdentifier(value) {
  const runtime = value ?? `osx-${process.arch === "arm64" ? "arm64" : "x64"}`;
  if (["osx-arm64", "osx-x64"].includes(runtime)) {
    return runtime;
  }
  throw new Error(`Unsupported macOS runtime: ${runtime}`);
}

function macArchitecture(runtime) {
  return runtime.replace("osx-", "");
}

async function createMacIcon(destination) {
  const iconset = path.join(outputRoot, "ProjectWingDesktopAgent.iconset");
  const source = path.join(appRoot, "resources/icon-source.png");
  const sizes = [16, 32, 128, 256, 512];
  await mkdir(iconset, { recursive: true });
  for (const size of sizes) {
    await createIconSize(source, iconset, size, 1);
    await createIconSize(source, iconset, size, 2);
  }
  await run("iconutil", ["-c", "icns", iconset, "-o", destination]);
}

async function createIconSize(source, iconset, size, scale) {
  const pixels = size * scale;
  const suffix = scale === 2 ? "@2x" : "";
  const destination = path.join(iconset, `icon_${size}x${size}${suffix}.png`);
  await cp(source, destination);
  await run("sips", ["-z", String(pixels), String(pixels), destination]);
}

async function resolveVpk() {
  const configuredDll = process.env.VPK_DLL;
  if (configuredDll) {
    return { command: "dotnet", prefix: [configuredDll] };
  }

  const configured = process.env.VPK_BIN;
  if (configured) {
    return { command: configured, prefix: [] };
  }

  const command = "vpk";
  try {
    await run(command, ["-h"]);
    return { command, prefix: [] };
  } catch {
    await run("dotnet", [
      "tool",
      "install",
      "--tool-path",
      vpkToolRoot,
      "vpk",
      "--version",
      "1.2.0",
    ]);
    return { command: path.join(vpkToolRoot, command), prefix: [] };
  }
}

async function downloadPreviousRelease(vpkTool, releaseProvider) {
  try {
    await runVpk(vpkTool, [
      "download",
      releaseProvider,
      "--outputDir",
      releasesRoot,
    ]);
  } catch (error) {
    console.warn(
      `No previous macOS release was downloaded; continuing with a full package. ${error}`
    );
  }
}

function runVpk(vpkTool, args) {
  return run(vpkTool.command, [...vpkTool.prefix, ...args]);
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? repoRoot,
      env: { ...process.env, ...options.env },
      shell: false,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(
        new Error(`${command} failed with ${signal ?? `exit code ${code}`}`)
      );
    });
  });
}
