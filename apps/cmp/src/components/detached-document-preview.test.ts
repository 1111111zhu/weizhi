import { describe, expect, it } from "vitest";

import { resolvePreviewKind } from "./detached-document-preview";

describe("DetachedDocumentPreview file resolution", () => {
  it.each([
    ["customer-proof.png", "", "image"],
    ["payment-proof", "image/jpeg", "image"],
    ["bank-slip.svg", "application/octet-stream", "image"],
    ["invoice.pdf", "application/pdf", "pdf"],
    ["invoice.docx", "", "docx"],
    ["workbook.xlsx", "", "xlsx"],
  ])("opens %s (%s) as %s", (fileName, mimeType, expected) => {
    expect(resolvePreviewKind({ blob: new Blob(), fileName, mimeType })).toBe(
      expected,
    );
  });

  it("shows a safe unsupported state instead of treating an unknown file as Excel", () => {
    expect(
      resolvePreviewKind({
        blob: new Blob(),
        fileName: "historical-receipt.zip",
        mimeType: "application/zip",
      }),
    ).toBeNull();
  });
});
