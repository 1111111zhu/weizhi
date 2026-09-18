import { CmpClientMasterService } from "./cmp-client-master.service";

describe(CmpClientMasterService, () => {
  const now = new Date("2026-08-05T00:00:00.000Z");
  const clientRecord = {
    id: "client-1",
    clientCode: "C-001",
    status: "ACTIVE",
    nameEn: "Example Limited",
    nameZh: "",
    companyNumber: "1234567",
    placeOfIncorporation: "Hong Kong",
    countryOrDistrict: "Hong Kong",
    dateOfIncorporation: null,
    yearEndDate: null,
    address: null,
    contactPerson: null,
    telephone: null,
    email: null,
    website: null,
    referredBy: null,
    sourceDescription: null,
    clientLeadingPartnerId: null,
    clientLeadingPartner: null,
    clientPartnerPicId: null,
    clientPartnerPic: null,
    clientManagerMicId: null,
    clientManagerMic: null,
    alternativePartnerSecondMicId: null,
    alternativePartnerSecondMic: null,
    remarks: null,
    createdAt: now,
    updatedAt: now,
  };
  const rootScope = {
    clientId: "client-1",
    entityId: "cmp_entity_client-1",
    role: "ROOT",
    entity: {
      id: "cmp_entity_client-1",
      kind: "COMPANY",
      displayName: "Example Limited",
      nameEn: "Example Limited",
      nameZh: null,
      jurisdiction: "Hong Kong",
      registrationNumber: "1234567",
      incorporationDate: null,
      dateOfBirth: null,
      nationality: null,
      remarks: null,
      createdAt: now,
      updatedAt: now,
    },
  };

  function setup() {
    const tx = {
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue(null),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(clientRecord),
      },
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue(rootScope),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue(rootScope),
      },
      cmpEntity: {
        findFirst: vi.fn().mockResolvedValue(rootScope.entity),
        update: vi.fn().mockResolvedValue(rootScope.entity),
        create: vi.fn().mockResolvedValue(rootScope.entity),
      },
      user: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx)
      ),
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue(clientRecord),
      },
      cmpClientEntityScope: tx.cmpClientEntityScope,
    };
    const auditLogs = {
      log: vi.fn().mockResolvedValue(undefined as never),
    };
    return {
      service: new CmpClientMasterService(prisma as never, auditLogs as never),
      prisma,
      tx,
      auditLogs,
    };
  }

  it("creates a Client directly and returns its trigger-created root Entity", async () => {
    const { service, tx, auditLogs } = setup();
    const result = await service.createClientProfile(
      {
        clientCode: "C-001",
        status: "ACTIVE",
        nameEn: "Example Limited",
        companyNumber: "1234567",
        jurisdiction: "Hong Kong",
      },
      {
        id: "manager-1",
        email: "manager@example.com",
        name: "Manager",
        globalRole: "MANAGER",
      },
      { ipAddress: "127.0.0.1", userAgent: "jest" }
    );

    expect(tx.cmpClient.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clientCode: "C-001",
          nameEn: "Example Limited",
          nameZh: null,
          placeOfIncorporation: "Hong Kong",
          createdById: "manager-1",
        }),
      })
    );
    expect(result.rootEntity).toStrictEqual(
      expect.objectContaining({
        id: "cmp_entity_client-1",
        displayName: "Example Limited",
      })
    );
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CMP_CLIENT_MASTER_CREATED",
        targetId: "client-1",
      })
    );
  });

  it("rejects duplicate Client codes before creating a record", async () => {
    const { service, tx } = setup();
    tx.cmpClient.findUnique.mockResolvedValue({ id: "existing" });

    await expect(
      service.createClientProfile(
        {
          clientCode: "C-001",
          status: "ACTIVE",
          nameEn: "Example Limited",
        },
        {
          id: "partner-1",
          email: "partner@example.com",
          name: "Partner",
          globalRole: "PARTNER",
        }
      )
    ).rejects.toMatchObject({ status: 409 });
    expect(tx.cmpClient.create).not.toHaveBeenCalled();
  });

  it("blocks roles that cannot create Client master records", async () => {
    const { service, prisma } = setup();

    await expect(
      service.createClientProfile(
        {
          clientCode: "C-001",
          status: "ACTIVE",
          nameEn: "Example Limited",
        },
        {
          id: "staff-1",
          email: "staff@example.com",
          name: "Staff",
          globalRole: "STAFF",
        }
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("reads a Client profile with its root Entity", async () => {
    const { service } = setup();
    await expect(service.getClientProfile("client-1")).resolves.toStrictEqual(
      expect.objectContaining({
        id: "client-1",
        rootEntity: expect.objectContaining({
          id: "cmp_entity_client-1",
        }),
      })
    );
  });
});
