import { readFileSync } from "node:fs";
import path from "node:path";

interface DesktopUpdateUrlOptions {
  environmentUrl?: string;
  isPackaged: boolean;
  resourcesPath: string;
}

interface DesktopRuntimeWebBaseUrlOptions {
  environmentUrl?: string;
  isPackaged: boolean;
  resourcesPath: string;
}

type DesktopReleaseConfig = {
  updateUrl?: unknown;
  webBaseUrl?: unknown;
};

export function getDesktopUpdateUrl(options: DesktopUpdateUrlOptions) {
  if (!options.isPackaged) {
    return options.environmentUrl;
  }
  try {
    const config = JSON.parse(
      readFileSync(
        path.join(options.resourcesPath, "desktop-release.json"),
        "utf-8"
      )
    ) as DesktopReleaseConfig;
    return typeof config.updateUrl === "string"
      ? config.updateUrl
      : options.environmentUrl;
  } catch {
    return options.environmentUrl;
  }
}

export function getDesktopRuntimeWebBaseUrl(
  options: DesktopRuntimeWebBaseUrlOptions
) {
  if (!options.isPackaged) {
    return options.environmentUrl;
  }
  try {
    const config = JSON.parse(
      readFileSync(
        path.join(options.resourcesPath, "desktop-release.json"),
        "utf-8"
      )
    ) as DesktopReleaseConfig;
    return typeof config.webBaseUrl === "string"
      ? config.webBaseUrl
      : options.environmentUrl;
  } catch {
    return options.environmentUrl;
  }
}

interface TrayIconPathOptions {
  appPath: string;
  dark: boolean;
  isPackaged: boolean;
  resourcesPath: string;
}

export function getTrayIconPath(options: TrayIconPathOptions) {
  const filename = options.dark ? "tray-dark.ico" : "icon.ico";
  if (!options.isPackaged) {
    return path.join(options.appPath, "resources", filename);
  }
  return path.join(
    options.resourcesPath,
    filename === "icon.ico" ? "tray.ico" : filename
  );
}
