import { afterEach, describe, expect, it, vi } from "vitest";

import { copyPreviewBlobToClipboard } from "./preview-file-actions";

describe(copyPreviewBlobToClipboard, () => {
  afterEach(() => vi.unstubAllGlobals());

  it("writes text previews directly to the system clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(null as never);
    vi.stubGlobal("navigator", { clipboard: { writeText } });

    await copyPreviewBlobToClipboard(
      new Blob(["ignored"], { type: "text/plain" }),
      "notes.md",
      "copied preview text"
    );

    expect(writeText).toHaveBeenCalledWith("copied preview text");
  });

  it("writes image previews as a native PNG clipboard item", async () => {
    const write = vi.fn().mockResolvedValue(null as never);
    class ClipboardItemMock {
      constructor(readonly data: Record<string, Blob>) {}
    }
    vi.stubGlobal("navigator", { clipboard: { write } });
    vi.stubGlobal("ClipboardItem", ClipboardItemMock);

    await copyPreviewBlobToClipboard(new Blob(["png bytes"]), "evidence.png");

    const item = write.mock.calls[0]?.[0]?.[0] as ClipboardItemMock;
    expect(item.data["image/png"]).toHaveProperty("type", "image/png");
  });

  it("does not fall back to a text data URL for binary previews", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    vi.stubGlobal("ClipboardItem", globalThis.ClipboardItem);

    await expect(
      copyPreviewBlobToClipboard(new Blob(["binary"]), "preview.bin")
    ).rejects.toThrow("Clipboard write is unavailable");

    expect(writeText).not.toHaveBeenCalled();
  });
});
