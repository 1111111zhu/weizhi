import { dialog } from "electron";
import { UpdateManager } from "velopack";
import type { UpdateInfo, VelopackAsset } from "velopack";

import type { DesktopAgentUpdate } from "../shared/desktop-agent-api";
import type { PreparedMaintenance } from "./maintenance-handoff";

export type UpdateController = {
  enabled: boolean;
  check: (showDialog?: boolean) => Promise<DesktopAgentUpdate | null>;
  download: () => Promise<DesktopAgentUpdate | null>;
  apply: () => Promise<boolean>;
};

type UpdateControllerOptions = {
  isPackaged: boolean;
  onBeforeQuit: () => void;
  onQuitCancelled?: () => void;
  quit: () => void;
  stopRuntime: () => Promise<void>;
  resumeRuntime?: () => Promise<void>;
  prepareUpdate?: (update: UpdateInfo) => Promise<PreparedMaintenance>;
  verifyDownloadedUpdate?: (update: UpdateInfo) => Promise<unknown>;
  restorePendingUpdate?: (asset: VelopackAsset) => Promise<UpdateInfo | null>;
  updateUrl?: string;
  getLocale?: () => string;
};

export function createUpdateController({
  isPackaged,
  onBeforeQuit,
  onQuitCancelled,
  quit,
  stopRuntime,
  resumeRuntime = () => Promise.resolve(),
  prepareUpdate,
  verifyDownloadedUpdate,
  restorePendingUpdate,
  updateUrl,
  getLocale = () => "en",
}: UpdateControllerOptions): UpdateController {
  let manager: UpdateManager | null = null;
  let availableUpdate: UpdateInfo | null = null;
  let applyTask: Promise<boolean> | null = null;
  let downloadTask: Promise<DesktopAgentUpdate | null> | null = null;
  let checkTask: Promise<DesktopAgentUpdate | null> | null = null;

  return {
    enabled: Boolean(updateUrl && isPackaged),
    check: (showDialog = false) =>
      (checkTask ??= checkForUpdate(showDialog).finally(() => {
        checkTask = null;
      })),
    download: () =>
      (downloadTask ??= downloadUpdate().finally(() => {
        downloadTask = null;
      })),
    apply: beginApply,
  };

  function beginApply() {
    return (applyTask ??= applyUpdate().finally(() => {
      applyTask = null;
    }));
  }

  function getManager() {
    if (!updateUrl || !isPackaged) {
      return null;
    }
    return (manager ??= new UpdateManager(updateUrl));
  }

  async function readPendingUpdate(
    updateManager: UpdateManager
  ): Promise<UpdateInfo | null> {
    const asset = updateManager.getUpdatePendingRestart();
    if (!asset) {
      return null;
    }
    if (!asset.SHA256 && !asset.SHA1) {
      return restorePendingUpdate ? await restorePendingUpdate(asset) : null;
    }
    return { TargetFullRelease: asset, DeltasToTarget: [], IsDowngrade: false };
  }

  async function checkForUpdate(showDialog: boolean) {
    if (applyTask || downloadTask) {
      return serializeUpdate(availableUpdate);
    }
    const updateManager = getManager();
    if (!updateManager) {
      return null;
    }
    availableUpdate =
      (await readPendingUpdate(updateManager)) ??
      (await updateManager.checkForUpdatesAsync());
    if (showDialog) {
      await showUpdateDialog();
    }
    return serializeUpdate(availableUpdate);
  }

  async function showUpdateDialog() {
    const chinese = getLocale().toLowerCase().startsWith("zh");
    if (!availableUpdate) {
      await dialog.showMessageBox({
        message: chinese
          ? "Desktop Agent 已是最新版本。"
          : "Project Wing Desktop Agent is up to date.",
        type: "info",
      });
      return;
    }
    const result = await dialog.showMessageBox({
      buttons: chinese
        ? ["下载并重启", "稍后"]
        : ["Download and restart", "Later"],
      cancelId: 1,
      defaultId: 0,
      detail: chinese
        ? `版本 ${availableUpdate.TargetFullRelease.Version} 已可安装。`
        : `Version ${availableUpdate.TargetFullRelease.Version} is ready to install.`,
      message: chinese
        ? "Desktop Agent 有可用的新版本。"
        : "A new version of Project Wing Desktop Agent is available.",
      type: "info",
    });
    if (result.response === 0) {
      await beginApply();
    }
  }

  async function downloadUpdate() {
    const updateManager = getManager();
    if (!updateManager) {
      return null;
    }
    availableUpdate ??=
      (await readPendingUpdate(updateManager)) ??
      (await updateManager.checkForUpdatesAsync());
    if (!availableUpdate) {
      return null;
    }
    await updateManager.downloadUpdateAsync(availableUpdate);
    await verifyDownloadedUpdate?.(availableUpdate);
    return serializeUpdate(availableUpdate);
  }

  async function applyUpdate() {
    const updateManager = getManager();
    if (!updateManager) {
      return false;
    }
    availableUpdate ??=
      (await readPendingUpdate(updateManager)) ??
      (await updateManager.checkForUpdatesAsync());
    if (!availableUpdate) {
      return false;
    }
    const selectedUpdate = availableUpdate;
    await (downloadTask ?? updateManager.downloadUpdateAsync(selectedUpdate));
    await verifyDownloadedUpdate?.(selectedUpdate);
    let maintenance: PreparedMaintenance | null = null;
    try {
      maintenance = prepareUpdate ? await prepareUpdate(selectedUpdate) : null;
      await stopRuntime();
      if (maintenance) {
        await maintenance.commit();
      } else {
        updateManager.waitExitThenApplyUpdate(selectedUpdate, false, true);
      }
      onBeforeQuit();
      quit();
    } catch (error) {
      onQuitCancelled?.();
      await maintenance?.cancel();
      try {
        await resumeRuntime();
      } catch (resumeError) {
        console.error(
          "Desktop Agent restart after interrupted update failed:",
          resumeError
        );
      }
      throw error;
    }
    return true;
  }
}

function serializeUpdate(info: UpdateInfo | null): DesktopAgentUpdate | null {
  if (!info) {
    return null;
  }
  return {
    releaseNotes: info.TargetFullRelease.NotesMarkdown,
    targetVersion: info.TargetFullRelease.Version,
  };
}
