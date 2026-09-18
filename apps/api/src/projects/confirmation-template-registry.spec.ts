import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  getConfirmationTemplateDefinition,
  isConfirmationTemplateAvailableForNewDrafts,
} from "./confirmation-template-registry";

const LEGACY_CONFIRMATION_TEMPLATE_CODES = [
  "STANDARD_FINANCIAL_INSTITUTION",
  "BANK_CONFIRMATION_HK_STANDARD_ENGLISH",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_1",
  "SECURITIES_CONFIRMATION_ENGLISH_TYPE_2",
] as const;

const LEGACY_TEMPLATE_FILES = [
  "standard-financial-institution-pdf-twin.docx",
  "bank-confirmation-hk-standard-english.docx",
  "securities-confirmation-english-type-1.docx",
  "securities-confirmation-english-type-2.docx",
] as const;

describe("legacy confirmation template removal", () => {
  it("retains definitions solely for historical draft rendering", () => {
    expect(
      LEGACY_CONFIRMATION_TEMPLATE_CODES.map((code) =>
        getConfirmationTemplateDefinition(code)
      )
    ).toStrictEqual([
      expect.objectContaining({ confirmationType: "BANK", typeCode: "BANK" }),
      expect.objectContaining({ confirmationType: "BANK", typeCode: "BANK" }),
      expect.objectContaining({
        confirmationType: "INTERMEDIARY",
        typeCode: "INTERMEDIARY",
      }),
      expect.objectContaining({
        confirmationType: "INTERMEDIARY",
        typeCode: "INTERMEDIARY",
      }),
    ]);
  });

  it.each(LEGACY_CONFIRMATION_TEMPLATE_CODES)(
    "does not offer %s for new drafts",
    (code) => {
      expect(
        isConfirmationTemplateAvailableForNewDrafts(code) === false
      ).toBeTruthy();
    }
  );

  it.each(LEGACY_TEMPLATE_FILES)("does not ship %s", (fileName) => {
    for (const basePath of [
      path.join(process.cwd(), "confirmation-templates"),
      path.join(process.cwd(), "apps/api/confirmation-templates"),
    ]) {
      expect(existsSync(path.join(basePath, fileName)) === false).toBeTruthy();
    }
  });
});
