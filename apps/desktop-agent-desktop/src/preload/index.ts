import { contextBridge, ipcRenderer } from "electron";

import type {
  DesktopAgentHostApi,
  DesktopAgentSnapshot,
} from "../shared/desktop-agent-api";

const api: DesktopAgentHostApi = {
  getCacheFiles: () => ipcRenderer.invoke("desktop-agent:cache-files"),
  deleteCacheFile: (id) =>
    ipcRenderer.invoke("desktop-agent:delete-cache-file", id),
  getCacheSettings: () => ipcRenderer.invoke("desktop-agent:cache-settings"),
  saveCacheSettings: (settings) =>
    ipcRenderer.invoke("desktop-agent:save-cache-settings", settings),
  getSnapshot: () => ipcRenderer.invoke("desktop-agent:snapshot"),
  onSnapshot: (callback) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      snapshot: DesktopAgentSnapshot
    ) => callback(snapshot);
    ipcRenderer.on("desktop-agent:snapshot-updated", listener);
    return () =>
      ipcRenderer.removeListener("desktop-agent:snapshot-updated", listener);
  },
  refresh: () => ipcRenderer.invoke("desktop-agent:refresh"),
  signOut: () => ipcRenderer.invoke("desktop-agent:sign-out"),
  checkIn: (sessionId) =>
    ipcRenderer.invoke("desktop-agent:check-in", sessionId),
  release: (sessionId) =>
    ipcRenderer.invoke("desktop-agent:release", sessionId),
  openMainWindow: () => ipcRenderer.invoke("desktop-agent:show-window"),
  minimize: () => ipcRenderer.invoke("desktop-agent:minimize"),
  endTracking: (sessionId) =>
    ipcRenderer.invoke("desktop-agent:end-tracking", sessionId),
  openProject: (sessionId) =>
    ipcRenderer.invoke("desktop-agent:open-project", sessionId),
  openRecentProject: (projectId) =>
    ipcRenderer.invoke("desktop-agent:open-recent-project", projectId),
  revealSessionFile: (sessionId) =>
    ipcRenderer.invoke("desktop-agent:reveal-session-file", sessionId),
  openRecoveryHistory: () =>
    ipcRenderer.invoke("desktop-agent:recovery-history"),
  openRetainedFiles: () =>
    ipcRenderer.invoke("desktop-agent:open-retained-files"),
  onOpenSettings: (callback) => {
    const listener = () => callback();
    ipcRenderer.on("desktop-agent:open-settings", listener);
    return () =>
      ipcRenderer.removeListener("desktop-agent:open-settings", listener);
  },
  checkForUpdate: () => ipcRenderer.invoke("desktop-agent:check-for-update"),
  downloadUpdate: () => ipcRenderer.invoke("desktop-agent:download-update"),
  applyUpdate: () => ipcRenderer.invoke("desktop-agent:apply-update"),
};

contextBridge.exposeInMainWorld("desktopAgent", api);
