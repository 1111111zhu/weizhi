import type {
  CmpAcceptanceRequest,
  CmpClient,
  CmpClientGroup,
  CmpEngagement,
  CmpEngagementArchiveMemberCost,
  GlobalRole,
  TmsEngagementSummary,
  TmsEngagementSummaryRow,
} from "@project-wing/shared";
import type {
  CmpClientGraph,
  CmpEntityRelationshipsResponse,
  CmpRelatedEntitiesResponse,
} from "@project-wing/shared/cmp-entity-graph";

const createdAt = "2026-07-16T08:30:00.000Z";
const updatedAt = "2026-07-18T09:45:00.000Z";

export function previewRelatedParties(
  clientId: string,
  asOf = "2026-07-18"
): {
  graph: CmpClientGraph;
  entities: CmpRelatedEntitiesResponse;
  relationships: CmpEntityRelationshipsResponse;
} {
  const previewClient = previewClients.find((item) => item.id === clientId);
  const rootEntityId = previewClient ? `entity-${previewClient.id}` : null;
  const entities: CmpRelatedEntitiesResponse = {
    rootEntityId,
    entities: previewClient
      ? [
          {
            id: `entity-${previewClient.id}`,
            role: "ROOT",
            kind: "COMPANY",
            displayName:
              previewClient.nameEn ??
              previewClient.nameZh ??
              previewClient.clientCode,
            nameZh: previewClient.nameZh,
            nameEn: previewClient.nameEn,
            jurisdiction: previewClient.placeOfIncorporation,
            registrationNumber: previewClient.companyNumber,
            status: "ACTIVE",
            companyProfile: null,
            personProfile: null,
            createdAt,
            updatedAt,
          },
        ]
      : [],
  };
  const relationships: CmpEntityRelationshipsResponse = { relationships: [] };
  return {
    entities,
    relationships,
    graph: {
      client: {
        id: clientId,
        clientCode: previewClient?.clientCode ?? "",
        rootEntityId,
      },
      asOf,
      nodes: entities.entities.map((entity) => ({
        id: entity.id,
        kind: entity.kind,
        displayName: entity.displayName,
        nameZh: entity.nameZh,
        nameEn: entity.nameEn,
        jurisdiction: entity.jurisdiction,
        registrationNumber: entity.registrationNumber,
        status: entity.status,
        role: entity.role,
        isRoot: entity.role === "ROOT",
        clientIds: [clientId],
      })),
      edges: [],
      groupRelationships: [],
    },
  };
}

export const previewGroups: CmpClientGroup[] = [
  group("group-harbour", "G-HARBOUR", "港湾集团", "Harbour Group", 1),
  group("group-orchid", "G-ORCHID", "兰花控股", "Orchid Holdings", 2),
  group("group-workshop", "G-WORKSHOP", "工坊集团", "Workshop Group", 1),
];

export const previewClients: CmpClient[] = [
  client({
    id: "client-harbour",
    clientCode: "C-HBR-010",
    companyCode: "HBR-010",
    companyNumber: "240379",
    nameZh: "港湾零售有限公司",
    nameEn: "Harbour Retail Limited",
    group: previewGroups[0],
    contactPerson: "Cathy Ho",
    telephone: "+852 2818 6200",
    email: "cathy@harbour.example",
    industry: "Retail",
    yearEndDate: "2026-03-31",
    serviceLines: "Audit, Accounting",
    approvalReferenceNumber: "NCA-240379",
    audit: true,
    tax: false,
    risk: false,
  }),
  client({
    id: "client-orchid",
    clientCode: "C-ORC-2026",
    companyCode: "ORC-2026",
    companyNumber: "240378",
    nameZh: "兰花科技有限公司",
    nameEn: "Orchid Technology Limited",
    group: previewGroups[1],
    contactPerson: "Ben Wong",
    telephone: "+852 3972 1188",
    email: "ben@orchid.example",
    industry: "Technology",
    yearEndDate: "2026-12-31",
    serviceLines: "Audit, Risk",
    approvalReferenceNumber: "NCA-240378",
    audit: true,
    tax: false,
    risk: true,
  }),
  client({
    id: "client-workshop",
    clientCode: "C-WKS-001",
    companyCode: "WKS-001",
    companyNumber: "240377",
    nameZh: "工坊有限公司",
    nameEn: "Workshop Company Limited",
    group: previewGroups[2],
    contactPerson: "Amy Chan",
    telephone: "+852 2180 7733",
    email: "amy@workshop.example",
    industry: "Trading",
    yearEndDate: "2026-10-31",
    serviceLines: "Audit, Tax",
    approvalReferenceNumber: "NCA-240377",
    audit: true,
    tax: true,
    risk: false,
  }),
  client({
    id: "client-e2e",
    clientCode: "E2E-20260716-2322",
    companyCode: "E2E-2322",
    companyNumber: null,
    nameZh: "CMP 全流程审批测试客户",
    nameEn: "CMP E2E Approval 20260716 2322",
    group: previewGroups[1],
    contactPerson: null,
    telephone: null,
    email: null,
    industry: "Professional services",
    yearEndDate: null,
    serviceLines: "Audit",
    approvalReferenceNumber: null,
    audit: false,
    tax: false,
    risk: false,
    status: "INACTIVE",
  }),
];

