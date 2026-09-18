import { Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateCmpAcceptanceRequestInput } from "@project-wing/shared";

import {
  ApiBadRequestException,
  ApiConflictException,
  ApiForbiddenException,
} from "../common/api-error";
import { CmpService, assertValidSubsidiaryGraph } from "./cmp.service";

const now = new Date("2026-07-05T00:00:00.000Z");
const user = {
  id: "user-1",
  email: "staff@example.com",
  name: "Staff",
  globalRole: "STAFF" as const,
};
const managerUser = {
  ...user,
  id: "approver-mic",
  email: "mic@example.com",
  name: "MIC Manager",
  globalRole: "MANAGER" as const,
};
const partnerUser = {
  ...user,
  id: "approver-pic",
  email: "pic@example.com",
  name: "PIC Partner",
  globalRole: "PARTNER" as const,
};
const superAdminUser = {
  ...user,
  id: "it-admin",
  email: "it@example.com",
  name: "IT Admin",
  globalRole: "SUPER_ADMIN" as const,
};

function group(overrides: Record<string, unknown> = {}) {
  return {
    id: "group-1",
    groupCode: "G001",
    nameZh: "Huaqian Group CN",
    nameEn: "Huaqian Group",
    status: "ACTIVE",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    _count: { clients: 2 },
    ...overrides,
  };
}

