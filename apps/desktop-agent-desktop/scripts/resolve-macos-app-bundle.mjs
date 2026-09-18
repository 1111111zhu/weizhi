import { readdir } from "node:fs/promises";
import path from "node:path";

export async function resolveMacosAppBundle(outputRoot, architecture) {
  const appOutputRoot = path.join(
    outputRoot,
    "electron",
    `mac-${architecture}`
  );
  let entries;
  try {
    entries = await readdir(appOutputRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(`macOS Electron output is missing: ${appOutputRoot}`, {
      cause: error,
    });
  }
  const appBundles = entries.filter(
    (entry) => entry.isDirectory() && entry.name.endsWith(".app")
  );
  if (appBundles.length !== 1) {
    const discovered = entries.map((entry) => entry.name).join(", ") || "none";
    throw new Error(
      `Expected one macOS app bundle in ${appOutputRoot}; found ${appBundles.length}. Entries: ${discovered}`
    );
  }
  return path.join(appOutputRoot, appBundles[0].name);
}

export async function resolveMacosMainExecutable(appBundlePath) {
  const executableRoot = path.join(appBundlePath, "Contents", "MacOS");
  let entries;
  try {
    entries = await readdir(executableRoot, { withFileTypes: true });
  } catch (error) {
    throw new Error(`macOS executable directory is missing: ${executableRoot}`, {
      cause: error,
    });
  }
  const executables = entries.filter(
    (entry) => entry.isFile() && !entry.name.startsWith(".")
  );
  if (executables.length !== 1) {
    const discovered = entries.map((entry) => entry.name).join(", ") || "none";
    throw new Error(
      `Expected one macOS main executable in ${executableRoot}; found ${executables.length}. Entries: ${discovered}`
    );
  }
  return executables[0].name;
}
