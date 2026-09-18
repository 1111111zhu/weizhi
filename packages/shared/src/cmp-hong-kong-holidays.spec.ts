import { describe, expect, it } from "vitest";

import { getCmpHongKongWorkdaySummary } from "./cmp-hong-kong-holidays";

describe(getCmpHongKongWorkdaySummary, () => {
  it("counts inclusive weekdays and published Hong Kong public holidays", () => {
    expect(
      getCmpHongKongWorkdaySummary("2026-04-01", "2026-04-07")
    ).toStrictEqual({
      workdays: 2,
      leaveDays: 5,
    });
  });

  it("does not present a summary outside the embedded holiday years", () => {
    expect(getCmpHongKongWorkdaySummary("2028-01-01", "2028-01-02")).toBeNull();
  });
});
