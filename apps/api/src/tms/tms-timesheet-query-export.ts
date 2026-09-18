import type {
  TmsTimesheetQueryDetailRow,
  TmsTimesheetQuerySummaryRow,
} from "@project-wing/shared";
import { XLSX } from "../common/xlsx";

export function buildTmsQueryWorkbook(
  mode: "DETAIL" | "SUMMARY",
  rows: (TmsTimesheetQueryDetailRow | TmsTimesheetQuerySummaryRow)[]
) {
  const records = rows.map((row) => ({
    "Job Code": row.jobCode,
    "Staff No": row.staffNo ?? "",
    "Staff Name": row.staffName,
    ...(mode === "DETAIL"
      ? {
          "Timesheet Date": (row as TmsTimesheetQueryDetailRow).timesheetDate,
        }
      : {
          "Date From": (row as TmsTimesheetQuerySummaryRow).dateFrom ?? "",
          "Date To": (row as TmsTimesheetQuerySummaryRow).dateTo ?? "",
        }),
    Rate: numberOrBlank(row.rate),
    Normal: row.normal,
    OT: row.ot,
    Absent: row.absent,
    Total: numberOrBlank(row.total),
    "Client Name": row.clientName,
    "Net Budget Fee": numberOrBlank(row.netBudgetFee),
    PIC: row.pic ?? "",
    MIC: row.mic ?? "",
    "Timesheet Status": row.timesheetStatus,
    "Active Status": row.activeStatus,
  }));
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(
    workbook,
    XLSX.utils.json_to_sheet(records),
    mode === "DETAIL" ? "Timesheet Detail" : "Timesheet Summary"
  );
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
}

function numberOrBlank(value: string | null) {
  return value === null ? "" : Number(value);
}
