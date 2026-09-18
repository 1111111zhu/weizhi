import { existsSync } from "node:fs";
import path from "node:path";

import type { Shell } from "electron";

import { backgroundLaunchArgument } from "./desktop-protocol";

type StartupOptions = {
  isPackaged: boolean;
  platform: NodeJS.Platform;
  appDataPath: string;
  localAppDataPath?: string;
  executablePath: string;
};

/** Amend only the installer's existing, exactly-owned Startup link; never
 * create a removed login item or change desktop/Start-menu shortcuts. */
export function configureWindowsStartupShortcut(
  options: StartupOptions,
  shortcuts: Pick<Shell, "readShortcutLink" | "writeShortcutLink">,
  pathExists = existsSync
) {
  if (
    !options.isPackaged ||
    options.platform !== "win32" ||
    !options.localAppDataPath
  ) {
    return false;
  }
  const normalize = (value: string) => path.win32.resolve(value).toLowerCase();
  const installedExecutable = path.win32.join(
    options.localAppDataPath,
    "com.superfx.projectwing.desktop-agent",
    "current",
    "ProjectWingDesktopAgent.exe"
  );
  if (normalize(options.executablePath) !== normalize(installedExecutable)) {
    return false;
  }
  const shortcut = path.win32.join(
    options.appDataPath,
    "Microsoft",
    "Windows",
    "Start Menu",
    "Programs",
    "Startup",
    "Project Wing Desktop Agent.lnk"
  );
  if (!pathExists(shortcut)) {
    return false;
  }
  const existing = shortcuts.readShortcutLink(shortcut);
  if (normalize(existing.target) !== normalize(installedExecutable)) {
    return false;
  }
  if (existing.args === backgroundLaunchArgument) {
    return false;
  }
  // Preserve customized or unknown commands rather than silently overwriting them.
  if (existing.args?.trim()) {
    return false;
  }
  if (
    !shortcuts.writeShortcutLink(shortcut, "update", {
      target: existing.target,
      args: backgroundLaunchArgument,
    })
  ) {
    throw new Error("The Desktop Agent Startup shortcut could not be updated.");
  }
  return true;
}
