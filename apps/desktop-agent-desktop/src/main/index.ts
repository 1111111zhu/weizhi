import { spawn } from "node:child_process";
import path from "node:path";

import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  nativeTheme,
  screen,
  shell,
  Tray,
} from "electron";
import type { Rectangle } from "electron";

import { configureDesktopAgentIpc } from "./desktop-agent-ipc";
import {
  getDesktopRuntimeWebBaseUrl,
  getDesktopUpdateUrl,
  getTrayIconPath,
} from "./desktop-paths";
import {
  configureDesktopProtocolHandlers,
  registerDesktopAgentProtocol,
  parseDesktopAgentCommand,
  hasDesktopAgentOpenRequest,
} from "./desktop-protocol";
import { configureMacLoginItem } from "./login-item";
import {
  prepareMaintenanceHandoff,
  verifyDownloadedUpdate,
  restoreVerifiedPendingUpdate,
} from "./maintenance-handoff";
import { ManagedRuntimeHost } from "./managed-runtime-host";
import { getRecoveryGuidance } from "./recovery-guidance";
import { DesktopAgentRuntimeClient } from "./runtime-client";
import { TrayActivationGuard } from "./tray-activation-guard";
import {
  getTrayWindowPlatformOptions,
  TrayFlyoutVisibility,
} from "./tray-flyout-visibility";
import { createTrayMenuTemplate } from "./tray-menu";
import { configureTrayWindowEvents } from "./tray-window-events";
import { getTrayFlyoutPosition } from "./tray-window-position";
import { createUpdateController } from "./update-controller";
import { runVelopackBootstrap } from "./velopack-bootstrap";
import { configureWindowsStartupShortcut } from "./windows-startup-shortcut";

runVelopackBootstrap({
  isPackaged: app.isPackaged,
  localAppDataPath: process.env.LOCALAPPDATA,
  platform: process.platform,
});
// Windows protocol activation starts a fresh executable. Recovery must run
// before singleton delegation, otherwise a hung primary can swallow it.
const recoveryOnly = process.argv.some(
  (argument) => parseDesktopAgentCommand(argument) === "recover"
);
let openWhenReady = false;
const isPrimaryInstance =
  !recoveryOnly &&
  configureDesktopProtocolHandlers(app, showTrayFlyout, () => {
    void recoverRuntime();
  });

const runtime = new DesktopAgentRuntimeClient(
  getDesktopRuntimeWebBaseUrl({
    environmentUrl: process.env.PROJECT_WING_AGENT_WEB_BASE_URL,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  })
);
const managedRuntime = new ManagedRuntimeHost({
  appDataPath: app.getPath("appData"),
  appVersion: app.getVersion(),
  isPackaged: app.isPackaged,
  localAppDataPath: process.env.LOCALAPPDATA,
  platform: process.platform,
  resourcesPath: process.resourcesPath,
  webBaseUrl: getDesktopRuntimeWebBaseUrl({
    environmentUrl: process.env.PROJECT_WING_AGENT_WEB_BASE_URL,
    isPackaged: app.isPackaged,
    resourcesPath: process.resourcesPath,
  }),
});
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let trayMenu: Menu | null = null;
let quitting = false;
let rendererRecoveryDialog: Promise<void> | null = null;
let flyoutHideTimer: NodeJS.Timeout | null = null;
const flyoutSize = { width: 900, height: 680 };
const flyoutVisibility = new TrayFlyoutVisibility(false);
const trayActivationGuard = new TrayActivationGuard();
const updateUrl = getDesktopUpdateUrl({
  environmentUrl: process.env.PROJECT_WING_DESKTOP_UPDATE_URL,
  isPackaged: app.isPackaged,
  resourcesPath: process.resourcesPath,
});
const updateController = createUpdateController({
  getLocale: () => app.getLocale(),
  isPackaged: app.isPackaged,
  onBeforeQuit: () => {
    quitting = true;
  },
  onQuitCancelled: () => {
    quitting = false;
  },
  quit: () => app.quit(),
  stopRuntime: () => managedRuntime.stop(),
  resumeRuntime: () => managedRuntime.resume(),
  verifyDownloadedUpdate:
    app.isPackaged && process.platform === "win32"
      ? (update) =>
          verifyDownloadedUpdate({
            executablePath: process.execPath,
            resourcesPath: process.resourcesPath,
            stateRoot: managedRuntime.stateRoot,
            update,
          })
      : undefined,
  restorePendingUpdate: (asset) =>
    restoreVerifiedPendingUpdate(asset, managedRuntime.stateRoot),
  prepareUpdate:
    app.isPackaged && process.platform === "win32"
      ? (update) =>
          prepareMaintenanceHandoff({
            executablePath: process.execPath,
            resourcesPath: process.resourcesPath,
            stateRoot: managedRuntime.stateRoot,
            update,
          })
      : undefined,
  updateUrl,
});

