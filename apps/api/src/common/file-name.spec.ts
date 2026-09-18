import {
  buildAttachmentContentDisposition,
  buildInlineContentDisposition,
  normalizeUploadedFileName,
} from "./file-name";

describe("file-name helpers", () => {
  it("repairs UTF-8 file names decoded as latin1", () => {
    const expected = "银行回函扫描件.pdf";
    const mojibake = Buffer.from(expected, "utf-8").toString("latin1");

    expect(normalizeUploadedFileName(mojibake)).toBe(expected);
  });

  it("keeps already-correct unicode file names unchanged", () => {
    expect(normalizeUploadedFileName("银行回函扫描件.pdf")).toBe(
      "银行回函扫描件.pdf"
    );
  });

  it("builds an inline disposition with an ASCII fallback and UTF-8 name", () => {
    expect(buildInlineContentDisposition("银行回函扫描件.pdf")).toBe(
      "inline; filename=\"_______.pdf\"; filename*=UTF-8''%E9%93%B6%E8%A1%8C%E5%9B%9E%E5%87%BD%E6%89%AB%E6%8F%8F%E4%BB%B6.pdf"
    );
  });

  it("builds a safe attachment disposition", () => {
    expect(buildAttachmentContentDisposition("银行函证模板.docx")).toBe(
      "attachment; filename=\"______.docx\"; filename*=UTF-8''%E9%93%B6%E8%A1%8C%E5%87%BD%E8%AF%81%E6%A8%A1%E6%9D%BF.docx"
    );
  });

  it("removes characters that are unsafe in response headers", () => {
    const disposition = buildInlineContentDisposition('response\r\n"scan".pdf');

    expect(disposition).not.toContain("\r");
    expect(disposition).not.toContain("\n");
    expect(disposition).toContain('filename="response_scan_.pdf"');
  });
});
