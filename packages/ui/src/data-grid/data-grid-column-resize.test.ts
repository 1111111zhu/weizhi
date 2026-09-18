import { describe, expect, it } from "vitest";

import {
  getDataGridColumnResizeCompensation,
  getDataGridColumnResizeMaxDeltaPercentage,
} from "./data-grid-column-resize";

const FULL_AVAILABLE_GROWTH = 1;
const NO_AVAILABLE_GROWTH = 0;
const QUARTER_COLUMN_GROWTH_LIMIT = 0.25;
const HALF_COLUMN_GROWTH_LIMIT = 0.5;

describe(getDataGridColumnResizeMaxDeltaPercentage, () => {
  it("lets resizable columns consume only the remaining viewport width", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: Number.POSITIVE_INFINITY,
        currentTableWidth: 720,
        resizedColumnsWidth: 180,
        viewportWidth: 900,
      })
    ).toBe(FULL_AVAILABLE_GROWTH);
  });

  it("prevents further growth when the table already fills the viewport", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: Number.POSITIVE_INFINITY,
        currentTableWidth: 900,
        resizedColumnsWidth: 180,
        viewportWidth: 900,
      })
    ).toBe(NO_AVAILABLE_GROWTH);
  });

  it("does not enlarge an already overflowing table", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: Number.POSITIVE_INFINITY,
        currentTableWidth: 980,
        resizedColumnsWidth: 180,
        viewportWidth: 900,
      })
    ).toBe(NO_AVAILABLE_GROWTH);
  });

  it("keeps a stricter column max-size constraint", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: 0.25,
        currentTableWidth: 720,
        resizedColumnsWidth: 180,
        viewportWidth: 900,
      })
    ).toBe(QUARTER_COLUMN_GROWTH_LIMIT);
  });

  it("borrows growth capacity from following resizable columns", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: Number.POSITIVE_INFINITY,
        compensationColumns: [
          { id: "status", minSize: 120, size: 300 },
          { id: "notes", minSize: 100, size: 100 },
        ],
        currentTableWidth: 900,
        resizedColumnsWidth: 180,
        viewportWidth: 900,
      })
    ).toBe(FULL_AVAILABLE_GROWTH);
  });

  it("uses free width before shrinking following columns", () => {
    expect(
      getDataGridColumnResizeCompensation({
        compensationColumns: [
          { id: "status", minSize: 120, size: 300 },
          { id: "notes", minSize: 100, size: 180 },
        ],
        currentTableWidth: 850,
        deltaOffset: 140,
        viewportWidth: 900,
      })
    ).toStrictEqual({ status: 210 });
  });

  it("shrinks following columns in visual order down to their minimums", () => {
    expect(
      getDataGridColumnResizeCompensation({
        compensationColumns: [
          { id: "status", minSize: 120, size: 200 },
          { id: "notes", minSize: 100, size: 180 },
        ],
        currentTableWidth: 900,
        deltaOffset: 120,
        viewportWidth: 900,
      })
    ).toStrictEqual({ notes: 140, status: 120 });
  });

  it("falls back to the column constraint without a measurable viewport", () => {
    expect(
      getDataGridColumnResizeMaxDeltaPercentage({
        columnMaxDeltaPercentage: 0.5,
        currentTableWidth: 720,
        resizedColumnsWidth: 180,
      })
    ).toBe(HALF_COLUMN_GROWTH_LIMIT);
  });
});
