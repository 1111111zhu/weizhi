import type { TmsApprovalRecord, TmsTimesheetRow } from "@project-wing/shared";
import { describe, expect, it } from "vitest";

import { buildApprovalReviewModel } from "./approval-review";
import { buildPeriodDays } from "./timesheet";

function row(
  id: string,
  periodScope: "first" | "second",
  hoursByDate: Record<string, number>
): TmsTimesheetRow {
  return {
    id,
    periodScope,
    type: "Chargeable",
    details: "Normal",
    description: "Fieldwork",
    hoursByDate,
    periodTotal: Object.values(hoursByDate).reduce(
      (total, hours) => total + hours,
      0
    ),
  };
}

function record(
  ownerUserId: string,
  ownerName: string,
  half: "FIRST_HALF" | "SECOND_HALF",
  status: TmsApprovalRecord["status"],
  submittedRows: TmsTimesheetRow[] = []
): TmsApprovalRecord {
  return {
    id: `${ownerUserId}-${half}`,
    ownerUserId,
    ownerName,
    ownerEmail: `${ownerUserId}@projectwing.local`,
    year: 2026,
    month: 7,
    half,
    engagementId: "engagement-1",
    engagementCode: "HBR-2026-ACC",
    clientCode: "C-HBR-2026",
    clientName: "Harbour Retail Limited",
    revision: 1,
    status,
    submittedRows,
    submittedAt: null,
    reviewedById: null,
    reviewedAt: null,
    returnReason: null,
  };
}

describe(buildApprovalReviewModel, () => {
  const records = [
    record("king", "King Su", "FIRST_HALF", "SUBMITTED", [
      row("king-first", "first", { "2026-07-01": 8, "2026-07-02": 4 }),
    ]),
    record("king", "King Su", "SECOND_HALF", "PENDING_CONFIRMATION", [
      row("king-second", "second", { "2026-07-16": 8 }),
    ]),
    record("amy", "Amy Chan", "FIRST_HALF", "NOT_SUBMITTED"),
    record("amy", "Amy Chan", "SECOND_HALF", "APPROVED", [
      row("amy-second", "second", { "2026-07-16": 8 }),
    ]),
    record("returned", "Returned User", "FIRST_HALF", "RETURNED"),
    record("returned", "Returned User", "SECOND_HALF", "RETURNED"),
  ];

  it("filters by Name and selects the requested half", () => {
    const model = buildApprovalReviewModel(
      records,
      buildPeriodDays(2026, 7, "first"),
      {
        period: "first",
        nameFilters: ["King Su"],
      }
    );

    expect(model.employees.map((employee) => employee.ownerName)).toStrictEqual(
      ["King Su"]
    );
    expect(model.employees[0]?.status).toBe("SUBMITTED");
    expect(model.statusCounts.SUBMITTED).toBe(1);
    expect(model.statusCounts.PENDING_CONFIRMATION).toBe(0);
  });

  it("aggregates all selected halves using attention priority", () => {
    const model = buildApprovalReviewModel(
      records,
      buildPeriodDays(2026, 7, "all"),
      {
        period: "all",
      }
    );

    expect(
      model.employees.map((employee) => [employee.ownerName, employee.status])
    ).toStrictEqual([
      ["King Su", "PENDING_CONFIRMATION"],
      ["Amy Chan", "NOT_SUBMITTED"],
      ["Returned User", "RETURNED"],
    ]);
    expect(model.statusCounts.NOT_SUBMITTED).toBe(1);
    expect(model.statusCounts.RETURNED).toBe(1);
    expect(model.statusCounts.PENDING_CONFIRMATION).toBe(1);
    expect(model.attentionEmployeeNames).toStrictEqual([
      "King Su",
      "Amy Chan",
      "Returned User",
    ]);
  });

  it("marks missing submissions and dates below eight explained hours", () => {
    const model = buildApprovalReviewModel(
      records,
      buildPeriodDays(2026, 7, "all"),
      {
        period: "all",
        nameFilters: ["King Su", "Amy Chan"],
      }
    );
    const king = model.employees.find(
      (employee) => employee.ownerName === "King Su"
    );
    const amy = model.employees.find(
      (employee) => employee.ownerName === "Amy Chan"
    );

    expect(king?.daily.find((day) => day.date === "2026-07-02")).toMatchObject({
      hours: 4,
      state: "underfilled",
    });
    expect(amy?.daily.find((day) => day.date === "2026-07-01")).toMatchObject({
      state: "missing",
    });
    expect(amy?.daily.find((day) => day.date === "2026-07-16")).toMatchObject({
      hours: 8,
      state: "complete",
    });
  });

  it("treats a zero workday inside a submitted record as missing", () => {
    const model = buildApprovalReviewModel(
      [
        record("partial", "Partial User", "FIRST_HALF", "SUBMITTED", [
          row("partial-first", "first", { "2026-07-01": 8 }),
        ]),
      ],
      buildPeriodDays(2026, 7, "first"),
      { period: "first" }
    );

    expect(
      model.employees[0]?.daily.find((day) => day.date === "2026-07-02")
    ).toMatchObject({ hours: 0, state: "missing" });
  });

  it("marks more than 24 explained hours as overfilled while keeping boundaries complete", () => {
    const model = buildApprovalReviewModel(
      [
        record("over", "Over User", "FIRST_HALF", "SUBMITTED", [
          row("over-first", "first", {
            "2026-07-01": 8,
            "2026-07-02": 24,
            "2026-07-03": 25,
          }),
        ]),
      ],
      buildPeriodDays(2026, 7, "first"),
      { period: "first" }
    );
    const daily = model.employees[0]?.daily;

    expect(daily?.find((day) => day.date === "2026-07-01")?.state).toBe(
      "complete"
    );
    expect(daily?.find((day) => day.date === "2026-07-02")?.state).toBe(
      "complete"
    );
    expect(daily?.find((day) => day.date === "2026-07-03")?.state).toBe(
      "overfilled"
    );
  });
});
