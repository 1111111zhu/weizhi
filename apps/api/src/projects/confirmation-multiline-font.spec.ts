import { PDFDocument, PDFPage } from "pdf-lib";

import { renderDynamicTemplateFieldsOnPdf } from "./confirmation-document.service";

describe("multiline PDF font size", () => {
  async function renderText(value: string, height = 0.3) {
    const source = await PDFDocument.create();
    source.addPage([600, 900]);
    return renderDynamicTemplateFieldsOnPdf({
      source: Buffer.from(await source.save()),
      templateCode: "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
      draftPayload: {
        templateDesignSchema: {
          version: 1,
          fields: [
            {
              id: "address",
              kind: "MULTILINE",
              name: "Address",
              options: [],
              page: 1,
              x: 0.1,
              y: 0.1,
              width: 0.2,
              height,
              textStyle: {
                fontFamily: "Arial",
                fontSize: 12,
                bold: false,
                italic: false,
                underline: false,
              },
            },
          ],
        },
        templateFieldValues: { address: value },
      } as never,
    });
  }

  it("wraps a long unbroken value without shrinking or dropping characters", async () => {
    const draw = vi.spyOn(PDFPage.prototype, "drawText");
    try {
      const value = "x".repeat(100);
      await renderText(value);
      expect(draw.mock.calls.length).toBeGreaterThan(1);
      expect(draw.mock.calls.map(([text]) => text).join("")).toBe(value);
      expect(draw.mock.calls.every(([, options]) => options?.size === 12)).toBe(
        true
      );
    } finally {
      draw.mockRestore();
    }
  });

  it("rejects overflow instead of silently shrinking or truncating", async () => {
    await expect(renderText("x".repeat(100), 0.02)).rejects.toThrow(
      /address.*超出填写框/
    );
  });
});
