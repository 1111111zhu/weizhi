import { describe, expect, it } from "vitest";

import {
  formatAttachmentSize,
  getAttachmentKind,
} from "./knowledge-attachment-utils";

describe("knowledge attachment presentation", () => {
  it.each([
    ["memo.pdf", "PDF"],
    ["letter.docx", "DOC"],
    ["analysis.xlsx", "XLS"],
    ["briefing.pptx", "PPT"],
    ["archive.zip", "FILE"],
  ])("maps %s to %s", (fileName, expected) => {
    expect(getAttachmentKind(fileName)).toBe(expected);
  });

  it("formats attachment sizes for the editor card", () => {
    expect(formatAttachmentSize(512)).toBe("512 B");
    expect(formatAttachmentSize(36_352)).toBe("35.5 KB");
    expect(formatAttachmentSize(2_621_440)).toBe("2.5 MB");
  });
});
