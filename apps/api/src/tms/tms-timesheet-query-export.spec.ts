import { XLSX } from "../common/xlsx";

import { buildTmsQueryWorkbook } from "./tms-timesheet-query-export";

describe(buildTmsQueryWorkbook, () => {
  it("exports detail rows with numeric totals", () => {
    const buffer = buildTmsQueryWorkbook("DETAIL", [
      {
        jobCode: "JOB-001",
        staffNo: "A4050",
        staffName: "Hugo Lam",
        timesheetDate: "2026-07-01",
        rate: "1800.00",
        normal: 8,
        ot: 2,
        absent: 0,
        total: "18000.00",
        clientName: "Dragon Huge",
        netBudgetFee: "480000.00",
        pic: "Billy Lau",
        mic: "John Tu",
        timesheetStatus: "DRAFT",
        activeStatus: "ACTIVE",
      },
    ]);
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const rows = XLSX.utils.sheet_to_json(
      assertPresentValue(workbook.Sheets["Timesheet Detail"])
    );
    expect(rows[0]).toMatchObject({
      "Job Code": "JOB-001",
      "Staff No": "A4050",
      Total: 18_000,
    });
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