app.whenReady().then(() => {
  if (recoveryOnly) {
    void recoverIndependently();
    return;
  }
  if (!isPrimaryInstance) {
    return;
  }
  app.setAppUserModelId("com.superfx.projectwing.desktop-agent");
  openWhenReady ||= hasDesktopAgentOpenRequest(
    process.argv,
    process.platform === "darwin" && app.getLoginItemSettings().wasOpenedAtLogin
  );
  try {
    configureWindowsStartupShortcut(
      {
        isPackaged: app.isPackaged,
        platform: process.platform,
        appDataPath: app.getPath("appData"),
        localAppDataPath: process.env.LOCALAPPDATA,
        executablePath: process.execPath,
      },
      shell
    );
  } catch (error) {
    // Shortcut repair must not prevent the manual window or recovery controls.
    console.error("Unable to configure background startup shortcut:", error);
  }
  fireAndForget(registerDesktopAgentProtocol(app));
  configureMacLoginItem(app);
  fireAndForget(managedRuntime.start());
  configureDesktopAgentIpc({
    refreshTray,
    runtime,
    showWindow: showTrayFlyout,
    updateController,
  });
  createWindow();
  createTray();
  if (openWhenReady) {
    showTrayFlyout();
  }
  fireAndForget(refreshTray());
  setInterval(pollRuntime, 3000);
});

async function recoverIndependently() {
  try {
    await managedRuntime.recover();
    app.exit(0);
  } catch (error) {
    console.error("Independent Desktop Agent recovery failed:", error);
    const guidance = getRecoveryGuidance(error, app.getLocale());
    const result = await dialog.showMessageBox({
      type: "warning",
      ...guidance,
      buttons: [guidance.openLabel, guidance.closeLabel],
      cancelId: 1,
    });
    if (result.response === 0) {
      const opener = spawn(process.execPath, ["projectwing-agent://open"], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      });
      opener.on("error", (openError) =>
        console.error(
          "Unable to open the installed local application:",
          openError
        )
      );
      opener.unref();
    }
    app.exit(1);
  }
}

app.on("window-all-closed", () => {
  // The tray is the application entry point. Explicit Quit is the only exit.
});

app.on("before-quit", (event) => {
  if (!isPrimaryInstance) {
    return;
  }
  if (quitting) {
    return;
  }
  event.preventDefault();
  quitting = true;
  fireAndForget(managedRuntime.stop().finally(() => app.quit()));
});

app.on("activate", () => showTrayFlyout());

