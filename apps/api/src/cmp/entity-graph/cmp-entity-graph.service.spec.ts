import { Prisma } from "@prisma/client";

import {
  ApiBadRequestException,
  ApiConflictException,
  ApiNotFoundException,
} from "../../common/api-error";
import {
  CmpEntityGraphService,
  ensureCmpClientRootEntity,
  materializeCmpRelatedPartyDraft,
} from "./cmp-entity-graph.service";

describe(CmpEntityGraphService, () => {
  it("reuses firm-level company master data for another client scope", async () => {
    const canonicalEntity = {
      id: "entity-company-1",
      kind: "COMPANY",
      displayName: "ABC HK Ltd",
      companyProfile: {
        identifierType: "COMPANY_REGISTRATION_NUMBER",
        identifierValue: "240379",
      },
      personProfile: null,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    };
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue(null),
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        upsert: vi.fn().mockResolvedValue({}),
      },
      cmpEntity: {
        findFirst: vi.fn().mockResolvedValue(canonicalEntity),
        update: vi.fn().mockResolvedValue(canonicalEntity),
        create: vi.fn(),
      },
    };

    await expect(
      ensureCmpClientRootEntity(tx as never, "client-b", {
        clientCode: "C-B",
        companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
        companyNumber: "240379",
        nameEn: "ABC HK Ltd",
      })
    ).rejects.toBeInstanceOf(ApiConflictException);

    await expect(
      ensureCmpClientRootEntity(tx as never, "client-b", {
        clientCode: "C-B",
        companyIdentifierType: "COMPANY_REGISTRATION_NUMBER",
        companyNumber: "240379",
        nameEn: "ABC HK Ltd",
        companyIdentityResolution: {
          action: "LINK_EXISTING",
          entityId: "entity-company-1",
          expectedUpdatedAt: "2026-08-10T00:00:00.000Z",
        },
      })
    ).resolves.toMatchObject({ id: "entity-company-1" });

    expect(tx.cmpEntity.create).not.toHaveBeenCalled();
    expect(tx.cmpClientEntityScope.upsert).toHaveBeenCalledWith({
      where: {
        clientId_entityId: {
          clientId: "client-b",
          entityId: "entity-company-1",
        },
      },
      update: { role: "ROOT" },
      create: {
        clientId: "client-b",
        entityId: "entity-company-1",
        role: "ROOT",
      },
    });
  });

  it("creates separate person masters until a person dedupe policy exists", async () => {
    const created = {
      id: "person-new",
      kind: "PERSON",
      displayName: "Alex Chan",
      nameZh: null,
      nameEn: "Alex Chan",
      jurisdiction: null,
      registrationNumber: null,
      incorporationDate: null,
      dateOfBirth: null,
      nationality: null,
      status: "ACTIVE",
      remarks: null,
      companyProfile: null,
      personProfile: null,
      createdAt: new Date("2026-08-10T00:00:00.000Z"),
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    };
    const prisma = {
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue({ id: "client-1" }),
      },
      cmpEntity: {
        findFirst: vi.fn(),
        create: vi.fn().mockResolvedValue(created),
      },
      cmpClientEntityScope: {
        upsert: vi.fn().mockResolvedValue({
          clientId: "client-1",
          entityId: created.id,
          role: "RELATED",
          entity: created,
        }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
        await Promise.resolve();
        return callback(prisma);
      }),
    };
    const service = new CmpEntityGraphService(prisma as never);

    await service.createClientEntity(
      "client-1",
      {
        kind: "PERSON",
        displayName: "Alex Chan",
        nameEn: "Alex Chan",
        status: "ACTIVE",
      },
      { id: "user-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.cmpEntity.findFirst).not.toHaveBeenCalled();
    expect(prisma.cmpEntity.create).toHaveBeenCalledOnce();
  });

  it("persists a Company Code for a related company", async () => {
    const created = {
      id: "company-new",
      kind: "COMPANY",
      displayName: "Example Holdings Limited",
      companyCode: "REL-001",
      nameZh: null,
      nameEn: "Example Holdings Limited",
      jurisdiction: "Hong Kong",
      registrationNumber: "7654321",
      incorporationDate: new Date("2020-01-02T00:00:00.000Z"),
      dateOfBirth: null,
      nationality: null,
      status: "ACTIVE",
      remarks: null,
      companyProfile: {
        identifierType: "COMPANY_REGISTRATION_NUMBER",
        identifierValue: "7654321",
        incorporationDate: new Date("2020-01-02T00:00:00.000Z"),
        companyType: "PRIVATE",
        industryClassification: null,
        registeredAddress: "Central, Hong Kong",
        principalBusinessAddress: null,
      },
      personProfile: null,
      createdAt: new Date("2026-08-19T00:00:00.000Z"),
      updatedAt: new Date("2026-08-19T00:00:00.000Z"),
    };
    const prisma = {
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue({ id: "client-1" }),
      },
      cmpEntity: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(created),
      },
      cmpClientEntityScope: {
        upsert: vi.fn().mockResolvedValue({
          clientId: "client-1",
          entityId: created.id,
          role: "RELATED",
          entity: created,
        }),
      },
      $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => {
        await Promise.resolve();
        return callback(prisma);
      }),
    };
    const service = new CmpEntityGraphService(prisma as never);
    const result = await service.createClientEntity(
      "client-1",
      {
        kind: "COMPANY",
        displayName: "Example Holdings Limited",
        companyCode: " REL-001 ",
        nameEn: "Example Holdings Limited",
        jurisdiction: "Hong Kong",
        registrationNumber: "7654321",
        status: "ACTIVE",
        companyProfile: {
          identifierType: "COMPANY_REGISTRATION_NUMBER",
          identifierValue: "7654321",
          incorporationDate: "2020-01-02",
          companyType: "PRIVATE",
          registeredAddress: "Central, Hong Kong",
        },
      },
      { id: "user-1", globalRole: "SUPER_ADMIN" } as never
    );

    expect(prisma.cmpEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ companyCode: "REL-001" }),
      })
    );
    expect(result.entity.companyCode).toBe("REL-001");
  });

  it("returns scoped nodes and active relationships", async () => {
    const prisma = {
      cmpClient: {
        findUnique: vi.fn().mockResolvedValue({
          id: "client-1",
          clientCode: "H031",
        }),
      },
      cmpClientEntityScope: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            {
              clientId: "client-1",
              entityId: "entity-1",
              role: "ROOT",
              entity: {
                id: "entity-1",
                kind: "COMPANY",
                displayName: "Hwa Hin Limited",
                nameZh: null,
                nameEn: "Hwa Hin Limited",
                jurisdiction: "Hong Kong",
                registrationNumber: "1234567",
                status: "ACTIVE",
              },
            },
            {
              clientId: "client-1",
              entityId: "entity-2",
              role: "RELATED",
              entity: {
                id: "entity-2",
                kind: "PERSON",
                displayName: "Alex Chan",
                nameZh: null,
                nameEn: "Alex Chan",
                jurisdiction: null,
                registrationNumber: null,
                status: "ACTIVE",
              },
            },
          ])
          .mockResolvedValueOnce([
            { clientId: "client-1", entityId: "entity-1" },
          ]),
      },
      cmpEntityRelationship: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "relationship-1",
            fromEntityId: "entity-2",
            toEntityId: "entity-1",
            type: "BENEFICIAL_OWNER_OF",
            ownershipPercentage: new Prisma.Decimal(70),
            effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
            effectiveTo: null,
            remarks: null,
            sourceDocument: "Registry extract",
            createdAt: new Date("2026-01-01T00:00:00.000Z"),
          },
        ]),
      },
      cmpGroupRelationship: {
        findMany: vi.fn().mockResolvedValue([]),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.getClientGraph("client-1", "2026-08-04")
    ).resolves.toMatchObject({
      client: { rootEntityId: "entity-1" },
      asOf: "2026-08-04",
      nodes: [
        { id: "entity-1", isRoot: true, clientIds: ["client-1"] },
        { id: "entity-2", isRoot: false },
      ],
      edges: [{ ownershipPercentage: 70 }],
    });
  });

  it("rejects an unknown client", async () => {
    const prisma = {
      cmpClient: { findUnique: vi.fn().mockResolvedValue(null) },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(service.getClientGraph("missing")).rejects.toBeInstanceOf(
      ApiNotFoundException
    );
  });

  it("finds Client Code candidates and identifies an existing map binding", async () => {
    const prisma = {
      cmpClient: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "client-1",
            clientCode: "HBR-001",
            nameZh: "港湾有限公司",
            nameEn: "Harbour Limited",
            companyNumber: "1234567",
            status: "ACTIVE",
          },
        ]),
      },
      cmpClientEntityScope: {
        findMany: vi
          .fn()
          .mockResolvedValue([{ clientId: "client-1", entityId: "entity-1" }]),
      },
      cmpEntityMapNode: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "node-1",
            entityId: "entity-1",
            map: { id: "map-1", name: "Harbour ownership" },
          },
        ]),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.findClientCandidates({ q: "br" })
    ).resolves.toStrictEqual({
      candidates: [
        {
          id: "client-1",
          clientCode: "HBR-001",
          nameZh: "港湾有限公司",
          nameEn: "Harbour Limited",
          companyNumber: "1234567",
          status: "ACTIVE",
          boundMap: {
            id: "map-1",
            name: "Harbour ownership",
            nodeId: "node-1",
          },
        },
      ],
    });
    expect(prisma.cmpClient.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10 })
    );
  });

  it("materializes draft scopes against firm master data and stores a global relationship", async () => {
    const existingEntity = {
      id: "entity-related",
      kind: "COMPANY",
      displayName: "ABC HK Limited",
      jurisdiction: "Hong Kong",
      registrationNumber: "12345678",
      status: "ACTIVE",
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    };
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue({ entityId: "entity-root" }),
        upsert: vi.fn().mockResolvedValue(undefined as never),
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findFirst: vi.fn().mockResolvedValue(existingEntity),
        findUnique: vi.fn(),
        findMany: vi.fn().mockResolvedValue([
          { id: "entity-root", kind: "COMPANY" },
          { id: "entity-related", kind: "COMPANY" },
        ]),
        create: vi.fn(),
      },
      cmpEntityRelationship: {
        findFirst: vi.fn().mockResolvedValue(null),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "relationship-1" }),
      },
    };

    await materializeCmpRelatedPartyDraft(
      tx as never,
      "client-1",
      "user-1",
      [
        {
          draftKey: "party-1",
          kind: "COMPANY",
          displayName: "ABC HK Limited",
          jurisdiction: "Hong Kong",
          registrationNumber: "12345678",
          status: "ACTIVE",
          companyIdentityResolution: {
            action: "LINK_EXISTING",
            entityId: "entity-related",
            expectedUpdatedAt: "2026-08-10T00:00:00.000Z",
          },
        },
      ],
      [
        {
          draftKey: "rel",
          fromRef: { type: "ROOT" },
          toRef: { type: "DRAFT", draftKey: "party-1" },
          type: "OWNS",
          ownershipPercentage: 100,
        },
      ]
    );

    expect(tx.cmpEntity.create).not.toHaveBeenCalled();
    expect(tx.cmpClientEntityScope.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          clientId: "client-1",
          entityId: "entity-related",
        }),
      })
    );
    expect(tx.cmpEntityRelationship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        fromEntityId: "entity-root",
        toEntityId: "entity-related",
        type: "OWNS",
        ownershipPercentage: 100,
        createdById: "user-1",
      }),
    });
    expect(
      tx.cmpEntityRelationship.create.mock.calls[0]?.[0]?.data
    ).not.toHaveProperty("clientId");
    expect(
      tx.cmpEntityRelationship.create.mock.calls[0]?.[0]?.data
    ).not.toHaveProperty("legacyMapId");
  });

  it("materializes a multi-party joint venture with per-participant methods", async () => {
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue({ entityId: "entity-root" }),
        count: vi.fn().mockResolvedValue(3),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entity-target", kind: "COMPANY" },
          { id: "entity-root", kind: "COMPANY" },
          { id: "entity-participant", kind: "COMPANY" },
        ]),
      },
      cmpEntityRelationship: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      cmpGroupRelationship: {
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn().mockResolvedValue({ id: "group-relationship-1" }),
      },
    };

    await materializeCmpRelatedPartyDraft(
      tx as never,
      "client-1",
      "user-1",
      [],
      [],
      [
        {
          draftKey: "group-relationship-1",
          targetRef: { type: "EXISTING", entityId: "entity-target" },
          type: "JOINT_VENTURE",
          participants: [
            {
              entityRef: { type: "ROOT" },
              method: "OWNERSHIP",
              ownershipPercentage: null,
            },
            {
              entityRef: {
                type: "EXISTING",
                entityId: "entity-participant",
              },
              method: "OTHER",
              otherDescription: "Contractual arrangement",
            },
          ],
        },
      ]
    );

    expect(tx.cmpGroupRelationship.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetEntityId: "entity-target",
        type: "JOINT_VENTURE",
        createdById: "user-1",
        participants: {
          create: [
            expect.objectContaining({
              entityId: "entity-root",
              method: "OWNERSHIP",
              ownershipPercentage: null,
            }),
            expect.objectContaining({
              entityId: "entity-participant",
              method: "OTHER",
              ownershipPercentage: null,
              otherDescription: "Contractual arrangement",
            }),
          ],
        },
      }),
    });
  });

  it("keeps distinct group drafts that share a target, type, and dates", async () => {
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue({ entityId: "entity-root" }),
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([
            { id: "entity-target", kind: "COMPANY" },
            { id: "entity-participant-a", kind: "COMPANY" },
          ])
          .mockResolvedValueOnce([
            { id: "entity-target", kind: "COMPANY" },
            { id: "entity-participant-b", kind: "COMPANY" },
          ]),
      },
      cmpEntityRelationship: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      cmpGroupRelationship: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              sourceDocument: null,
              remarks: null,
              participants: [
                {
                  entityId: "entity-participant-a",
                  method: "OWNERSHIP",
                  ownershipPercentage: null,
                  otherDescription: null,
                },
              ],
            },
          ]),
        create: vi.fn(),
      },
    };

    await materializeCmpRelatedPartyDraft(
      tx as never,
      "client-1",
      "user-1",
      [],
      [],
      [
        {
          draftKey: "group-a",
          targetRef: { type: "EXISTING", entityId: "entity-target" },
          type: "ASSOCIATE",
          participants: [
            {
              entityRef: {
                type: "EXISTING",
                entityId: "entity-participant-a",
              },
              method: "OWNERSHIP",
            },
          ],
        },
        {
          draftKey: "group-b",
          targetRef: { type: "EXISTING", entityId: "entity-target" },
          type: "ASSOCIATE",
          participants: [
            {
              entityRef: {
                type: "EXISTING",
                entityId: "entity-participant-b",
              },
              method: "OTHER",
              otherDescription: "Different participant and method",
            },
          ],
        },
      ]
    );

    expect(tx.cmpGroupRelationship.create).toHaveBeenCalledTimes(2);
  });

  it("updates and removes persisted group relationships from an edit draft", async () => {
    const persistedRelationship = {
      id: "group-existing",
      targetEntityId: "entity-target",
      participants: [
        {
          entityId: "entity-root",
          method: "OWNERSHIP" as const,
          ownershipPercentage: null,
          otherDescription: null,
        },
      ],
    };
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue({ entityId: "entity-root" }),
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "entity-target", kind: "COMPANY" },
          { id: "entity-root", kind: "COMPANY" },
        ]),
      },
      cmpEntityRelationship: {
        findFirst: vi.fn(),
        create: vi.fn(),
      },
      cmpGroupRelationship: {
        findUnique: vi.fn().mockResolvedValue(persistedRelationship),
        findMany: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      cmpGroupRelationshipParticipant: {
        deleteMany: vi.fn(),
      },
    };

    await materializeCmpRelatedPartyDraft(
      tx as never,
      "client-1",
      "user-1",
      [],
      [],
      [
        {
          draftKey: "group-existing",
          existingRelationshipId: "group-existing",
          targetRef: { type: "EXISTING", entityId: "entity-target" },
          type: "ASSOCIATE",
          participants: [
            {
              entityRef: { type: "ROOT" },
              method: "OTHER",
              otherDescription: "Shareholder agreement",
            },
          ],
          remarks: "Edited in client acceptance",
        },
      ],
      ["group-removed"]
    );

    expect(tx.cmpGroupRelationshipParticipant.deleteMany).toHaveBeenCalledWith({
      where: { relationshipId: "group-existing" },
    });
    expect(tx.cmpGroupRelationship.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "group-existing" },
        data: expect.objectContaining({
          type: "ASSOCIATE",
          participants: {
            create: [
              expect.objectContaining({
                entityId: "entity-root",
                method: "OTHER",
                ownershipPercentage: null,
                otherDescription: "Shareholder agreement",
              }),
            ],
          },
        }),
      })
    );
    expect(tx.cmpGroupRelationship.delete).toHaveBeenCalledWith({
      where: { id: "group-removed" },
    });
  });

  it("enriches a reused legacy company with its specialised profile", async () => {
    const legacyEntity = {
      id: "entity-related",
      kind: "COMPANY",
      displayName: "ABC HK Limited",
      jurisdiction: "Hong Kong",
      registrationNumber: "12345678",
      status: "ACTIVE",
      companyProfile: null,
      personProfile: null,
      updatedAt: new Date("2026-08-10T00:00:00.000Z"),
    };
    const tx = {
      cmpClientEntityScope: {
        findFirst: vi.fn().mockResolvedValue({ entityId: "entity-root" }),
        upsert: vi.fn().mockResolvedValue(undefined as never),
      },
      cmpEntity: {
        findFirst: vi
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValueOnce(legacyEntity),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn().mockResolvedValue({
          ...legacyEntity,
          companyProfile: { entityId: legacyEntity.id },
        }),
      },
      cmpEntityRelationship: {
        findFirst: vi.fn(),
        findMany: vi.fn().mockResolvedValue([]),
        create: vi.fn(),
      },
    };

    await materializeCmpRelatedPartyDraft(
      tx as never,
      "client-1",
      "user-1",
      [
        {
          draftKey: "party-1",
          kind: "COMPANY",
          displayName: "ABC HK Limited",
          nameEn: "ABC HK Limited",
          jurisdiction: "Hong Kong",
          registrationNumber: "12345678",
          status: "ACTIVE",
          companyProfile: {
            identifierType: "COMPANY_REGISTRATION_NUMBER",
            identifierValue: "12345678",
            incorporationDate: "2020-01-02",
            companyType: "PRIVATE",
            registeredAddress: "Central, Hong Kong",
          },
          companyIdentityResolution: {
            action: "UPDATE_EXISTING",
            entityId: "entity-related",
            expectedUpdatedAt: "2026-08-10T00:00:00.000Z",
          },
        },
      ],
      []
    );

    expect(tx.cmpEntity.create).not.toHaveBeenCalled();
    expect(tx.cmpEntity.findFirst).toHaveBeenCalledTimes(2);
    expect(tx.cmpEntity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "entity-related" },
        data: expect.objectContaining({
          companyProfile: {
            upsert: {
              create: expect.objectContaining({
                identifierValue: "12345678",
                registeredAddress: "Central, Hong Kong",
              }),
              update: expect.objectContaining({
                identifierValue: "12345678",
                registeredAddress: "Central, Hong Kong",
              }),
            },
          },
        }),
      })
    );
  });

  it("rejects ownership that pushes an overlapping cap table above 100%", async () => {
    const prisma = {
      cmpClientEntityScope: {
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "shareholder-b", kind: "PERSON" },
          { id: "investee", kind: "COMPANY" },
        ]),
      },
      cmpEntityRelationship: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "ownership-existing",
              fromEntityId: "shareholder-a",
              toEntityId: "investee",
              type: "OWNS",
              ownershipPercentage: new Prisma.Decimal(60),
              effectiveFrom: null,
              effectiveTo: null,
            },
          ]),
        create: vi.fn(),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.createClientRelationship(
        "client-1",
        {
          fromEntityId: "shareholder-b",
          toEntityId: "investee",
          type: "OWNS",
          ownershipPercentage: 50,
        },
        { id: "user-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(prisma.cmpEntityRelationship.create).not.toHaveBeenCalled();
  });

  it("creates an associate relationship with multiple company participants", async () => {
    const timestamp = new Date("2026-09-02T00:00:00.000Z");
    const prisma = {
      cmpClient: { findUnique: vi.fn().mockResolvedValue({ id: "client-1" }) },
      cmpClientEntityScope: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { entityId: "target" },
            { entityId: "participant-a" },
            { entityId: "participant-b" },
          ]),
        count: vi.fn().mockResolvedValue(3),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "target", kind: "COMPANY" },
          { id: "participant-a", kind: "COMPANY" },
          { id: "participant-b", kind: "COMPANY" },
        ]),
      },
      cmpGroupRelationship: {
        create: vi.fn().mockResolvedValue({
          id: "group-1",
          targetEntityId: "target",
          type: "ASSOCIATE",
          effectiveFrom: null,
          effectiveTo: null,
          sourceDocument: null,
          remarks: null,
          createdAt: timestamp,
          updatedAt: timestamp,
          participants: [
            {
              entityId: "participant-a",
              method: "OWNERSHIP",
              ownershipPercentage: new Prisma.Decimal(30),
              otherDescription: null,
            },
            {
              entityId: "participant-b",
              method: "OTHER",
              ownershipPercentage: null,
              otherDescription: "Contractual arrangement",
            },
          ],
        }),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.createClientGroupRelationship(
        "client-1",
        {
          targetEntityId: "target",
          type: "ASSOCIATE",
          participants: [
            {
              entityId: "participant-a",
              method: "OWNERSHIP",
              ownershipPercentage: 30,
            },
            {
              entityId: "participant-b",
              method: "OTHER",
              otherDescription: "Contractual arrangement",
            },
          ],
        },
        { id: "user-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).resolves.toMatchObject({
      relationship: {
        type: "ASSOCIATE",
        participants: [
          { entityId: "participant-a", ownershipPercentage: 30 },
          {
            entityId: "participant-b",
            ownershipPercentage: null,
            otherDescription: "Contractual arrangement",
          },
        ],
      },
    });
    expect(prisma.cmpGroupRelationship.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          participants: {
            create: expect.arrayContaining([
              expect.objectContaining({
                entityId: "participant-b",
                ownershipPercentage: null,
                otherDescription: "Contractual arrangement",
              }),
            ]),
          },
        }),
      })
    );
  });

  it("rejects a natural person as the investee of an ownership relationship", async () => {
    const prisma = {
      cmpClientEntityScope: {
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "company", kind: "COMPANY" },
          { id: "person", kind: "PERSON" },
        ]),
      },
      cmpEntityRelationship: {
        findMany: vi.fn(),
        create: vi.fn(),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.createClientRelationship(
        "client-1",
        {
          fromEntityId: "company",
          toEntityId: "person",
          type: "OWNS",
          ownershipPercentage: 50,
        },
        { id: "user-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toBeInstanceOf(ApiBadRequestException);
    expect(prisma.cmpEntityRelationship.create).not.toHaveBeenCalled();
  });

  it("rejects an unspecified ownership edge when the cap table is full", async () => {
    const prisma = {
      cmpClientEntityScope: {
        count: vi.fn().mockResolvedValue(2),
      },
      cmpEntity: {
        findMany: vi.fn().mockResolvedValue([
          { id: "shareholder-b", kind: "PERSON" },
          { id: "investee", kind: "COMPANY" },
        ]),
      },
      cmpEntityRelationship: {
        findMany: vi
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              id: "ownership-existing",
              fromEntityId: "shareholder-a",
              toEntityId: "investee",
              type: "OWNS",
              ownershipPercentage: new Prisma.Decimal(100),
              effectiveFrom: null,
              effectiveTo: null,
            },
          ]),
        create: vi.fn(),
      },
    };
    const service = new CmpEntityGraphService(prisma as never);

    await expect(
      service.createClientRelationship(
        "client-1",
        {
          fromEntityId: "shareholder-b",
          toEntityId: "investee",
          type: "OWNS",
          ownershipPercentage: null,
        },
        { id: "user-1", globalRole: "SUPER_ADMIN" } as never
      )
    ).rejects.toBeInstanceOf(ApiConflictException);
    expect(prisma.cmpEntityRelationship.create).not.toHaveBeenCalled();
  });
});
