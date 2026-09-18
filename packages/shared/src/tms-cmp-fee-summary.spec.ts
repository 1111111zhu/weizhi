import { describe, expect, it } from "vitest";

import { TmsEngagementSummarySchema } from "./index";

describe("tMS CMP fee summary contract", () => {
  it("accepts current final fields and nullable future cost fields", () => {
    const row = {
      userId: "user-1",
      name: "King Su",
      budgetNormal: null,
      budgetOt: null,
      finalNormal: 16,
      finalOt: 2,
      absent: null,
      rate: null,
      budgetCost: null,
      actualCost: null,
      diff: null,
    };
    const summary = TmsEngagementSummarySchema.parse({
      approved: {
        rows: [row],
        total: { ...row, userId: "total", name: "Total" },
      },
      draft: {
        rows: [],
        total: {
          userId: "total",
          name: "Total",
          budgetNormal: null,
          budgetOt: null,
          finalNormal: null,
          finalOt: null,
          absent: null,
          rate: null,
          budgetCost: null,
          actualCost: null,
          diff: null,
        },
      },
      periods: [
        {
          userId: "user-1",
          name: "King Su",
          year: 2026,
          month: 8,
          half: "FIRST_HALF",
          revision: 2,
          status: "APPROVED",
          bucket: "APPROVED",
          normal: 16,
          ot: 2,
          absent: 0,
          total: 18,
        },
      ],
    });

    expect(summary.approved.rows[0]?.finalNormal).toBe(16);
    expect(summary.approved.rows[0]?.rate).toBeNull();
    expect(summary.draft.total.name).toBe("Total");
    expect(summary.periods?.[0]).toMatchObject({
      year: 2026,
      month: 8,
      total: 18,
    });
  });
});
