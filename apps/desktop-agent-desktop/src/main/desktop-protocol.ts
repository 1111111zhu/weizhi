import path from "node:path";

import type { App } from "electron";
import { UpdateManager } from "velopack";

const desktopAgentProtocol = "projectwing-agent";

export const backgroundLaunchArgument = "--background";

export function hasDesktopAgentOpenRequest(
  argumentsList: string[],
  openedAtLogin = false
) {
  const commands = argumentsList.map(parseDesktopAgentCommand);
  if (commands.includes("recover")) {
    return false;
  }
  if (commands.includes("open") || commands.includes("start")) {
    return true;
  }
  // A malformed/external URL must not be mistaken for a plain app launch.
  if (argumentsList.some((argument) => argument.includes("://"))) {
    return false;
  }
  if (openedAtLogin || argumentsList.includes(backgroundLaunchArgument)) {
    return false;
  }
  if (argumentsList.some((argument) => argument.startsWith("--veloapp-"))) {
    return false;
  }
  return true;
}

export function configureDesktopProtocolHandlers(
  app: App,
  onOpen: () => void,
  onRecover: () => void = onOpen
) {
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return false;
  }
  app.on("second-instance", (_event, commandLine) => {
    const command = commandLine.map(parseDesktopAgentCommand).find(Boolean);
    if (command === "recover") {
      onRecover();
    } else if (hasDesktopAgentOpenRequest(commandLine)) {
      onOpen();
    }
  });
  app.on("open-url", (event, url) => {
    const command = parseDesktopAgentCommand(url);
    if (!command) {
      return;
    }
    event.preventDefault();
    if (command === "recover") {
      onRecover();
    } else {
      onOpen();
    }
  });
  return true;
}

export async function registerDesktopAgentProtocol(app: App) {
  // Development copies must never steal the installed application's handler.
  if (!app.isPackaged) {
    return;
  }
  if (process.platform === "win32") {
    try {
      const installation = new UpdateManager("");
      if (
        installation.isPortable() ||
        installation.getAppId() !== "com.superfx.projectwing.desktop-agent" ||
        installation.getCurrentVersion() !== app.getVersion()
      ) {
        return;
      }
    } catch {
      // An unpacked/corrupt copy must not replace the working installed URL.
      return;
    }
  }
  const protocolUrl = `${desktopAgentProtocol}://open`;
  if (app.getApplicationNameForProtocol(protocolUrl)) {
    try {
      const registered = await app.getApplicationInfoForProtocol(protocolUrl);
      const normalize = (value: string) =>
        process.platform === "win32"
          ? path.resolve(value).toLowerCase()
          : path.resolve(value);
      if (normalize(registered.path) !== normalize(process.execPath)) {
        console.warn(
          "Another installation owns the Desktop Agent URL handler; its registration was retained."
        );
        return;
      }
    } catch {
      // Unknown ownership is not permission to replace a working registration.
      return;
    }
  }
  if (process.defaultApp && process.argv[1]) {
    app.setAsDefaultProtocolClient(desktopAgentProtocol, process.execPath, [
      path.resolve(process.argv[1]),
    ]);
    return;
  }
  app.setAsDefaultProtocolClient(desktopAgentProtocol);
}

export function parseDesktopAgentCommand(
  value: string
): "start" | "open" | "recover" | null {
  if (!/^projectwing-agent:\/\/(start|open|recover)\/?$/i.test(value)) {
    return null;
  }
  try {
    const url = new URL(value);
    if (
      url.protocol !== `${desktopAgentProtocol}:` ||
      url.username ||
      url.password ||
      url.port ||
      url.search ||
      url.hash ||
      (url.pathname && url.pathname !== "/")
    ) {
      return null;
    }
    return url.hostname === "start" ||
      url.hostname === "open" ||
      url.hostname === "recover"
      ? url.hostname
      : null;
  } catch {
    return null;
  }
}
