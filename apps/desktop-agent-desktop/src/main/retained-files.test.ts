import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  configureDesktopAgentIpc,
  openRetainedFilesDirectory,
} from "./desktop-agent-ipc";
import { DesktopAgentRuntimeClient } from "./runtime-client";

const mocks = vi.hoisted(() => ({
  openPath: vi.fn(),
  realpath: vi.fn(),
  stat: vi.fn(),
  handle: vi.fn(),
}));
vi.mock("electron", () => ({
  ipcMain: { handle: mocks.handle },
  shell: { openPath: mocks.openPath },
}));
vi.mock("node:fs/promises", () => ({
  realpath: mocks.realpath,
  stat: mocks.stat,
}));

describe("retained local files recovery", () => {
  const directory = path.resolve("synthetic", "controlled-cache");
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.realpath.mockImplementation((value: string) =>
      Promise.resolve(value)
    );
    mocks.stat.mockResolvedValue({ isDirectory: () => true });
    mocks.openPath.mockResolvedValue("");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("IPC ignores caller-provided paths and rejects untrusted renderer requests", async () => {
    vi.stubEnv("ELECTRON_RENDERER_URL", "");
    const retainedFilesDirectory = vi.fn().mockResolvedValue(directory);
    configureDesktopAgentIpc({
      runtime: { retainedFilesDirectory },
      updateController: {},
      refreshTray: vi.fn(() => Promise.resolve()),
      showWindow: vi.fn(),
    } as unknown as Parameters<typeof configureDesktopAgentIpc>[0]);
    const registration = mocks.handle.mock.calls.find(
      ([name]) => name === "desktop-agent:open-retained-files"
    );
    const invoke = registration?.[1] as (
      event: unknown,
      ...args: unknown[]
    ) => Promise<void>;
    await expect(
      invoke({ senderFrame: { url: "https://untrusted.test" } }, "/evil")
    ).rejects.toThrow("Untrusted IPC sender");
    expect(retainedFilesDirectory).not.toHaveBeenCalled();
    await invoke(
      { senderFrame: { url: "file:///renderer/index.html" } },
      "/evil"
    );
    expect(mocks.openPath).toHaveBeenCalledExactlyOnceWith(directory);
  });

  it("opens only the confirmed existing directory without launching files", async () => {
    await openRetainedFilesDirectory(directory);
    expect(mocks.openPath).toHaveBeenCalledExactlyOnceWith(directory);
  });

  it.each([
    "relative",
    "https://example.test",
    "\\\\server\\share",
    path.parse(path.resolve(".")).root,
  ])("rejects unsafe target %s", async (target) => {
    await expect(openRetainedFilesDirectory(target)).rejects.toThrow(
      "not a confirmed local folder"
    );
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it("rejects symlink redirection and non-directory targets", async () => {
    mocks.realpath.mockResolvedValue(path.resolve("other"));
    await expect(openRetainedFilesDirectory(directory)).rejects.toThrow(
      "not a confirmed local folder"
    );
    mocks.realpath.mockResolvedValue(directory);
    mocks.stat.mockResolvedValue({ isDirectory: () => false });
    await expect(openRetainedFilesDirectory(directory)).rejects.toThrow(
      "not a confirmed local folder"
    );
    expect(mocks.openPath).not.toHaveBeenCalled();
  });

  it("reports the file manager failure instead of claiming success", async () => {
    mocks.openPath.mockResolvedValue("Failed to open");
    await expect(openRetainedFilesDirectory(directory)).rejects.toThrow(
      "could not open"
    );
  });

  it.each(["valid", "foreign", "changed", "bad-settings"])(
    "checks native settings and generation: %s",
    async (mode) => {
      let healthReads = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn((input: string | URL | Request) => {
          if (String(input).endsWith("/cache/settings")) {
            return Promise.resolve(
              Response.json({
                ok: mode !== "bad-settings",
                cacheRoot: directory,
              })
            );
          }
          healthReads += 1;
          return Promise.resolve(
            Response.json({
              ok: true,
              app:
                mode === "foreign"
                  ? "another-app"
                  : "project-wing-desktop-runtime",
              managerInstanceId:
                mode === "changed" ? `manager-${healthReads}` : "manager-1",
              agentState: "READY_WITH_ATTENTION",
            })
          );
        })
      );
      const result = await new DesktopAgentRuntimeClient()
        .retainedFilesDirectory()
        .then(
          (value) => value,
          (error: Error) => error.message
        );
      expect(result).toBe(
        mode === "valid"
          ? directory
          : "The local recovery folder could not be confirmed. Recover the local service and retry; no files were changed."
      );
      expect(mocks.openPath).not.toHaveBeenCalled();
    }
  );
});
