import { describe, expect, it } from "vitest";

import { getPdfNoteFileType } from "./pdf-note-file-type";

describe("PDF note attachment classification", () => {
  it.each([
    ["3. PRC Bank Confirmation (Template 2)(1).docx", "document", true],
    [" REPORT.DOCX ", "document", true],
    ["scan.png.docx", "document", true],
    ["report.PDF", "document", true],
    ["report.XLSX", "spreadsheet", true],
    ["report.csv", "spreadsheet", true],
    ["report.PPTX", "presentation", true],
    ["evidence.JPEG", "image", true],
    ["证据.webp", "image", true],
    ["evidence.png", "image", true],
    ["scan.png.exe", "file", false],
    ["image.svg", "file", false],
    ["attachment.html", "file", false],
    ["archive.zip", "file", false],
    ["legacy.doc", "file", false],
    ["no-extension", "file", false],
  ])(
    "classifies %s without trusting its historical storage category",
    (name, kind, preview) => {
      expect(getPdfNoteFileType(name)).toMatchObject({ kind, preview });
    }
  );
});
