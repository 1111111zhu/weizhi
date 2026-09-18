import { readFileSync } from "node:fs";

import {
  DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE,
  SmartFormV2DefinitionSchema,
  SmartFormV2ResponseSchema,
} from "@project-wing/shared";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";

import { buildMobilePreviewPdf } from "./mobile-preview-pdf";
import { parseMobileRoute } from "./mobile-workspace-model";

describe("mobile PDF sources", () => {
  it("imports the canonical SmartForm definition and response, with a real PDF export", async () => {
    const definition = SmartFormV2DefinitionSchema.parse(
      JSON.parse(
        readFileSync(
          new URL(
            "../../../public/mobile-smartforms/deferred-income.sf",
            import.meta.url
          ),
          "utf-8"
        )
      )
    );
    expect(definition).toStrictEqual(
      DEFERRED_INCOME_SMART_FORM_V2_AUTHORED_FIXTURE
    );
    expect(
      SmartFormV2ResponseSchema.safeParse(
        JSON.parse(
          readFileSync(
            new URL(
              "../../../public/mobile-smartforms/deferred-income.response.json",
              import.meta.url
            ),
            "utf-8"
          )
        )
      ).success
    ).toBeTruthy();
    const pdf = await PDFDocument.load(
      readFileSync(
        new URL(
          "../../../public/mobile-smartforms/deferred-income.pdf",
          import.meta.url
        )
      )
    );
    expect(pdf.getPageCount()).toBeGreaterThan(1);
    expect(
      parseMobileRoute(
        "#document?project=orchid&file=deferred-income&mode=edit"
      ).mode
    ).toBe("read");
    expect(
      parseMobileRoute("#document?project=orchid&file=cash-program&mode=edit")
        .mode
    ).toBe("edit");
  });

  it("produces a real two-page PDF tied to the exact project and file", async () => {
    const bytes = await buildMobilePreviewPdf("orchid", "bank-reply");
    expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe("%PDF-");
    const document = await PDFDocument.load(bytes);
    expect(document.getPageCount()).toBe(2);
    expect(document.getTitle()).toBe("AUD-2026-018 / A-03 / 银行回函.pdf");
    expect(document.getSubject()).toContain("Synthetic");
  });

  it("does not show the same PDF for a different file or project", async () => {
    const reply = await PDFDocument.load(
      await buildMobilePreviewPdf("orchid", "bank-reply")
    );
    const statement = await PDFDocument.load(
      await buildMobilePreviewPdf("harbour", "bank-statement")
    );
    expect(statement.getTitle()).toBe(
      "AUD-2026-021 / A-04 / 十二月份银行对账单.pdf"
    );
    expect(statement.getTitle()).not.toBe(reply.getTitle());
  });

  it.each([
    ["unknown", "bank-reply"],
    ["orchid", "reconciliation"],
    ["orchid", "../bank-reply"],
  ])("rejects missing or non-PDF sources: %s / %s", async (project, file) => {
    await expect(buildMobilePreviewPdf(project, file)).rejects.toThrow(
      "No PDF source"
    );
  });
});
