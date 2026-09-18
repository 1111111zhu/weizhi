import { describe, expect, it } from "vitest";

import {
  mobileSheetFieldSpan,
  mobileSheetLayout,
  projectMobileSheetColumns,
} from "./smart-form-v2-mobile-sheet";
import {
  MOBILE_STRUCTURE_SHEET,
  mobileFixtureText,
} from "./smart-form-v2-mobile-sheet.fixture";

describe("schema-driven mobile sheet projection", () => {
  it("retains identity, source order and full grouped-header ancestry without mutations", () => {
    const before = structuredClone(MOBILE_STRUCTURE_SHEET);
    const columns = projectMobileSheetColumns(MOBILE_STRUCTURE_SHEET.columns);
    expect(columns.map(({ column }) => column.id)).toStrictEqual([
      "subject",
      "actual",
      "ledger",
      "when",
      "condition",
      "narrative",
    ]);
    expect(columns[1].ancestors.map((group) => group.id)).toStrictEqual([
      "observed",
    ]);
    expect(columns[2].ancestors.map((group) => group.id)).toStrictEqual([
      "recorded",
    ]);
    expect(MOBILE_STRUCTURE_SHEET).toStrictEqual(before);
  });

  it("does not infer layout from IDs or translated column labels", () => {
    const renamed = structuredClone(MOBILE_STRUCTURE_SHEET);
    renamed.id = "unrelated";
    renamed.columns = projectMobileSheetColumns(renamed.columns).map(
      ({ column }, index) => ({
        ...column,
        id: `unrelated-${index}`,
        header: mobileFixtureText("different label"),
      })
    );
    expect(mobileSheetLayout(renamed)).toBe("records");
    expect(
      projectMobileSheetColumns(renamed.columns).map(({ column }) =>
        mobileSheetFieldSpan({ id: "r" }, column)
      )
    ).toStrictEqual(
      projectMobileSheetColumns(MOBILE_STRUCTURE_SHEET.columns).map(
        ({ column }) => mobileSheetFieldSpan({ id: "r" }, column)
      )
    );
  });

  it("respects an explicit comparison table and keeps ambiguous headings as a table", () => {
    expect(
      mobileSheetLayout({
        ...MOBILE_STRUCTURE_SHEET,
        presentation: {
          ...MOBILE_STRUCTURE_SHEET.presentation,
          responsive: "scroll",
        },
      })
    ).toBe("table");
    expect(
      mobileSheetLayout({
        ...MOBILE_STRUCTURE_SHEET,
        columns: [
          ...MOBILE_STRUCTURE_SHEET.columns,
          {
            kind: "column",
            id: "second-heading",
            header: mobileFixtureText("secondary"),
            cell: { kind: "rowLabel" },
          },
        ],
      })
    ).toBe("table");
  });

  it("bases field width on data type/cardinality and honors content overrides", () => {
    const columns = projectMobileSheetColumns(MOBILE_STRUCTURE_SHEET.columns);
    expect(
      columns
        .slice(1)
        .map(({ column }) => mobileSheetFieldSpan({ id: "r" }, column))
    ).toStrictEqual(["compact", "compact", "compact", "full", "full"]);
    expect(
      mobileSheetFieldSpan(
        {
          id: "r",
          cells: {
            actual: {
              kind: "content",
              content: mobileFixtureText("a long explanation"),
            },
          },
        },
        columns[1].column
      )
    ).toBe("full");
  });
});
