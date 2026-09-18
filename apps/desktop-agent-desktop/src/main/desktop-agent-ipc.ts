import { realpath, stat } from "node:fs/promises";
import path from "node:path";

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import type { IpcMainInvokeEvent } from "electron";

import { formatCacheBytes } from "../shared/cache-format";
import type { DesktopAgentSnapshot } from "../shared/desktop-agent-api";
import type { DesktopAgentRuntimeClient } from "./runtime-client";
import type { UpdateController } from "./update-controller";

type DesktopAgentIpcOptions = {
  runtime: DesktopAgentRuntimeClient;
  updateController: UpdateController;
  refreshTray: (snapshot?: DesktopAgentSnapshot) => Promise<void>;
  showWindow: () => void;
};

export function configureDesktopAgentIpc(options: DesktopAgentIpcOptions) {
  registerCacheHandlers(options);
  registerSnapshotHandlers(options);
  registerSessionHandlers(options);
  registerAuthHandlers(options);
  registerUpdateHandlers(options);
  ipcMain.handle("desktop-agent:minimize", (event) => {
    assertTrustedRenderer(event);
    BrowserWindow.fromWebContents(event.sender)?.minimize();
  });
  ipcMain.handle("desktop-agent:recovery-history", async (event) => {
    assertTrustedRenderer(event);
    await openRetainedFilesDirectory(
      await options.runtime.recoveryHistoryDirectory()
    );
  });
  ipcMain.handle(
    "desktop-agent:open-project",
    async (event, sessionId: unknown) => {
      assertTrustedRenderer(event);
      if (typeof sessionId !== "string")
        throw new TypeError("Invalid session.");
      await shell.openExternal(await options.runtime.projectUrl(sessionId));
    }
  );
  ipcMain.handle(
    "desktop-agent:open-recent-project",
    async (event, projectId: unknown) => {
      assertTrustedRenderer(event);
      if (typeof projectId !== "string")
        throw new TypeError("Invalid project.");
      await shell.openExternal(
        await options.runtime.recentProjectUrl(projectId)
      );
    }
  );
  ipcMain.handle(
    "desktop-agent:reveal-session-file",
    async (event, sessionId: unknown) => {
      assertTrustedRenderer(event);
      if (typeof sessionId !== "string")
        throw new TypeError("Invalid session.");
      shell.showItemInFolder(await options.runtime.sessionFilePath(sessionId));
    }
  );
  ipcMain.handle(
    "desktop-agent:end-tracking",
    async (event, sessionId: unknown) => {
      assertTrustedRenderer(event);
      if (typeof sessionId !== "string")
        throw new TypeError("Invalid session.");
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner) throw new Error("Window unavailable.");
      const chinese = app.getLocale().toLowerCase().startsWith("zh");
      const result = await dialog.showMessageBox(owner, {
        type: "warning",
        title: chinese ? "结束跟踪" : "End tracking",
        message: chinese
          ? "结束这条旧文件记录？"
          : "End this old file session?",
        detail: chinese
          ? "能找到的本地副本会保存在恢复历史中，不上传、不覆盖服务器文件。缺失且未上传的修改无法恢复。释放旧占用失败时记录会保留，可再次重试。"
          : "Local copies are preserved in recovery history, without upload or server overwrite. Missing unuploaded edits cannot be recovered. Failed release keeps the record available for retry.",
        buttons: chinese
          ? ["取消", "保留副本并结束"]
          : ["Cancel", "Preserve and end"],
        defaultId: 0,
        cancelId: 0,
      });
      if (result.response !== 1) return options.runtime.snapshot();
      const snapshot = await options.runtime.endTracking(sessionId);
      await options.refreshTray(snapshot);
      return snapshot;
    }
  );
}

