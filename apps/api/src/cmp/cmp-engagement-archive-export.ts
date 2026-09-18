import type { CmpEngagementArchiveSnapshot } from "@project-wing/shared";
import ExcelJS from "exceljs";

export async function buildEngagementArchiveWorkbook(
  snapshot: CmpEngagementArchiveSnapshot
) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Project Wing CMP";
  const overview = workbook.addWorksheet("Archive");
  overview.columns = [{ width: 26 }, { width: 52 }, { width: 22 }];
  overview.addRow(["CMP Engagement Archive / CMP 业务归档"]);
  overview.mergeCells("A1:C1");
  overview.getCell("A1").font = { bold: true, size: 16 };
  const {engagement} = snapshot;
  for (const [label, value] of [
    ["Engagement Code / 业务代码", engagement.engagementCode],
    [
      "Client / 客户",
      engagement.client.nameZh ||
        engagement.client.nameEn ||
        engagement.client.clientCode,
    ],
    ["Report Date / 报告日期", engagement.reportDate ?? ""],
    ["PIC", engagement.pic ?? ""],
    ["Prepared By / 编制人", snapshot.preparedById ?? snapshot.archivedById],
    ["Submitted At / 提交时间", snapshot.submittedAt ?? ""],
    ["Approved By / 批准人", snapshot.approvedById ?? snapshot.archivedById],
    ["Archived At / 归档时间", snapshot.archivedAt],
    ["Approval Note / 审批意见", snapshot.approvalNote ?? ""],
    ["Currency / 币种", snapshot.totals.currency],
    ["Budget Cost / 预算成本", snapshot.totals.budgetCost],
    ["Actual Cost / 实际成本", snapshot.totals.actualCost],
  ])
    {overview.addRow([label, value]);}
  const detail = workbook.addWorksheet("Member Costs");
  detail.columns = [22, 18, 15, 14, 14, 14, 14, 12, 14, 16, 16].map(
    (width) => ({ width })
  );
  detail.addRow([
    "Member / 成员",
    "Grade / 职级",
    "Budget Normal",
    "Budget OT",
    "Actual Normal",
    "Actual OT",
    "Absent / 缺勤",
    "Rate / 时薪",
    "Budget Cost",
    "Actual Cost",
    "Historical / 历史人员",
  ]);
  detail.getRow(1).font = { bold: true };
  for (const row of snapshot.memberCosts)
    {detail.addRow([
      row.name,
      row.grade,
      row.budgetNormal,
      row.budgetOt,
      row.actualNormal,
      row.actualOt,
      row.absent,
      row.hourlyRate,
      row.budgetCost,
      row.actualCost,
      row.historical ? "Yes / 是" : "No / 否",
    ]);}
  detail.addRow([
    "Total / 合计",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    snapshot.totals.budgetCost,
    snapshot.totals.actualCost,
    snapshot.totals.currency,
  ]);
  detail.getRow(detail.rowCount).font = { bold: true };
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function buildEngagementArchiveTypst(
  snapshot: CmpEngagementArchiveSnapshot
) {
  const e = snapshot.engagement;
  const t = (value: unknown) =>
    String(value ?? "—")
      .replaceAll("\\", "\\\\")
      .replaceAll("#", "\\#")
      .replaceAll("[", "\\[")
      .replaceAll("]", "\\]")
      .replaceAll("*", "\\*")
      .replaceAll("_", "\\_")
      .replaceAll("@", "\\@");
  const rows = snapshot.memberCosts
    .map(
      (row) =>
        `[${t(row.name)}, ${t(row.grade)}, ${t(`${row.budgetNormal} / ${row.budgetOt}`)}, ${t(`${row.actualNormal} / ${row.actualOt}`)}, ${t(row.absent)}, ${t(row.hourlyRate)}, ${t(row.budgetCost)}, ${t(row.actualCost)}],`
    )
    .join("\n");
  return `#set page(margin: 20mm)\n#set text(font: "Arial", size: 9pt)\n= CMP Engagement Archive / CMP 业务归档\n#table(columns: (35%, 65%), [Engagement Code / 业务代码], [${t(e.engagementCode)}], [Client / 客户], [${t(e.client.nameZh || e.client.nameEn || e.client.clientCode)}], [Report Date / 报告日期], [${t(e.reportDate)}], [PIC], [${t(e.pic)}], [Prepared By / 编制人], [${t(snapshot.preparedById || snapshot.archivedById)}], [Submitted At / 提交时间], [${t(snapshot.submittedAt)}], [Approved By / 批准人], [${t(snapshot.approvedById || snapshot.archivedById)}], [Approval Note / 审批意见], [${t(snapshot.approvalNote)}], [Archived At / 归档时间], [${t(snapshot.archivedAt)}], [Currency / 币种], [${t(snapshot.totals.currency)}], [Budget Cost / 预算成本], [${t(snapshot.totals.budgetCost)}], [Actual Cost / 实际成本], [${t(snapshot.totals.actualCost)}])\n\n== Member Cost Detail / 成员成本明细\n#table(columns: (18%, 12%, 12%, 12%, 10%, 10%, 13%, 13%), [Member], [Grade], [Budget N / OT], [Actual N / OT], [Absent], [Rate], [Budget Cost], [Actual Cost], ${rows} [Total / 合计], [], [], [], [], [], [${t(snapshot.totals.budgetCost)}], [${t(snapshot.totals.actualCost)}])`;
}
