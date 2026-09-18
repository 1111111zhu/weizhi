import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ManagedRuntimeHost } from "./managed-runtime-host";
import { createUpdateController } from "./update-controller";

const updateMocks = vi.hoisted(() => ({
  check: vi.fn(),
  download: vi.fn(),
  apply: vi.fn(),
  pending: vi.fn(),
  dialog: vi.fn(),
}));
vi.mock("electron", () => ({ dialog: { showMessageBox: updateMocks.dialog } }));
vi.mock("velopack", () => ({
  UpdateManager: class {
    checkForUpdatesAsync = updateMocks.check;
    downloadUpdateAsync = updateMocks.download;
    waitExitThenApplyUpdate = updateMocks.apply;
    getUpdatePendingRestart = updateMocks.pending;
  },
}));

const release = {
  TargetFullRelease: { Version: "0.3.99", SHA256: "a".repeat(64) },
};
const options = {
  appDataPath: "unused-mocked-path",
  appVersion: "0.3.0",
  isPackaged: false,
  platform: "win32" as const,
  resourcesPath: "unused-mocked-path",
};

// Regression coverage uses only mock I/O; no installed application is used.
describe("adversarial installation/recovery review", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    updateMocks.check.mockResolvedValue(release);
    updateMocks.download.mockResolvedValue(null);
    updateMocks.dialog.mockResolvedValue({ response: 0 });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("adopts the same installation's recovered Manager and confirms its shutdown", async () => {
    let stopped = false;
    const fetcher = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") {
        stopped = true;
        return new Response(null, { status: 202 });
      }
      if (stopped) {
        throw new TypeError("refused", { cause: { code: "ECONNREFUSED" } });
      }
      return Response.json({
        app: "project-wing-desktop-runtime",
        agentState: "READY",
        version: "0.3.0",
        managerPid: 12_345,
        managerInstanceId: "recovery-only-owner",
        appDirectory: path.resolve(options.resourcesPath, "DesktopRuntime"),
        stateRoot: path.resolve(
          options.appDataPath,
          "ProjectWing",
          "AgentState"
        ),
      });
    });
    vi.stubGlobal("fetch", fetcher);
    const host = new ManagedRuntimeHost(options);
    await host.start();
    await host.stop();
    expect(stopped).toBeTruthy();
  });

  it("does not arm an update when the active Manager is not verifiably owned", async () => {
    const fetcher = vi.fn(() =>
      Response.json({
        app: "project-wing-desktop-runtime",
        agentState: "READY",
        version: "0.3.0",
      })
    );
    vi.stubGlobal("fetch", fetcher);
    const host = new ManagedRuntimeHost(options);
    await host.start();
    const quit = vi.fn();
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: vi.fn(),
      quit,
      stopRuntime: () => host.stop(),
    });
    await expect(controller.apply()).rejects.toThrow(
      "has not confirmed shutdown"
    );
    expect(updateMocks.apply).not.toHaveBeenCalled();
    expect(quit).not.toHaveBeenCalled();
  });

  it("keeps normal operation and resumes service when launching the updater throws", async () => {
    updateMocks.apply.mockImplementation(() => {
      throw new Error("updater unavailable");
    });
    let quitting = false;
    const stopRuntime = vi.fn();
    const quit = vi.fn();
    const resumeRuntime = vi.fn(() => Promise.resolve());
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: () => {
        quitting = true;
      },
      quit,
      stopRuntime,
      resumeRuntime,
    });
    await expect(controller.apply()).rejects.toThrow("updater unavailable");
    expect(quitting).toBeFalsy();
    expect(stopRuntime).toHaveBeenCalledOnce();
    expect(resumeRuntime).toHaveBeenCalledOnce();
    expect(quit).not.toHaveBeenCalled();
  });

  it("coalesces concurrent update applications", async () => {
    const stopRuntime = vi.fn(() => Promise.resolve());
    const quit = vi.fn();
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: vi.fn(),
      quit,
      stopRuntime,
    });
    await Promise.all([controller.apply(), controller.apply()]);
    expect(updateMocks.download).toHaveBeenCalledOnce();
    expect(updateMocks.apply).toHaveBeenCalledOnce();
    expect(stopRuntime).toHaveBeenCalledOnce();
    expect(quit).toHaveBeenCalledOnce();
  });

  it("coalesces duplicate check dialogs and shares their update transaction", async () => {
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: vi.fn(),
      quit: vi.fn(),
      stopRuntime: () => Promise.resolve(),
    });
    await Promise.all([
      controller.check(true),
      controller.check(true),
      controller.apply(),
    ]);
    expect(updateMocks.dialog).toHaveBeenCalledOnce();
    expect(updateMocks.apply).toHaveBeenCalledOnce();
  });

  it("keeps the maintenance lease through stop and verified updater handoff", async () => {
    const events: string[] = [];
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: () => {
        events.push("quitting");
      },
      quit: () => {
        events.push("quit");
      },
      stopRuntime: () => {
        events.push("stop");
        return Promise.resolve();
      },
      prepareUpdate: () => {
        events.push("prepare");
        return Promise.resolve({
          commit: () => {
            events.push("commit");
            return Promise.resolve();
          },
          cancel: () => {
            events.push("cancel");
            return Promise.resolve();
          },
        });
      },
    });
    await controller.apply();
    expect(events).toStrictEqual([
      "prepare",
      "stop",
      "commit",
      "quitting",
      "quit",
    ]);
    expect(updateMocks.apply).not.toHaveBeenCalled();
  });

  it("can find an already downloaded update without requiring another network check", async () => {
    updateMocks.pending.mockReturnValue(release.TargetFullRelease);
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      onBeforeQuit: vi.fn(),
      quit: vi.fn(),
      stopRuntime: () => Promise.resolve(),
    });
    await controller.apply();
    expect(updateMocks.check).not.toHaveBeenCalled();
    expect(updateMocks.apply).toHaveBeenCalledOnce();
  });

  it("localizes native update decisions without depending on the renderer", async () => {
    updateMocks.dialog.mockResolvedValue({ response: 1 });
    const controller = createUpdateController({
      isPackaged: true,
      updateUrl: "https://unused.invalid/releases",
      getLocale: () => "zh-CN",
      onBeforeQuit: vi.fn(),
      quit: vi.fn(),
      stopRuntime: () => Promise.resolve(),
    });
    await controller.check(true);
    expect(updateMocks.dialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ buttons: ["下载并重启", "稍后"] })
    );
    updateMocks.check.mockResolvedValue(null);
    await controller.check(true);
    expect(updateMocks.dialog).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: "Desktop Agent 已是最新版本。" })
    );
  });
});
