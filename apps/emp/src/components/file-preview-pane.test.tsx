import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
// @vitest-environment jsdom
import { cleanup, render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BlobFilePreviewPane, getFilePreviewKind } from "./file-preview-pane";

const errorToast = vi.hoisted(() => vi.fn());
vi.mock("@/lib/error-toast", () => ({
  showErrorToast: errorToast,
}));

vi.mock("./extend/docx-viewer", () => ({
  DocxViewerPreview: ({
    fileName,
    renderPageOverlay,
  }: {
    fileName: string;
    renderPageOverlay?: (input: { pageNumber: number }) => ReactNode;
  }) => {
    if (fileName === "damaged.docx") {
      throw new Error("Malformed DOCX package");
    }
    return (
      <div data-testid="docx-preview">
        {renderPageOverlay?.({ pageNumber: 1 })}
      </div>
    );
  },
}));

vi.mock("./extend/pdf-viewer", () => ({
  PDFViewer: ({
    renderPageOverlay,
  }: {
    renderPageOverlay?: (input: { pageNumber: number }) => ReactNode;
  }) => (
    <div data-testid="pdf-preview">
      {renderPageOverlay?.({ pageNumber: 1 })}
    </div>
  ),
}));

vi.mock("./extend/document-asset-viewer", () => ({
  DocumentAssetViewer: ({
    fileName,
    kind,
    sourceUrl,
  }: {
    fileName: string;
    kind: string;
    sourceUrl: string;
  }) => (
    // The mock keeps this test focused on file routing and blob loading.
    // eslint-disable-next-line @next/next/no-img-element
    <img alt={fileName} data-preview-kind={kind} src={sourceUrl} />
  ),
}));

describe(BlobFilePreviewPane, () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
    vi.spyOn(URL, "revokeObjectURL").mockReturnValue();
    vi.spyOn(console, "error").mockReturnValue();
    errorToast.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("contains a viewer runtime failure instead of crashing the library page", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <BlobFilePreviewPane
          ariaLabel="Template preview"
          fileName="damaged.docx"
          queryKey={["template-preview", "damaged"]}
          loadFile={() => Promise.resolve(new Blob(["damaged"]))}
        />
      </QueryClientProvider>
    );

    const alert = await screen.findByRole("alert");
    expect(within(alert).getByRole("button", { name: "Retry" })).toBeVisible();
    expect(alert).not.toHaveTextContent("Malformed DOCX package");
    expect(errorToast).toHaveBeenCalledWith(
      expect.any(Error),
      "Preview could not be loaded"
    );
  });

  it.each([
    ["evidence.png", ""],
    ["photo.JPEG", ""],
    ["capture", "image/webp"],
    ["diagram.svg", "application/octet-stream"],
  ])("routes %s (%s) to image preview", (fileName, mimeType) => {
    expect(getFilePreviewKind(fileName, mimeType)).toBe("image");
  });

  it("renders an image blob in the common preview pane", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <BlobFilePreviewPane
          ariaLabel="Evidence preview"
          fileName="evidence.png"
          mimeType="image/png"
          queryKey={["evidence-preview", "image"]}
          loadFile={() =>
            Promise.resolve(new Blob(["image"], { type: "image/png" }))
          }
        />
      </QueryClientProvider>
    );

    const image = await screen.findByRole("img", { name: "evidence.png" });
    expect(image).toBeVisible();
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
  });

  it.each(["preview.pdf", "preview.docx"])(
    "forwards a page overlay renderer to %s previews",
    async (fileName) => {
      const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
      });
      render(
        <QueryClientProvider client={queryClient}>
          <BlobFilePreviewPane
            ariaLabel="Template preview"
            fileName={fileName}
            queryKey={["template-preview", fileName]}
            loadFile={() => Promise.resolve(new Blob(["preview"]))}
            renderPageOverlay={({ pageNumber }) => (
              <div data-testid={`field-overlay-page-${pageNumber}`} />
            )}
          />
        </QueryClientProvider>
      );

      expect(
        await screen.findByTestId("field-overlay-page-1")
      ).toBeVisible();
    }
  );
});
