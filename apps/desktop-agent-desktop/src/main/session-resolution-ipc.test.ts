import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { configureDesktopAgentIpc } from "./desktop-agent-ipc";

const mocks = vi.hoisted(() => ({
  handlers: new Map<
    string,
    (event: unknown, sessionId?: unknown) => Promise<unknown>
  >(),
  dialog: vi.fn(),
  window: { minimize: vi.fn() },
}));
vi.mock("electron", () => ({
  app: { getLocale: () => "en-US" },
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, sessionId?: unknown) => Promise<unknown>
    ) => mocks.handlers.set(name, handler),
  },
  BrowserWindow: { fromWebContents: () => mocks.window },
  dialog: { showMessageBox: mocks.dialog },
  shell: {},
}));

describe("confirmed session resolution", () => {
  afterEach(() => vi.unstubAllEnvs());
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.handlers.clear();
    vi.stubEnv("ELECTRON_RENDERER_URL", "");
  });
  function fixture() {
    const runtime = {
      cacheSettings: vi
        .fn()
        .mockResolvedValue({
          cacheRoot: "C:/fixture",
          maxBytes: 2048,
          usedBytes: 512,
          evictionPolicy: "LRU",
          idleDays: 30,
        }),
      cacheFiles: vi.fn().mockResolvedValue({
        usedBytes: 12,
        files: [
          {
            id: "cache-id",
            fileName: "cached.pdf",
            size: 12,
            canDelete: true,
          },
        ],
      }),
      deleteCacheFile: vi.fn().mockResolvedValue({ usedBytes: 0, files: [] }),
      snapshot: vi.fn().mockResolvedValue({ sessions: [] }),
      endTracking: vi.fn().mockResolvedValue({ sessions: [] }),
      saveCacheSettings: vi.fn().mockResolvedValue({
        cacheRoot: "C:/fixture",
        maxBytes: 1024,
        evictionPolicy: "FIFO",
        idleDays: 7,
      }),
    };
    configureDesktopAgentIpc({
      runtime,
      refreshTray: vi.fn(),
      showWindow: vi.fn(),
      updateController: {},
    } as never);
    return {
      runtime,
      invoke: mocks.handlers.get("desktop-agent:end-tracking")!,
      event: { senderFrame: { url: "file:///fixture/index.html" }, sender: {} },
    };
  }
  it("defaults to cancellation without mutating the session", async () => {
    const { runtime, invoke, event } = fixture();
    mocks.dialog.mockResolvedValue({ response: 0 });
    await invoke(event, "missing");
    expect(runtime.endTracking).not.toHaveBeenCalled();
    expect(mocks.dialog).toHaveBeenCalledWith(
      mocks.window,
      expect.objectContaining({ defaultId: 0, cancelId: 0 })
    );
  });
  it("passes explicit replacement and idle settings through the trusted boundary", async () => {
    const { runtime, event } = fixture();
    const settings = {
      cacheRoot: "C:/fixture",
      maxBytes: 1024,
      evictionPolicy: "FIFO",
      idleDays: 7,
    };
    await mocks.handlers.get("desktop-agent:save-cache-settings")!(
      event,
      settings
    );
    expect(runtime.saveCacheSettings).toHaveBeenCalledExactlyOnceWith(settings);
  });
  it("cancels an over-capacity reduction without persisting settings", async () => {
    const { runtime, event } = fixture();
    runtime.cacheSettings.mockResolvedValue({
      cacheRoot: "C:/fixture",
      maxBytes: 2048,
      usedBytes: 1536,
      evictionPolicy: "LRU",
      idleDays: 30,
    });
    mocks.dialog.mockResolvedValue({ response: 0 });
    const result = await mocks.handlers.get(
      "desktop-agent:save-cache-settings"
    )!(event, {
      cacheRoot: "C:/fixture",
      maxBytes: 1024,
      evictionPolicy: "FIFO",
      idleDays: 7,
    });
    expect(result).toMatchObject({ cancelled: true, maxBytes: 2048 });
    expect(runtime.saveCacheSettings).not.toHaveBeenCalled();
    expect(mocks.dialog).toHaveBeenCalledWith(
      mocks.window,
      expect.objectContaining({
        defaultId: 0,
        detail: expect.stringContaining("FIFO"),
      })
    );
  });
  it("passes a confirmation only after the user accepts the reduction", async () => {
    const { runtime, event } = fixture();
    runtime.cacheSettings.mockResolvedValue({
      cacheRoot: "C:/fixture",
      maxBytes: 2048,
      usedBytes: 1536,
      evictionPolicy: "LRU",
      idleDays: 30,
    });
    mocks.dialog.mockResolvedValue({ response: 1 });
    const settings = {
      cacheRoot: "C:/fixture",
      maxBytes: 1024,
      evictionPolicy: "FIFO",
      idleDays: 7,
    };
    await mocks.handlers.get("desktop-agent:save-cache-settings")!(
      event,
      settings
    );
    expect(runtime.saveCacheSettings).toHaveBeenCalledExactlyOnceWith(
      settings,
      true
    );
  });
  it.each([
    { evictionPolicy: "UNKNOWN", idleDays: 30 },
    { evictionPolicy: "LRU", idleDays: 0 },
  ])(
    "rejects invalid policy settings before native persistence: %j",
    (invalid) => {
      const { runtime, event } = fixture();
      expect(() =>
        mocks.handlers.get("desktop-agent:save-cache-settings")!(event, {
          cacheRoot: "C:/fixture",
          maxBytes: 1024,
          ...invalid,
        })
      ).toThrow();
      expect(runtime.saveCacheSettings).not.toHaveBeenCalled();
    }
  );
  it("requires explicit confirmation and revalidation in the main process", async () => {
    const { runtime, invoke, event } = fixture();
    mocks.dialog.mockResolvedValue({ response: 1 });
    await invoke(event, "missing");
    expect(runtime.endTracking).toHaveBeenCalledExactlyOnceWith("missing");
  });
  it("does not show a privileged confirmation to an untrusted renderer", async () => {
    const { runtime, invoke } = fixture();
    await expect(
      invoke({ senderFrame: { url: "https://untrusted.invalid" } }, "missing")
    ).rejects.toThrow("Untrusted");
    expect(runtime.endTracking).not.toHaveBeenCalled();
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
  it("does not delete cached files when confirmation is cancelled", async () => {
    const { runtime, event } = fixture();
    mocks.dialog.mockResolvedValue({ response: 0 });
    await mocks.handlers.get("desktop-agent:delete-cache-file")!(
      event,
      "cache-id"
    );
    expect(runtime.deleteCacheFile).not.toHaveBeenCalled();
  });
  it("deletes only the freshly selected cache id after confirmation", async () => {
    const { runtime, event } = fixture();
    mocks.dialog.mockResolvedValue({ response: 1 });
    await mocks.handlers.get("desktop-agent:delete-cache-file")!(
      event,
      "cache-id"
    );
    expect(runtime.deleteCacheFile).toHaveBeenCalledExactlyOnceWith("cache-id");
  });
  it("rejects protected files even if the renderer asks to delete them", async () => {
    const { runtime, event } = fixture();
    runtime.cacheFiles.mockResolvedValue({
      usedBytes: 12,
      files: [
        { id: "cache-id", fileName: "cached.pdf", size: 12, canDelete: false },
      ],
    });
    await expect(
      mocks.handlers.get("desktop-agent:delete-cache-file")!(event, "cache-id")
    ).rejects.toThrow("in use");
    expect(runtime.deleteCacheFile).not.toHaveBeenCalled();
    expect(mocks.dialog).not.toHaveBeenCalled();
  });
});
