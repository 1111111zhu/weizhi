import { NodeCompiler } from "@myriaddreamin/typst-ts-node-compiler";
import type { CmpClient, CmpEngagement } from "@project-wing/shared";
import type { CmpClientGraph } from "@project-wing/shared/cmp-entity-graph";

import {
  buildClientPreviewDocument,
  buildCmpRecordPreviewPdfSource,
  buildEngagementPreviewDocument,
} from "./cmp-record-preview";

const client = {
  id: "client-1",
  clientCode: "C001",
  companyCode: "EX-001",
  companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
  companyNumber: "1234567",
  nameZh: "示例有限公司",
  nameEn: "Example Limited",
  addresses: [
    {
      id: "registered",
      type: "REGISTERED",
      label: null,
      address: "1 Registered Road",
      sortOrder: 0,
    },
    {
      id: "additional-2",
      type: "OTHER",
      label: null,
      address: "3 Second Road",
      sortOrder: 2,
    },
    {
      id: "additional-1",
      type: "OTHER",
      label: null,
      address: "2 First Road",
      sortOrder: 1,
    },
  ],
  relationships: [],
  yearEndMonth: 12,
  hsicSectionCode: "M",
  placeOfIncorporation: "Hong Kong",
  listedOrPrivate: "PRIVATE",
  serviceLines: "Audit, Tax",
  clientPartnerPic: "PIC User",
  clientManagerMic: "MIC User",
  status: "ACTIVE",
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
} as unknown as CmpClient;
const engagement = {
  id: "engagement-1",
  clientId: client.id,
  client: {
    id: client.id,
    clientCode: client.clientCode,
    nameZh: client.nameZh,
    nameEn: client.nameEn,
    status: "ACTIVE",
  },
  engagementCode: "C001-2026-AUD",
  serviceType: "ANNUAL_AUDIT",
  otherServiceDescription: null,
  deliverables: [
    { code: "AUDIT_REPORT", description: "Signed copy", sortOrder: 2 },
    { code: "MANAGEMENT_LETTER", description: null, sortOrder: 1 },
  ],
  yearEndDate: "2026-12-31",
  reportDate: null,
  approvalReferenceNumber: null,
  engagementDate: null,
  budgetedHours: "120.00",
  agreedFee: "80000.00",
  recoveryRate: "84.50",
  feeCurrency: "HKD",
  feePlanningLines: [
    {
      id: "fee-plan-1",
      grade: "MANAGER",
      assignmentType: "STAFF",
      hourlyRate: "2400.00",
      budgetHours: "10.00",
      dateFrom: "2026-04-01",
      dateTo: "2026-04-07",
      lineTotal: "24000.00",
      staff: {
        id: "staff-1",
        name: "Example Staff",
        email: "staff@example.com",
      },
      sortOrder: 0,
    },
  ],
  pic: "PIC User",
  mic: "MIC User",
  status: "ACTIVE",
  remarks: null,
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-08T00:00:00.000Z",
} as unknown as CmpEngagement;

