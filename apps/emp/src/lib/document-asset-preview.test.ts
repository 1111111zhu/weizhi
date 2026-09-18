import { describe, expect, it } from "vitest";

import { getDocumentAssetPreviewKind } from "./document-asset-preview";

describe(getDocumentAssetPreviewKind, () => {
  it.each(["notes.md", "notes.markdown", "notes.mdx"])(
    "routes %s to text preview",
    (fileName) => {
      expect(getDocumentAssetPreviewKind(fileName, "")).toBe("text");
    }
  );

  it.each([
    ["scan.png", ""],
    ["photo.JPG", "application/octet-stream"],
    ["evidence", "image/webp"],
    ["diagram.svg", "image/svg+xml"],
  ])("routes %s (%s) to image preview", (fileName, mimeType) => {
    expect(getDocumentAssetPreviewKind(fileName, mimeType)).toBe("image");
  });
});
