import type { App } from "electron";

export function configureMacLoginItem(
  app: App,
  platform: NodeJS.Platform = process.platform
) {
  if (!app.isPackaged || platform !== "darwin") {
    return;
  }
  app.setLoginItemSettings({ openAsHidden: true, openAtLogin: true });
}
