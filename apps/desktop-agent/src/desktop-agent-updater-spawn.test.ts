import type { ChildProcess } from "node:child_process";
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));
const updateRequest = () => ({
  expectedVersion: "0.1.19",
  expectedSha256: "a".repeat(64),
  expectedFileSize: 123_456,
  signaturePolicy: "optional" as const,
});

vi.mock("node:child_process", () => ({
  spawn: spawnMock,
}));

describe("desktop agent updater installer process", () => {
  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("starts the trusted manager update when manager path is configured", async () => {
    vi.stubEnv(
      "PROJECT_WING_AGENT_MANAGER_EXE_PATH",
      String.raw`C:\Agent\ProjectWing.AgentManager.exe`
    );
    const child = new EventEmitter() as ChildProcess;
    Object.defineProperty(child, "unref", {
      configurable: true,
      value: () => child,
      writable: true,
    });
    vi.spyOn(child, "unref").mockReturnValue(child);
    spawnMock.mockReturnValue(child);
    const { createDesktopAgentUpdater } =
      await import("./desktop-agent-updater.js");
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());

    await vi.waitFor(() => {
      expect(spawnMock).toHaveBeenCalledWith(
        String.raw`C:\Agent\ProjectWing.AgentManager.exe`,
        [
          "update",
          "--download-url",
          "http://localhost:3000/downloads/desktop-agent/windows/latest",
          "--expected-version",
          "0.1.19",
          "--expected-sha256",
          "a".repeat(64),
          "--expected-file-size",
          "123456",
          "--signature-policy",
          "optional",
        ],
        expect.objectContaining({
          detached: true,
          stdio: "ignore",
          windowsHide: true,
        })
      );
    });
    child.emit("spawn");
    await vi.waitFor(() => {
      expect(child.unref).toHaveBeenCalledOnce();
    });
  }, 15_000);

  it("turns installer spawn errors into a failed update task", async () => {
    vi.stubEnv(
      "PROJECT_WING_AGENT_MANAGER_EXE_PATH",
      String.raw`C:\Agent\ProjectWing.AgentManager.exe`
    );
    const child = new EventEmitter() as ChildProcess;
    Object.defineProperty(child, "unref", {
      configurable: true,
      value: () => child,
      writable: true,
    });
    vi.spyOn(child, "unref").mockReturnValue(child);
    spawnMock.mockReturnValue(child);
    const { createDesktopAgentUpdater } =
      await import("./desktop-agent-updater.js");
    const updater = createDesktopAgentUpdater({
      apiBaseUrl: "http://localhost:3000",
      downloadUrl:
        "http://localhost:3000/downloads/desktop-agent/windows/latest",
      sessionStore: {
        refresh: vi.fn().mockResolvedValue([]),
      },
      randomUUID: () => "update-task-1",
    });

    await updater.startUpdate(updateRequest());

    await vi.waitFor(() => {
      expect(child.listenerCount("error")).toBeGreaterThan(0);
    });
    child.emit("error", new Error("installer was blocked"));

    await vi.waitFor(() => {
      expect(updater.getCurrentUpdate()).toStrictEqual(
        expect.objectContaining({
          status: "FAILED",
          message: "installer was blocked",
        })
      );
    });
  });
});
