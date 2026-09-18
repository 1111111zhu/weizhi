import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("smart-form-v2-table.module.css", import.meta.url),
  "utf-8"
);
const editorSource = readFileSync(
  new URL("smart-form-v2-editor.tsx", import.meta.url),
  "utf-8"
);
const readonlySource = readFileSync(
  new URL("smart-form-v2-readonly.tsx", import.meta.url),
  "utf-8"
);
const normalizedStylesheet = stylesheet.replaceAll(/\s+/g, " ");

function expectRule(selector: string, declarations: string[]) {
  expect(normalizedStylesheet).toContain(
    `.${selector} { ${declarations.join(" ")} }`
  );
}

describe("smart Form V2 shared table colors", () => {
  it("keeps editor and readonly tables on the same semantic stylesheet", () => {
    expect.hasAssertions();
    const sharedImport =
      'import tableStyles from "@/components/smart-form-v2-table.module.css";';

    expect(editorSource).toContain(sharedImport);
    expect(readonlySource).toContain(sharedImport);
  });

  it("preserves the header color contract", () => {
    expect.hasAssertions();
    expectRule("headerSurface", [
      "background-color: var(--smart-form-table-header);",
    ]);
    expectRule("headerBorder", [
      "border-color: var(--smart-form-table-header-border);",
    ]);
    expectRule("headerForeground", [
      "color: var(--smart-form-table-header-foreground);",
    ]);
    expectRule("headerInteractive:hover", [
      "background-color: var(--smart-form-table-header);",
      "color: var(--smart-form-table-header-foreground);",
    ]);
  });

  it("preserves group surfaces, alpha levels, and accent directions", () => {
    expect.hasAssertions();
    expectRule("groupSurface", [
      "background-color: var(--smart-form-table-group);",
    ]);
    expectRule("groupSurfaceMuted", [
      "background-color: color-mix( in oklab, var(--smart-form-table-group) 70%, transparent );",
    ]);
    expectRule("groupInteractive:hover", [
      "background-color: var(--smart-form-table-group);",
    ]);
    expectRule("groupRow:hover", [
      "background-color: color-mix( in oklab, var(--smart-form-table-group) 55%, transparent );",
    ]);
    expectRule("groupAccentStart", [
      "border-inline-start-color: var(--smart-form-table-group-accent);",
    ]);
    expectRule("groupAccentLeft", [
      "border-left-color: var(--smart-form-table-group-accent);",
    ]);
  });

  it("does not reintroduce table color arbitrary values in JSX", () => {
    expect.hasAssertions();
    const componentSources = `${editorSource}\n${readonlySource}`;
    const arbitraryMarker = ["-", "[", "var(--smart-form-table-"].join("");

    for (const utility of ["bg", "border", "border-l", "border-s", "text"]) {
      expect(componentSources).not.toContain(`${utility}${arbitraryMarker}`);
    }
  });

  it("gives working-paper references enough room without changing the schema", () => {
    expect.hasAssertions();
    expectRule("procedureColumn", ["width: 37%;"]);
    expectRule("testRequiredColumn", ["width: 12%;"]);
    expectRule("resultColumn", ["width: 14%;"]);
    expectRule("referenceColumn", ["width: 22%;"]);
    expectRule("commentsColumn", ["width: 15%;"]);
    expect(editorSource).toContain("tableStyles.referenceColumn");
  });

  it("keeps the reference picker height stable while its results change", () => {
    expect.hasAssertions();
    expectRule("referencePickerTree", [
      "height: min(30rem, 50dvh);",
      "min-height: 12rem;",
      "overflow-y: auto;",
      "overscroll-behavior: contain;",
    ]);
  });
});
