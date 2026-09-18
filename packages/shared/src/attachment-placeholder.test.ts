import { describe, expect, it } from "vitest";

import {
  CreateAttachmentPlaceholderSchema,
  getAttachmentPlaceholderReplacementName,
  getAttachmentPlaceholderTypeForFile,
} from "./index.js";

describe("attachment placeholder file types", () => {
  it.each([
    ["report.doc", "application/msword", "WORD"],
    [
      "report.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "WORD",
    ],
    ["ledger.csv", "text/csv", "SPREADSHEET"],
    ["ledger.xlsx", "application/octet-stream", "SPREADSHEET"],
    ["slides.pptx", "application/octet-stream", "PRESENTATION"],
    ["evidence.pdf", "application/pdf", "PDF"],
    ["photo.jpeg", "image/jpeg", "IMAGE"],
    ["support.zip", "application/zip", "ZIP"],
    ["notes.txt", "text/plain", "TEXT"],
  ])("classifies %s as %s", (fileName, mimeType, expected) => {
    expect(getAttachmentPlaceholderTypeForFile(fileName, mimeType)).toBe(
      expected
    );
  });

  it("rejects files whose extension and MIME type belong to different families", () => {
    expect(
      getAttachmentPlaceholderTypeForFile("renamed.docx", "application/pdf")
    ).toBeNull();
    expect(
      getAttachmentPlaceholderTypeForFile("renamed.pdf", "image/png")
    ).toBeNull();
  });

  it("keeps the placeholder base name and adopts the replacement extension", () => {
    expect(
      getAttachmentPlaceholderReplacementName(
        "Monthly ledger.xlsx",
        "source-data.csv"
      )
    ).toBe("Monthly ledger.csv");
  });

  it("trims placeholder names and rejects empty names", () => {
    expect(
      CreateAttachmentPlaceholderSchema.parse({
        name: "  Audit report  ",
        placeholderType: "WORD",
      })
    ).toStrictEqual({ name: "Audit report", placeholderType: "WORD" });
    expect(() =>
      CreateAttachmentPlaceholderSchema.parse({
        name: "   ",
        placeholderType: "WORD",
      })
    ).toThrow(/./);
  });

  it("defaults new placeholders to an unrestricted file format", () => {
    expect(
      CreateAttachmentPlaceholderSchema.parse({
        name: "  Pending evidence  ",
      })
    ).toStrictEqual({ name: "Pending evidence", placeholderType: "GENERIC" });
  });
});