describe("cMP record preview documents", () => {
  it("includes Company Code in the current Client document and omits retired fields", () => {
    const document = buildClientPreviewDocument(client, "en-US");

    expect(document.sections.map((section) => section.id)).toStrictEqual([
      "basic",
      "registration",
      "relationships",
      "responsible-and-services",
    ]);
    expect(
      document.sections[0]?.fields.slice(0, 5).map((field) => field.id)
    ).toStrictEqual([
      "clientCode",
      "companyCode",
      "companyIdentifierType",
      "companyNumber",
      "nameEn",
    ]);
    expect(
      document.sections[0]?.fields.find((field) => field.id === "email")?.value
    ).toBe("—");
    expect(
      document.sections[0]?.fields.find(
        (field) => field.id === "additionalAddresses"
      )?.value
    ).toMatch(
      /^Additional address 1: 2 First Road\nAdditional address 2: 3 Second Road$/
    );
    expect(
      document.sections
        .flatMap((section) => section.fields)
        .map((field) => field.id)
    ).not.toStrictEqual(
      expect.arrayContaining([
        "yearEndDate",
        "groupMode",
        "approvalReferenceNumber",
        "taxServiceDetails",
      ])
    );
  });

  it("uses the current Engagement form sections and preserves deliverable order", () => {
    const document = buildEngagementPreviewDocument(engagement, "zh-CN");

    expect(document.sections.map((section) => section.id)).toStrictEqual([
      "setup",
      "budget",
      "notes",
    ]);
    expect(
      document.sections[0]?.fields.find(
        (field) => field.id === "engagementRiskClassification"
      )?.value
    ).toBe("正常（例如私人公司）");
    expect(
      document.sections[0]?.fields.find((field) => field.id === "deliverables")
        ?.value
    ).toBe("MANAGEMENT_LETTER\nAUDIT_REPORT: Signed copy");
    expect(
      document.sections[1]?.fields.find((field) => field.id === "agreedFee")
        ?.value
    ).toContain("80,000.00");
    const table = document.sections[1]?.tables?.[0];
    expect(table?.columns).toStrictEqual(
      expect.arrayContaining(["开始日期", "结束日期"])
    );
    expect(table?.rows[0]).toStrictEqual(
      expect.arrayContaining(["2026年4月1日", "2026年4月7日"])
    );
  });

  it("shows associate and joint venture relationships in the Client preview", () => {
    const graph = {
      client: {
        id: client.id,
        clientCode: client.clientCode,
        rootEntityId: "a",
      },
      asOf: "2026-08-22",
      nodes: ["a", "b", "c", "d"].map((id) => ({
        id,
        kind: "COMPANY" as const,
        displayName: `Company ${id.toUpperCase()}`,
        nameZh: null,
        nameEn: `Company ${id.toUpperCase()}`,
        jurisdiction: null,
        registrationNumber: null,
        status: "ACTIVE" as const,
        role: id === "a" ? ("ROOT" as const) : ("RELATED" as const),
        isRoot: id === "a",
        clientIds: [client.id],
      })),
      edges: [],
      groupRelationships: [
        {
          id: "associate-1",
          targetEntityId: "d",
          type: "ASSOCIATE" as const,
          effectiveFrom: null,
          effectiveTo: null,
          remarks: null,
          sourceDocument: null,
          participants: [
            {
              entityId: "a",
              method: "OWNERSHIP" as const,
              ownershipPercentage: 30,
              otherDescription: null,
            },
          ],
          createdAt: "2026-08-22T00:00:00.000Z",
          updatedAt: "2026-08-22T00:00:00.000Z",
        },
      ],
    } satisfies CmpClientGraph;

    const document = buildClientPreviewDocument(client, "en-US", graph);
    const fields = document.sections.find(
      (section) => section.id === "relationships"
    )?.fields;
    expect(
      fields?.find((field) => field.id === "groupRelationships")?.value
    ).toContain("Associate · Company D · Company A · Ownership 30%");
  });

  it("uses the same ordered sections in the printable PDF source", () => {
    const document = buildClientPreviewDocument(client, "en-US");
    const source = buildCmpRecordPreviewPdfSource(document);

    expect(
      source.indexOf(assertPresentValue(document.sections[0]).title)
    ).toBeLessThan(
      source.indexOf(assertPresentValue(document.sections[1]).title)
    );
    expect(source).toContain("Additional Addresses");
    expect(source).toContain("—");
    expect(source).not.toContain(`${document.code} · ${document.status}`);
  });

  it("compiles English and Chinese preview documents into PDFs", () => {
    for (const document of [
      buildClientPreviewDocument(client, "en-US"),
      buildEngagementPreviewDocument(engagement, "zh-CN"),
    ]) {
      const compiler = NodeCompiler.create();
      const compiled = compiler.compile({
        mainFileContent: buildCmpRecordPreviewPdfSource(document),
      });
      expect(compiled.hasError()).toBeFalsy();
      expect(compiled.result).toBeTruthy();
      if (!compiled.result) {
        throw new Error("Typst did not return a compiled document");
      }
      expect(
        Buffer.from(compiler.pdf(compiled.result))
          .subarray(0, 4)
          .toString("ascii")
      ).toBe("%PDF");
    }
  });
});

function assertPresentValue<T>(value: T): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error("Expected a non-null value");
  }
  return value as NonNullable<T>;
}