function createWindow() {
  mainWindow = new BrowserWindow({
    ...flyoutSize,
    ...getTrayWindowPlatformOptions(process.platform),
    alwaysOnTop: false,
    autoHideMenuBar: true,
    backgroundColor: "rgba(0, 0, 0, 0)",
    fullscreenable: false,
    hasShadow: false,
    maximizable: false,
    paintWhenInitiallyHidden: true,
    resizable: false,
    roundedCorners: false,
    show: false,
    title: "Desktop Agent",
    webPreferences: {
      backgroundThrottling: false,
      preload: path.join(import.meta.dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  configureTrayWindowEvents(mainWindow, {
    onClose: hideTrayFlyout,
    onReady: () => {
      if (mainWindow) {
        flyoutVisibility.handleReady(mainWindow);
      }
    },
    shouldClose: () => quitting,
    onRecoveryExhausted: (retry) => {
      if (quitting) {
        return;
      }
      rendererRecoveryDialog ??= showRendererRecoveryHelp(retry).finally(() => {
        rendererRecoveryDialog = null;
      });
    },
  });
  if (process.env.ELECTRON_RENDERER_URL) {
    fireAndForget(mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL));
  } else {
    fireAndForget(
      mainWindow.loadFile(
        path.join(import.meta.dirname, "../renderer/index.html")
      )
    );
  }
}

async function showRendererRecoveryHelp(retry: () => void) {
  const chinese = app.getLocale().toLowerCase().startsWith("zh");
  const result = await dialog.showMessageBox({
    type: "warning",
    message: chinese
      ? "Desktop Agent 界面暂时无法显示"
      : "Desktop Agent interface could not reload",
    detail: chinese
      ? "本地文件和后台服务不受影响。可以在这里重新加载界面，无需重新安装。"
      : "Your local files and background service are retained. Reload the interface here; no reinstall is needed.",
    buttons: chinese ? ["重新加载界面", "稍后"] : ["Reload interface", "Later"],
    cancelId: 1,
  });
  if (result.response === 0 && !quitting) {
    retry();
  }
}

function createTray() {
  const icon = nativeImage.createFromPath(
    getTrayIconPath({
      appPath: app.getAppPath(),
      dark: nativeTheme.shouldUseDarkColors,
      isPackaged: app.isPackaged,
      resourcesPath: process.resourcesPath,
    })
  );
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon);
  tray.setToolTip("Desktop Agent");
  tray.on("mouse-down", handleTrayPointerDown);
  tray.on("click", (_event, bounds) => {
    toggleTrayFlyout(bounds);
    trayActivationGuard.finishActivation();
  });
  tray.on("double-click", (_event, bounds) => {
    showTrayFlyout(bounds);
    trayActivationGuard.finishActivation();
  });
  tray.on("right-click", showTrayContextMenu);
}

function showTrayContextMenu() {
  if (!trayMenu) {
    trayActivationGuard.finishActivation();
    return;
  }
  tray?.popUpContextMenu(trayMenu);
  trayActivationGuard.finishActivation();
}

function handleTrayPointerDown() {
  trayActivationGuard.beginActivation();
  clearFlyoutHideTimer();
}

function toggleTrayFlyout(anchor: Rectangle) {
  if (mainWindow && flyoutVisibility.isVisible(mainWindow)) {
    clearFlyoutHideTimer();
    hideTrayFlyout();
    return;
  }
  showTrayFlyout(anchor);
}

function showTrayFlyout(anchor = tray?.getBounds()) {
  if (!mainWindow) {
    // A cold protocol/open-url activation may arrive before the window exists.
    openWhenReady = true;
    return;
  }
  openWhenReady = false;
  const trayAnchor = getTrayAnchor(anchor);
  const display = screen.getDisplayNearestPoint({
    x: trayAnchor.x + Math.round(trayAnchor.width / 2),
    y: trayAnchor.y + Math.round(trayAnchor.height / 2),
  });
  const fittedSize = {
    width: Math.min(flyoutSize.width, display.workArea.width - 16),
    height: Math.min(flyoutSize.height, display.workArea.height - 16),
  };
  const position = getTrayFlyoutPosition(
    trayAnchor,
    display.workArea,
    fittedSize
  );
  if (!mainWindow.isVisible()) {
    mainWindow.setSize(fittedSize.width, fittedSize.height, false);
    mainWindow.setPosition(position.x, position.y, false);
  }
  if (mainWindow.isMinimized()) mainWindow.restore();
  clearFlyoutHideTimer();
  flyoutVisibility.show(mainWindow);
  fireAndForget(refreshTray());
}

function showTraySettings() {
  showTrayFlyout();
  mainWindow?.webContents.send("desktop-agent:open-settings");
}

function hideTrayFlyout() {
  if (!mainWindow) {
    return;
  }
  clearFlyoutHideTimer();
  flyoutVisibility.hide(mainWindow);
}

function getTrayAnchor(anchor?: Rectangle): Rectangle {
  if (anchor?.width && anchor.height) {
    return anchor;
  }
  const point = screen.getCursorScreenPoint();
  return { ...point, width: 1, height: 1 };
}

function clearFlyoutHideTimer() {
  if (!flyoutHideTimer) {
    return;
  }
  clearTimeout(flyoutHideTimer);
  flyoutHideTimer = null;
}

async function refreshTray(
  snapshot?: Awaited<ReturnType<typeof runtime.snapshot>>
) {
  if (!tray) {
    return;
  }
  const currentSnapshot = snapshot ?? (await runtime.snapshot());
  lastTraySnapshot = currentSnapshot;
  if (
    mainWindow &&
    !mainWindow.isDestroyed() &&
    !mainWindow.webContents.isLoading()
  ) {
    mainWindow.webContents.send(
      "desktop-agent:snapshot-updated",
      currentSnapshot
    );
  }
  const attention =
    currentSnapshot.attentionCount > 0
      ? ` · ${currentSnapshot.attentionCount} attention item(s)`
      : "";
  tray.setToolTip(`Desktop Agent · ${currentSnapshot.state}${attention}`);
  trayMenu = Menu.buildFromTemplate(
    createTrayMenuTemplate(currentSnapshot, {
      onOpen: showTrayFlyout,
      onOpenSettings: showTraySettings,
      onQuit: () => app.quit(),
      onRefresh: () => fireAndForget(refreshTray()),
      onRecover: () => {
        void recoverRuntime();
      },
      onSignOut: () => fireAndForget(signOutFromTray()),
    })
  );
}

let lastTraySnapshot: Awaited<ReturnType<typeof runtime.snapshot>> | null =
  null;
let hiddenPollTicks = 0;
function pollRuntime() {
  const foreground = Boolean(mainWindow?.isVisible());
  const active = Boolean(lastTraySnapshot?.sessions.length);
  hiddenPollTicks += 1;
  if (!foreground && !active && hiddenPollTicks % 5 !== 0) return;
  fireAndForget(refreshTray());
}

async function signOutFromTray() {
  const snapshot = await runtime.signOut();
  await refreshTray(snapshot);
}

function fireAndForget(task: Promise<unknown>) {
  task.catch((error) =>
    console.error("Desktop Agent background operation failed:", error)
  );
}

let recoveryRequest: Promise<void> | null = null;
function recoverRuntime(): Promise<void> {
  return (recoveryRequest ??= performRecovery().finally(() => {
    recoveryRequest = null;
  }));
}

async function performRecovery() {
  await app.whenReady();
  if (!isPrimaryInstance || quitting) {
    return;
  }
  showTrayFlyout();
  try {
    await managedRuntime.recover();
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.webContents.reload();
    }
    showTrayFlyout();
    await refreshTray();
  } catch (error) {
    console.error("Desktop Agent recovery failed:", error);
    await dialog.showMessageBox({
      type: "warning",
      ...getRecoveryGuidance(error, app.getLocale()),
    });
  }
}