const partner = user(
  "preview-partner",
  "Jony Ma",
  "partner@projectwing.local",
  "PARTNER"
);
const mic = user(
  "preview-mic",
  "Leo Li",
  "leo.li@projectwing.local",
  "MANAGER"
);
const it = user(
  "preview-it",
  "Eden Chan",
  "eden.chan@projectwing.local",
  "SUPER_ADMIN"
);
const staff = user(
  "preview-staff",
  "Amy Chan",
  "amy.chan@projectwing.local",
  "STAFF"
);

export const previewEngagements: CmpEngagement[] = [
  engagement(
    "eng-hbr",
    previewClients[0],
    "HBR-2026-ACC",
    "ACCOUNTING",
    "2026-03-31",
    "2026-06-30",
    "NEA-240379-ACC",
    "Edric Han",
    "Leo Li",
    "ACTIVE"
  ),
  engagement(
    "eng-orc-aud",
    previewClients[1],
    "ORC-2026-AUD",
    "AUDIT",
    "2026-12-31",
    "2027-03-31",
    "NEA-240378-AUD",
    "Jony Ma",
    "Eden Chan",
    "ACTIVE"
  ),
  engagement(
    "eng-orc-email",
    previewClients[1],
    "ORC-2026-EMAIL",
    "AUDIT",
    "2026-12-31",
    null,
    null,
    null,
    null,
    "ACTIVE"
  ),
  engagement(
    "eng-orc-risk",
    previewClients[1],
    "ORC-2026-RISK",
    "RISK",
    "2026-12-31",
    "2027-02-28",
    "NEA-240378-RSK",
    "Edric Han",
    "Sam Lu",
    "ACTIVE"
  ),
  engagement(
    "eng-wks",
    previewClients[2],
    "WKS-2026-AUD",
    "AUDIT",
    "2026-10-31",
    "2027-01-31",
    "NEA-240377-AUD",
    "Jony Ma",
    "Leo Li",
    "COMPLETED"
  ),
];

function previewTmsRow(
  userId: string,
  name: string,
  values: Partial<TmsEngagementSummaryRow> = {}
): TmsEngagementSummaryRow {
  return {
    userId,
    name,
    budgetNormal: null,
    budgetOt: null,
    finalNormal: null,
    finalOt: null,
    absent: null,
    rate: null,
    budgetCost: null,
    actualCost: null,
    diff: null,
    ...values,
  };
}

export function emptyPreviewTmsSummary(): TmsEngagementSummary {
  return {
    approved: {
      rows: [],
      total: previewTmsRow("total", "Total"),
    },
    draft: {
      rows: [],
      total: previewTmsRow("total", "Total"),
    },
    periods: [],
  };
}

export const previewTmsEngagementSummaries: Record<
  string,
  TmsEngagementSummary
