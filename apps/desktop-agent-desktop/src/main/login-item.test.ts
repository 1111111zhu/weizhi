import type { App } from "electron";
import { describe, expect, it, vi } from "vitest";

import { configureMacLoginItem } from "./login-item";

function createApp(isPackaged = true) {
  return {
    isPackaged,
    setLoginItemSettings: vi.fn(),
  } as unknown as App;
}

describe("configureLoginItem", () => {
  it("registers packaged macOS startup", () => {
    const app = createApp();

    configureMacLoginItem(app, "darwin");

    expect(app.setLoginItemSettings).toHaveBeenCalledWith({
      openAsHidden: true,
      openAtLogin: true,
    });
  });

  it("does not register startup for unpackaged or unsupported hosts", () => {
    const unpackaged = createApp(false);
    const linux = createApp();

    configureMacLoginItem(unpackaged, "darwin");
    configureMacLoginItem(linux, "win32");

    expect(unpackaged.setLoginItemSettings).not.toHaveBeenCalled();
    expect(linux.setLoginItemSettings).not.toHaveBeenCalled();
  });
});
