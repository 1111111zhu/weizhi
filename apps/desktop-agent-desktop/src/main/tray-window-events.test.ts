import type { BrowserWindow } from "electron";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  configureRendererRecovery,
  configureTrayWindowEvents,
} from "./tray-window-events";

function fixtureWindow() {
  const events = () => {
    const listeners = new Map<string, ((...args: unknown[]) => void)[]>();
    return {
      on: (event: string, listener: (...args: unknown[]) => void) => {
        listeners.set(event, [...(listeners.get(event) ?? []), listener]);
      },
      emit: (event: string, ...args: unknown[]) => {
        for (const listener of listeners.get(event) ?? []) {
          listener(...args);
        }
      },
    };
  };
  const webContents = Object.assign(events(), {
    setWindowOpenHandler: vi.fn(),
    reload: vi.fn(),
    forcefullyCrashRenderer: vi.fn(),
  });
  const window = Object.assign(events(), {
    once: vi.fn(),
    webContents,
    isDestroyed: () => false,
  });
  return { window: window as unknown as BrowserWindow, webContents };
}

describe("tray renderer recovery", () => {
  afterEach(() => vi.useRealTimers());

  it("does not dismiss the window on blur or Escape", () => {
    const { window, webContents } = fixtureWindow();
    const onClose = vi.fn();
    configureTrayWindowEvents(window, {
      onClose,
      onReady: vi.fn(),
      shouldClose: () => false,
    });
    window.emit("blur");
    const event = { preventDefault: vi.fn() };
    webContents.emit("before-input-event", event, { key: "Escape" });
    expect(onClose).not.toHaveBeenCalled();
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  it("automatically reloads crashes with a bounded budget", () => {
    const { window, webContents } = fixtureWindow();
    const onRecoveryExhausted = vi.fn();
    configureRendererRecovery(window, {
      shouldClose: () => false,
      onRecoveryExhausted,
    });
    for (let index = 0; index < 4; index += 1) {
      webContents.emit("render-process-gone", {}, { reason: "crashed" });
    }
    expect(webContents.reload).toHaveBeenCalledTimes(3);
    expect(onRecoveryExhausted).toHaveBeenCalledOnce();
  });

  it("only replaces a renderer that remains unresponsive, never the runtime", async () => {
    vi.useFakeTimers();
    const { window, webContents } = fixtureWindow();
    configureRendererRecovery(window, { shouldClose: () => false });
    window.emit("unresponsive");
    window.emit("responsive");
    await vi.advanceTimersByTimeAsync(5000);
    expect(webContents.forcefullyCrashRenderer).not.toHaveBeenCalled();
    window.emit("unresponsive");
    await vi.advanceTimersByTimeAsync(5000);
    expect(webContents.forcefullyCrashRenderer).toHaveBeenCalledOnce();
  });

  it("does not resurrect a quitting application", () => {
    const { window, webContents } = fixtureWindow();
    configureRendererRecovery(window, { shouldClose: () => true });
    webContents.emit("render-process-gone", {}, { reason: "crashed" });
    expect(webContents.reload).not.toHaveBeenCalled();
  });
});