> = {
  "eng-hbr": {
    approved: {
      rows: [
        previewTmsRow("preview-pic", "Edric Han", {
          finalNormal: 10,
          finalOt: 2,
        }),
      ],
      total: previewTmsRow("total", "Total", {
        finalNormal: 10,
        finalOt: 2,
      }),
    },
    draft: {
      rows: [
        previewTmsRow("preview-staff", "Amy Chan", {
          finalNormal: 8,
          absent: 4,
        }),
      ],
      total: previewTmsRow("total", "Total", {
        finalNormal: 8,
        absent: 4,
      }),
    },
    periods: [
      {
        userId: "preview-pic",
        name: "Edric Han",
        year: 2026,
        month: 7,
        half: "FIRST_HALF",
        revision: 1,
        status: "APPROVED",
        bucket: "APPROVED",
        normal: 6,
        ot: 2,
        absent: 0,
        total: 8,
      },
      {
        userId: "preview-pic",
        name: "Edric Han",
        year: 2026,
        month: 7,
        half: "SECOND_HALF",
        revision: 1,
        status: "APPROVED",
        bucket: "APPROVED",
        normal: 4,
        ot: 0,
        absent: 0,
        total: 4,
      },
      {
        userId: "preview-staff",
        name: "Amy Chan",
        year: 2026,
        month: 8,
        half: "FIRST_HALF",
        revision: 1,
        status: "SUBMITTED",
        bucket: "DRAFT",
        normal: 8,
        ot: 0,
        absent: 4,
        total: 8,
      },
    ],
  },
};

export const previewUsers = [partner, mic, it, staff];

export const previewAcceptanceRequests: CmpAcceptanceRequest[] = [
  acceptance(
    "acceptance-1",
    "CA-2026-0042",
    "CLIENT",
    "PENDING_MIC",
    "MIC",
    staff,
    mic,
    partner,
    it,
    {
      clientPayload: {
        clientCode: "C-NOVA-001",
        nameZh: "新星贸易有限公司",
        nameEn: "Nova Trading Limited",
        contactPerson: "Kelly Ng",
        email: "kelly@nova.example",
        hsicSectionCode: "G",
        yearEndDate: "2026-12-31",
        serviceLines: "Audit, Tax",
        status: "ACTIVE",
      },
    }
  ),
  acceptance(
    "acceptance-2",
    "EA-2026-0038",
    "ENGAGEMENT",
    "PENDING_PIC",
    "PIC",
    staff,
    mic,
    partner,
    it,
    {
      targetClientId: previewClients[1].id,
      engagementPayload: {
        clientId: previewClients[1].id,
        engagementCode: "ORC-2027-AUD",
        serviceType: "AUDIT",
        yearEndDate: "2027-12-31",
        reportDate: "2028-03-31",
        budgetedHours: "620.00",
        agreedFee: "265000.00",
        recoveryRate: "83.50",
        feeCurrency: "HKD",
        picUserId: partner.id,
        micUserId: mic.id,
        pic: "Jony Ma",
        mic: "Leo Li",
        status: "ACTIVE",
      },
    }
  ),
  acceptance(
    "acceptance-3",
    "CC-2026-0019",
    "CLIENT_CHANGE",
    "RETURNED",
    "MIC",
    staff,
    mic,
    partner,
    it,
    {
      targetClientId: previewClients[0].id,
      clientPayload: {
        clientCode: previewClients[0].clientCode,
        nameEn: previewClients[0].nameEn ?? "",
        nameZh: previewClients[0].nameZh,
        contactPerson: "Cathy Ho",
        telephone: "+852 2818 6299",
        email: "cathy@harbour.example",
      },
      returnReason: "Please attach the updated contact authorization.",
    }
  ),
  acceptance(
    "acceptance-4",
    "EC-2026-0014",
    "ENGAGEMENT_CHANGE",
    "APPROVED",
    "DONE",
    staff,
    mic,
    partner,
    it,
    {
      targetClientId: previewClients[2].id,
      targetEngagementId: previewEngagements[4].id,
      engagementPayload: {
        clientId: previewClients[2].id,
        engagementCode: previewEngagements[4].engagementCode,
        serviceType: "AUDIT",
        budgetedHours: "450.00",
        agreedFee: "192000.00",
        recoveryRate: "81.00",
        feeCurrency: "HKD",
        picUserId: partner.id,
        micUserId: mic.id,
        pic: partner.name,
        mic: mic.name,
      },
    }
  ),
];

function group(
  id: string,
  groupCode: string,
  nameZh: string,
  nameEn: string,
  clientCount: number
): CmpClientGroup {
  return {
    id,
    groupCode,
    nameZh,
    nameEn,
    status: "ACTIVE",
    clientCount,
    createdById: "preview-partner",
    createdAt,
    updatedAt,
  };
}

