import {
  CMP_ENGAGEMENT_DELIVERABLE_LABELS,
  CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS,
} from "@project-wing/shared";
import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import type { CmpRecordPreviewLocale } from "@project-wing/shared/cmp-record-preview";
import ExcelJS from "exceljs";

type WorkbookClient = {
  clientCode: string;
  companyCode?: string | null;
  companyNumber?: string | null;
  nameEn?: string | null;
  nameZh?: string | null;
  status: CmpClient["status"];
  listedOrPrivate?: string | null;
  placeOfIncorporation?: string | null;
  contactPerson?: string | null;
};

const BLUE = "FF1F4E78";
const BORDER = "FFA6B7C8";
const NAVY = "FF17365D";
const PALE_BLUE = "FFD9EAF7";
const PALE_GREEN = "FFE2F0D9";
const border: ExcelJS.Borders = {
  top: { style: "thin", color: { argb: BORDER } },
  bottom: { style: "thin", color: { argb: BORDER } },
  left: { style: "thin", color: { argb: BORDER } },
  right: { style: "thin", color: { argb: BORDER } },
  diagonal: {},
};
const style = {
  title: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } },
    font: {
      name: "Arial",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 18,
    },
    alignment: { horizontal: "center", vertical: "middle" },
  },
  subtitle: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEAF2F8" },
    },
    font: {
      name: "Arial",
      italic: true,
      color: { argb: "FF536879" },
      size: 10,
    },
    alignment: { horizontal: "center", vertical: "middle" },
  },
  section: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: BLUE } },
    font: {
      name: "Arial",
      bold: true,
      color: { argb: "FFFFFFFF" },
      size: 12,
    },
    alignment: { vertical: "middle" },
  },
  label: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: PALE_BLUE } },
    font: { name: "Arial", bold: true, color: { argb: NAVY }, size: 10 },
    alignment: { vertical: "middle", wrapText: true },
  },
  value: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFFFFFFF" },
    },
    font: { name: "Arial", color: { argb: "FF1F2937" }, size: 10 },
    alignment: { vertical: "middle", wrapText: true },
  },
  header: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } },
    font: { name: "Arial", bold: true, color: { argb: "FFFFFFFF" }, size: 9 },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
  },
  formula: {
    fill: {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: PALE_GREEN },
    },
    font: {
      name: "Arial",
      bold: true,
      color: { argb: "FF174A2A" },
      size: 10,
    },
    alignment: { vertical: "middle" },
  },
} satisfies Record<string, Partial<ExcelJS.Style>>;