function registerCacheHandlers({ runtime }: DesktopAgentIpcOptions) {
  ipcMain.handle("desktop-agent:cache-files", (event) => {
    assertTrustedRenderer(event);
    return runtime.cacheFiles();
  });
  ipcMain.handle("desktop-agent:cache-settings", (event) => {
    assertTrustedRenderer(event);
    return runtime.cacheSettings();
  });
  ipcMain.handle(
    "desktop-agent:save-cache-settings",
    (event, value: unknown) => {
      assertTrustedRenderer(event);
      if (
        !value ||
        typeof value !== "object" ||
        !("cacheRoot" in value) ||
        !("maxBytes" in value) ||
        typeof value.cacheRoot !== "string" ||
        typeof value.maxBytes !== "number"
      )
        throw new TypeError("Invalid cache settings.");
      return confirmCacheSettingsChange(event, runtime, {
        cacheRoot: value.cacheRoot,
        maxBytes: value.maxBytes,
        ...("evictionPolicy" in value
          ? { evictionPolicy: readEvictionPolicy(value.evictionPolicy) }
          : {}),
        ...("idleDays" in value
          ? { idleDays: readIdleDays(value.idleDays) }
          : {}),
      });
    }
  );
  ipcMain.handle(
    "desktop-agent:delete-cache-file",
    async (event, id: unknown) => {
      assertTrustedRenderer(event);
      if (typeof id !== "string") throw new TypeError("Invalid cache file.");
      const listing = await runtime.cacheFiles();
      const file = listing.files.find((file) => file.id === id);
      if (!file?.canDelete)
        throw new Error(
          "This file is in use or retained for recovery. No file was deleted."
        );
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner) throw new Error("Window unavailable.");
      const chinese = app.getLocale().toLowerCase().startsWith("zh");
      const result = await dialog.showMessageBox(owner, {
        type: "warning",
        message: chinese
          ? `删除缓存副本“${file.fileName}”？`
          : `Delete cached copy “${file.fileName}”?`,
        detail: chinese
          ? "不会删除项目中的原文件。下次使用时会重新下载。"
          : "The project original is not deleted. It will be downloaded again when needed.",
        title: chinese ? "删除缓存" : "Delete cache",
        buttons: chinese ? ["取消", "删除缓存"] : ["Cancel", "Delete cache"],
        defaultId: 0,
        cancelId: 0,
      });
      return result.response === 1 ? runtime.deleteCacheFile(id) : listing;
    }
  );
}

function readEvictionPolicy(value: unknown): "LRU" | "FIFO" {
  if (value !== "LRU" && value !== "FIFO")
    throw new TypeError("Invalid cache replacement strategy.");
  return value;
}

async function confirmCacheSettingsChange(
  event: IpcMainInvokeEvent,
  runtime: DesktopAgentRuntimeClient,
  settings: Parameters<DesktopAgentRuntimeClient["saveCacheSettings"]>[0]
) {
  const current = await runtime.cacheSettings();
  const normalize = (value: string) =>
    process.platform === "win32"
      ? path.resolve(value).toLowerCase()
      : path.resolve(value);
  const sameLocation =
    normalize(current.cacheRoot) === normalize(settings.cacheRoot);
  if (
    sameLocation &&
    settings.maxBytes < current.maxBytes &&
    current.usedBytes > settings.maxBytes
  ) {
    const owner = BrowserWindow.fromWebContents(event.sender);
    if (!owner) throw new Error("Window unavailable.");
    const chinese = app.getLocale().toLowerCase().startsWith("zh");
    const strategy = settings.evictionPolicy ?? current.evictionPolicy ?? "LRU";
    const reclaim = formatCacheBytes(current.usedBytes - settings.maxBytes);
    const result = await dialog.showMessageBox(owner, {
      type: "warning",
      title: chinese ? "降低缓存容量" : "Reduce cache capacity",
      message: chinese
        ? `将缓存上限降低至 ${formatCacheBytes(settings.maxBytes)}？`
        : `Reduce the cache limit to ${formatCacheBytes(settings.maxBytes)}?`,
      detail: chinese
        ? `当前已用 ${formatCacheBytes(current.usedBytes)}，需要按 ${strategy} 策略至少清理 ${reclaim} 的闲置缓存。项目原文件不受影响，正在使用和恢复所需的副本会保留。`
        : `Currently using ${formatCacheBytes(current.usedBytes)}. At least ${reclaim} of idle cache must be removed using ${strategy}. Project originals and working/recovery copies are preserved.`,
      buttons: chinese
        ? ["取消", "清理并应用"]
        : ["Cancel", "Clean up and apply"],
      defaultId: 0,
      cancelId: 0,
    });
    if (result.response !== 1) return { ...current, cancelled: true };
    return runtime.saveCacheSettings(settings, true);
  }
  return runtime.saveCacheSettings(settings);
}