function client(input: {
  id: string;
  clientCode: string;
  companyCode?: string | null;
  companyNumber: string | null;
  nameZh: string;
  nameEn: string;
  group: CmpClientGroup;
  contactPerson: string | null;
  telephone: string | null;
  email: string | null;
  industry: string;
  yearEndDate: string | null;
  serviceLines: string;
  approvalReferenceNumber: string | null;
  audit: boolean;
  tax: boolean;
  risk: boolean;
  status?: "ACTIVE" | "INACTIVE" | "RESIGNED";
}): CmpClient {
  return {
    id: input.id,
    clientCode: input.clientCode,
    companyCode: input.companyCode ?? null,
    companyNumber: input.companyNumber,
    nameZh: input.nameZh,
    nameEn: input.nameEn,
    groupId: input.group.id,
    group: input.group,
    address: "Hong Kong",
    contactPerson: input.contactPerson,
    telephone: input.telephone,
    email: input.email,
    website: null,
    yearEndDate: input.yearEndDate,
    yearEndMonth: Number(input.yearEndDate?.slice(5, 7)) || null,
    hsicSectionCode: input.industry === "Technology" ? "J" : "G",
    industryOtherDescription: null,
    reportingGaap: null,
    placeOfIncorporation: "Hong Kong",
    incorporationYearMonth: null,
    listedOrPrivate: "PRIVATE",
    stockExchangeOrListingPlace: null,
    stockCode: null,
    marketSegment: null,
    regulatedEntities: null,
    isSubsidiary: false,
    parentClientCode: null,
    subsidiariesOrAssociates: null,
    referredBy: null,
    clientPartnerPic: "Jony Ma",
    clientManagerMic: "Leo Li",
    alternativePartnerSecondMic: null,
    expectedJobOrEngagementType: "Annual service",
    serviceLines: input.serviceLines,
    approvalReferenceNumber: input.approvalReferenceNumber,
    approvalDate: input.approvalReferenceNumber ? "2026-03-12" : null,
    preparedBy: "King Su",
    approvedBy: "Leo Li",
    micApproval: "Approved",
    picApproval: "Approved",
    itAdmin: "Eden Chan",
    signOffDate: "2026-03-12",
    status: input.status ?? "ACTIVE",
    createdById: "preview-staff",
    createdAt,
    updatedAt,
  };
}

function engagement(
  id: string,
  clientRecord: CmpClient,
  engagementCode: string,
  serviceType: CmpEngagement["serviceType"],
  yearEndDate: string | null,
  reportDate: string | null,
  approvalReferenceNumber: string | null,
  pic: string | null,
  micName: string | null,
  status: CmpEngagement["status"]
): CmpEngagement {
  return {
    id,
    clientId: clientRecord.id,
    client: {
      id: clientRecord.id,
      clientCode: clientRecord.clientCode,
      nameZh: clientRecord.nameZh,
      nameEn: clientRecord.nameEn,
      status: clientRecord.status,
    },
    engagementCode,
    serviceType,
    yearEndDate,
    reportDate,
    approvalReferenceNumber,
    engagementDate: "2026-03-20",
    budgetedHours: "420.00",
    agreedFee: "180000.00",
    recoveryRate: "84.00",
    feeNotes: [],
    feePlanningLines:
      id === "eng-orc-aud"
        ? [
            {
              id: "fee-line-orc-1",
              grade: "MANAGER",
              assignmentType: "TBC",
              hourlyRate: "1800.00",
              budgetHours: "40.00",
              dateFrom: "2026-04-01",
              dateTo: "2026-04-30",
              lineTotal: "72000.00",
              staff: null,
              sortOrder: 0,
            },
            {
              id: "fee-line-orc-2",
              grade: "SENIOR",
              assignmentType: "TBC",
              hourlyRate: "900.00",
              budgetHours: "80.00",
              dateFrom: "2026-04-01",
              dateTo: "2026-04-30",
              lineTotal: "72000.00",
              staff: null,
              sortOrder: 1,
            },
          ]
        : [],
    feeCurrency: "HKD",
    amlRiskClassification: "NOT_HIGH",
    engagementRiskClassification: "NORMAL",
    picUserId: pic ? partner.id : null,
    micUserId: micName ? mic.id : null,
    eqReviewerUserId: null,
    pic,
    mic: micName,
    eqReviewer: null,
    status,
    remarks: "Preview data for layout review.",
    createdById: "preview-staff",
    createdAt,
    updatedAt,
    codeAliases: [],
  };
}

