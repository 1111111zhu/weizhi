import { afterEach, describe, expect, it, vi } from "vitest";

import { openAuthorizedPreviewWindow } from "./open-preview-window";

describe(openAuthorizedPreviewWindow, () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("hands the original Excel blob to the unified detached viewer", async () => {
    vi.stubGlobal("crypto", { randomUUID: () => "preview-nonce" });
    const previewWindow = {
      close: vi.fn(),
      opener: window,
    } as unknown as Window;
    vi.spyOn(window, "open").mockReturnValue(previewWindow);
    const channels: {
      addEventListener: (
        type: string,
        listener: (event: MessageEvent<unknown>) => void
      ) => void;
      close: ReturnType<typeof vi.fn>;
      postMessage: ReturnType<typeof vi.fn>;
      removeEventListener: (
        type: string,
        listener: (event: MessageEvent<unknown>) => void
      ) => void;
      dispatchMessage: (event: MessageEvent<unknown>) => void;
    }[] = [];
    vi.stubGlobal(
      "BroadcastChannel",
      class {
        close = vi.fn();
        listeners: ((event: MessageEvent<unknown>) => void)[] = [];
        postMessage = vi.fn();
        addEventListener(
          type: string,
          listener: (event: MessageEvent<unknown>) => void
        ) {
          if (type === "message") {
            this.listeners.push(listener);
          }
        }
        removeEventListener(
          type: string,
          listener: (event: MessageEvent<unknown>) => void
        ) {
          if (type === "message") {
            this.listeners = this.listeners.filter(
              (candidate) => candidate !== listener
            );
          }
        }
        dispatchMessage(event: MessageEvent<unknown>) {
          for (const listener of this.listeners) {
            listener(event);
          }
        }
        constructor() {
          channels.push(this);
        }
      }
    );
    const workbook = new Blob(["xlsx"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const result = openAuthorizedPreviewWindow({
      fileName: "aml-search.xlsx",
      loadBlob: () => Promise.resolve(workbook),
      mimeType: workbook.type,
    });
    channels[0]?.dispatchMessage(
      new MessageEvent("message", {
        data: { nonce: "preview-nonce", type: "ready" },
      })
    );
    await vi.waitFor(() =>
      expect(channels[0]?.postMessage).toHaveBeenCalledOnce()
    );
    channels[0]?.dispatchMessage(
      new MessageEvent("message", {
        data: { nonce: "preview-nonce", type: "received" },
      })
    );

    await expect(result).resolves.toBeTruthy();
    expect(window.open).toHaveBeenCalledWith(
      "http://localhost:3000/en-US/preview?nonce=preview-nonce",
      "_blank"
    );
    expect(channels[0]?.postMessage).toHaveBeenCalledWith({
      blob: workbook,
      fileName: "aml-search.xlsx",
      mimeType: workbook.type,
      nonce: "preview-nonce",
      type: "file",
    });
  });
});
