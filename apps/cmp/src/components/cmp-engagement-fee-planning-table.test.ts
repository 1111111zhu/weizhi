import { describe, expect, it } from "vitest";

import { deriveFeePlanningBudget } from "./cmp-engagement-fee-planning-table";
import type { CmpFeePlanningFormLine } from "./cmp-engagement-fee-planning-table";

const line = (
  patch: Partial<CmpFeePlanningFormLine> = {}
): CmpFeePlanningFormLine => ({
  key: "budget-1",
  grade: "MANAGER",
  assignmentType: "TBC",
  staffUserId: "",
  hourlyRate: "2400.00",
  budgetHours: "20.00",
  dateFrom: "",
  dateTo: "",
  ...patch,
});

describe(deriveFeePlanningBudget, () => {
  it("derives total hours, standard value, recovery and effective rate", () => {
    expect(deriveFeePlanningBudget([line()], "60000.00")).toStrictEqual({
      totalHours: 20,
      standardValue: 48_000,
      budgetedHours: "20.00",
      recoveryRate: "125.00",
      effectiveHourlyRate: 3000,
    });
  });

  it("keeps derived metrics empty until the plan has positive hours", () => {
    expect(
      deriveFeePlanningBudget([line({ budgetHours: "" })], "60000.00")
    ).toStrictEqual({
      totalHours: 0,
      standardValue: 0,
      budgetedHours: "",
      recoveryRate: "",
      effectiveHourlyRate: null,
    });
  });
});
