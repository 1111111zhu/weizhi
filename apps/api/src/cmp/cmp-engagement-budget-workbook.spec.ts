import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import ExcelJS from "exceljs";
import { XLSX } from "../common/xlsx";

import { buildEngagementBudgetWorkbook } from "./cmp-engagement-budget-workbook";

const client = {
  clientCode: "C-ORC-2026",
  companyCode: "ORC-001",
  companyNumber: "7890123",
  nameEn: "Orchid Technology Limited",
  nameZh: "兰花科技有限公司",
  status: "ACTIVE",
  listedOrPrivate: "PRIVATE",
  placeOfIncorporation: "Hong Kong",
  contactPerson: "Jony Ma",
} as unknown as Pick<
  CmpClient,
  | "clientCode"
  | "companyCode"
  | "companyNumber"
  | "nameEn"
  | "nameZh"
  | "status"
  | "listedOrPrivate"
  | "placeOfIncorporation"
  | "contactPerson"
>;
const engagement = {
  id: "engagement-1",
  clientId: "client-1",
  client: {
    id: "client-1",
    clientCode: client.clientCode,
    nameEn: client.nameEn,
    nameZh: client.nameZh,
    status: "ACTIVE",
  },
  engagementCode: "ORC-2026-AUD",
  serviceType: "ANNUAL_AUDIT",
  otherServiceDescription: null,
  deliverables: [
    {
      key: "auditors-report",
      category: "ANNUAL_AUDIT",
      code: "AUDITORS_REPORT",
      sortOrder: 0,
    },
    {
      key: "custom-deliverable",
      category: "OTHERS",
      code: "CUSTOM",
      description: "Management presentation",
      sortOrder: 1,
    },
  ],
  yearEndDate: "2026-12-31",
  reportDate: "2027-03-31",
  approvalReferenceNumber: null,
  engagementDate: "2026-08-19",
  budgetedHours: "130.00",
  agreedFee: "80000.00",
  recoveryRate: "84.50",
  feeCurrency: "HKD",
  feeExchangeRateSnapshot: null,
  amlRiskClassification: "NOT_HIGH",
  engagementRiskClassification: "GREATER_THAN_NORMAL",
  picUserId: "pic-1",
  micUserId: "mic-1",
  eqReviewerUserId: "eqr-1",
  pic: "Jony Ma",
  mic: "Eden Chan",
  eqReviewer: "Fiona Lee",
  feePlanningLines: [
    {
      id: "line-1",
      grade: "MANAGER",
      assignmentType: "STAFF",
      hourlyRate: "2400.00",
      budgetHours: "10.00",
      dateFrom: "2026-09-01",
      dateTo: "2026-09-07",
      lineTotal: "24000.00",
      staff: { id: "staff-1", name: "Alice Wong", email: "alice@example.com" },
      sortOrder: 0,
    },
  ],
  status: "ACTIVE",
  remarks: "Sample Engagement budget export",
  createdById: "staff-1",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-19T00:00:00.000Z",
  codeAliases: [],
} as unknown as CmpEngagement;

describe(buildEngagementBudgetWorkbook, () => {
  it("creates the Engagement budget workbook in the Job Budget Sheet layout", async () => {
    const body = await buildEngagementBudgetWorkbook({
      engagement,
      client,
      locale: "en-US",
    });
    const workbook = XLSX.read(body, { type: "buffer", cellFormula: true });
    const form = workbook.Sheets.Form;
    const appendix = workbook.Sheets["Appendix 1"];

    expect(workbook.SheetNames).toStrictEqual(["Form", "Appendix 1"]);
    expect(form.A1?.v).toBe("WZ CPA Firm — Engagement Budget Sheet");
    expect(form.B6?.v).toBe("C-ORC-2026");
    expect(form.F6?.v).toBe("ORC-2026-AUD");
    expect(form.B18?.v).toBe("Jony Ma");
    expect(form.F18?.v).toBe("Eden Chan");
    expect(form.C30?.v).toBe("Alice Wong");
    expect(form.G30?.f).toBe("F30*B30");
    expect(form.F47?.f).toContain("SUM(F30:F46)");
    expect(form.G47?.f).toContain("SUM(G30:G46)");
    expect(appendix.B5?.v).toBe("Auditor's report");
    expect(appendix.B6?.v).toBe("Custom deliverable");
    expect(appendix.D6?.v).toBe("Management presentation");

    const excelWorkbook = new ExcelJS.Workbook();
    await excelWorkbook.xlsx.load(body as never);
    const printableForm = excelWorkbook.getWorksheet("Form");
    expect(printableForm?.pageSetup.orientation).toBe("landscape");
    expect(printableForm?.pageSetup.fitToPage).toBeTruthy();
    expect(printableForm?.pageSetup.fitToWidth).toBe(1);
    expect(printableForm?.pageSetup.printArea).toBe("A1:J64");
    expect(form.A60?.v).toBe("VI. REMARKS & SIGN-OFF");
    expect(form.A63?.v).not.toBe("VI. BUDGET QUALITY CHECKS");
  });

  it("uses Chinese labels while keeping the same field order and formulas", async () => {
    const body = await buildEngagementBudgetWorkbook({
      engagement,
      client,
      locale: "zh-CN",
    });
    const workbook = XLSX.read(body, { type: "buffer", cellFormula: true });
    const form = workbook.Sheets.Form;

    expect(form.A4?.v).toBe("I. 业务信息");
    expect(form.A29?.v).toBe("事务所职级");
    expect(form.G30?.f).toBe("F30*B30");
  });
});