function client(overrides: Record<string, unknown> = {}) {
  return {
    id: "client-1",
    clientCode: "C001",
    companyCode: "HQ-001",
    companyNumber: "1234567",
    nameZh: "Huaqian Limited CN",
    nameEn: "Huaqian Limited",
    groupId: "group-1",
    group: group(),
    address: "1 Queen's Road Central",
    contactPerson: "Amy Chan",
    telephone: "+852 1111 2222",
    email: "amy@example.com",
    website: "https://example.com",
    yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
    yearEndMonth: 12,
    hsicSectionCode: "C",
    industryBusinessNatureDetails: "Manufacturing",
    contactPosition: null,
    contactDepartment: null,
    contactMobile: null,
    contactRemarks: null,
    principalAddressSameAsRegistered: true,
    addresses: [],
    placeOfIncorporation: "Hong Kong",
    dateOfIncorporation: new Date("2010-01-15T00:00:00.000Z"),
    countryOrDistrict: "Hong Kong",
    listedOrPrivate: "PRIVATE",
    stockExchangeOrListingPlace: null,
    stockCode: null,
    marketSegment: null,
    regulatedEntities: null,
    companyTypeOrSpecialIndustry: "Private company",
    isSubsidiary: false,
    parentClientCode: null,
    subsidiariesOrAssociates: null,
    referredBy: "Internal referral",
    internalSource: "Partner",
    externalSource: null,
    sourceDescription: "Legacy client relationship",
    clientPartnerPicId: null,
    clientPartnerPic: "Partner A",
    clientManagerMicId: null,
    clientManagerMic: "Manager B",
    alternativePartnerSecondMicId: null,
    alternativePartnerSecondMic: "Partner C",
    expectedJobOrEngagementType: "Annual audit",
    serviceLines: "Audit, Tax",
    approvalReferenceNumber: "NCA-001",
    approvalDate: new Date("2026-02-01T00:00:00.000Z"),
    preparedBy: "Staff A",
    approvedBy: "Manager B",
    micApproval: "Approved",
    picApproval: "Approved",
    itAdmin: "IT Admin",
    signOffDate: new Date("2026-02-03T00:00:00.000Z"),
    status: "ACTIVE",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function engagement(overrides: Record<string, unknown> = {}) {
  return {
    id: "engagement-1",
    clientId: "client-1",
    client: client(),
    codeAliases: [],
    engagementCode: "C001-2026-AUD",
    serviceType: "AUDIT",
    yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
    reportDate: new Date("2027-03-31T00:00:00.000Z"),
    approvalReferenceNumber: "NEA-001",
    engagementDate: new Date("2026-02-10T00:00:00.000Z"),
    budgetedHours: new Prisma.Decimal("420.00"),
    agreedFee: new Prisma.Decimal("180000.00"),
    recoveryRate: new Prisma.Decimal("84.50"),
    feeCurrency: "HKD",
    amlRiskClassification: "NOT_HIGH",
    engagementRiskClassification: "NORMAL",
    picUserId: "user-pic",
    micUserId: "user-mic",
    eqReviewerUserId: null,
    riskManagementPartnerUserId: null,
    pic: "Partner A",
    mic: "Manager B",
    eqReviewer: null,
    riskManagementPartner: null,
    status: "ACTIVE",
    remarks: "Demo engagement",
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function userRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "approver-mic",
    email: "mic@example.com",
    name: "MIC Manager",
    globalRole: "MANAGER",
    ...overrides,
  };
}

function acceptance(overrides: Record<string, unknown> = {}) {
  return {
    id: "acceptance-1",
    requestNo: "CA-001",
    type: "CLIENT",
    status: "PENDING_MIC",
    currentStep: "MIC",
    submittedById: "user-1",
    micApproverId: "approver-mic",
    picApproverId: "approver-pic",
    itApproverId: "approver-it",
    workflowVersion: 1,
    draftAssigneeId: null,
    draftCompletedAt: null,
    draftCompletedById: null,
    returnedFromStep: null,
    picApprovedAt: null,
    targetClientId: null,
    targetEngagementId: null,
    clientPayload: completeClientAcceptancePayload({
      nameZh: "New Client CN",
    }),
    engagementPayload: null,
    changeBaselinePayload: null,
    changeBaselineCapturedAt: null,
    changeBaselineTargetUpdatedAt: null,
    returnReason: null,
    submittedAt: now,
    approvedAt: null,
    returnedAt: null,
    createdAt: now,
    updatedAt: now,
    submittedBy: userRef({
      id: "user-1",
      email: "staff@example.com",
      name: "Staff",
      globalRole: "STAFF",
    }),
    micApprover: userRef({ id: "approver-mic", name: "MIC Manager" }),
    picApprover: userRef({
      id: "approver-pic",
      email: "pic@example.com",
      name: "PIC Partner",
      globalRole: "PARTNER",
    }),
    itApprover: userRef({
      id: "approver-it",
      email: "it@example.com",
      name: "IT Admin",
      globalRole: "SUPER_ADMIN",
    }),
    draftAssignee: null,
    draftCompletedBy: null,
    approvalSteps: [
      {
        id: "step-mic",
        requestId: "acceptance-1",
        step: "MIC",
        approverId: "approver-mic",
        approver: userRef({ id: "approver-mic", name: "MIC Manager" }),
        status: "PENDING",
        comment: null,
        actedAt: null,
        createdAt: now,
      },
    ],
    ...overrides,
  };
}

type CompleteClientAcceptancePayload = NonNullable<
  CreateCmpAcceptanceRequestInput["clientPayload"]
>;

function completeClientAcceptancePayload(
  overrides: Partial<CompleteClientAcceptancePayload> = {}
): CompleteClientAcceptancePayload {
  return {
    clientCode: "C-NEW",
    companyCode: "NEW-001",
    companyNumber: "7654321",
    nameEn: "New Client Limited",
    status: "ACTIVE",
    yearEndDate: "2026-12-31",
    yearEndMonth: 12,
    hsicSectionCode: "C",
    registeredAddress: "1 Queen's Road Central",
    principalBusinessAddress: "1 Queen's Road Central",
    principalAddressSameAsRegistered: true,
    placeOfIncorporation: "Hong Kong",
    incorporationYearMonth: "2020-01",
    listedOrPrivate: "PRIVATE",
    clientLeadingPartnerId: "approver-pic",
    clientPartnerPicId: "approver-pic",
    clientManagerMicId: "approver-mic",
    serviceType: "Audit",
    ...overrides,
  };
}

describe("cMP subsidiary graph validation", () => {
  it("accepts a multi-level subsidiary tree", () => {
    expect(() =>
      assertValidSubsidiaryGraph([
        { fromClientId: "A", toClientId: "B" },
        { fromClientId: "B", toClientId: "C" },
      ])
    ).not.toThrow(/./);
  });

  it("rejects more than one direct parent", () => {
    expect(() =>
      assertValidSubsidiaryGraph([
        { fromClientId: "A", toClientId: "C" },
        { fromClientId: "B", toClientId: "C" },
      ])
    ).toThrow("one active direct parent");
  });

  it("rejects circular subsidiary relationships", () => {
    expect(() =>
      assertValidSubsidiaryGraph([
        { fromClientId: "A", toClientId: "B" },
        { fromClientId: "B", toClientId: "C" },
        { fromClientId: "C", toClientId: "A" },
      ])
    ).toThrow("cannot form a cycle");
  });
});

describe(CmpService, () => {
  const prisma = {
    user: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    cmpClientGroup: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    cmpApprovalNumberSequence: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
    },
    cmpClient: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cmpClientEntityScope: {
      findFirst: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
    cmpEntity: {
      findFirst: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    cmpClientVersion: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    cmpClientRelationship: {
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cmpClientAddress: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    cmpClientContact: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    cmpEngagement: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    tmsApprovalSubmission: {
      findMany: vi.fn(),
    },
    tmsTimesheetMonth: {
      findMany: vi.fn(),
    },
    project: {
      findMany: vi.fn(),
    },
    independenceDeclaration: {
      findMany: vi.fn(),
    },
    cmpEngagementCodeAlias: {
      findUnique: vi.fn(),
      create: vi.fn(),
      deleteMany: vi.fn(),
    },
    cmpAcceptanceRequest: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
    },
    cmpAcceptanceApprovalStep: {
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
      createMany: vi.fn(),
      create: vi.fn(),
    },
    cmpAmlScreeningBatch: {
      updateMany: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  const auditLogs = {
    log: vi.fn(),
  };
  const inbox = {
    createCollaborationMessage: vi.fn(),
  };
  const email = {
    send: vi.fn(),
  };

  let service: CmpService;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma.user.findFirst.mockReset();
    prisma.user.findUnique.mockReset();
    prisma.user.findFirst.mockResolvedValue({ name: "Active User" });
    prisma.user.findUnique.mockResolvedValue(null);
    prisma.cmpAcceptanceRequest.findFirst.mockResolvedValue(null);
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(null);
    prisma.cmpApprovalNumberSequence.findUnique.mockResolvedValue(null);
    prisma.cmpApprovalNumberSequence.upsert.mockImplementation(
      async (input: { create: { lastNumber: number } }) => {
        await Promise.resolve();
        return {
          lastNumber: input.create.lastNumber,
        };
      }
    );
    prisma.cmpClient.findMany.mockResolvedValue([]);
    prisma.cmpClient.findFirst.mockResolvedValue(null);
    prisma.cmpClientEntityScope.findFirst.mockResolvedValue(null);
    prisma.cmpClientEntityScope.count.mockResolvedValue(0);
    prisma.cmpClientEntityScope.updateMany.mockResolvedValue({ count: 0 });
    prisma.cmpClientEntityScope.upsert.mockResolvedValue({});
    prisma.cmpEntity.findFirst.mockResolvedValue(null);
    prisma.cmpEntity.update.mockImplementation(async ({ data }) => {
      await Promise.resolve();
      return {
        id: "entity-root",
        ...data,
      };
    });
    prisma.cmpEntity.create.mockImplementation(async ({ data }) => {
      await Promise.resolve();
      return {
        id: "entity-root",
        ...data,
      };
    });
    prisma.cmpClientVersion.findFirst.mockResolvedValue(null);
    prisma.cmpClientVersion.findMany.mockResolvedValue([]);
    prisma.cmpClientVersion.create.mockResolvedValue({
      id: "version-1",
      versionNumber: 1,
      snapshotJson: client(),
      approvedAt: now,
      createdAt: now,
    });
    prisma.cmpEngagement.findMany.mockResolvedValue([]);
    prisma.auditLog.findMany.mockResolvedValue([]);
    prisma.$transaction.mockImplementation(async (callback) => {
      await Promise.resolve();
      return callback(prisma);
    });
    prisma.project.findMany.mockResolvedValue([]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([]);
    prisma.cmpClientRelationship.findMany.mockResolvedValue([]);
    prisma.cmpAmlScreeningBatch.updateMany.mockResolvedValue({ count: 0 });
    prisma.cmpClientAddress.findMany.mockResolvedValue([]);
    prisma.cmpEngagement.findUniqueOrThrow.mockResolvedValue({
      engagementRiskClassification: "NORMAL",
      picUserId: "user-pic",
      micUserId: "user-mic",
      eqReviewerUserId: null,
      riskManagementPartnerUserId: null,
      pic: "Partner A",
      mic: "Manager B",
      eqReviewer: null,
      riskManagementPartner: null,
    });
    service = new CmpService(
      prisma as never,
      auditLogs as never,
      inbox as never,
      email as never
    );
  });

  it("returns dashboard counts from CMP master data", async () => {
    prisma.cmpClient.count.mockResolvedValue(3);
    prisma.cmpEngagement.count.mockResolvedValue(4);
    prisma.cmpAcceptanceRequest.count.mockResolvedValue(0);
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([]);

    await expect(
      service.dashboard({
        id: "it-1",
        email: "it@example.com",
        name: "IT Admin",
        globalRole: "SUPER_ADMIN",
      })
    ).resolves.toMatchObject({
      myClients: 3,
      myEngagements: 4,
    });
  });

  it("creates a single baseline version when an existing Client has no history", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue(client());
    prisma.cmpClientVersion.findFirst.mockResolvedValue(null);
    prisma.cmpClientVersion.findMany.mockResolvedValue([]);

    await expect(
      service.listClientVersions("client-1", { page: 1, pageSize: 25 })
    ).resolves.toMatchObject({
      client: { id: "client-1" },
      versions: [],
      total: 0,
    });

    expect(prisma.cmpClientVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          versionNumber: 1,
          sourceType: "BASELINE",
          changedByName: "System migration",
        }),
      })
    );
  });

  it("exports a read-only Client version PDF with current-version comparison data", async () => {
    const snapshot = structuredClone(client()) as Record<string, unknown>;
    for (const key of [
      "yearEndDate",
      "dateOfIncorporation",
      "approvalDate",
      "signOffDate",
      "createdAt",
      "updatedAt",
    ] as const) {
      const value = snapshot[key];
      if (value instanceof Date) {
        snapshot[key] = value.toISOString();
      }
    }
    const version = {
      id: "version-1",
      clientId: "client-1",
      versionNumber: 1,
      sourceType: "BASELINE",
      acceptanceRequestId: null,
      snapshotJson: snapshot,
      changeSummaryJson: null,
      changedById: null,
      changedByName: "System migration",
      approvedById: null,
      approvedByName: null,
      approvedAt: now,
      schemaVersion: 1,
      createdAt: now,
      acceptanceRequest: null,
    };
    prisma.cmpClientVersion.findFirst.mockResolvedValue(version);

    await expect(
      service.exportClientVersionPdf("client-1", "version-1")
    ).resolves.toMatchObject({
      fileName: "C001-v1.pdf",
      body: expect.any(Buffer),
    });
  });

  it("builds an all-history TMS summary for an engagement", async () => {
    prisma.cmpEngagement.findUnique.mockResolvedValue({
      id: "engagement-1",
      picUserId: "partner-1",
      micUserId: "manager-1",
    });
    prisma.project.findMany.mockResolvedValue([
      {
        members: [
          {
            status: "ACTIVE",
            user: { id: "staff-1", name: "Staff One", globalRole: "STAFF" },
          },
          {
            status: "ACTIVE",
            user: { id: "staff-2", name: "Staff Two", globalRole: "STAFF" },
          },
        ],
      },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { id: "partner-1", name: "PIC Partner", globalRole: "PARTNER" },
      { id: "manager-1", name: "MIC Manager", globalRole: "MANAGER" },
    ]);
    prisma.tmsApprovalSubmission.findMany.mockResolvedValue([
      {
        ownerUserId: "staff-1",
        year: 2026,
        month: 7,
        half: "FIRST_HALF",
        revision: 1,
        status: "APPROVED",
        submittedRows: [
          {
            id: "row-1",
            engagementId: "engagement-1",
            periodScope: "first",
            type: "Chargeable",
            details: "Normal",
            description: "",
            hoursByDate: { "2026-07-01": 8 },
            periodTotal: 8,
          },
        ],
      },
    ]);
    prisma.tmsTimesheetMonth.findMany.mockResolvedValue([
      {
        userId: "partner-1",
        year: 2026,
        month: 7,
        firstStatus: "SUBMITTED",
        firstSubmittedRevision: 1,
        firstSubmittedRows: [
          {
            id: "row-pic",
            engagementId: "engagement-1",
            periodScope: "first",
            type: "Chargeable",
            details: "OT",
            description: "",
            hoursByDate: { "2026-07-02": 2 },
            periodTotal: 2,
          },
        ],
        secondStatus: "DRAFT",
        secondSubmittedRevision: 0,
        secondSubmittedRows: null,
      },
    ]);

    await expect(
      service.getTmsEngagementSummary("engagement-1")
    ).resolves.toMatchObject({
      approved: {
        rows: expect.arrayContaining([
          expect.objectContaining({ userId: "staff-1", finalNormal: 8 }),
          expect.objectContaining({ userId: "partner-1", finalOt: 2 }),
        ]),
      },
      periods: expect.arrayContaining([
        expect.objectContaining({
          userId: "staff-1",
          year: 2026,
          month: 7,
          status: "APPROVED",
          total: 8,
        }),
        expect.objectContaining({
          userId: "partner-1",
          year: 2026,
          month: 7,
          status: "SUBMITTED",
          bucket: "APPROVED",
          total: 2,
        }),
      ]),
    });
  });

  it("rejects dashboard access for non-IT users", async () => {
    await expect(
      service.dashboard({
        id: "staff-1",
        email: "staff@example.com",
        name: "Staff",
        globalRole: "STAFF",
      })
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });

  it("lists client groups with client counts", async () => {
    prisma.cmpClientGroup.findMany.mockResolvedValue([group()]);

    await expect(service.listClientGroups()).resolves.toStrictEqual({
      groups: [
        expect.objectContaining({
          id: "group-1",
          groupCode: "G001",
          clientCount: 2,
        }),
      ],
    });
  });

  it("returns ended Group relationships as read-only history", async () => {
    const parent = {
      id: "client-1",
      clientCode: "C001",
      nameZh: "Parent CN",
      nameEn: "Parent",
      groupId: "group-1",
      status: "ACTIVE",
    };
    const formerSubsidiary = {
      id: "client-2",
      clientCode: "C002",
      nameZh: "Former Subsidiary CN",
      nameEn: "Former Subsidiary",
      groupId: "group-1",
      status: "ACTIVE",
    };
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      ...group({
        ultimateParentClientId: "client-1",
        ultimateParent: parent,
      }),
      clients: [
        { ...parent, parentClientCode: null, subsidiariesOrAssociates: null },
        {
          ...formerSubsidiary,
          parentClientCode: null,
          subsidiariesOrAssociates: null,
        },
      ],
      relationships: [
        {
          id: "relationship-1",
          groupId: "group-1",
          fromClientId: "client-1",
          toClientId: "client-2",
          type: "SUBSIDIARY",
          ownershipPercentage: new Prisma.Decimal(100),
          effectiveFrom: new Date("2025-01-01T00:00:00.000Z"),
          effectiveTo: new Date("2026-06-30T00:00:00.000Z"),
          remarks: "Disposed",
          approvedViaRequestId: "acceptance-1",
          createdAt: now,
          updatedAt: now,
          fromClient: parent,
          toClient: formerSubsidiary,
        },
      ],
    });

    await expect(
      service.getClientGroupStructure("group-1")
    ).resolves.toMatchObject({
      subsidiaryTree: [
        expect.objectContaining({
          client: expect.objectContaining({ id: "client-1" }),
        }),
        expect.objectContaining({
          client: expect.objectContaining({ id: "client-2" }),
        }),
      ],
      relationshipHistory: [
        expect.objectContaining({
          id: "relationship-1",
          effectiveTo: "2026-06-30",
        }),
      ],
    });
  });

  it("shows cross-Group Associate relationships from either Group structure", async () => {
    const currentMember = {
      id: "client-1",
      clientCode: "C001",
      nameZh: "Current Member CN",
      nameEn: "Current Member",
      groupId: "group-1",
      status: "ACTIVE",
    };
    const externalAssociate = {
      id: "client-2",
      clientCode: "C002",
      nameZh: "External Associate CN",
      nameEn: "External Associate",
      groupId: "group-2",
      status: "ACTIVE",
    };
    prisma.cmpClientGroup.findUnique.mockResolvedValue(
      group({
        ultimateParentClientId: null,
        ultimateParent: null,
        clients: [
          {
            ...currentMember,
            parentClientCode: null,
            subsidiariesOrAssociates: null,
          },
        ],
        relationships: [],
      })
    );
    prisma.cmpClientRelationship.findMany.mockResolvedValue([
      {
        id: "relationship-external",
        groupId: "group-2",
        fromClientId: "client-2",
        toClientId: "client-1",
        type: "ASSOCIATE",
        ownershipPercentage: new Prisma.Decimal(20),
        effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
        effectiveTo: null,
        remarks: "Cross-group associate",
        approvedViaRequestId: "acceptance-1",
        createdAt: now,
        updatedAt: now,
        fromClient: externalAssociate,
        toClient: currentMember,
      },
    ]);

    await expect(
      service.getClientGroupStructure("group-1")
    ).resolves.toMatchObject({
      associates: [
        expect.objectContaining({
          id: "relationship-external",
          groupId: "group-2",
        }),
      ],
    });
  });

  it("creates a client group and writes an audit log", async () => {
    prisma.cmpClientGroup.create.mockResolvedValue(
      group({ nameEn: null, _count: { clients: 0 } })
    );

    await expect(
      service.createClientGroup(
        { groupCode: "G001", nameZh: "Huaqian Group CN", nameEn: "" },
        superAdminUser
      )
    ).resolves.toMatchObject({ groupCode: "G001", nameEn: null });

    expect(prisma.cmpClientGroup.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          groupCode: "G001",
          nameZh: "Huaqian Group CN",
          nameEn: null,
          createdById: "it-admin",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_CLIENT_GROUP_CREATED" })
    );
  });

  it.each([managerUser, partnerUser])(
    "allows Client Group maintenance by %s",
    async (authorizedUser) => {
      prisma.cmpClientGroup.create.mockResolvedValue(
        group({ nameEn: null, _count: { clients: 0 } })
      );

      await expect(
        service.createClientGroup(
          { groupCode: "G001", nameZh: "Huaqian Group CN" },
          authorizedUser
        )
      ).resolves.toMatchObject({ groupCode: "G001" });
    }
  );

  it("rejects Client Group maintenance by other users", async () => {
    await expect(
      service.createClientGroup(
        { groupCode: "G001", nameZh: "Huaqian Group CN" },
        user
      )
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });

  it("lists clients with expanded search filters", async () => {
    prisma.cmpClient.findMany.mockResolvedValue([client()]);

    await expect(
      service.listClients({ q: "Partner A" })
    ).resolves.toStrictEqual({
      clients: [expect.objectContaining({ clientCode: "C001" })],
    });

    expect(prisma.cmpClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              clientPartnerPic: expect.any(Object),
            }),
          ]),
        }),
      })
    );
  });

  it("creates a client with expanded master data", async () => {
    prisma.cmpClientGroup.findUnique.mockResolvedValue({ id: "group-1" });
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "PIC From Directory" })
      .mockResolvedValueOnce({ name: "MIC From Directory" })
      .mockResolvedValueOnce({ name: "Second MIC From Directory" });
    prisma.cmpClient.create.mockResolvedValue(
      client({
        clientPartnerPicId: "user-pic",
        clientPartnerPic: "PIC From Directory",
        clientManagerMicId: "user-mic",
        clientManagerMic: "MIC From Directory",
        alternativePartnerSecondMicId: "user-second-mic",
        alternativePartnerSecondMic: "Second MIC From Directory",
      })
    );

    await expect(
      service.createClient(
        {
          clientCode: "C001",
          companyCode: "HQ-001",
          companyNumber: "1234567",
          nameZh: "Huaqian Limited CN",
          nameEn: "Huaqian Limited",
          groupId: "group-1",
          address: "1 Queen's Road Central",
          contactPerson: "Amy Chan",
          telephone: "+852 1111 2222",
          email: "amy@example.com",
          website: "https://example.com",
          hsicSectionCode: "C",
          yearEndDate: "2026-12-31",
          placeOfIncorporation: "Hong Kong",
          incorporationYearMonth: "2010-01",
          listedOrPrivate: "PRIVATE",
          stockExchangeOrListingPlace: "",
          stockCode: "",
          marketSegment: "",
          regulatedEntities: "",
          isSubsidiary: false,
          parentClientCode: "",
          subsidiariesOrAssociates: "",
          referredBy: "Internal referral",
          clientPartnerPicId: "user-pic",
          clientPartnerPic: "Incorrect PIC Snapshot",
          clientManagerMicId: "user-mic",
          clientManagerMic: "Incorrect MIC Snapshot",
          alternativePartnerSecondMicId: "user-second-mic",
          alternativePartnerSecondMic: "Incorrect Second MIC Snapshot",
          expectedJobOrEngagementType: "Annual audit",
          serviceLines: "Audit, Tax",
          approvalReferenceNumber: "NCA-001",
          approvalDate: "2026-02-01",
          preparedBy: "Staff A",
          approvedBy: "Manager B",
          micApproval: "Approved",
          picApproval: "Approved",
          itAdmin: "IT Admin",
          signOffDate: "2026-02-03",
          status: "ACTIVE",
        },
        user
      )
    ).resolves.toMatchObject({
      clientCode: "C001",
      companyNumber: "1234567",
      clientPartnerPicId: "user-pic",
      clientPartnerPic: "PIC From Directory",
      clientManagerMicId: "user-mic",
      clientManagerMic: "MIC From Directory",
      alternativePartnerSecondMicId: "user-second-mic",
      alternativePartnerSecondMic: "Second MIC From Directory",
      serviceLines: "Audit, Tax",
    });

    expect(prisma.cmpClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyNumber: "1234567",
          yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
          approvalDate: new Date("2026-02-01T00:00:00.000Z"),
          clientPartnerPicId: "user-pic",
          clientPartnerPic: "PIC From Directory",
          clientManagerMicId: "user-mic",
          clientManagerMic: "MIC From Directory",
          alternativePartnerSecondMicId: "user-second-mic",
          alternativePartnerSecondMic: "Second MIC From Directory",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_CLIENT_CREATED" })
    );
  });

  it("updates only selected client fields", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.cmpClient.update.mockResolvedValue(
      client({
        listedOrPrivate: "LISTED",
        clientPartnerPic: "Partner Z",
        yearEndDate: new Date("2027-03-31T00:00:00.000Z"),
      })
    );

    await expect(
      service.updateClient(
        "client-1",
        {
          listedOrPrivate: "LISTED",
          clientPartnerPic: "Partner Z",
          yearEndDate: "2027-03-31",
        },
        user
      )
    ).resolves.toMatchObject({
      listedOrPrivate: "LISTED",
      clientPartnerPic: "Partner Z",
      yearEndDate: "2027-03-31",
    });

    expect(prisma.cmpClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          listedOrPrivate: "LISTED",
          clientPartnerPic: "Partner Z",
          yearEndDate: new Date("2027-03-31T00:00:00.000Z"),
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_CLIENT_UPDATED" })
    );
  });

  it("clears optional fields during update when blank values are submitted", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.cmpClient.update.mockResolvedValue(
      client({
        companyNumber: null,
        groupId: null,
        group: null,
        approvalDate: null,
        clientPartnerPic: null,
      })
    );

    await expect(
      service.updateClient(
        "client-1",
        {
          companyNumber: "",
          groupId: "",
          approvalDate: "",
          clientPartnerPic: "",
        },
        user
      )
    ).resolves.toMatchObject({
      companyNumber: null,
      groupId: null,
      approvalDate: null,
      clientPartnerPic: null,
    });

    expect(prisma.cmpClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyNumber: null,
          groupId: null,
          approvalDate: null,
          clientPartnerPic: null,
        }),
      })
    );
  });

  it("rejects client creation when the group is missing", async () => {
    prisma.cmpClientGroup.findUnique.mockResolvedValue(null);

    await expect(
      service.createClient(
        {
          clientCode: "C001",
          companyCode: "HQ-001",
          nameEn: "Huaqian Limited",
          nameZh: "Huaqian Limited CN",
          groupId: "missing-group",
        },
        user
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("maps duplicate client codes to API errors", async () => {
    prisma.cmpClient.create.mockRejectedValue(duplicateError());

    await expect(
      service.createClient(
        {
          clientCode: "C001",
          companyCode: "HQ-001",
          nameEn: "Huaqian Limited",
          nameZh: "Huaqian Limited CN",
        },
        user
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
  });

  it("gets a client by id with expanded fields", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue(client());

    await expect(service.getClient("client-1")).resolves.toMatchObject({
      id: "client-1",
      clientCode: "C001",
      companyNumber: "1234567",
      yearEndDate: "2026-12-31",
      clientManagerMic: "Manager B",
    });
  });

  it("lists engagements with client search filters", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);

    await expect(
      service.listEngagements({ q: "Partner A" })
    ).resolves.toStrictEqual({
      engagements: [
        expect.objectContaining({
          engagementCode: "C001-2026-AUD",
          client: expect.objectContaining({ clientCode: "C001" }),
        }),
      ],
    });

    expect(prisma.cmpEngagement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ pic: expect.any(Object) }),
            expect.objectContaining({
              client: expect.objectContaining({
                clientCode: expect.any(Object),
              }),
            }),
          ]),
        }),
      })
    );
  });

  it("keeps engagements available for multiple EMP projects", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([]);

    await expect(
      service.listEngagements({
        status: "ACTIVE",
        availableForProject: true,
      })
    ).resolves.toStrictEqual({ engagements: [] });

    expect(prisma.cmpEngagement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "ACTIVE",
          client: { status: "ACTIVE" },
          picUser: {
            is: {
              status: "ACTIVE",
              globalRole: { in: ["PARTNER", "PRINCIPAL"] },
            },
          },
          micUser: {
            is: { status: "ACTIVE", globalRole: "MANAGER" },
          },
        }),
      })
    );
  });

  it("provides active and archived CMP engagements to the TMS directory", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([
      engagement({
        codeAliases: [
          {
            code: "C001-2025-AUD",
            normalizedCode: "C001-2025-AUD",
            replacedAt: now,
          },
        ],
      }),
    ]);

    await expect(
      service.listTmsEngagements({ q: "2025" }, user)
    ).resolves.toStrictEqual({
      engagements: [
        expect.objectContaining({
          id: "engagement-1",
          engagementCode: "C001-2026-AUD",
          clientCode: "C001",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          recoveryRate: "84.50",
          feeCurrency: "HKD",
          codeAliases: ["C001-2025-AUD"],
          timesheetAccess: {
            allowed: false,
            reason: "EMP_PROJECT_REQUIRED",
          },
        }),
      ],
    });

    expect(prisma.cmpEngagement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["ACTIVE", "ARCHIVED"] },
        }),
      })
    );
  });

  it("does not load the full TMS directory without a search query", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);

    await expect(service.listTmsEngagements({}, user)).resolves.toStrictEqual({
      engagements: [],
    });

    expect(prisma.cmpEngagement.findMany).not.toHaveBeenCalled();
    expect(prisma.project.findMany).not.toHaveBeenCalled();
  });

  it("returns an independently created EMP project only after code search", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-dummy",
        projectCode: "DUMMY-EMP-1000027",
        name: "Dummy",
        cmpClientId: null,
        cmpEngagementId: null,
        members: [{ joinedAt: new Date("2026-08-19T00:00:00.000Z") }],
      },
    ]);

    await expect(
      service.listTmsEngagements({ q: "DUMMY-EMP-1000027" }, user)
    ).resolves.toMatchObject({
      engagements: [
        {
          id: "unlinked:project-dummy",
          source: "UNLINKED_PROJECT",
          projectId: "project-dummy",
          projectCode: "DUMMY-EMP-1000027",
          projectName: "Dummy",
          engagementCode: "DUMMY-EMP-1000027",
          clientName: "Dummy",
          timesheetAccess: { allowed: true, reason: "ALLOWED" },
        },
      ],
    });
  });

  it("requires a post-join independence declaration for an active EMP member", async () => {
    const joinedAt = new Date("2026-07-01T00:00:00.000Z");
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        cmpEngagementId: "engagement-1",
        members: [{ joinedAt }],
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([]);

    await expect(
      service.listTmsEngagements({ q: "C001" }, user)
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          timesheetAccess: {
            allowed: false,
            reason: "INDEPENDENCE_DECLARATION_REQUIRED",
          },
        }),
      ],
    });
  });

  it("requires accepted EMP membership when an active linked project exists", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        cmpEngagementId: "engagement-1",
        members: [],
      },
    ]);

    await expect(
      service.listTmsEngagements({ q: "C001" }, user)
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          timesheetAccess: {
            allowed: false,
            reason: "EMP_MEMBERSHIP_REQUIRED",
          },
        }),
      ],
    });
  });

  it("does not accept a declaration signed before the member joined the project", async () => {
    const joinedAt = new Date("2026-07-01T00:00:00.000Z");
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        cmpEngagementId: "engagement-1",
        members: [{ joinedAt }],
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([
      {
        projectId: "project-1",
        acceptedAt: new Date("2026-06-30T00:00:00.000Z"),
      },
    ]);

    await expect(
      service.listTmsEngagements({ q: "C001" }, user)
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          timesheetAccess: {
            allowed: false,
            reason: "INDEPENDENCE_DECLARATION_REQUIRED",
          },
        }),
      ],
    });
  });

  it("allows an active EMP member with a declaration signed after joining", async () => {
    const joinedAt = new Date("2026-07-01T00:00:00.000Z");
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        cmpEngagementId: "engagement-1",
        members: [{ joinedAt }],
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([
      {
        projectId: "project-1",
        acceptedAt: new Date("2026-07-01T00:00:00.000Z"),
      },
    ]);

    await expect(
      service.listTmsEngagements({ q: "C001" }, user)
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          timesheetAccess: { allowed: true, reason: "ALLOWED" },
        }),
      ],
    });
  });

  it("returns every linked EMP project with its own access decision", async () => {
    const joinedAt = new Date("2026-07-01T00:00:00.000Z");
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);
    prisma.project.findMany.mockResolvedValue([
      {
        id: "project-1",
        projectCode: "EMP-C001-GROUP",
        name: "Group audit",
        cmpEngagementId: "engagement-1",
        members: [],
      },
      {
        id: "project-2",
        projectCode: "EMP-C001-HK",
        name: "Hong Kong component",
        cmpEngagementId: "engagement-1",
        members: [{ joinedAt }],
      },
    ]);
    prisma.independenceDeclaration.findMany.mockResolvedValue([
      {
        projectId: "project-2",
        acceptedAt: new Date("2026-07-02T00:00:00.000Z"),
      },
    ]);

    await expect(
      service.listTmsEngagements({ q: "C001" }, user)
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          projectId: "project-1",
          projectCode: "EMP-C001-GROUP",
          timesheetAccess: {
            allowed: false,
            reason: "EMP_MEMBERSHIP_REQUIRED",
          },
        }),
        expect.objectContaining({
          projectId: "project-2",
          projectCode: "EMP-C001-HK",
          timesheetAccess: { allowed: true, reason: "ALLOWED" },
        }),
      ],
    });
  });

  it("does not let SUPER_ADMIN bypass EMP timesheet access", async () => {
    prisma.cmpEngagement.findMany.mockResolvedValue([engagement()]);

    await expect(
      service.listTmsEngagements(
        { q: "C001" },
        { ...user, globalRole: "SUPER_ADMIN" }
      )
    ).resolves.toMatchObject({
      engagements: [
        expect.objectContaining({
          timesheetAccess: {
            allowed: false,
            reason: "EMP_PROJECT_REQUIRED",
          },
        }),
      ],
    });
  });

  it("creates an engagement under an existing client", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Partner A" })
      .mockResolvedValueOnce({ name: "Manager B" });
    prisma.cmpEngagement.create.mockResolvedValue(engagement());

    await expect(
      service.createEngagement(
        {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          amlRiskClassification: "NOT_HIGH",
          engagementRiskClassification: "NORMAL",
          yearEndDate: "2026-12-31",
          reportDate: "2027-03-31",
          approvalReferenceNumber: "NEA-001",
          engagementDate: "2026-02-10",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          recoveryRate: "84.50",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Partner A",
          mic: "Manager B",
          status: "ACTIVE",
          remarks: "Demo engagement",
        },
        user
      )
    ).resolves.toMatchObject({
      engagementCode: "C001-2026-AUD",
      serviceType: "AUDIT",
      yearEndDate: "2026-12-31",
      client: expect.objectContaining({ clientCode: "C001" }),
    });

    expect(prisma.cmpEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Partner A",
          mic: "Manager B",
          createdById: "user-1",
        }),
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_ENGAGEMENT_CREATED" })
    );
  });

  it("rejects a role-incompatible engagement PIC", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.createEngagement(
        {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          amlRiskClassification: "NOT_HIGH",
          engagementRiskClassification: "NORMAL",
          otherServiceDescription: "",
          yearEndDate: "",
          reportDate: "",
          approvalReferenceNumber: "",
          engagementDate: "",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          feeCurrency: "HKD",
          picUserId: "staff-1",
          micUserId: "user-mic",
        },
        user
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.cmpEngagement.create).not.toHaveBeenCalled();
  });

  it("rejects engagement creation when the client is missing", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue(null);

    await expect(
      service.createEngagement(
        {
          clientId: "missing-client",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          amlRiskClassification: "NOT_HIGH",
          engagementRiskClassification: "NORMAL",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Partner A",
          mic: "Manager B",
        },
        user
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "NOT_FOUND" }),
    });
  });

  it("maps duplicate engagement codes to API errors", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({ id: "client-1" });
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Partner A" })
      .mockResolvedValueOnce({ name: "Manager B" });
    prisma.cmpEngagement.create.mockRejectedValue(duplicateError());

    await expect(
      service.createEngagement(
        {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          amlRiskClassification: "NOT_HIGH",
          engagementRiskClassification: "NORMAL",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
        },
        user
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
  });

  it("updates selected engagement fields", async () => {
    prisma.cmpEngagement.findUnique.mockResolvedValue({
      id: "engagement-1",
      engagementCode: "C001-2026-AUD",
    });
    prisma.cmpEngagement.findUniqueOrThrow.mockResolvedValue(engagement());
    prisma.cmpEngagement.update.mockResolvedValue(
      engagement({
        micUserId: "manager-z",
        mic: "Manager Z",
        status: "COMPLETED",
        reportDate: new Date("2027-04-15T00:00:00.000Z"),
      })
    );
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Partner A" })
      .mockResolvedValueOnce({ name: "Manager Z" })
      .mockResolvedValue({ name: "Manager Z" });

    await expect(
      service.updateEngagement(
        "engagement-1",
        {
          micUserId: "manager-z",
          picUserId: undefined,
          status: "COMPLETED",
          reportDate: "2027-04-15",
        },
        user
      )
    ).resolves.toMatchObject({
      mic: "Manager Z",
      status: "COMPLETED",
      reportDate: "2027-04-15",
    });

    expect(prisma.cmpEngagement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          mic: "Manager Z",
          micUserId: "manager-z",
          pic: "Partner A",
          picUserId: "user-pic",
          status: "COMPLETED",
          reportDate: new Date("2027-04-15T00:00:00.000Z"),
        }),
      })
    );
  });

  it("retains the old code as an alias when an engagement code changes", async () => {
    prisma.cmpEngagement.findUnique.mockResolvedValue({
      id: "engagement-1",
      engagementCode: "C001-2026-AUD",
    });
    prisma.cmpEngagement.findUniqueOrThrow.mockResolvedValue(engagement());
    prisma.cmpEngagement.update.mockResolvedValue(
      engagement({ engagementCode: "C001-2026-AUD-R" })
    );

    await service.updateEngagement(
      "engagement-1",
      { engagementCode: "C001-2026-AUD-R" },
      user
    );

    expect(prisma.cmpEngagementCodeAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        engagementId: "engagement-1",
        code: "C001-2026-AUD",
        normalizedCode: "C001-2026-AUD",
      }),
    });
  });

  it("creates and submits a client acceptance request", async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "PENDING_PIC",
        currentStep: "PIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload({
            nameZh: "New Client CN",
          }),
          micApproverId: "approver-mic",
          picApproverId: "approver-pic",
          itApproverId: "approver-it",
          submit: true,
        },
        managerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT",
      status: "PENDING_PIC",
      currentStep: "PIC",
      clientPayload: expect.objectContaining({ clientCode: "C-NEW" }),
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_PIC",
          submittedById: "approver-mic",
          micApproverId: "approver-mic",
        }),
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "approver-pic",
        senderId: null,
        type: "SYSTEM_NOTIFICATION",
        title: "CA-001 已进入 PIC 审批",
        actionUrl: "/cmp/acceptance?tab=approvals&requestId=acceptance-1",
      })
    );
  });

  it("lets a Partner submit a new client acceptance to the selected MIC", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: managerUser.id,
      status: "ACTIVE",
      globalRole: "MANAGER",
    });
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "PENDING_MIC",
        currentStep: "MIC",
        submittedById: partnerUser.id,
        workflowVersion: 2,
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload(),
          micApproverId: managerUser.id,
          submit: true,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT",
      status: "PENDING_MIC",
      currentStep: "MIC",
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_MIC",
          currentStep: "MIC",
          submittedById: partnerUser.id,
          micApproverId: managerUser.id,
          approvalSteps: {
            create: [{ step: "MIC", approverId: managerUser.id }],
          },
        }),
      })
    );
  });

  it("lets a Partner save an incomplete client acceptance before selecting an MIC", async () => {
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: partnerUser.id,
        submittedBy: userRef(partnerUser),
        micApproverId: partnerUser.id,
        micApprover: userRef(partnerUser),
        picApproverId: null,
        picApprover: null,
        itApproverId: null,
        itApprover: null,
        workflowVersion: 2,
        submittedAt: null,
        clientPayload: { clientCode: "" },
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: { clientCode: "" },
          submit: false,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      status: "DRAFT",
      submittedById: partnerUser.id,
      micApproverId: partnerUser.id,
      clientPayload: { clientCode: "" },
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "DRAFT",
          submittedById: partnerUser.id,
          micApproverId: partnerUser.id,
          picApproverId: null,
          itApproverId: null,
        }),
      })
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it("keeps an unrouted Partner draft editable but requires an MIC on submission", async () => {
    const unroutedDraft = acceptance({
      status: "DRAFT",
      currentStep: "MIC",
      submittedById: partnerUser.id,
      submittedBy: userRef(partnerUser),
      micApproverId: partnerUser.id,
      micApprover: userRef(partnerUser),
      picApproverId: null,
      picApprover: null,
      itApproverId: null,
      itApprover: null,
      workflowVersion: 2,
      submittedAt: null,
      clientPayload: { clientCode: "C-DRAFT" },
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(unroutedDraft);
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        ...unroutedDraft,
        clientPayload: { clientCode: "C-DRAFT-UPDATED" },
      })
    );

    await expect(
      service.updateAcceptance(
        "acceptance-1",
        {
          clientPayload: { clientCode: "C-DRAFT-UPDATED" },
          submit: false,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      status: "DRAFT",
      micApproverId: partnerUser.id,
      clientPayload: { clientCode: "C-DRAFT-UPDATED" },
    });
    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ micApproverId: partnerUser.id }),
      })
    );

    prisma.cmpAcceptanceRequest.update.mockClear();
    await expect(
      service.updateAcceptance(
        "acceptance-1",
        {
          clientPayload: completeClientAcceptancePayload(),
          submit: true,
        },
        partnerUser
      )
    ).rejects.toThrow(
      "Partner-initiated requests must select a Manager or Senior Manager as MIC"
    );
    expect(prisma.cmpAcceptanceRequest.update).not.toHaveBeenCalled();
  });

  it("lets a Partner delegate a new acceptance draft to Staff", async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce({
        id: managerUser.id,
        status: "ACTIVE",
        globalRole: "MANAGER",
      })
      .mockResolvedValueOnce({
        status: "ACTIVE",
        globalRole: "STAFF",
      });
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "STAFF_EDITING",
        currentStep: "MIC",
        submittedById: partnerUser.id,
        micApproverId: managerUser.id,
        workflowVersion: 2,
        submittedAt: null,
        draftAssigneeId: user.id,
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload(),
          micApproverId: managerUser.id,
          draftAssigneeId: user.id,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      status: "STAFF_EDITING",
      submittedById: partnerUser.id,
      micApproverId: managerUser.id,
      draftAssigneeId: user.id,
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "STAFF_EDITING",
          submittedById: partnerUser.id,
          micApproverId: managerUser.id,
          draftAssigneeId: user.id,
        }),
      })
    );
  });

  it("lets a Partner initiate a Client Change request", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: managerUser.id,
      status: "ACTIVE",
      globalRole: "MANAGER",
    });
    prisma.cmpClient.findUnique.mockResolvedValue(
      client({
        relationshipsFrom: [],
        relationshipsTo: [],
      })
    );
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: partnerUser.id,
        micApproverId: managerUser.id,
        workflowVersion: 2,
        submittedAt: null,
        targetClientId: "client-1",
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: { nameEn: "Revised client name" },
          micApproverId: managerUser.id,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT_CHANGE",
      status: "DRAFT",
      targetClientId: "client-1",
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: "CLIENT_CHANGE",
          submittedById: partnerUser.id,
          micApproverId: managerUser.id,
          targetClientId: "client-1",
        }),
      })
    );
  });

  it("lets a Partner initiate an Engagement Change request", async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: managerUser.id,
      status: "ACTIVE",
      globalRole: "MANAGER",
    });
    prisma.cmpEngagement.findUnique.mockResolvedValue(engagement());
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT_CHANGE",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: partnerUser.id,
        micApproverId: managerUser.id,
        workflowVersion: 2,
        submittedAt: null,
        targetEngagementId: "engagement-1",
        clientPayload: null,
        engagementPayload: { remarks: "Revised engagement" },
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "ENGAGEMENT_CHANGE",
          targetEngagementId: "engagement-1",
          engagementPayload: { remarks: "Revised engagement" },
          micApproverId: managerUser.id,
        },
        partnerUser
      )
    ).resolves.toMatchObject({
      type: "ENGAGEMENT_CHANGE",
      status: "DRAFT",
      targetEngagementId: "engagement-1",
    });
  });

  it("rejects a second active Client Change request for the same Client", async () => {
    prisma.cmpAcceptanceRequest.findFirst.mockResolvedValue({
      requestNo: "CC-001",
    });

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: { nameZh: "Revised client name" },
        },
        managerUser
      )
    ).rejects.toBeInstanceOf(ApiConflictException);

    expect(prisma.cmpAcceptanceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        type: "CLIENT_CHANGE",
        status: {
          in: [
            "DRAFT",
            "STAFF_EDITING",
            "RETURNED",
            "PENDING_MIC",
            "PENDING_PIC",
            "PENDING_IT",
          ],
        },
        targetClientId: "client-1",
      },
      select: { requestNo: true },
    });
    expect(prisma.cmpAcceptanceRequest.create).not.toHaveBeenCalled();
  });

  it("rejects a second active Engagement Change request for the same Engagement", async () => {
    prisma.cmpAcceptanceRequest.findFirst.mockResolvedValue({
      requestNo: "EC-001",
    });

    await expect(
      service.createAcceptance(
        {
          type: "ENGAGEMENT_CHANGE",
          targetEngagementId: "engagement-1",
          engagementPayload: {},
        },
        managerUser
      )
    ).rejects.toBeInstanceOf(ApiConflictException);

    expect(prisma.cmpAcceptanceRequest.findFirst).toHaveBeenCalledWith({
      where: {
        type: "ENGAGEMENT_CHANGE",
        status: {
          in: [
            "DRAFT",
            "STAFF_EDITING",
            "RETURNED",
            "PENDING_MIC",
            "PENDING_PIC",
            "PENDING_IT",
          ],
        },
        targetEngagementId: "engagement-1",
      },
      select: { requestNo: true },
    });
    expect(prisma.cmpAcceptanceRequest.create).not.toHaveBeenCalled();
  });

  it("allows a new Client Change request after the earlier request is no longer active", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue(client());
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        status: "DRAFT",
        targetClientId: "client-1",
        clientPayload: { nameZh: "Revised client name" },
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: { nameZh: "Revised client name" },
        },
        managerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT_CHANGE",
      status: "DRAFT",
      targetClientId: "client-1",
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledOnce();
  });

  it("maps a concurrent active-change index conflict to an actionable error", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({
      ...client(),
    });
    prisma.cmpAcceptanceRequest.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
        code: "P2002",
        clientVersion: "test",
        meta: {
          target: "cmp_acceptance_requests_active_client_change_target_key",
        },
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: { nameZh: "Concurrent revision" },
        },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: "CONFLICT_RISK",
        message: expect.stringContaining("active Change request"),
      }),
    });
  });

  it("accepts an English-only Client name during formal submission", async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "PENDING_PIC",
        currentStep: "PIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload({
            clientCode: "C-EN",
            nameEn: "English Name Limited",
          }),
          submit: true,
        },
        managerUser
      )
    ).resolves.toMatchObject({ status: "PENDING_PIC" });

    const [[createCall]] = prisma.cmpAcceptanceRequest.create.mock.calls;
    expect(createCall.data.clientPayload).toStrictEqual(
      expect.objectContaining({
        nameEn: "English Name Limited",
        nameZh: "",
      })
    );
  });

  it.each([
    ["clientCode", "Client Code"],
    ["companyNumber", "Company Number"],
    ["nameEn", "Company Name English or Chinese"],
    ["status", "Client Status"],
    ["yearEndMonth", "YE Month / Year End"],
    ["registeredAddress", "Registered address"],
    ["principalBusinessAddress", "Principal business address"],
    ["placeOfIncorporation", "Place of Incorporation"],
    ["listedOrPrivate", "Company Type"],
    ["clientLeadingPartnerId", "Client Leading Partner"],
    ["clientPartnerPicId", "PIC"],
    ["clientManagerMicId", "MIC"],
    ["serviceType", "Service Type"],
  ])("rejects a formal Client submission without %s", async (field, label) => {
    const clientPayload: Partial<
      ReturnType<typeof completeClientAcceptancePayload>
    > = completeClientAcceptancePayload();
    Reflect.deleteProperty(clientPayload, field);

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload,
          submit: true,
        },
        managerUser
      )
    ).rejects.toThrow(`${label} is required before submitting`);
    expect(prisma.cmpAcceptanceRequest.create).not.toHaveBeenCalled();
  });

  it("converts a uniquely matched legacy parent even when the UI sends an empty Group proposal", async () => {
    prisma.cmpClient.findMany.mockResolvedValue([{ id: "client-parent" }]);
    prisma.cmpClient.findUnique.mockResolvedValue({
      id: "client-parent",
      groupId: "group-1",
    });
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      id: "group-1",
      status: "ACTIVE",
      ultimateParentClientId: null,
    });
    prisma.cmpClientGroup.findUniqueOrThrow.mockResolvedValue({
      ultimateParentClientId: null,
    });
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "PENDING_PIC",
        currentStep: "PIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
      })
    );

    await service.createAcceptance(
      {
        type: "CLIENT",
        clientPayload: completeClientAcceptancePayload({
          groupId: "group-1",
          groupStructure: {
            primaryGroupId: "group-1",
            ultimateParentAction: "UNCHANGED",
            relationships: [],
          },
          parentClientCode: "C-PARENT",
        }),
        submit: true,
      },
      managerUser
    );

    const [[createCall]] = prisma.cmpAcceptanceRequest.create.mock.calls;
    expect(createCall.data.clientPayload).toStrictEqual(
      expect.objectContaining({
        groupStructure: expect.objectContaining({
          relationships: [
            expect.objectContaining({
              type: "SUBSIDIARY",
              direction: "TO_CLIENT",
              counterpartClientId: "client-parent",
            }),
          ],
        }),
      })
    );
  });

  it("rejects a future relationship effective date", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "approver-it" }]);
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      id: "group-1",
      status: "ACTIVE",
      ultimateParentClientId: null,
    });

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload({
            clientCode: "C-FUTURE",
            nameEn: "Future Relationship Limited",
            groupId: "group-1",
            groupStructure: {
              primaryGroupId: "group-1",
              ultimateParentAction: "UNCHANGED",
              relationships: [
                {
                  action: "UPSERT",
                  type: "ASSOCIATE",
                  direction: "FROM_CLIENT",
                  counterpartClientId: "client-2",
                  effectiveFrom: "2100-01-01",
                },
              ],
            },
          }),
          submit: true,
        },
        managerUser
      )
    ).rejects.toThrow("Relationship effective date cannot be in the future");
  });

  it("rejects an inactive Client as the Ultimate Parent", async () => {
    prisma.user.findMany.mockResolvedValue([{ id: "approver-it" }]);
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      id: "group-1",
      status: "ACTIVE",
      ultimateParentClientId: null,
    });
    prisma.cmpClientGroup.findUniqueOrThrow.mockResolvedValue({
      ultimateParentClientId: null,
    });

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload({
            clientCode: "C-INACTIVE",
            nameEn: "Inactive Parent Limited",
            status: "INACTIVE",
            groupId: "group-1",
            groupStructure: {
              primaryGroupId: "group-1",
              ultimateParentAction: "SET_CURRENT",
              relationships: [],
            },
          }),
          submit: true,
        },
        managerUser
      )
    ).rejects.toThrow(
      "The Ultimate Parent must be an active primary member of the Group"
    );
  });

  it("rejects inactivating the unchanged Ultimate Parent", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        status: "PENDING_IT",
        currentStep: "IT",
        targetClientId: "client-1",
        clientPayload: completeClientAcceptancePayload({
          clientCode: "C001",
          nameEn: "Current Parent Limited",
          status: "INACTIVE",
          groupId: "group-1",
          groupStructure: {
            primaryGroupId: "group-1",
            ultimateParentAction: "UNCHANGED",
            relationships: [],
          },
          clientPartnerPicId: "user-pic",
        }),
      })
    );
    prisma.cmpClient.findUnique.mockResolvedValue({
      id: "client-1",
      groupId: "group-1",
      ultimateParentForGroup: { id: "group-1" },
    });
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      id: "group-1",
      status: "ACTIVE",
      ultimateParentClientId: "client-1",
    });
    prisma.cmpClientGroup.findUniqueOrThrow.mockResolvedValue({
      ultimateParentClientId: "client-1",
      ultimateParent: {
        id: "client-1",
        groupId: "group-1",
        status: "ACTIVE",
      },
    });

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...superAdminUser, id: "approver-it" },
        "final ok"
      )
    ).rejects.toThrow(
      "The Ultimate Parent must be an active primary member of the Group"
    );
    expect(prisma.cmpClient.update).not.toHaveBeenCalled();
  });

  it("rejects Resigned status for a new Client request", async () => {
    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: {
            clientCode: "C-NEW",
            nameEn: "New Client Limited",
            status: "RESIGNED",
          },
        },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.cmpAcceptanceRequest.create).not.toHaveBeenCalled();
  });

  it("creates a client change request with a client change type and target", async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        requestNo: "CC-001",
        type: "CLIENT_CHANGE",
        targetClientId: "client-1",
      })
    );
    prisma.cmpClient.findUnique.mockResolvedValue({
      ...client(),
    });

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: completeClientAcceptancePayload({
            clientCode: "C001",
            nameEn: "Updated Client Limited",
            nameZh: "Updated Client CN",
            status: "RESIGNED",
          }),
          micApproverId: "approver-mic",
          picApproverId: "approver-pic",
          itApproverId: "approver-it",
          submit: true,
        },
        managerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT_CHANGE",
      targetClientId: "client-1",
    });

    expect(prisma.cmpAcceptanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          requestNo: expect.stringMatching(/^CC-/),
          type: "CLIENT_CHANGE",
          targetClientId: "client-1",
          clientPayload: expect.objectContaining({ status: "RESIGNED" }),
          changeBaselinePayload: expect.objectContaining({
            clientCode: "C001",
            nameEn: "Huaqian Limited",
          }),
          changeBaselineCapturedAt: expect.any(Date),
          changeBaselineTargetUpdatedAt: now,
        }),
      })
    );
  });

  it("keeps a Change request target immutable", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        status: "DRAFT",
        workflowVersion: 2,
        targetClientId: "client-1",
        micApproverId: managerUser.id,
      })
    );

    await expect(
      service.updateAcceptance(
        "acceptance-1",
        { targetClientId: "client-2" },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.cmpAcceptanceRequest.update).not.toHaveBeenCalled();
  });

  it("returns the stored baseline comparison for a Client Change", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        status: "PENDING_PIC",
        currentStep: "PIC",
        targetClientId: "client-1",
        clientPayload: {
          clientCode: "C001",
          nameEn: "Updated Client Limited",
        },
        changeBaselinePayload: {
          clientCode: "C001",
          nameEn: "Huaqian Limited",
        },
        changeBaselineCapturedAt: now,
        changeBaselineTargetUpdatedAt: now,
      })
    );
    prisma.cmpClient.findUnique.mockResolvedValue({
      ...client(),
    });
    prisma.cmpClient.findMany.mockResolvedValue([]);
    prisma.cmpClientGroup.findMany.mockResolvedValue([]);

    await expect(
      service.getAcceptanceChanges("acceptance-1", user)
    ).resolves.toMatchObject({
      status: "AVAILABLE",
      changedFieldCount: 1,
      staleMasterData: false,
      groups: [
        expect.objectContaining({
          section: "basicInformation",
          changes: [
            expect.objectContaining({
              field: "nameEn",
              before: "Huaqian Limited",
              after: "Updated Client Limited",
            }),
          ],
        }),
      ],
    });
  });

  it("returns an unavailable comparison for legacy Change requests", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT_CHANGE",
        targetEngagementId: "engagement-1",
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "C001-2026-AUD",
          serviceType: "ANNUAL_AUDIT",
          status: "ACTIVE",
        },
      })
    );

    await expect(
      service.getAcceptanceChanges("acceptance-1", user)
    ).resolves.toStrictEqual({
      status: "BASELINE_UNAVAILABLE",
      changedFieldCount: 0,
      baselineCapturedAt: null,
      staleMasterData: false,
      groups: [],
    });
    expect(prisma.cmpEngagement.findUnique).not.toHaveBeenCalled();
  });

  it("applies Acceptance visibility rules to the changes endpoint", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT_CHANGE",
        targetClientId: "client-1",
        changeBaselinePayload: { clientCode: "C001" },
      })
    );

    await expect(
      service.getAcceptanceChanges("acceptance-1", {
        ...user,
        id: "unrelated-user",
      })
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(prisma.cmpClient.findUnique).not.toHaveBeenCalled();
  });

  it("rejects client change requests without a target client", async () => {
    prisma.user.findMany.mockResolvedValue([
      { id: "approver-mic", globalRole: "MANAGER" },
      { id: "approver-pic", globalRole: "PARTNER" },
      { id: "approver-it", globalRole: "SUPER_ADMIN" },
    ]);

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT_CHANGE",
          clientPayload: {
            clientCode: "C001",
            nameZh: "Updated Client CN",
          },
          micApproverId: "approver-mic",
          picApproverId: "approver-pic",
          itApproverId: "approver-it",
        },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
  });

  it("lists only approvals assigned to the current user", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([acceptance()]);

    await expect(
      service.listApprovals({
        ...user,
        id: "approver-mic",
      })
    ).resolves.toStrictEqual({
      requests: [expect.objectContaining({ id: "acceptance-1" })],
    });

    expect(prisma.cmpAcceptanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({
              status: "PENDING_MIC",
              micApproverId: "approver-mic",
            }),
          ]),
        }),
      })
    );
  });

  it("scopes acceptance listing to the submitter and approvers", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([acceptance()]);

    await expect(service.listAcceptance({}, user)).resolves.toStrictEqual({
      requests: [expect.objectContaining({ requestNo: "CA-001" })],
    });

    expect(prisma.cmpAcceptanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([
            expect.objectContaining({
              OR: expect.arrayContaining([
                expect.objectContaining({ submittedById: "user-1" }),
              ]),
            }),
          ]),
        }),
      })
    );
  });

  it("normalizes legacy master-only client fields when listing acceptance requests", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([
      acceptance({
        status: "DRAFT",
        submittedAt: null,
        clientPayload: {
          ...completeClientAcceptancePayload(),
          id: "legacy-client-id",
          group: {
            id: "legacy-group-id",
            groupCode: "G-LEGACY",
          },
        },
      }),
    ]);

    const result = await service.listAcceptance({}, user);

    expect(result.requests[0]?.clientPayload).toStrictEqual(
      expect.objectContaining({ clientCode: "C-NEW" })
    );
    expect(result.requests[0]?.clientPayload).not.toHaveProperty("id");
    expect(result.requests[0]?.clientPayload).not.toHaveProperty("group");
  });

  it("lists only visible new-record master drafts without exposing them to future approvers", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([
      acceptance({
        status: "DRAFT",
        submittedAt: null,
        workflowVersion: 2,
      }),
      acceptance({
        id: "staff-assigned-draft",
        requestNo: "CA-002",
        status: "STAFF_EDITING",
        submittedAt: null,
        submittedById: "draft-owner",
        submittedBy: userRef({ id: "draft-owner", name: "Draft owner" }),
        micApproverId: "approver-mic",
        draftAssigneeId: user.id,
        draftAssignee: userRef({
          id: user.id,
          email: user.email,
          name: user.name,
          globalRole: user.globalRole,
        }),
        workflowVersion: 2,
      }),
      acceptance({
        id: "future-pic-only-draft",
        requestNo: "CA-003",
        status: "DRAFT",
        submittedAt: null,
        submittedById: "another-owner",
        submittedBy: userRef({ id: "another-owner", name: "Another owner" }),
        micApproverId: "approver-mic",
        picApproverId: user.id,
        workflowVersion: 2,
      }),
    ]);

    await expect(
      service.listMasterDrafts("CLIENT", user)
    ).resolves.toStrictEqual({
      drafts: [
        expect.objectContaining({
          request: expect.objectContaining({ id: "acceptance-1" }),
          canEdit: true,
          canDelete: true,
        }),
        expect.objectContaining({
          request: expect.objectContaining({ id: "staff-assigned-draft" }),
          currentOwner: expect.objectContaining({ id: user.id }),
          canEdit: true,
          canDelete: false,
        }),
      ],
    });

    expect(prisma.cmpAcceptanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "CLIENT",
          OR: expect.not.arrayContaining([
            expect.objectContaining({ picApproverId: user.id }),
            expect.objectContaining({ itApproverId: user.id }),
          ]),
        }),
      })
    );
  });

  it("filters acceptance listing by the engagement change target", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([
      acceptance({
        id: "engagement-change-1",
        requestNo: "EC-001",
        type: "ENGAGEMENT_CHANGE",
        targetEngagementId: "engagement-1",
      }),
    ]);

    await expect(
      service.listAcceptance(
        { type: "ENGAGEMENT_CHANGE", targetEngagementId: "engagement-1" },
        user
      )
    ).resolves.toStrictEqual({
      requests: [expect.objectContaining({ id: "engagement-change-1" })],
    });

    expect(prisma.cmpAcceptanceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: "ENGAGEMENT_CHANGE",
          targetEngagementId: "engagement-1",
        }),
      })
    );
  });

  it("rejects legacy engagement payloads containing retired fields", async () => {
    prisma.cmpAcceptanceRequest.findMany.mockResolvedValue([
      acceptance({
        type: "ENGAGEMENT",
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "E-LEGACY",
          engagementName: "Legacy engagement request",
          serviceType: "ANNUAL_AUDIT",
          status: "ACTIVE",
        },
      }),
    ]);

    await expect(service.listAcceptance({}, user)).rejects.toMatchObject({
      issues: expect.any(Array),
    });
  });

  it("rejects role-ineligible acceptance approvers", async () => {
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic", globalRole: "STAFF" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: completeClientAcceptancePayload({
            nameZh: "New Client CN",
          }),
          micApproverId: "approver-mic",
          picApproverId: "approver-pic",
          itApproverId: "untrusted-it",
          submit: true,
        },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "BAD_REQUEST" }),
    });
  });

  it("moves approval from MIC to PIC", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({ workflowVersion: 2 })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "PENDING_PIC",
        currentStep: "PIC",
        approvalSteps: [
          {
            id: "step-mic",
            requestId: "acceptance-1",
            step: "MIC",
            approverId: "approver-mic",
            approver: userRef({ id: "approver-mic" }),
            status: "APPROVED",
            comment: "ok",
            actedAt: now,
            createdAt: now,
          },
        ],
      })
    );

    await expect(
      service.approveAcceptance("acceptance-1", managerUser, "ok")
    ).resolves.toMatchObject({
      status: "PENDING_PIC",
      currentStep: "PIC",
    });

    expect(prisma.cmpAcceptanceApprovalStep.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          step: "MIC",
          approverId: "approver-mic",
        }),
        data: expect.objectContaining({ status: "APPROVED", comment: "ok" }),
      })
    );
    expect(prisma.cmpAcceptanceApprovalStep.create).toHaveBeenCalledWith({
      data: {
        requestId: "acceptance-1",
        step: "PIC",
        approverId: "approver-pic",
        status: "PENDING",
      },
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "approver-pic",
        senderId: null,
        title: "CA-001 已进入 PIC 审批",
        contentKey: "CMP_ACCEPTANCE_NEXT_APPROVER",
        contentParams: {
          requestNo: "CA-001",
          actor: "MIC Manager",
          acceptanceType: "CLIENT",
          subject: "New Client Limited",
          completedStep: "MIC",
        },
        actionUrl: "/cmp/acceptance?tab=approvals&requestId=acceptance-1",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: null,
        title: "CA-001 已通过 MIC 审批",
        contentKey: "CMP_ACCEPTANCE_STEP_ADVANCED",
        contentParams: {
          requestNo: "CA-001",
          actor: "MIC Manager",
          subject: "New Client Limited",
          completedStep: "MIC",
          nextStep: "PIC",
        },
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
    for (const [message] of inbox.createCollaborationMessage.mock.calls) {
      expect(message).not.toHaveProperty("request");
      expect(message).not.toHaveProperty("recipientEmail");
      expect(message).not.toHaveProperty("actorName");
      expect(message).not.toHaveProperty("tab");
    }
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "pic@example.com",
        subject: "[CMP] CA-001 已进入你的审批环节",
        text: expect.stringContaining("申请编号：CA-001"),
      })
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "pic@example.com",
        text: expect.stringContaining(
          "详情：http://localhost:3002/zh-CN/acceptance?tab=approvals&requestId=acceptance-1"
        ),
      })
    );
  });

  it.each([
    ["COMPLETED", 1, 0, "ATTENTION", false],
    ["COMPLETED", 0, 0, "ATTENTION", true],
    ["PARTIAL_FAILED", 0, 1, "ERROR", false],
    ["FAILED", 0, 1, "ERROR", false],
  ] as const)(
    "keeps AML %s advisory while MIC approval advances",
    async (
      batchStatus,
      attentionCount,
      errorCount,
      summaryStatus,
      hasConfirmedMatch
    ) => {
      const amlScreeningBatches = [
        {
          status: batchStatus,
          subjectCount: 1,
          attentionCount,
          errorCount,
          completedAt: now,
          createdAt: now,
          subjects: hasConfirmedMatch
            ? [
                {
                  status: "APPROVED",
                  hits: [{ reviewStatus: "CONFIRMED_MATCH" }],
                },
              ]
            : [],
        },
      ];
      prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
        acceptance({ workflowVersion: 2, amlScreeningBatches })
      );
      prisma.cmpAcceptanceRequest.update.mockResolvedValue(
        acceptance({
          workflowVersion: 2,
          status: "PENDING_PIC",
          currentStep: "PIC",
          amlScreeningBatches,
        })
      );

      await expect(
        service.approveAcceptance("acceptance-1", managerUser, "ok")
      ).resolves.toMatchObject({
        status: "PENDING_PIC",
        currentStep: "PIC",
        amlSummary: { status: summaryStatus },
      });
    }
  );

  it("moves approval from PIC to IT and notifies IT", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "PENDING_PIC",
        currentStep: "PIC",
      })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "PENDING_IT",
        currentStep: "IT",
      })
    );

    await expect(
      service.approveAcceptance("acceptance-1", partnerUser, "pic ok")
    ).resolves.toMatchObject({
      status: "PENDING_IT",
      currentStep: "IT",
    });

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "approver-it",
        senderId: null,
        title: "CA-001 已进入 IT 审批",
        actionUrl: "/cmp/acceptance?tab=approvals&requestId=acceptance-1",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: null,
        title: "CA-001 已通过 PIC 审批",
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "it@example.com",
        subject: "[CMP] CA-001 已进入你的审批环节",
      })
    );
  });

  it("moves IT approval to final approved state", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue({
      id: "client-associate",
      groupId: "group-other",
    });
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Leading Partner From Directory" })
      .mockResolvedValueOnce({ name: "PIC From Directory" })
      .mockResolvedValueOnce({ name: "MIC From Directory" })
      .mockResolvedValueOnce({ name: "Second MIC From Directory" });
    prisma.cmpClientGroup.findUnique.mockResolvedValue({
      id: "group-1",
      status: "ACTIVE",
      ultimateParentClientId: null,
    });
    prisma.cmpClientGroup.findUniqueOrThrow.mockResolvedValue({
      ultimateParentClientId: null,
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "PENDING_IT",
        currentStep: "IT",
        clientPayload: completeClientAcceptancePayload({
          clientCode: "C-NEW",
          nameEn: "New Client Limited",
          nameZh: "New Client CN",
          clientPartnerPicId: "user-pic",
          clientPartnerPic: "Wrong PIC Snapshot",
          clientManagerMicId: "user-mic",
          clientManagerMic: "Wrong MIC Snapshot",
          alternativePartnerSecondMicId: "user-second-mic",
          alternativePartnerSecondMic: "Wrong Second MIC Snapshot",
          status: "ACTIVE",
          groupId: "group-1",
          groupStructure: {
            primaryGroupId: "group-1",
            ultimateParentAction: "SET_CURRENT",
            relationships: [
              {
                action: "UPSERT",
                type: "ASSOCIATE",
                direction: "FROM_CLIENT",
                counterpartClientId: "client-associate",
                ownershipPercentage: 25,
                effectiveFrom: "2026-07-05",
                remarks: "Cross-group associate",
              },
            ],
          },
        }),
      })
    );
    prisma.cmpClient.create.mockResolvedValue({ id: "client-new" });
    prisma.cmpClient.findUnique.mockResolvedValue(
      client({ id: "client-new", clientCode: "C-NEW" })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "APPROVED",
        currentStep: "DONE",
        targetClientId: "client-new",
        approvedAt: now,
        draftCompletedById: "user-1",
        draftCompletedBy: userRef({
          id: "user-1",
          email: "staff@example.com",
          name: "Staff",
          globalRole: "STAFF",
        }),
      })
    );

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...superAdminUser, id: "approver-it" },
        "final ok"
      )
    ).resolves.toMatchObject({
      status: "APPROVED",
      currentStep: "DONE",
    });

    expect(prisma.cmpClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientCode: "C-NEW",
          approvalReferenceNumber: "NCA-2026-0001",
          nameZh: "New Client CN",
          clientPartnerPicId: "user-pic",
          clientPartnerPic: "PIC From Directory",
          clientManagerMicId: "user-mic",
          clientManagerMic: "MIC From Directory",
          alternativePartnerSecondMicId: "user-second-mic",
          alternativePartnerSecondMic: "Second MIC From Directory",
          createdById: "approver-it",
        }),
      })
    );
    const createdClientData = prisma.cmpClient.create.mock.calls[0][0].data;
    expect(createdClientData).not.toHaveProperty("isSubsidiary");
    expect(createdClientData).not.toHaveProperty("parentClientCode");
    expect(createdClientData).not.toHaveProperty("subsidiariesOrAssociates");
    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ targetClientId: "client-new" }),
      })
    );
    expect(prisma.cmpAmlScreeningBatch.updateMany).toHaveBeenCalledWith({
      where: { acceptanceRequestId: "acceptance-1" },
      data: { clientId: "client-new" },
    });
    expect(prisma.cmpClientVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientId: "client-new",
          versionNumber: 1,
          sourceType: "CLIENT_ACCEPTANCE",
          acceptanceRequestId: "acceptance-1",
        }),
      })
    );
    expect(prisma.cmpClientGroup.updateMany).toHaveBeenCalledWith({
      where: { ultimateParentClientId: "client-new" },
      data: { ultimateParentClientId: null },
    });
    expect(prisma.cmpClientGroup.update).toHaveBeenCalledWith({
      where: { id: "group-1" },
      data: { ultimateParentClientId: "client-new" },
    });
    expect(prisma.cmpClientRelationship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        groupId: "group-1",
        fromClientId: "client-new",
        toClientId: "client-associate",
        type: "ASSOCIATE",
        ownershipPercentage: new Prisma.Decimal(25),
        approvedViaRequestId: "acceptance-1",
        createdById: "approver-it",
      }),
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: null,
        title: "CA-001 已通过",
        contentKey: "CMP_ACCEPTANCE_APPROVED",
        contentParams: {
          requestNo: "CA-001",
          actor: "IT Admin",
          acceptanceType: "CLIENT",
          subject: "New Client Limited",
        },
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );

    expect(email.send).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        to: "staff@example.com",
        subject: "[CMP] CA-001 已通过",
      })
    );
  });

  it("updates the target client when a client change request is approved", async () => {
    prisma.cmpClient.findUnique.mockResolvedValue(client({ id: "client-1" }));
    prisma.cmpClient.update.mockResolvedValue({ id: "client-1" });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "PENDING_IT",
        currentStep: "IT",
        targetClientId: "client-1",
        clientPayload: completeClientAcceptancePayload({
          clientCode: "C001",
          nameZh: "Updated Client CN",
          status: "ACTIVE",
        }),
      })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "APPROVED",
        currentStep: "DONE",
        targetClientId: "client-1",
        approvedAt: now,
      })
    );

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...superAdminUser, id: "approver-it" },
        "final ok"
      )
    ).resolves.toMatchObject({ status: "APPROVED" });

    expect(prisma.cmpClient.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "client-1" },
        data: expect.objectContaining({
          nameZh: "Updated Client CN",
        }),
      })
    );
  });

  it("creates an engagement when an engagement acceptance is approved", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "PENDING_IT",
        currentStep: "IT",
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "E-NEW",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          recoveryRate: "80.00",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          status: "ACTIVE",
        },
      })
    );
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Partner A" })
      .mockResolvedValueOnce({ name: "Manager B" });
    prisma.cmpEngagement.create.mockResolvedValue({ id: "engagement-new" });
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "APPROVED",
        currentStep: "DONE",
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "E-NEW",
          serviceType: "ANNUAL_AUDIT",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          recoveryRate: "80.00",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          status: "ACTIVE",
        },
        targetEngagementId: "engagement-new",
        approvedAt: now,
      })
    );

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...superAdminUser, id: "approver-it" },
        "final ok"
      )
    ).resolves.toMatchObject({ status: "APPROVED" });

    expect(prisma.cmpEngagement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementCode: "E-NEW",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          recoveryRate: "80.00",
          feeCurrency: "HKD",
          createdById: "approver-it",
        }),
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-pic",
        title: "E-NEW 承接已最终批准",
        actionUrl: "/engagement",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-mic",
        title: "E-NEW 承接已最终批准",
        actionUrl: "/engagement",
      })
    );
  });

  it("retains the old code alias when an engagement change request is approved", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "PENDING_IT",
        currentStep: "IT",
        clientPayload: null,
        targetEngagementId: "engagement-1",
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "E-NEW",
          serviceType: "ANNUAL_AUDIT",
          otherServiceDescription: "",
          yearEndDate: "",
          reportDate: "",
          approvalReferenceNumber: "",
          engagementDate: "",
          budgetedHours: "480.00",
          agreedFee: "200000.00",
          recoveryRate: "82.50",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Partner A",
          mic: "Manager B",
          status: "ACTIVE",
        },
      })
    );
    prisma.cmpEngagement.findUnique.mockResolvedValue({
      engagementCode: "E-OLD",
    });
    prisma.user.findFirst
      .mockResolvedValueOnce({ name: "Partner A" })
      .mockResolvedValueOnce({ name: "Manager B" });
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "APPROVED",
        currentStep: "DONE",
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "E-NEW",
          serviceType: "ANNUAL_AUDIT",
          otherServiceDescription: "",
          yearEndDate: "",
          reportDate: "",
          approvalReferenceNumber: "",
          engagementDate: "",
          budgetedHours: "480.00",
          agreedFee: "200000.00",
          recoveryRate: "82.50",
          feeCurrency: "HKD",
          picUserId: "user-pic",
          micUserId: "user-mic",
          pic: "Partner A",
          mic: "Manager B",
          status: "ACTIVE",
        },
        targetEngagementId: "engagement-1",
        approvedAt: now,
      })
    );

    await service.approveAcceptance(
      "acceptance-1",
      { ...superAdminUser, id: "approver-it" },
      "final ok"
    );

    expect(prisma.cmpEngagementCodeAlias.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        engagementId: "engagement-1",
        code: "E-OLD",
      }),
    });
    expect(prisma.cmpEngagement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          engagementCode: "E-NEW",
          budgetedHours: "480.00",
          agreedFee: "200000.00",
          recoveryRate: "82.50",
          feeCurrency: "HKD",
        }),
      })
    );
  });

  it("returns a pending request to staff for editing", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(acceptance());
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "RETURNED",
        currentStep: "MIC",
        returnReason: "Need more details",
        returnedAt: now,
      })
    );

    await expect(
      service.returnAcceptance(
        "acceptance-1",
        { comment: "Need more details" },
        managerUser
      )
    ).resolves.toMatchObject({
      status: "RETURNED",
      returnReason: "Need more details",
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: null,
        title: "CA-001 已被退回",
        body: expect.stringContaining("Need more details"),
        contentKey: "CMP_ACCEPTANCE_RETURNED",
        contentParams: {
          requestNo: "CA-001",
          actor: "MIC Manager",
          acceptanceType: "CLIENT",
          subject: "New Client Limited",
          reason: "Need more details",
        },
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
  });

  it("keeps the return workflow successful when CMP email delivery fails", async () => {
    const warning = vi.spyOn(Logger.prototype, "warn").mockReturnValue();
    email.send.mockRejectedValueOnce(new Error("SMTP unavailable"));
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(acceptance());
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "RETURNED",
        currentStep: "MIC",
        returnReason: "Need more details",
      })
    );

    await expect(
      service.returnAcceptance(
        "acceptance-1",
        { comment: "Need more details" },
        managerUser
      )
    ).resolves.toMatchObject({ status: "RETURNED" });

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({ recipientId: "user-1" })
    );
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("CMP email failed for CA-001")
    );
    warning.mockRestore();
  });

  it("resubmits a returned request from MIC with new steps", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "RETURNED",
        currentStep: "MIC",
        returnReason: "Need more details",
      })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "PENDING_MIC",
        currentStep: "MIC",
        returnReason: null,
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", user)
    ).resolves.toMatchObject({
      status: "PENDING_MIC",
      currentStep: "MIC",
      returnReason: null,
    });

    expect(prisma.cmpAcceptanceApprovalStep.deleteMany).toHaveBeenCalledWith({
      where: { requestId: "acceptance-1" },
    });
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-1",
        senderId: null,
        title: "CA-001 已提交成功",
        contentKey: "CMP_ACCEPTANCE_SUBMITTED",
        contentParams: {
          requestNo: "CA-001",
          acceptanceType: "CLIENT",
          subject: "New Client Limited",
        },
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "approver-mic",
        senderId: null,
        title: "CA-001 已提交，等待你审批",
        contentKey: "CMP_ACCEPTANCE_APPROVAL_REQUESTED",
        contentParams: {
          requestNo: "CA-001",
          actor: "Staff",
          acceptanceType: "CLIENT",
          subject: "New Client Limited",
          step: "MIC",
        },
        actionUrl: "/cmp/acceptance?tab=approvals&requestId=acceptance-1",
      })
    );
  });

  it("assigns a V2 draft to Staff and records completion for the MIC", async () => {
    const draft = acceptance({
      status: "DRAFT",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: "approver-mic",
      draftAssigneeId: null,
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(draft);
    prisma.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      globalRole: "STAFF",
    });
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...draft,
        status: "STAFF_EDITING",
        draftAssigneeId: "user-staff",
        draftAssignee: userRef({
          id: "user-staff",
          email: "staff@example.com",
          name: "Staff User",
          globalRole: "STAFF",
        }),
      })
    );

    await expect(
      service.assignAcceptanceDraft(
        "acceptance-1",
        { assigneeId: "user-staff" },
        managerUser
      )
    ).resolves.toMatchObject({
      status: "STAFF_EDITING",
      draftAssigneeId: "user-staff",
    });

    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(
      acceptance({
        ...draft,
        status: "STAFF_EDITING",
        draftAssigneeId: "user-staff",
      })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...draft,
        status: "DRAFT",
        draftAssigneeId: "user-staff",
        draftCompletedAt: now,
        draftCompletedById: "user-staff",
        draftCompletedBy: userRef({
          id: "user-staff",
          email: "staff@example.com",
          name: "Staff User",
          globalRole: "STAFF",
        }),
      })
    );

    await expect(
      service.completeAcceptanceDraft("acceptance-1", {
        ...user,
        id: "user-staff",
      })
    ).resolves.toMatchObject({
      status: "DRAFT",
      draftCompletedById: "user-staff",
      draftCompletedAt: now.toISOString(),
    });
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "staff@example.com",
        subject: "[CMP] CA-001 草稿已分派给你",
      })
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "mic@example.com",
        subject: "[CMP] CA-001 草稿已完成",
      })
    );
  });

  it("lets a Partner manage delegated drafting before the first submission", async () => {
    const partnerDraft = acceptance({
      status: "DRAFT",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: partnerUser.id,
      submittedBy: userRef(partnerUser),
      submittedAt: null,
      micApproverId: managerUser.id,
      micApprover: userRef(managerUser),
      draftAssigneeId: null,
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(partnerDraft);
    prisma.user.findUnique.mockResolvedValueOnce({
      status: "ACTIVE",
      globalRole: "STAFF",
    });
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...partnerDraft,
        status: "STAFF_EDITING",
        draftAssigneeId: "user-staff",
        draftAssignee: userRef({
          id: "user-staff",
          email: "staff@example.com",
          name: "Staff User",
          globalRole: "STAFF",
        }),
      })
    );

    await expect(
      service.assignAcceptanceDraft(
        "acceptance-1",
        { assigneeId: "user-staff" },
        partnerUser
      )
    ).resolves.toMatchObject({
      status: "STAFF_EDITING",
      draftAssigneeId: "user-staff",
    });

    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(
      acceptance({
        ...partnerDraft,
        status: "STAFF_EDITING",
        draftAssigneeId: "user-staff",
      })
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...partnerDraft,
        status: "DRAFT",
        draftAssigneeId: "user-staff",
        draftCompletedAt: now,
        draftCompletedById: "user-staff",
        draftCompletedBy: userRef({
          id: "user-staff",
          email: "staff@example.com",
          name: "Staff User",
          globalRole: "STAFF",
        }),
      })
    );

    await service.completeAcceptanceDraft("acceptance-1", {
      ...user,
      id: "user-staff",
    });

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: partnerUser.id,
        title: "CA-001 草稿已完成，等待发起人复核",
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
  });

  it("hands a Partner-owned completed draft to MIC even if the initiator role changes", async () => {
    const partnerDraft = acceptance({
      status: "DRAFT",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: partnerUser.id,
      submittedBy: userRef(partnerUser),
      submittedAt: null,
      micApproverId: managerUser.id,
      micApprover: userRef(managerUser),
      clientPayload: completeClientAcceptancePayload(),
      draftAssigneeId: "user-staff",
      draftCompletedAt: now,
      draftCompletedById: "user-staff",
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(partnerDraft);
    prisma.user.findUnique.mockResolvedValueOnce({
      id: managerUser.id,
      status: "ACTIVE",
      globalRole: "MANAGER",
    });
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: superAdminUser.id }])
      .mockResolvedValueOnce([
        { id: managerUser.id, globalRole: "MANAGER" },
        { id: partnerUser.id, globalRole: "PARTNER" },
        { id: superAdminUser.id, globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        ...partnerDraft,
        status: "PENDING_MIC",
        currentStep: "MIC",
        submittedAt: now,
        approvalSteps: [
          {
            id: "step-mic",
            requestId: "acceptance-1",
            step: "MIC",
            approverId: managerUser.id,
            approver: userRef(managerUser),
            status: "PENDING",
            comment: null,
            actedAt: null,
            createdAt: now,
          },
        ],
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", {
        ...partnerUser,
        globalRole: "MANAGER",
      })
    ).resolves.toMatchObject({
      status: "PENDING_MIC",
      currentStep: "MIC",
      micApproverId: managerUser.id,
    });

    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "PENDING_MIC",
          currentStep: "MIC",
          approvalSteps: {
            create: [{ step: "MIC", approverId: managerUser.id }],
          },
        }),
      })
    );
  });

  it("keeps returned work under MIC control after a Partner submission", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "RETURNED",
        currentStep: "MIC",
        workflowVersion: 2,
        submittedById: partnerUser.id,
        submittedBy: userRef(partnerUser),
        submittedAt: now,
        micApproverId: managerUser.id,
        micApprover: userRef(managerUser),
        returnReason: "Please revise",
        returnedAt: now,
      })
    );

    await expect(
      service.assignAcceptanceDraft(
        "acceptance-1",
        { assigneeId: "user-staff" },
        partnerUser
      )
    ).rejects.toBeInstanceOf(ApiForbiddenException);
  });

  it("notifies the MIC when a Partner-initiated request is returned after submission", async () => {
    const pendingPicRequest = acceptance({
      status: "PENDING_PIC",
      currentStep: "PIC",
      workflowVersion: 2,
      submittedById: partnerUser.id,
      submittedBy: userRef(partnerUser),
      submittedAt: now,
      micApproverId: managerUser.id,
      micApprover: userRef(managerUser),
      picApproverId: partnerUser.id,
      picApprover: userRef(partnerUser),
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(pendingPicRequest);
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        ...pendingPicRequest,
        status: "RETURNED",
        currentStep: "MIC",
        returnReason: "Please revise",
        returnedAt: now,
        returnedFromStep: "PIC",
      })
    );

    await service.returnAcceptance(
      "acceptance-1",
      { comment: "Please revise" },
      partnerUser
    );

    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: managerUser.id,
        actionUrl: "/cmp/acceptance?tab=requests&requestId=acceptance-1",
      })
    );
  });

  it("restores a returned request after a Staff recall", async () => {
    const staffEditingRequest = acceptance({
      status: "STAFF_EDITING",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: "approver-mic",
      draftAssigneeId: "user-staff",
      returnReason: "Please update the client information",
      returnedAt: now,
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(
      staffEditingRequest
    );
    prisma.user.findUnique.mockResolvedValueOnce({
      id: "user-staff",
      email: "staff@example.com",
    });
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...staffEditingRequest,
        status: "RETURNED",
        draftAssigneeId: null,
        draftCompletedAt: null,
        draftCompletedById: null,
      })
    );

    await expect(
      service.recallAcceptanceDraft("acceptance-1", managerUser)
    ).resolves.toMatchObject({
      status: "RETURNED",
      draftAssigneeId: null,
    });

    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETURNED",
          draftAssigneeId: null,
        }),
      })
    );
    expect(inbox.createCollaborationMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientId: "user-staff",
        title: "CA-001 草稿已被撤回",
      })
    );
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "staff@example.com",
        subject: "[CMP] CA-001 草稿已被撤回",
      })
    );
  });

  it("restores a returned request when the MIC recalls it from Staff", async () => {
    const staffEditingRequest = acceptance({
      status: "STAFF_EDITING",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: "approver-mic",
      draftAssigneeId: "user-staff",
      returnReason: "Please update the client information",
      returnedAt: now,
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(
      staffEditingRequest
    );
    prisma.cmpAcceptanceRequest.update.mockResolvedValueOnce(
      acceptance({
        ...staffEditingRequest,
        status: "RETURNED",
        draftAssigneeId: null,
        draftCompletedAt: null,
        draftCompletedById: null,
      })
    );

    await expect(
      service.recallAcceptanceDraft("acceptance-1", managerUser)
    ).resolves.toMatchObject({
      status: "RETURNED",
      draftAssigneeId: null,
    });

    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: "RETURNED",
          draftAssigneeId: null,
        }),
      })
    );
  });

  it("saves a V2 draft before PIC and IT routing is complete", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(null);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(
      acceptance({
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
        picApproverId: null,
        picApprover: null,
        itApproverId: null,
        itApprover: null,
      })
    );

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: {
            clientCode: "C-DRAFT",
            nameZh: "Draft Client",
          },
        },
        managerUser
      )
    ).resolves.toMatchObject({
      status: "DRAFT",
      picApproverId: null,
      itApproverId: null,
    });

    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it("creates and assigns an incomplete Client draft to Staff", async () => {
    const draft = acceptance({
      status: "STAFF_EDITING",
      currentStep: "MIC",
      submittedById: "approver-mic",
      workflowVersion: 2,
      clientPayload: {},
      draftAssigneeId: "user-staff",
      draftAssignee: userRef({
        id: "user-staff",
        name: "Staff User",
        globalRole: "STAFF",
      }),
    });
    prisma.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      globalRole: "STAFF",
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(null);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(draft);

    await expect(
      service.createAcceptance(
        {
          type: "CLIENT",
          clientPayload: {},
          draftAssigneeId: "user-staff",
          submit: false,
        },
        managerUser
      )
    ).resolves.toMatchObject({
      type: "CLIENT",
      status: "STAFF_EDITING",
      draftAssigneeId: "user-staff",
      clientPayload: {},
    });
  });

  it("rejects formal submission of an incomplete Client draft", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
        clientPayload: {},
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", managerUser)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
  });

  it("rejects retired PRC fields in a Client submission", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "CLIENT",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
        clientPayload: {
          ...completeClientAcceptancePayload({ clientCode: "C-PRC" }),
          prcEstablishments: [{ establishmentName: "" }],
        },
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", managerUser)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
  });

  it("creates and assigns an incomplete Engagement draft to Staff", async () => {
    const draft = acceptance({
      type: "ENGAGEMENT",
      status: "STAFF_EDITING",
      currentStep: "MIC",
      submittedById: "approver-mic",
      workflowVersion: 2,
      clientPayload: null,
      engagementPayload: {},
      draftAssigneeId: "user-staff",
      draftAssignee: userRef({
        id: "user-staff",
        name: "Staff User",
        globalRole: "STAFF",
      }),
    });
    prisma.user.findUnique.mockResolvedValue({
      status: "ACTIVE",
      globalRole: "STAFF",
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValueOnce(null);
    prisma.cmpAcceptanceRequest.create.mockResolvedValue(draft);

    await expect(
      service.createAcceptance(
        {
          type: "ENGAGEMENT",
          engagementPayload: {},
          draftAssigneeId: "user-staff",
          submit: false,
        },
        managerUser
      )
    ).resolves.toMatchObject({
      type: "ENGAGEMENT",
      status: "STAFF_EDITING",
      draftAssigneeId: "user-staff",
      engagementPayload: {},
    });
  });

  it("rejects formal submission of an incomplete Engagement draft", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
        clientPayload: null,
        engagementPayload: {},
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", managerUser)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
  });

  it("rejects formal Engagement submission when a responsible user is inactive or has the wrong role", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        type: "ENGAGEMENT",
        status: "DRAFT",
        currentStep: "MIC",
        submittedById: "approver-mic",
        workflowVersion: 2,
        clientPayload: null,
        engagementPayload: {
          clientId: "client-1",
          engagementCode: "C001-2027-AUD",
          serviceType: "AUDIT",
          budgetedHours: "420.00",
          agreedFee: "180000.00",
          feeCurrency: "HKD",
          picUserId: "inactive-partner",
          micUserId: "approver-mic",
          status: "ACTIVE",
        },
      })
    );
    prisma.user.findFirst.mockResolvedValueOnce(null);

    await expect(
      service.submitAcceptance("acceptance-1", managerUser)
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.cmpAcceptanceApprovalStep.createMany).not.toHaveBeenCalled();
  });

  it("updates an existing Engagement draft while it remains incomplete", async () => {
    const draft = acceptance({
      type: "ENGAGEMENT",
      status: "DRAFT",
      currentStep: "MIC",
      submittedById: "approver-mic",
      workflowVersion: 2,
      clientPayload: null,
      engagementPayload: {},
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(draft);
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        ...draft,
        engagementPayload: { remarks: "Working draft" },
      })
    );

    await expect(
      service.updateAcceptance(
        "acceptance-1",
        { engagementPayload: { remarks: "Working draft" } },
        managerUser
      )
    ).resolves.toMatchObject({
      status: "DRAFT",
      engagementPayload: { remarks: "Working draft" },
    });
  });

  it("deletes an unsubmitted MIC-owned draft", async () => {
    const draft = acceptance({
      type: "ENGAGEMENT",
      status: "DRAFT",
      currentStep: "MIC",
      submittedById: managerUser.id,
      submittedAt: null,
      workflowVersion: 2,
      clientPayload: null,
      engagementPayload: {},
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(draft);

    await expect(
      service.deleteAcceptanceDraft("acceptance-1", managerUser)
    ).resolves.toStrictEqual({
      id: "acceptance-1",
    });

    expect(prisma.cmpAcceptanceRequest.delete).toHaveBeenCalledWith({
      where: { id: "acceptance-1" },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({ action: "CMP_ACCEPTANCE_DRAFT_DELETED" })
    );
  });

  it("rejects invalid recovery rate values in a draft", async () => {
    await expect(
      service.createAcceptance(
        {
          type: "ENGAGEMENT",
          engagementPayload: {
            recoveryRate: "-1.00",
          },
          submit: false,
        },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
  });

  it("prevents delegated Staff from changing a change request target", async () => {
    const delegated = acceptance({
      type: "CLIENT_CHANGE",
      status: "STAFF_EDITING",
      currentStep: "MIC",
      workflowVersion: 2,
      submittedById: "approver-mic",
      targetClientId: "client-1",
      draftAssigneeId: "user-staff",
    });
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(delegated);
    await expect(
      service.updateAcceptance(
        "acceptance-1",
        {
          targetClientId: "client-2",
          clientPayload: {
            clientCode: "C001",
            nameZh: "Staff update",
          },
        },
        { ...user, id: "user-staff" }
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "VALIDATION_FAILED" }),
    });
    expect(prisma.cmpAcceptanceRequest.update).not.toHaveBeenCalled();
  });

  it("prevents the MIC from editing while Staff owns the draft", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "STAFF_EDITING",
        currentStep: "MIC",
        workflowVersion: 2,
        submittedById: "approver-mic",
        draftAssigneeId: "user-staff",
      })
    );

    await expect(
      service.updateAcceptance(
        "acceptance-1",
        { clientPayload: { clientCode: "C001", nameZh: "MIC overwrite" } },
        managerUser
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });

    expect(prisma.cmpAcceptanceRequest.update).not.toHaveBeenCalled();
  });

  it("resubmits a V2 request directly to IT after PIC has approved", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(
      acceptance({
        status: "RETURNED",
        currentStep: "MIC",
        workflowVersion: 2,
        submittedById: "approver-mic",
        picApprovedAt: now,
        returnedFromStep: "IT",
        clientPayload: completeClientAcceptancePayload({
          nameZh: "New Client CN",
          clientPartnerPicId: "approver-pic-new",
        }),
      })
    );
    prisma.user.findMany
      .mockResolvedValueOnce([{ id: "approver-it" }])
      .mockResolvedValueOnce([
        { id: "approver-mic", globalRole: "MANAGER" },
        { id: "approver-pic-new", globalRole: "PARTNER" },
        { id: "approver-it", globalRole: "SUPER_ADMIN" },
      ]);
    prisma.cmpAcceptanceRequest.update.mockResolvedValue(
      acceptance({
        status: "PENDING_IT",
        currentStep: "IT",
        workflowVersion: 2,
        submittedById: "approver-mic",
        picApprovedAt: now,
        returnedFromStep: null,
      })
    );

    await expect(
      service.submitAcceptance("acceptance-1", managerUser)
    ).resolves.toMatchObject({
      status: "PENDING_IT",
      currentStep: "IT",
    });

    expect(prisma.cmpAcceptanceApprovalStep.deleteMany).not.toHaveBeenCalled();
    expect(prisma.cmpAcceptanceApprovalStep.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ step: "MIC", status: "APPROVED" }),
        expect.objectContaining({
          step: "IT",
          approverId: "approver-it",
          status: "PENDING",
        }),
      ]),
    });
    expect(prisma.cmpAcceptanceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ picApproverId: "approver-pic" }),
      })
    );
  });

  it("rejects approval by a non-current approver", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(acceptance());

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...user, id: "other-user" },
        ""
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });

  it("rejects the stored approver after their role no longer matches the current step", async () => {
    prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue(acceptance());

    await expect(
      service.approveAcceptance(
        "acceptance-1",
        { ...user, id: "approver-mic", globalRole: "STAFF" },
        ""
      )
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
  });
});

function duplicateError() {
  return new Prisma.PrismaClientKnownRequestError("duplicate", {
    clientVersion: "test",
    code: "P2002",
  });
}
