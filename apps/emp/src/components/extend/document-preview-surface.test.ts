import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getDocumentPreviewCanvasClassName,
  IMAGE_PREVIEW_CANVAS_CLASS_NAME,
  PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME,
  PRESENTATION_PREVIEW_CANVAS_CLASS_NAME,
} from "./document-preview-surface";

const pdfViewerSource = readFileSync(
  new URL("pdf-viewer.tsx", import.meta.url),
  "utf-8"
);
const cachedPreviewSource = readFileSync(
  new URL("../workbench-cached-preview.tsx", import.meta.url),
  "utf-8"
);

describe("document preview surfaces", () => {
  it("uses a light gray canvas for PDF and Word pages", () => {
    expect(getDocumentPreviewCanvasClassName("paged-document")).toBe(
      PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
    );
  });

  it("uses a slightly stronger neutral canvas for presentations", () => {
    expect(getDocumentPreviewCanvasClassName("presentation")).toBe(
      PRESENTATION_PREVIEW_CANVAS_CLASS_NAME
    );
  });

  it("keeps images on the paged-document canvas instead of the presentation token", () => {
    expect(getDocumentPreviewCanvasClassName("image")).toBe(
      IMAGE_PREVIEW_CANVAS_CLASS_NAME
    );
    expect(IMAGE_PREVIEW_CANVAS_CLASS_NAME).toBe(
      PAGED_DOCUMENT_PREVIEW_CANVAS_CLASS_NAME
    );
  });

  it("keeps rendered PDF paper white and preserves source colors in dark mode", () => {
    expect(pdfViewerSource).toContain(
      '"relative bg-white select-none selection:bg-transparent selection:text-inherit"'
    );
    expect(pdfViewerSource).toContain(
      'className="pointer-events-none absolute inset-0 bg-white"'
    );
    expect(pdfViewerSource).not.toContain("dark:bg-background");
    expect(pdfViewerSource).not.toContain("dark:[&>img]:invert");
    expect(pdfViewerSource).not.toContain("dark:[&>img]:hue-rotate-180");
    expect(pdfViewerSource).not.toContain("dark:[&>div>img]:invert");
    expect(pdfViewerSource).not.toContain("dark:[&>div>img]:hue-rotate-180");
  });

  it("does not invert cached raster document pages", () => {
    expect(cachedPreviewSource).not.toContain(
      "DOCUMENT_NIGHT_RENDER_FILTER_CLASS_NAME"
    );
    expect(cachedPreviewSource).not.toContain("dark:invert");
    expect(cachedPreviewSource).not.toContain("dark:hue-rotate-180");
  });
});