export async function buildEngagementBudgetWorkbook(input: {
  engagement: CmpEngagement;
  client: WorkbookClient;
  locale: CmpRecordPreviewLocale;
}) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Project Wing CMP";
  const form = workbook.addWorksheet("Form", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  const appendix = workbook.addWorksheet("Appendix 1", {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  buildForm(form, input);
  buildAppendix(appendix, input);
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

function buildForm(
  sheet: ExcelJS.Worksheet,
  {
    engagement,
    client,
    locale,
  }: Parameters<typeof buildEngagementBudgetWorkbook>[0]
) {
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [22, 16, 11, 30, 15, 15, 14, 12, 14, 18].map((width) => ({
    width,
  }));

  merged(
    sheet,
    "A1:J1",
    "WZ CPA Firm — Engagement Budget Sheet",
    style.title,
    30
  );
  merged(
    sheet,
    "A2:J2",
    t(
      "Engagement setup, team allocation and budget control",
      "业务设定、团队配置及预算控制"
    ),
    style.subtitle,
    20
  );
  section(
    sheet,
    4,
    t("I. ENGAGEMENT INFORMATION", "I. 业务信息"),
    t("Engagement and client data from CMP.", "来自 CMP 的业务及客户资料。")
  );
  const fields: [number, string, unknown, string, unknown][] = [
    [
      6,
      t("Client Code", "客户编号"),
      client.clientCode,
      t("Engagement Code", "业务代码"),
      engagement.engagementCode,
    ],
    [
      7,
      t("Client Name (English)", "客户英文名称"),
      client.nameEn,
      t("Client Name (Chinese)", "客户中文名称"),
      client.nameZh,
    ],
    [
      8,
      t("Company Type", "公司类型"),
      companyType(client.listedOrPrivate, locale),
      t("Client Status", "客户状态"),
      clientStatus(client.status, locale),
    ],
    [
      9,
      t("Service Type", "服务类型"),
      serviceType(engagement.serviceType, locale),
      t("Place of Incorporation", "注册地"),
      client.placeOfIncorporation,
    ],
    [
      10,
      t("Year / Period End", "年结日"),
      date(engagement.yearEndDate),
      t("Engagement Date", "业务日期"),
      date(engagement.engagementDate),
    ],
    [
      11,
      t("Expected Report Date", "预计报告日期"),
      date(engagement.reportDate),
      t("Approval Reference", "审批编号"),
      engagement.approvalReferenceNumber ?? "—",
    ],
    [
      12,
      t("AML / TF Risk", "反洗钱／恐怖融资风险"),
      engagement.amlRiskClassification === "HIGH"
        ? t("High", "高风险")
        : t("Not high", "非高风险"),
      t("Engagement Risk", "业务风险"),
      engagement.engagementRiskClassification === "GREATER_THAN_NORMAL"
        ? t("Greater than normal", "高于正常")
        : t("Normal", "正常"),
    ],
    [
      13,
      t("Budget Currency", "预算币种"),
      engagement.feeCurrency,
      t("FX Rate (HKD per unit)", "汇率（每单位币种兑港币）"),
      engagement.feeExchangeRateHkdPerUnit ??
        engagement.feeExchangeRateSnapshot?.hkdPerUnit ??
        (engagement.feeCurrency === "HKD" ? "1.0000" : "—"),
    ],
    [
      14,
      t("Engagement Status", "业务状态"),
      engagementStatus(engagement.status, locale),
      t("Scope / Nature of Engagement", "业务范围／性质"),
      engagement.otherServiceDescription,
    ],
  ];
  fields.forEach(([rowNumber, leftLabel, leftValue, rightLabel, rightValue]) =>
    paired(sheet, rowNumber, leftLabel, leftValue, rightLabel, rightValue)
  );

  section(
    sheet,
    16,
    t("II. RESPONSIBLE PERSONS", "II. 负责人"),
    t("Current engagement assignees.", "当前业务负责人。")
  );
  paired(sheet, 18, "PIC", engagement.pic, "MIC", engagement.mic);
  paired(
    sheet,
    19,
    "EQR",
    engagement.eqReviewer,
    t("Client Contact", "客户联系人"),
    client.contactPerson
  );

  section(
    sheet,
    21,
    t("III. REPORTS & DELIVERABLES", "III. 报告及交付物"),
    t(
      "Selected deliverables are listed below; see Appendix 1 for a working list.",
      "下列为已选交付物；工作清单见附录 1。"
    )
  );
  const deliverables = [...(engagement.deliverables ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  paired(
    sheet,
    23,
    t("Auditor's Report", "审计师报告"),
    deliverables.some((item) => item.code === "AUDITORS_REPORT")
      ? t("Yes", "是")
      : t("No", "否"),
    t("Custom Deliverable 1", "自定义交付物 1"),
    custom(deliverables, 0, locale)
  );
  paired(
    sheet,
    24,
    t("Custom Deliverable 2", "自定义交付物 2"),
    custom(deliverables, 1, locale),
    t("Deliverables Notes", "交付物备注"),
    deliverables
      .filter((item) => item.code === "CUSTOM")
      .slice(2)
      .map((item) => item.description)
      .filter(Boolean)
      .join("; ")
  );

  section(
    sheet,
    27,
    t("IV. BUDGET TIME COSTS", "IV. 预算工时及成本"),
    t(
      "Current CMP budget lines. TBC represents an unconfirmed staff assignment.",
      "当前 CMP 预算明细。TBC 表示待确认人员。"
    )
  );
  row(
    sheet,
    29,
    [
      t("Firm Grade", "事务所职级"),
      t("Fixed Hourly Rate", "固定时薪"),
      t("Staff Name / TBC", "员工姓名／TBC"),
      t("Date From", "开始日期"),
      t("Date To", "结束日期"),
      t("Budget in Hours", "预算工时"),
      t(
        `Budget Cost (${engagement.feeCurrency})`,
        `预算成本（${engagement.feeCurrency}）`
      ),
    ],
    style.header,
    30
  );
  const lines = engagement.feePlanningLines ?? [];
  const start = 30;
  const count = Math.max(lines.length, 17);
  const total = start + count;
  for (let index = 0; index < count; index += 1) {
    const line = lines[index];
    const targetRow = start + index;
    if (!line) {
      emptyRow(sheet, targetRow, 7, style.value, 22);
      continue;
    }
    const staff =
      line.assignmentType === "STAFF" ? (line.staff?.name ?? "TBC") : "TBC";
    row(
      sheet,
      targetRow,
      [
        CMP_ENGAGEMENT_FEE_PLAN_GRADE_LABELS[line.grade][zh ? "zh" : "en"],
        number(line.hourlyRate),
        staff,
        date(line.dateFrom),
        date(line.dateTo),
        number(line.budgetHours),
        "",
      ],
      style.value,
      22
    );
    formula(sheet, `G${targetRow}`, `F${targetRow}*B${targetRow}`, "#,##0.00");
    sheet.getCell(`B${targetRow}`).numFmt = "#,##0.00";
  }
  sheet.mergeCells(`A${total}:E${total}`);
  cell(sheet, `A${total}`, t("TOTAL BUDGET", "预算合计"), style.section);
  formula(sheet, `F${total}`, `SUM(F${start}:F${total - 1})`, "0.00");
  formula(sheet, `G${total}`, `SUM(G${start}:G${total - 1})`, "#,##0.00");
  sheet.getRow(total).height = 22;

  const fee = total + 3;
  section(
    sheet,
    fee,
    t("V. FEE, BILLING & COVERAGE", "V. 费用、开票及覆盖率"),
    t(
      "Coverage compares the agreed fee with total planned time cost.",
      "覆盖率按约定费用与预计工时成本计算。"
    )
  );
  const costRow = fee + 2;
  paired(
    sheet,
    costRow,
    t("Agreed Fee", "约定费用"),
    engagement.agreedFee,
    t("Total Time Cost", "总工时成本"),
    ""
  );
  formula(sheet, `F${costRow}`, `J${total}`, "#,##0.00");
  paired(
    sheet,
    costRow + 1,
    t("Budgeted Hours", "预算工时"),
    engagement.budgetedHours,
    t("Coverage Rate", "覆盖率"),
    ""
  );
  formula(
    sheet,
    `F${costRow + 1}`,
    `IFERROR(B${costRow}/F${costRow},0)`,
    "0.0%"
  );
  paired(
    sheet,
    costRow + 2,
    t("Recovery Rate", "回收率"),
    engagement.recoveryRate ? `${engagement.recoveryRate}%` : "—",
    t("Budget Gap", "预算差额"),
    ""
  );
  formula(sheet, `F${costRow + 2}`, `B${costRow}-F${costRow}`, "#,##0.00");

  const invoice = fee + 6;
  merged(
    sheet,
    `A${invoice}:J${invoice}`,
    t(
      "Invoice / Billing Plan (amounts in budget currency)",
      "开票／收费计划（金额按预算币种）"
    ),
    style.label,
    20
  );
  const billingPlans = engagement.feeNotes ?? [];
  const planRows = Math.max(1, billingPlans.length);
  billingPlans.forEach((note, index) => {
    paired(
      sheet,
      invoice + 1 + index,
      t(`Invoice ${note.periodNumber} Date`, `第 ${note.periodNumber} 期计划开票日期`),
      note.plannedIssueDate || note.issueDate || "",
      t("Amount", "金额"),
      note.plannedAmount || note.totalAmount || ""
    );
  });
  if (!billingPlans.length) {
    placeholderPair(sheet, invoice + 1, t("Invoice Date", "计划开票日期"), t("Amount", "金额"));
  }

  const signoff = invoice + planRows + 3;
  section(sheet, signoff, t("VI. REMARKS & SIGN-OFF", "VI. 备注及签核"));
  paired(
    sheet,
    signoff + 2,
    t("Budget Remarks", "预算备注"),
    engagement.remarks,
    t("Prepared By", "编制人"),
    "—"
  );
  paired(
    sheet,
    signoff + 3,
    t("MIC Review", "MIC 复核"),
    engagement.mic,
    t("PIC Approval", "PIC 批准"),
    engagement.pic
  );
  paired(
    sheet,
    signoff + 4,
    t("Exported At", "导出时间"),
    dateTime(new Date()),
    t("Company Code", "公司代码"),
    client.companyCode || client.companyNumber
  );
  configurePrintLayout(sheet, `A1:J${signoff + 4}`);
}

function buildAppendix(
  sheet: ExcelJS.Worksheet,
  { engagement, locale }: Parameters<typeof buildEngagementBudgetWorkbook>[0]
) {
  const zh = locale === "zh-CN";
  const t = (en: string, cn: string) => (zh ? cn : en);
  sheet.properties.defaultRowHeight = 20;
  sheet.columns = [22, 35, 13, 40, 22, 16].map((width) => ({ width }));
  merged(
    sheet,
    "A1:F1",
    t("Appendix 1 — Engagement Deliverables", "附录 1 — 业务交付物"),
    style.title,
    30
  );
  merged(
    sheet,
    "A2:F2",
    t("Current selected deliverables from CMP.", "来自 CMP 的当前已选交付物。"),
    style.subtitle,
    20
  );
  row(
    sheet,
    4,
    [
      t("Category", "类别"),
      t("Deliverable", "交付物"),
      t("Selected", "已选择"),
      t("Description / Notes", "说明／备注"),
      t("Owner", "负责人"),
      t("Due Date", "截止日期"),
    ],
    style.header,
    28
  );
  const deliverables = [...(engagement.deliverables ?? [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );
  for (let index = 0; index < Math.max(deliverables.length, 4); index += 1) {
    const item = deliverables[index];
    row(
      sheet,
      5 + index,
      item
        ? [
            item.category === "ANNUAL_AUDIT"
              ? t("Annual Audit", "年度审计")
              : t("Other", "其他"),
            CMP_ENGAGEMENT_DELIVERABLE_LABELS[item.code][zh ? "zh" : "en"],
            t("Yes", "是"),
            item.description ?? "—",
            "—",
            "—",
          ]
        : Array.from({ length: 6 }, () => ""),
      style.value,
      22
    );
    if (!item) {
      emptyRow(sheet, 5 + index, 6, style.value, 22);
    }
  }
  configurePrintLayout(sheet, `A1:F${4 + Math.max(deliverables.length, 4)}`);
}

function configurePrintLayout(sheet: ExcelJS.Worksheet, printArea: string) {
  sheet.pageSetup = {
    ...sheet.pageSetup,
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    verticalCentered: false,
    margins: {
      left: 0.25,
      right: 0.25,
      top: 0.35,
      bottom: 0.35,
      header: 0.15,
      footer: 0.15,
    },
    printArea,
  };
}

function paired(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  leftLabel: string,
  leftValue: unknown,
  rightLabel: string,
  rightValue: unknown
) {
  cell(sheet, `A${rowNumber}`, leftLabel, style.label);
  sheet.mergeCells(`B${rowNumber}:D${rowNumber}`);
  cell(sheet, `B${rowNumber}`, render(leftValue), style.value);
  cell(sheet, `E${rowNumber}`, rightLabel, style.label);
  sheet.mergeCells(`F${rowNumber}:J${rowNumber}`);
  cell(sheet, `F${rowNumber}`, render(rightValue), style.value);
}

function placeholderPair(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  leftLabel: string,
  rightLabel: string
) {
  cell(sheet, `A${rowNumber}`, leftLabel, style.label);
  sheet.mergeCells(`B${rowNumber}:D${rowNumber}`);
  blankCell(sheet, `B${rowNumber}`, style.value);
  cell(sheet, `E${rowNumber}`, rightLabel, style.label);
  sheet.mergeCells(`F${rowNumber}:J${rowNumber}`);
  blankCell(sheet, `F${rowNumber}`, style.value);
}

function section(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  title: string,
  subtitle?: string
) {
  merged(sheet, `A${rowNumber}:J${rowNumber}`, title, style.section, 24);
  if (subtitle) {
    merged(
      sheet,
      `A${rowNumber + 1}:J${rowNumber + 1}`,
      subtitle,
      style.subtitle,
      18
    );
  }
}

function row(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  values: unknown[],
  cellStyle: Partial<ExcelJS.Style>,
  height?: number
) {
  values.forEach((entry, index) =>
    cell(sheet, `${column(index)}${rowNumber}`, render(entry), cellStyle)
  );
  if (height) {
    sheet.getRow(rowNumber).height = height;
  }
}

function emptyRow(
  sheet: ExcelJS.Worksheet,
  rowNumber: number,
  columns: number,
  cellStyle: Partial<ExcelJS.Style>,
  height?: number
) {
  Array.from({ length: columns }, (_, index) =>
    blankCell(sheet, `${column(index)}${rowNumber}`, cellStyle)
  );
  if (height) {
    sheet.getRow(rowNumber).height = height;
  }
}

function merged(
  sheet: ExcelJS.Worksheet,
  range: string,
  entry: unknown,
  cellStyle: Partial<ExcelJS.Style>,
  height?: number
) {
  sheet.mergeCells(range);
  cell(sheet, range.slice(0, range.indexOf(":")), render(entry), cellStyle);
  if (height) {
    sheet.getRow(Number(range.match(/\d+/)?.[0] ?? 1)).height = height;
  }
}

function cell(
  sheet: ExcelJS.Worksheet,
  address: string,
  entry: ExcelJS.CellValue,
  cellStyle: Partial<ExcelJS.Style>
) {
  const target = sheet.getCell(address);
  target.value = entry;
  target.style = { ...cellStyle, border } as Partial<ExcelJS.Style>;
}

function blankCell(
  sheet: ExcelJS.Worksheet,
  address: string,
  cellStyle: Partial<ExcelJS.Style>
) {
  const target = sheet.getCell(address);
  target.value = null;
  target.style = { ...cellStyle, border } as Partial<ExcelJS.Style>;
}

function formula(
  sheet: ExcelJS.Worksheet,
  address: string,
  expression: string,
  numberFormat: string
) {
  const target = sheet.getCell(address);
  target.value = { formula: expression, result: 0 };
  target.style = { ...style.formula, border } as Partial<ExcelJS.Style>;
  target.numFmt = numberFormat;
}

function column(index: number) {
  return String.fromCodePoint(65 + index);
}

function render(input: unknown): ExcelJS.CellValue {
  return input === null || input === undefined || input === ""
    ? "—"
    : (input as ExcelJS.CellValue);
}

function date(input: string | null | undefined) {
  if (!input) {
    return "—";
  }
  const parsed = new Date(`${input}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime())
    ? input
    : parsed.toISOString().slice(0, 10);
}

function dateTime(input: Date) {
  return input.toISOString().slice(0, 16).replace("T", " ");
}

function number(input: string) {
  const result = Number(input);
  return Number.isFinite(result) ? result : 0;
}

function custom(
  deliverables: NonNullable<CmpEngagement["deliverables"]>,
  index: number,
  locale: CmpRecordPreviewLocale
) {
  const item = deliverables.filter((entry) => entry.code === "CUSTOM")[index];
  if (!item) {
    return "—";
  }
  const label =
    CMP_ENGAGEMENT_DELIVERABLE_LABELS.CUSTOM[locale === "zh-CN" ? "zh" : "en"];
  return item.description ? `${label}: ${item.description}` : label;
}

function serviceType(
  value: CmpEngagement["serviceType"],
  locale: CmpRecordPreviewLocale
) {
  const labels: Record<CmpEngagement["serviceType"], [string, string]> = {
    ANNUAL_AUDIT: ["Annual Audit", "年度审计"],
    REVIEW: ["Review", "审阅"],
    SPECIAL_AUDIT_PRIVATE_CO: [
      "Special audit for private co.",
      "私人公司专项审计",
    ],
    OTHERS: ["Others", "其他"],
    AUDIT: ["Audit", "审计"],
    TAX: ["Tax", "税务"],
    RISK: ["Risk", "风险"],
    ACCOUNTING: ["Accounting Service", "会计服务"],
    COM_SEC: ["Com Sec", "公司秘书"],
  };
  return labels[value][locale === "zh-CN" ? 1 : 0];
}

function companyType(
  value: string | null | undefined,
  locale: CmpRecordPreviewLocale
) {
  const labels = {
    PRIVATE: ["Private", "私人公司"],
    LISTED: ["Listed", "上市公司"],
    OTHERS: ["Others", "其他"],
  } as const;
  return value && value in labels
    ? labels[value as keyof typeof labels][locale === "zh-CN" ? 1 : 0]
    : value || "—";
}

function clientStatus(
  value: CmpClient["status"],
  locale: CmpRecordPreviewLocale
) {
  const labels = {
    ACTIVE: ["Active", "有效"],
    INACTIVE: ["Inactive", "无效"],
    RESIGNED: ["Resigned", "已辞任"],
  } as const;
  return labels[value][locale === "zh-CN" ? 1 : 0];
}

function engagementStatus(
  value: CmpEngagement["status"],
  locale: CmpRecordPreviewLocale
) {
  const labels = {
    ACTIVE: ["Active", "有效"],
    INACTIVE: ["Inactive", "无效"],
    COMPLETED: ["Completed", "已完成"],
    ARCHIVED: ["Archived", "已归档"],
  } as const;
  return labels[value][locale === "zh-CN" ? 1 : 0];
}