function user(id: string, name: string, email: string, globalRole: GlobalRole) {
  return { id, name, email, globalRole };
}

function acceptance(
  id: string,
  requestNo: string,
  type: CmpAcceptanceRequest["type"],
  status: CmpAcceptanceRequest["status"],
  currentStep: CmpAcceptanceRequest["currentStep"],
  submittedBy: typeof staff,
  micApprover: typeof mic,
  picApprover: typeof partner,
  itApprover: typeof it,
  payload: Partial<
    Pick<
      CmpAcceptanceRequest,
      | "targetClientId"
      | "targetEngagementId"
      | "clientPayload"
      | "engagementPayload"
      | "returnReason"
    >
  >
): CmpAcceptanceRequest {
  return {
    id,
    requestNo,
    type,
    status,
    currentStep,
    submittedById: submittedBy.id,
    submittedBy,
    micApproverId: micApprover.id,
    micApprover,
    picApproverId: picApprover.id,
    picApprover,
    itApproverId: itApprover.id,
    itApprover,
    workflowVersion: 1,
    draftAssigneeId: null,
    draftAssignee: null,
    draftCompletedAt: null,
    draftCompletedById: null,
    draftCompletedBy: null,
    returnedFromStep: status === "RETURNED" ? "MIC" : null,
    picApprovedAt: status === "APPROVED" ? updatedAt : null,
    targetClientId: payload.targetClientId ?? null,
    targetEngagementId: payload.targetEngagementId ?? null,
    clientPayload: payload.clientPayload ?? null,
    engagementPayload: payload.engagementPayload ?? null,
    returnReason: payload.returnReason ?? null,
    submittedAt: createdAt,
    approvedAt: status === "APPROVED" ? updatedAt : null,
    returnedAt: status === "RETURNED" ? updatedAt : null,
    createdAt,
    updatedAt,
    approvalSteps: [],
  };
}

function previewArchiveCost(
  userId: string,
  name: string,
  email: string,
  grade: CmpEngagementArchiveMemberCost["grade"],
  overrides: Partial<CmpEngagementArchiveMemberCost> = {}
): CmpEngagementArchiveMemberCost {
  return {
    userId,
    name,
    email,
    grade,
    historical: false,
    budgetNormal: "0.00",
    budgetOt: "0.00",
    actualNormal: "0.00",
    actualOt: "0.00",
    absent: "0.00",
    hourlyRate: "0.00",
    budgetCost: "0.00",
    actualCost: "0.00",
    currency: "HKD",
    ...overrides,
  };
}

export const previewArchiveMemberCosts: Record<
  string,
  CmpEngagementArchiveMemberCost[]
> = {
  "eng-wks": [
    previewArchiveCost(
      "preview-mic",
      "Leo Li",
      "leo.li@projectwing.local",
      "MANAGER",
      {
        budgetNormal: "60.00",
        budgetOt: "6.00",
        actualNormal: "72.50",
        actualOt: "9.00",
        hourlyRate: "1800.00",
        budgetCost: "118800.00",
        actualCost: "146700.00",
      }
    ),
    previewArchiveCost(
      "preview-staff",
      "Amy Chan",
      "amy.chan@projectwing.local",
      "STAFF",
      {
        historical: true,
        budgetNormal: "120.00",
        budgetOt: "12.00",
        actualNormal: "110.00",
        actualOt: "10.50",
        absent: "8.00",
        hourlyRate: "600.00",
        budgetCost: "79200.00",
        actualCost: "72300.00",
      }
    ),
  ],
  "eng-hbr": [
    previewArchiveCost(
      "preview-pic",
      "Edric Han",
      "edric.han@projectwing.local",
      "MANAGER",
      {
        budgetNormal: "20.00",
        budgetOt: "2.00",
        actualNormal: "10.00",
        actualOt: "2.00",
        hourlyRate: "1500.00",
        budgetCost: "33000.00",
        actualCost: "18000.00",
      }
    ),
  ],
  "eng-orc-aud": [
    previewArchiveCost(
      "preview-partner",
      "Jony Ma",
      "partner@projectwing.local",
      "PARTNER",
      {
        budgetNormal: "40.00",
        budgetOt: "4.00",
        actualNormal: "44.00",
        actualOt: "5.50",
        hourlyRate: "2400.00",
        budgetCost: "105600.00",
        actualCost: "118800.00",
      }
    ),
  ],
};