function readIdleDays(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 3650
  )
    throw new TypeError("Idle retention must be between 1 and 3650 days.");
  return value;
}

function registerSnapshotHandlers({
  refreshTray,
  runtime,
  showWindow,
}: DesktopAgentIpcOptions) {
  ipcMain.handle("desktop-agent:snapshot", (event) => {
    assertTrustedRenderer(event);
    return runtime.snapshot();
  });
  ipcMain.handle("desktop-agent:refresh", async (event) => {
    assertTrustedRenderer(event);
    const snapshot = await runtime.snapshot();
    await refreshTray(snapshot);
    return snapshot;
  });
  ipcMain.handle("desktop-agent:show-window", (event) => {
    assertTrustedRenderer(event);
    showWindow();
  });
  ipcMain.handle("desktop-agent:open-retained-files", async (event) => {
    assertTrustedRenderer(event);
    await openRetainedFilesDirectory(await runtime.retainedFilesDirectory());
  });
}

export async function openRetainedFilesDirectory(directory: string) {
  // No file/URL/executable targets, network paths, symlink redirection or disk
  // roots. This helper is called only with the freshly confirmed native config.
  if (
    !path.isAbsolute(directory) ||
    /^[\\/]{2}/.test(directory) ||
    directory.includes("\0")
  ) {
    throw new Error(
      "The retained-file directory is not a confirmed local folder."
    );
  }
  const resolved = path.resolve(directory);
  const canonical = await realpath(resolved);
  const entry = await stat(canonical);
  const compare = (value: string) =>
    process.platform === "win32" ? value.toLowerCase() : value;
  if (
    resolved === path.parse(resolved).root ||
    compare(canonical) !== compare(resolved) ||
    !entry.isDirectory()
  ) {
    throw new Error(
      "The retained-file directory is not a confirmed local folder."
    );
  }
  const error = await shell.openPath(canonical);
  if (error) {
    throw new Error(
      "The file manager could not open the retained-file folder. Please retry; no files were changed."
    );
  }
}

function registerSessionHandlers({
  refreshTray,
  runtime,
}: DesktopAgentIpcOptions) {
  ipcMain.handle(
    "desktop-agent:check-in",
    async (event, sessionId: unknown) => {
      assertTrustedRenderer(event);
      if (typeof sessionId !== "string") {
        throw new TypeError("Invalid session.");
      }
      const snapshot = await runtime.checkIn(sessionId);
      await refreshTray(snapshot);
      return snapshot;
    }
  );
  ipcMain.handle("desktop-agent:release", async (event, sessionId: unknown) => {
    assertTrustedRenderer(event);
    if (typeof sessionId !== "string") {
      throw new TypeError("Invalid session.");
    }
    const snapshot = await runtime.release(sessionId);
    await refreshTray(snapshot);
    return snapshot;
  });
}

function registerAuthHandlers({
  refreshTray,
  runtime,
}: DesktopAgentIpcOptions) {
  ipcMain.handle("desktop-agent:sign-out", async (event) => {
    assertTrustedRenderer(event);
    const snapshot = await runtime.signOut();
    await refreshTray(snapshot);
    return snapshot;
  });
}

function registerUpdateHandlers({ updateController }: DesktopAgentIpcOptions) {
  ipcMain.handle("desktop-agent:check-for-update", (event) => {
    assertTrustedRenderer(event);
    return updateController.check();
  });
  ipcMain.handle("desktop-agent:download-update", (event) => {
    assertTrustedRenderer(event);
    return updateController.download();
  });
  ipcMain.handle("desktop-agent:apply-update", (event) => {
    assertTrustedRenderer(event);
    return updateController.apply();
  });
}

function assertTrustedRenderer(event: IpcMainInvokeEvent) {
  const senderUrl = event.senderFrame?.url;
  if (!senderUrl) {
    throw new Error("Untrusted IPC sender.");
  }
  if (
    process.env.ELECTRON_RENDERER_URL &&
    senderUrl.startsWith(process.env.ELECTRON_RENDERER_URL)
  ) {
    return;
  }
  if (!process.env.ELECTRON_RENDERER_URL && senderUrl.startsWith("file:")) {
    return;
  }
  throw new Error("Untrusted IPC sender.");
}
