import { describe, expect, it, vi } from "vitest";
// @vitest-environment happy-dom

import {
  getPreviewChannelName,
  openAuthorizedPreviewWindow,
} from "./open-preview-window";

class MockBroadcastChannel {
  static instances: MockBroadcastChannel[] = [];
  close = vi.fn();
  postMessage = vi.fn();
  private readonly listeners: ((event: MessageEvent<unknown>) => void)[] = [];

  constructor(readonly name: string) {
    MockBroadcastChannel.instances.push(this);
  }

  addEventListener(
    type: string,
    listener: (event: MessageEvent<unknown>) => void
  ) {
    if (type === "message") {
      this.listeners.push(listener);
    }
  }

  emit(event: MessageEvent<unknown>) {
    for (const listener of this.listeners) {
      listener(event);
    }
  }
}

describe(openAuthorizedPreviewWindow, () => {
  it("hands an authorized blob to the detached preview page", async () => {
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    vi.stubGlobal("crypto", { randomUUID: () => "preview-nonce" });
    const previewWindow = {
      close: vi.fn(),
      opener: window,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(previewWindow);
    const loadBlob = vi.fn(() => new Blob(["file"]));
    const result = openAuthorizedPreviewWindow({
      fileName: "ledger.xlsx",
      projectId: "project-a",
      loadBlob,
      mimeType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const [channel] = MockBroadcastChannel.instances;
    channel.emit({
      data: { nonce: "preview-nonce", type: "ready" },
    } as MessageEvent);
    await vi.waitFor(() => expect(channel.postMessage).toHaveBeenCalledOnce());
    channel.emit({
      data: { nonce: "preview-nonce", type: "received" },
    } as MessageEvent);

    await expect(result).resolves.toBeTruthy();
    expect(previewWindow.opener).toBeNull();
    expect(channel.name).toBe(getPreviewChannelName("preview-nonce"));
    expect(channel.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({ fileName: "ledger.xlsx", type: "file", projectId: "project-a" })
    );
  });
});
