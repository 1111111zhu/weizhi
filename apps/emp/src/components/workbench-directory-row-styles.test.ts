import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("workbench-directory-row.module.css", import.meta.url),
  "utf-8"
);
const normalizedStylesheet = stylesheet.replaceAll(/\s+/g, " ");
const globalStylesheet = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf-8"
);
const normalizedGlobalStylesheet = globalStylesheet.replaceAll(/\s+/g, " ");

function expectRule(selector: string, declarations: string[]) {
  expect(normalizedStylesheet).toContain(
    `.${selector} { ${declarations.join(" ")} }`
  );
}

describe("workbench directory row semantic states", () => {
  it("preserves the flat active state", () => {
    expect.hasAssertions();
    expectRule('flatRow[data-active="true"]', [
      "color: var(--foreground);",
      "font-weight: var(--font-weight-medium);",
    ]);
    expectRule('flatRow[data-active="true"]::after', [
      "position: absolute;",
      "z-index: -10;",
      "inset-block: 0;",
      "inset-inline: 0.25rem;",
      "border-radius: var(--radius-md);",
      "background-color: color-mix(in oklab, var(--primary) 15%, transparent);",
      'content: "";',
      "pointer-events: none;",
    ]);
    expectRule('flatRow[data-active="true"]:hover::after', [
      "background-color: color-mix(in oklab, var(--primary) 20%, transparent);",
    ]);
  });

  it("keeps drag-over above the active layer", () => {
    expect.hasAssertions();
    expectRule("flatRow.flatDropTarget::after", [
      "position: absolute;",
      "z-index: 10;",
      "inset-block: 0;",
      "inset-inline: 0.25rem;",
      "border: 1px dashed var(--primary);",
      "border-radius: var(--radius-md);",
      "background-color: color-mix(in oklab, var(--primary) 10%, transparent);",
      'content: "";',
      "pointer-events: none;",
    ]);
  });

  it("preserves selected and highlighted row layers", () => {
    expect.hasAssertions();
    expectRule("tintedRow", ["background-color: var(--brand-tint);"]);
    expectRule("tintedRow:hover", ["background-color: var(--brand-tint);"]);
    expectRule("selectedNodeRow::before", [
      "position: absolute;",
      "inset-block: 0.25rem;",
      "left: 0;",
      "width: 0.125rem;",
      "border-radius: 9999px;",
      "background-color: var(--primary);",
      'content: "";',
    ]);
    expectRule("fileHighlight::before", [
      "background-color: var(--brand-tint);",
      'content: "";',
    ]);
    expectRule("fileHighlight::after", ['content: "";']);
  });

  it("gives dark workbench rows a distinct hover surface", () => {
    expect(normalizedGlobalStylesheet).toContain(
      "--workbench-row-hover: color-mix( in srgb, var(--workbench-sidebar) 82%, var(--foreground) );"
    );
  });
});
