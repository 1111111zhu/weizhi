import { describe, expect, it, vi } from "vitest";

import {
  getTrayWindowPlatformOptions,
  TrayFlyoutVisibility,
} from "./tray-flyout-visibility";
import type { TrayFlyoutWindow } from "./tray-flyout-visibility";

function createWindow(visible = false) {
  const calls: string[] = [];
  const window: TrayFlyoutWindow = {
    focus: vi.fn(() => calls.push("focus")),
    hide: vi.fn(() => calls.push("hide")),
    isVisible: vi.fn(() => visible),
    setIgnoreMouseEvents: vi.fn((ignore) => calls.push(`ignore:${ignore}`)),
    setOpacity: vi.fn((opacity) => calls.push(`opacity:${opacity}`)),
    setSkipTaskbar: vi.fn((skip) => calls.push(`skipTaskbar:${skip}`)),
    show: vi.fn(() => calls.push("show")),
    showInactive: vi.fn(() => calls.push("showInactive")),
  };
  return { calls, window };
}

describe(TrayFlyoutVisibility, () => {
  it("uses a taskbar window that supports explicit minimization", () => {
    expect(getTrayWindowPlatformOptions("win32")).toStrictEqual({
      frame: true,
      transparent: false,
      minimizable: true,
      skipTaskbar: false,
      type: undefined,
    });
    expect(getTrayWindowPlatformOptions("darwin")).toStrictEqual({
      frame: true,
      transparent: false,
      minimizable: true,
      skipTaskbar: false,
      type: undefined,
    });
  });

  it("mounts the Windows flyout transparently without a taskbar entry", () => {
    const visibility = new TrayFlyoutVisibility(true);
    const { calls, window } = createWindow();

    visibility.handleReady(window);

    expect(calls).toStrictEqual([
      "skipTaskbar:true",
      "opacity:0",
      "ignore:true",
      "showInactive",
      "skipTaskbar:true",
    ]);
    expect(visibility.isVisible(window)).toBeFalsy();
  });

  it("reveals the resident Windows flyout without remounting it", () => {
    const visibility = new TrayFlyoutVisibility(true);
    const { calls, window } = createWindow();
    visibility.handleReady(window);
    calls.length = 0;

    visibility.show(window);

    expect(calls).toStrictEqual([
      "ignore:false",
      "focus",
      "opacity:1",
      "skipTaskbar:true",
    ]);
    expect(visibility.isVisible(window)).toBeTruthy();
  });

  it("conceals the resident Windows flyout without unmounting it", () => {
    const visibility = new TrayFlyoutVisibility(true);
    const { calls, window } = createWindow();
    visibility.handleReady(window);
    visibility.show(window);
    calls.length = 0;

    visibility.hide(window);

    expect(calls).toStrictEqual([
      "opacity:0",
      "ignore:true",
      "skipTaskbar:true",
    ]);
    expect(visibility.isVisible(window)).toBeFalsy();
  });

  it("retains native visibility outside Windows", () => {
    const visibility = new TrayFlyoutVisibility(false);
    const { calls, window } = createWindow(true);

    visibility.show(window);
    visibility.hide(window);

    expect(calls).toStrictEqual(["show", "hide"]);
    expect(visibility.isVisible(window)).toBeTruthy();
  });
});
