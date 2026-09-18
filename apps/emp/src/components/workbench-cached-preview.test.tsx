import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { createElement } from "react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { api } from "@/api/client";
import type { Attachment } from "@/api/client";
import { openAuthorizedPreviewWindow } from "@/lib/open-preview-window";

import { CachedPdfViewerPreview } from "./workbench-cached-preview";

// @vitest-environment jsdom

vi.mock("@/components/extend/pdf-viewer", () => ({
  PDFViewer: ({
    fileName,
    toolbarActions,
    annotationProjectId,
  }: {
    fileName?: string;
    annotationProjectId?: string;
    toolbarActions?: ReactNode;
  }) =>
    createElement(
      "div",
      { "data-testid": "cached-smart-form-pdf-viewer", "data-project": annotationProjectId },
      fileName,
      toolbarActions
    ),
}));

vi.mock("@/components/extend/preview-panel-actions", () => ({
  PreviewPanelActions: ({
    expandLabel,
    exitExpandedLabel,
    isPreviewExpanded,
    onOpenInNewWindow,
    presentationLabel,
    onTogglePreviewExpanded,
    openInNewWindowLabel,
  }: {
    expandLabel: string;
    exitExpandedLabel: string;
    isPreviewExpanded: boolean;
    onOpenInNewWindow: () => void;
    onTogglePreviewExpanded?: () => void;
    openInNewWindowLabel: string;
    presentationLabel?: string;
  }) =>
    createElement(
      "div",
      null,
      onTogglePreviewExpanded
        ? createElement(
            "button",
            { type: "button", onClick: onTogglePreviewExpanded },
            isPreviewExpanded ? exitExpandedLabel : expandLabel
          )
        : null,
      presentationLabel
        ? createElement("button", { type: "button" }, presentationLabel)
        : null,
      createElement(
        "button",
        { type: "button", onClick: onOpenInNewWindow },
        openInNewWindowLabel
      )
    ),
}));

vi.mock("@/lib/open-preview-window", () => ({
  openAuthorizedPreviewWindow: vi.fn(() => Promise.resolve(true)),
}));

const copy = {
  loadingPreview: "Loading preview",
  download: "Download",
  fitToWidth: "Fit to width",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  expandLabel: "Expand preview",
  exitExpandedLabel: "Collapse to sidebar",
  presentationLabel: "Presentation mode",
  openInNewWindow: "Open in new window",
};
const attachment = {
  id: "attachment-smart-form-toolbar",
  fileKind: "SMART_FORM",
  fileName: "stored.sf",
  originalName: "audit-program.sf",
  version: 3,
  contentHash: "smart-form-toolbar-hash",
} as Attachment;

function renderPreview({ inSidebar = true }: { inSidebar?: boolean } = {}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const preview = createElement(CachedPdfViewerPreview, {
    projectId: "project-1",
    attachment,
    copy,
  });

  return render(
    createElement(
      QueryClientProvider,
      { client },
      inSidebar
        ? createElement(
            "div",
            { "data-testid": "file-preview-dropzone" },
            preview
          )
        : preview
    )
  );
}

describe("cachedPdfViewerPreview Smart Form toolbar", () => {
  beforeEach(() => {
    vi.spyOn(api, "previewAttachmentPdf").mockResolvedValue(
      new Blob(["pdf"], { type: "application/pdf" })
    );
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: vi.fn(() => "blob:smart-form-preview"),
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("shows the same expand and new-window actions as PDF in the sidebar preview", async () => {
    renderPreview();

    await expect(
      screen.findByTestId("cached-smart-form-pdf-viewer")
    ).resolves.toHaveTextContent("audit-program.pdf");
    const expand = await screen.findByRole("button", {
      name: "Expand preview",
    });
    expect(
      screen.getByRole("button", { name: "Open in new window" })
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Presentation mode" })
    ).toBeTruthy();

    fireEvent.click(expand);

    await expect(
      screen.findByRole("button", { name: "Collapse to sidebar" })
    ).resolves.toBeTruthy();
    await waitFor(() => {
      expect(
        document.querySelector('[data-preview-expanded="true"]')
      ).toBeTruthy();
    });
  });

  it("keeps the new-window action but omits sidebar expansion outside the sidebar preview", async () => {
    renderPreview({ inSidebar: false });

    await screen.findByTestId("cached-smart-form-pdf-viewer");
    expect(
      screen.getByRole("button", { name: "Open in new window" })
    ).toBeTruthy();
  });

  it("uses the authorized blob handoff when native PDF reading is disabled", async () => {
    const windowOpen = vi.spyOn(window, "open").mockReturnValue(null);
    renderPreview();

    await screen.findByTestId("cached-smart-form-pdf-viewer");
    fireEvent.click(screen.getByRole("button", { name: "Open in new window" }));

    await waitFor(() => {
      expect(openAuthorizedPreviewWindow).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName: "audit-program.pdf",
          mimeType: "application/pdf",
        })
      );
    });
    expect(windowOpen).not.toHaveBeenCalled();
  });
});
