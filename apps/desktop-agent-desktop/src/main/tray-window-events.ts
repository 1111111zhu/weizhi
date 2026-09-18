import type { BrowserWindow } from "electron";

interface TrayWindowEventHandlers {
  onClose: () => void;
  onReady: () => void;
  shouldClose: () => boolean;
  onRecoveryExhausted?: (retry: () => void) => void;
}

export function configureTrayWindowEvents(
  window: BrowserWindow,
  handlers: TrayWindowEventHandlers
) {
  window.on("close", (event) => {
    if (handlers.shouldClose()) {
      return;
    }
    event.preventDefault();
    handlers.onClose();
  });
  window.once("ready-to-show", handlers.onReady);
  // Remain visible when focus moves away. Escape belongs to the active
  // popover/dialog; minimizing is an explicit window control.
  window.webContents.on("preload-error", (_event, preloadPath, error) => {
    console.error(`Desktop Agent preload failed at ${preloadPath}:`, error);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  configureRendererRecovery(window, handlers);
}

export function configureRendererRecovery(
  window: BrowserWindow,
  handlers: Pick<TrayWindowEventHandlers, "shouldClose" | "onRecoveryExhausted">
) {
  let attempts: number[] = [];
  let hangTimer: ReturnType<typeof setTimeout> | null = null;
  const clearHang = () => {
    if (hangTimer) {
      clearTimeout(hangTimer);
    }
    hangTimer = null;
  };
  const recover = () => {
    clearHang();
    if (handlers.shouldClose() || window.isDestroyed()) {
      return;
    }
    const now = Date.now();
    attempts = attempts.filter((time) => now - time < 60_000);
    if (attempts.length >= 3) {
      handlers.onRecoveryExhausted?.(() => {
        attempts = [];
        recover();
      });
      return;
    }
    attempts.push(now);
    window.webContents.reload();
  };
  window.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason !== "clean-exit") {
      recover();
    }
  });
  window.on("unresponsive", () => {
    if (!hangTimer) {
      hangTimer = setTimeout(() => {
        hangTimer = null;
        if (!handlers.shouldClose() && !window.isDestroyed()) {
          window.webContents.forcefullyCrashRenderer();
        }
      }, 5000);
    }
  });
  window.on("responsive", clearHang);
  window.on("closed", clearHang);
}
