import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("project-confirmation-editor.module.css", import.meta.url),
  "utf-8"
);
const normalizedStylesheet = stylesheet.replaceAll(/\s+/g, " ");

function expectRule(selector: string, declarations: string[]) {
  const rule = `.${selector} { ${declarations.join(" ")} }`;
  expect(normalizedStylesheet).toContain(rule);
}

describe("project confirmation editor semantic geometry", () => {
  it("preserves the editor shell dimensions", () => {
    expect.hasAssertions();
    expectRule("templateControl", ["flex: 0 1 22rem;", "min-width: 18rem;"]);
    expectRule("editorPreviewLayout", [
      "grid-template-rows: auto minmax(0, 1fr);",
    ]);
    expectRule("editorDraftLayout", [
      "grid-template-rows: auto minmax(0, 1fr) auto;",
    ]);
  });

  it("preserves the template popover bounds", () => {
    expect.hasAssertions();
    expectRule("informationLibraryPopover", [
      "width: min(64rem, calc(100vw - 2rem));",
      "max-width: calc(100vw - 2rem);",
    ]);
    expectRule("templatePopover", ["width: min(26rem, calc(100vw - 2rem));"]);
  });

  it.each([
    ["recipientNameField", "13.8%", "12.2%", "32%", "1.8%"],
    ["salutationField", "27.45%", "16%", "16%", "1.8%"],
    ["docxSalutationField", "22.2%", "16%", "28%", "1.8%"],
    ["bankNameField", "16.75%", "12.2%", "29.2%", "1.35%"],
    ["officeDateField", "16.75%", "56.5%", "32.8%", "1.35%"],
    ["referenceCodeField", "18.25%", "56.5%", "32.8%", "1.35%"],
    ["clientNameField", "36.4%", "56.4%", "32.8%", "1.8%"],
    ["reportDateField", "40.2%", "56.4%", "13.4%", "1.8%"],
    ["auditorNameField", "52.45%", "12.2%", "31%", "1.9%"],
    ["auditorAddressField", "54.2%", "12.2%", "44%", "1.9%"],
    ["authorizationAccountField", "57.05%", "75.8%", "13.6%", "1.9%"],
  ])(
    "preserves the %s PDF overlay coordinates",
    (selector, top, left, width, height) => {
      expect.hasAssertions();
      expectRule(selector, [
        `top: ${top};`,
        `left: ${left};`,
        `width: ${width};`,
        `height: ${height};`,
      ]);
    }
  );

  it("preserves the PDF overlay input typography", () => {
    expect.hasAssertions();
    expectRule("overlayInput", ["font-size: 10px !important;"]);
    expectRule("managedOverlayText", ["font-size: 10px !important;"]);
    expectRule("managedOverlayLongText", ["font-size: 8px !important;"]);
    expectRule("bankNameSourceCover", ["top: -70%;"]);
  });

  it("preserves the managed select value clipping contract", () => {
    expect.hasAssertions();
    expectRule('overlaySelectValue > [data-slot="select-value"]', [
      "-webkit-line-clamp: unset;",
      "-webkit-box-orient: horizontal;",
      "display: block;",
      "overflow: hidden;",
      "text-overflow: clip;",
    ]);
  });

  it.each([
    ["securitiesReferenceFallback", "7%", "18%", "36%"],
    ["securitiesDateFallback", "9.5%", "18%", "36%"],
    ["securitiesRecipientNameFallback", "13%", "16%", "42%"],
    ["securitiesRecipientAddressFallback", "15.5%", "16%", "58%"],
    ["securitiesSalutationFallback", "18%", "16%", "28%"],
    ["securitiesAccountNumberFallback", "54%", "31%", "31%"],
    ["securitiesGenericFallback", "30%", "30%", "30%"],
  ])(
    "preserves the %s securities fallback geometry",
    (selector, top, left, width) => {
      expect.hasAssertions();
      expectRule(selector, [
        `top: ${top};`,
        `left: ${left};`,
        `width: ${width};`,
        "height: 2.2%;",
      ]);
    }
  );
});
