import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  new URL("confirmations.module.css", import.meta.url),
  "utf-8"
);
const normalizedStylesheet = stylesheet.replaceAll(/\s+/g, " ");
const confirmationPageSource = readFileSync(
  new URL("confirmations.tsx", import.meta.url),
  "utf-8"
);
const templateGridSource = readFileSync(
  new URL(
    "../components/confirmations/confirmation-template-library-data-grid.tsx",
    import.meta.url
  ),
  "utf-8"
);
const globalStylesheet = readFileSync(
  new URL("../styles.css", import.meta.url),
  "utf-8"
);

function expectRule(selector: string, declarations: string[]) {
  const rule = `.${selector} { ${declarations.join(" ")} }`;
  expect(normalizedStylesheet).toContain(rule);
}

describe("confirmation overview semantic geometry", () => {
  it.each(Array.from({ length: 18 }, (_, index) => 184 + index * 8))(
    "preserves the %ipx navigation width step",
    (width) => {
      expect.hasAssertions();
      expectRule(`navigationWidth${width}`, [`width: ${width}px;`]);
    }
  );

  it("preserves the navigation motion contract", () => {
    expect.hasAssertions();
    expectRule("navigationPanel", [
      "transition-property: width, opacity, padding, border-color;",
      "transition-duration: var(--motion-panel);",
      "transition-timing-function: var(--motion-ease-emphasized);",
    ]);
  });

  it("preserves the overview table proportions", () => {
    expect.hasAssertions();
    expectRule("overviewTable", ["min-width: 62rem;"]);
    expectRule("projectColumn", ["width: 24%;"]);
    expectRule("timelineColumn", ["width: 22%;"]);
    expectRule("progressColumn", ["width: 34%;"]);
    expectRule("countColumn", ["width: 10%;"]);
  });

  it("preserves progress labels and loading-row geometry", () => {
    expect.hasAssertions();
    expectRule("progressLabels", ["font-size: 11px;"]);
    expectRule("skeletonRow", [
      "grid-template-columns: 1.3fr 1fr 1.4fr 0.55fr 0.45fr;",
    ]);
  });

  it("uses the available viewport width without truncating confirmation fields", () => {
    expect(confirmationPageSource).toMatch(
      /meta:\s*\{\s*autoSize:\s*true,\s*headerTitle:\s*copy\.project,/
    );
    expect(confirmationPageSource).toMatch(
      /meta:\s*\{\s*autoSize:\s*true,\s*headerTitle:\s*copy\.myCreated\s*\}/
    );
    expect(confirmationPageSource).not.toContain(
      'className="truncate font-semibold group-hover:text-primary"'
    );
  });

  it("uses the available viewport width without truncating template fields", () => {
    for (const column of ["code", "name", "type", "status", "file"]) {
      expect(templateGridSource).toMatch(
        new RegExp(
          `meta:\\s*\\{\\s*autoSize:\\s*true,\\s*headerTitle:\\s*copy\\.templateLibrary\\.columns\\.${column},`
        )
      );
    }
    expect(templateGridSource).not.toContain("truncate");
  });

  it("uses the same information-library icon in global and project navigation", () => {
    expect(confirmationPageSource).toMatch(
      /<Landmark \/>[\s\S]{0,160}\{copy\.informationLibrary\.title\}/
    );
  });

  it("leaves information-library scrolling to the data grid only", () => {
    expect(confirmationPageSource).toContain(
      'activeView === "INFORMATION" ? "overflow-hidden" : "overflow-y-auto"'
    );
    expect(globalStylesheet).not.toContain(
      '.confirmation-information-library-grid [data-slot="scroll-area-viewport"]'
    );
  });
});
