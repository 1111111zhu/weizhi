import path from "node:path";

import type { App } from "electron";
import { describe, expect, it, vi } from "vitest";

import {
  configureDesktopProtocolHandlers,
  hasDesktopAgentOpenRequest,
  parseDesktopAgentCommand,
  registerDesktopAgentProtocol,
} from "./desktop-protocol";

const installedCopy = vi.hoisted(() => ({ portable: false }));
vi.mock("velopack", () => ({
  UpdateManager: class {
    isPortable() {
      return installedCopy.portable;
    }
    getAppId() {
      return "com.superfx.projectwing.desktop-agent";
    }
    getCurrentVersion() {
      return "test";
    }
  },
}));

function createApp(hasLock: boolean) {
  const handlers = new Map<string, (...args: unknown[]) => void>();
  const app = {
    on: vi.fn((event: string, listener: (...args: unknown[]) => void) => {
      handlers.set(event, listener);
      return app;
    }),
    quit: vi.fn(),
    requestSingleInstanceLock: vi.fn(() => hasLock),
  } as unknown as App;
  return { app, handlers };
}

describe(configureDesktopProtocolHandlers, () => {
  it("opens manual launches while keeping explicit login and recovery launches quiet", () => {
    expect(
      hasDesktopAgentOpenRequest(["agent.exe", "projectwing-agent://open"])
    ).toBeTruthy();
    expect(
      hasDesktopAgentOpenRequest(["agent.exe", "projectwing-agent://start"])
    ).toBeTruthy();
    expect(hasDesktopAgentOpenRequest(["agent.exe"])).toBeTruthy();
    expect(
      hasDesktopAgentOpenRequest(["agent.exe", "--background"])
    ).toBeFalsy();
    expect(hasDesktopAgentOpenRequest(["agent.exe"], true)).toBeFalsy();
    expect(
      hasDesktopAgentOpenRequest(["agent.exe", "--veloapp-updated", "0.3.6"])
    ).toBeFalsy();
    expect(
      hasDesktopAgentOpenRequest([
        "agent.exe",
        "--background",
        "projectwing-agent://open",
      ])
    ).toBeTruthy();
    expect(
      hasDesktopAgentOpenRequest(
        ["agent.exe", "projectwing-agent://open"],
        true
      )
    ).toBeTruthy();
    expect(
      hasDesktopAgentOpenRequest(["agent.exe", "projectwing-agent://recover"])
    ).toBeFalsy();
    expect(
      hasDesktopAgentOpenRequest([
        "agent.exe",
        "projectwing-agent://open?run=command",
      ])
    ).toBeFalsy();
  });

  it("preserves a protocol handler belonging to another installed copy", async () => {
    const setAsDefaultProtocolClient = vi.fn();
    const app = {
      isPackaged: true,
      getVersion: () => "test",
      getApplicationNameForProtocol: () => "Desktop Agent",
      getApplicationInfoForProtocol: () =>
        Promise.resolve({
          path: path.resolve("other-install/ProjectWingDesktopAgent.exe"),
        }),
      setAsDefaultProtocolClient,
    } as unknown as App;
    await registerDesktopAgentProtocol(app);
    expect(setAsDefaultProtocolClient).not.toHaveBeenCalled();
  });

  it.runIf(process.platform === "win32")(
    "does not let a portable copy register over the installed application",
    async () => {
      installedCopy.portable = true;
      const setAsDefaultProtocolClient = vi.fn();
      try {
        await registerDesktopAgentProtocol({
          isPackaged: true,
          getVersion: () => "test",
          setAsDefaultProtocolClient,
        } as unknown as App);
        expect(setAsDefaultProtocolClient).not.toHaveBeenCalled();
      } finally {
        installedCopy.portable = false;
      }
    }
  );

  it("routes recovery separately from showing a window", () => {
    const { app, handlers } = createApp(true);
    const open = vi.fn();
    const recover = vi.fn();
    configureDesktopProtocolHandlers(app, open, recover);
    handlers.get("second-instance")?.({}, ["projectwing-agent://recover"]);
    expect(recover).toHaveBeenCalledOnce();
    expect(open).not.toHaveBeenCalled();
  });

  it("reveals the existing window on a normal second launch, without recovering or opening on background login", () => {
    const { app, handlers } = createApp(true);
    const open = vi.fn();
    const recover = vi.fn();
    configureDesktopProtocolHandlers(app, open, recover);
    handlers.get("second-instance")?.({}, ["agent.exe", "--background"]);
    expect(open).not.toHaveBeenCalled();
    handlers.get("second-instance")?.({}, ["agent.exe"]);
    expect(open).toHaveBeenCalledOnce();
    expect(recover).not.toHaveBeenCalled();
  });

  it.each([
    "projectwing-agent://recover?exe=evil",
    "projectwing-agent://recover/../start",
    "projectwing-agent://user@recover",
    "projectwing-agent://recover:99",
    "projectwing-agent://recover#command",
    "projectwing-agent://unknown",
    "file:///agent.exe",
  ])("rejects ambiguous protocol input %s", (url) => {
    expect(parseDesktopAgentCommand(url)).toBeNull();
  });

  it("opens the tray for protocol activations", () => {
    const { app, handlers } = createApp(true);
    const onOpen = vi.fn();
    const preventDefault = vi.fn();

    expect(configureDesktopProtocolHandlers(app, onOpen)).toBeTruthy();
    handlers.get("second-instance")?.({}, ["projectwing-agent://open"]);
    handlers.get("open-url")?.({ preventDefault }, "projectwing-agent://open");

    expect(onOpen).toHaveBeenCalledTimes(2);
    expect(preventDefault).toHaveBeenCalledOnce();
  });

  it("ignores unrelated protocol URLs", () => {
    const { app, handlers } = createApp(true);
    const onOpen = vi.fn();
    const preventDefault = vi.fn();

    configureDesktopProtocolHandlers(app, onOpen);
    handlers.get("second-instance")?.({}, ["https://emp.superfx.cn"]);
    handlers.get("open-url")?.({ preventDefault }, "https://emp.superfx.cn");

    expect(onOpen).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });

  it("quits duplicate application instances", () => {
    const { app } = createApp(false);

    expect(configureDesktopProtocolHandlers(app, vi.fn())).toBeFalsy();
    expect(app.quit).toHaveBeenCalledOnce();
  });
});
