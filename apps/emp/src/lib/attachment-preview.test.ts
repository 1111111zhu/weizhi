import { describe, expect, it } from "vitest";

import {
  ATTACHMENT_PREVIEW_KINDS,
  getAttachmentPreviewCapabilities,
  getAttachmentPreviewFamily,
} from "./attachment-preview";

describe("attachment preview families", () => {
  it.each([
    ["pdf", "document"],
    ["docx", "document"],
    ["pptx", "document"],
    ["csv", "spreadsheet"],
    ["xlsx", "spreadsheet"],
    ["text", "text"],
    ["email", "email"],
    ["image", "asset"],
    ["media", "media"],
    ["archive", "archive"],
  ] as const)("routes %s to the %s family", (kind, family) => {
    expect(getAttachmentPreviewFamily(kind)).toBe(family);
  });

  it("enables zoom for images, documents, spreadsheets, and text", () => {
    const zoomableKinds = ATTACHMENT_PREVIEW_KINDS.filter(
      (kind) => getAttachmentPreviewCapabilities(kind).zoom
    );

    expect(zoomableKinds).toStrictEqual([
      "csv",
      "docx",
      "image",
      "pdf",
      "pptx",
      "text",
      "xlsx",
    ]);
  });

  it("gives every document family preview thumbnails", () => {
    expect(getAttachmentPreviewCapabilities("pdf").thumbnails).toBeTruthy();
    expect(getAttachmentPreviewCapabilities("docx").thumbnails).toBeTruthy();
    expect(getAttachmentPreviewCapabilities("pptx").thumbnails).toBeTruthy();
  });
});
