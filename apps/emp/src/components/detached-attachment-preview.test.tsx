import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
// @vitest-environment-options {"url":"http://localhost:3001/zh-CN/preview"}

import {
  DetachedAttachmentPreview,
  resolveTrustedOpenerOrigin,
} from "./detached-attachment-preview";

vi.mock("./extend/csv-viewer", () => ({
  CsvViewer: ({ className }: { className?: string }) => (
    <div data-testid="csv-viewer" className={className} />
  ),
}));
vi.mock("./extend/docx-viewer", () => ({
  DocxViewerPreview: ({ className }: { className?: string }) => (
    <div data-testid="docx-viewer" className={className} />
  ),
}));
vi.mock("./extend/document-asset-viewer", () => ({
  DocumentAssetViewer: ({ kind }: { kind: string }) => (
    <div data-testid={`${kind}-viewer`} />
  ),
}));
vi.mock("./extend/pdf-viewer", () => ({
  PDFViewer: ({ className, annotationProjectId }: { className?: string; annotationProjectId?: string }) => (
    <div data-testid="pdf-viewer" className={className} data-project={annotationProjectId} />
  ),
}));
vi.mock("./extend/pptx-viewer", () => ({
  PptxViewerPreview: ({ className }: { className?: string }) => (
    <div data-testid="pptx-viewer" className={className} />
  ),
}));
vi.mock("./extend/xlsx-viewer", () => ({
  XlsxViewerPreview: ({ className }: { className?: string }) => (
    <div data-testid="xlsx-viewer" className={className} />
  ),
}));

class MockBroadcastChannel {
  static latest: MockBroadcastChannel | null = null;
  onmessage: ((event: MessageEvent<unknown>) => void) | null = null;
  location = { origin: "http://localhost:3001" };
  postMessage = vi.fn();
  close = vi.fn();

  addEventListener(
    _type: string,
    listener: (event: MessageEvent<unknown>) => void
  ) {
    this.onmessage = listener;
  }

  removeEventListener() {
    this.onmessage = null;
  }

  constructor(public name: string) {
    MockBroadcastChannel.latest = this;
  }
}

function stubObjectUrl(
  createObjectURL: () => string,
  revokeObjectURL: () => void
) {
  const mockedUrl = new Proxy(URL, {
    get(target, property, receiver) {
      if (property === "createObjectURL") {
        return createObjectURL;
      }
      if (property === "revokeObjectURL") {
        return revokeObjectURL;
      }
      return Reflect.get(target, property, receiver);
    },
  });
  vi.stubGlobal("URL", mockedUrl);
}

describe(DetachedAttachmentPreview, () => {
  beforeEach(() => {
    MockBroadcastChannel.latest = null;
    vi.stubGlobal("BroadcastChannel", MockBroadcastChannel);
    stubObjectUrl(
      vi.fn(() => "blob:detached-preview"),
      vi.fn()
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("stretches the detached document viewer to the full viewport", () => {
    const { container: _unused_container } = render(
      <DetachedAttachmentPreview nonce="preview-nonce" />
    );
    const channel = MockBroadcastChannel.latest;
    expect(channel).not.toBeNull();

    act(() => {
      channel?.onmessage?.({
        data: {
          nonce: "preview-nonce",
          type: "file",
          blob: new Blob(["docx"]),
          fileName: "confirmation.docx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        },
      } as MessageEvent<unknown>);
    });
  });

  it("preserves the authorized project context when opening a PDF in a new window", () => {
    render(<DetachedAttachmentPreview nonce="preview-nonce" />);
    act(()=>MockBroadcastChannel.latest?.onmessage?.({data:{nonce:"preview-nonce",type:"file",blob:new Blob(["pdf"]),fileName:"notes.pdf",mimeType:"application/pdf",projectId:"project-a"}} as MessageEvent<unknown>));
    expect(screen.getByTestId("pdf-viewer").getAttribute("data-project")).toBe("project-a");
  });

  it("accepts an authorized cross-app CMP handoff", async () => {
    const opener = window;
    const postMessage = vi
      .spyOn(opener, "postMessage")
      .mockImplementation(() => {});
    Object.defineProperty(window, "opener", {
      configurable: true,
      value: opener,
    });
    expect(window.opener).toBe(opener);
    expect(resolveTrustedOpenerOrigin("http://localhost:3002")).toBe(
      "http://localhost:3002"
    );
    render(
      <DetachedAttachmentPreview
        nonce="preview-nonce"
        sourceOrigin="http://localhost:3002"
      />
    );
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        { nonce: "preview-nonce", type: "ready" },
        "http://localhost:3002"
      )
    );

    act(() => {
      const message = new MessageEvent("message", {
        data: {
          nonce: "preview-nonce",
          type: "file",
          blob: new Blob(["xlsx"]),
          fileName: "aml-search.xlsx",
          mimeType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
      });
      Object.defineProperties(message, {
        origin: { value: "http://localhost:3002" },
        source: { value: opener },
      });
      window.dispatchEvent(message);
    });

    await expect(
      screen.findByTestId("xlsx-viewer")
    ).resolves.toBeInTheDocument();
    expect(postMessage).toHaveBeenCalledWith(
      { nonce: "preview-nonce", type: "received" },
      "http://localhost:3002"
    );
  });

  it("renders images received by the detached preview window", async () => {
    render(<DetachedAttachmentPreview nonce="image-preview" />);
    const channel = MockBroadcastChannel.latest;

    act(() => {
      channel?.onmessage?.({
        data: {
          nonce: "image-preview",
          type: "file",
          blob: new Blob(["image"], { type: "image/png" }),
          fileName: "evidence.png",
          mimeType: "image/png",
        },
      } as MessageEvent<unknown>);
    });

    await expect(
      screen.findByTestId("image-viewer")
    ).resolves.toBeInTheDocument();
  });
});
