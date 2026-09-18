import { describe, expect, it, vi } from "vitest";

import type { RequestUser } from "../../auth/request-user";
import {
  buildAmlSubjects,
  CmpAmlService,
  deriveAmlAttentionCount,
  fingerprintAmlSubjects,
  normalizeCountryCode,
} from "./cmp-aml.service";

const manager: RequestUser = {
  id: "manager-1",
  email: "manager@example.com",
  name: "Manager",
  globalRole: "MANAGER",
};
const staff: RequestUser = {
  ...manager,
  id: "staff-1",
  globalRole: "STAFF",
};

describe("CMP AML subject selection", () => {
  it("selects the Client, active UBO/director/controller people and merges duplicate roles", () => {
    const subjects = buildAmlSubjects({
      clientCode: "C001",
      nameEn: "Example Holdings Limited",
      nameZh: "示例控股有限公司",
      companyNumber: "CR-123",
      incorporationYearMonth: "2020-05",
      placeOfIncorporation: "Hong Kong",
      relatedEntities: [
        {
          draftKey: "owner",
          kind: "PERSON",
          displayName: "Alex Chan",
          nameZh: "陈大文",
          nameEn: "Alex Chan",
          status: "ACTIVE",
          personProfile: {
            dateOfBirth: "1980-05-01",
            identifierType: "PASSPORT",
            identifierValue: "P123456",
            nationality: "Hong Kong SAR",
          },
        },
        {
          draftKey: "former-director",
          kind: "PERSON",
          displayName: "Former Director",
          nameEn: "Former Director",
          status: "ACTIVE",
        },
        {
          draftKey: "future-director",
          kind: "PERSON",
          displayName: "Future Director",
          nameEn: "Future Director",
          status: "ACTIVE",
        },
        {
          draftKey: "inactive-owner",
          kind: "PERSON",
          displayName: "Inactive Owner",
          nameEn: "Inactive Owner",
          status: "DECEASED",
        },
      ],
      relatedRelationships: [
        {
          draftKey: "ubo",
          fromRef: { type: "DRAFT", draftKey: "owner" },
          toRef: { type: "ROOT" },
          type: "BENEFICIAL_OWNER_OF",
        },
        {
          draftKey: "director",
          fromRef: { type: "DRAFT", draftKey: "owner" },
          toRef: { type: "ROOT" },
          type: "DIRECTOR_OF",
        },
        {
          draftKey: "expired",
          fromRef: { type: "DRAFT", draftKey: "former-director" },
          toRef: { type: "ROOT" },
          type: "DIRECTOR_OF",
          effectiveTo: "2020-01-01",
        },
        {
          draftKey: "future",
          fromRef: { type: "DRAFT", draftKey: "future-director" },
          toRef: { type: "ROOT" },
          type: "DIRECTOR_OF",
          effectiveFrom: "2099-01-01",
        },
        {
          draftKey: "inactive",
          fromRef: { type: "DRAFT", draftKey: "inactive-owner" },
          toRef: { type: "ROOT" },
          type: "BENEFICIAL_OWNER_OF",
        },
      ],
    });

    expect(subjects).toHaveLength(2);
    const company = subjects.find((subject) => subject.subjectKey === "ROOT");
    expect(company).toMatchObject({
      entityType: "COMPANY",
      roles: ["CLIENT"],
      displayName: "Example Holdings Limited",
      complete: true,
      request: {
        full_name: "Example Holdings Limited",
        entity_type: "company",
        nationality: "HK",
        document_number: "CR-123",
      },
    });
    expect(company?.request).not.toHaveProperty("date_of_birth");

    const owner = subjects.find((subject) =>
      subject.subjectKey.includes("owner")
    );
    expect(owner).toMatchObject({
      entityType: "PERSON",
      roles: ["BENEFICIAL_OWNER", "DIRECTOR"],
      displayName: "Alex Chan",
      complete: true,
      request: {
        full_name: "Alex Chan",
        entity_type: "person",
        date_of_birth: "1980-05-01",
        nationality: "HK",
        document_number: "P123456",
      },
    });
  });

  it("does not invent a legal name or send an invalid nationality", () => {
    const subjects = buildAmlSubjects({
      clientCode: "C002",
      relatedEntities: [
        {
          draftKey: "owner",
          kind: "PERSON",
          displayName: "Display label only",
          status: "ACTIVE",
          personProfile: { nationality: "Unknown jurisdiction" },
        },
      ],
      relatedRelationships: [
        {
          draftKey: "ubo",
          fromRef: { type: "DRAFT", draftKey: "owner" },
          toRef: { type: "ROOT" },
          type: "BENEFICIAL_OWNER_OF",
        },
      ],
    });

    expect(subjects).toHaveLength(2);
    expect(subjects.every((subject) => !subject.complete)).toBeTruthy();
    expect(subjects[0]?.request).not.toHaveProperty("full_name");
    expect(subjects[0]?.request).not.toHaveProperty("nationality");
    expect(normalizeCountryCode("Hong-Kong")).toBe("HK");
    expect(normalizeCountryCode("ZZZ")).toBeUndefined();
  });

  it("selects only connected active group companies and their key people", () => {
    const subjects = buildAmlSubjects({
      nameEn: "Root Client Limited",
      relatedEntities: [
        {
          draftKey: "holding",
          kind: "COMPANY",
          displayName: "Holding Company Limited",
          nameEn: "Holding Company Limited",
          jurisdiction: "Singapore",
          status: "ACTIVE",
          companyProfile: {
            identifierType: "COMPANY_REGISTRATION_NUMBER",
            identifierValue: "SG-001",
            incorporationDate: "2019-01-01",
            companyType: "PRIVATE",
          },
        },
        {
          draftKey: "operating",
          kind: "COMPANY",
          displayName: "Operating Company Limited",
          nameEn: "Operating Company Limited",
          status: "ACTIVE",
        },
        {
          draftKey: "disconnected",
          kind: "COMPANY",
          displayName: "Disconnected Company Limited",
          nameEn: "Disconnected Company Limited",
          status: "ACTIVE",
        },
        {
          draftKey: "inactive",
          kind: "COMPANY",
          displayName: "Inactive Company Limited",
          nameEn: "Inactive Company Limited",
          status: "INACTIVE",
        },
        {
          draftKey: "owner",
          kind: "PERSON",
          displayName: "Connected Owner",
          nameEn: "Connected Owner",
          status: "ACTIVE",
        },
        {
          draftKey: "unconnected-director",
          kind: "PERSON",
          displayName: "Unconnected Director",
          nameEn: "Unconnected Director",
          status: "ACTIVE",
        },
      ],
      relatedRelationships: [
        {
          draftKey: "root-owns-holding",
          fromRef: { type: "ROOT" },
          toRef: { type: "DRAFT", draftKey: "holding" },
          type: "OWNS",
        },
        {
          draftKey: "holding-owns-operating",
          fromRef: { type: "DRAFT", draftKey: "holding" },
          toRef: { type: "DRAFT", draftKey: "operating" },
          type: "OWNS",
        },
        {
          draftKey: "inactive-link",
          fromRef: { type: "ROOT" },
          toRef: { type: "DRAFT", draftKey: "inactive" },
          type: "OWNS",
        },
        {
          draftKey: "owner-ubo",
          fromRef: { type: "DRAFT", draftKey: "owner" },
          toRef: { type: "DRAFT", draftKey: "operating" },
          type: "BENEFICIAL_OWNER_OF",
        },
        {
          draftKey: "owner-director",
          fromRef: { type: "DRAFT", draftKey: "owner" },
          toRef: { type: "DRAFT", draftKey: "holding" },
          type: "DIRECTOR_OF",
        },
        {
          draftKey: "unconnected-director",
          fromRef: { type: "DRAFT", draftKey: "unconnected-director" },
          toRef: { type: "DRAFT", draftKey: "disconnected" },
          type: "DIRECTOR_OF",
        },
      ],
    });

    expect(subjects.map((subject) => subject.subjectKey)).toStrictEqual([
      "ROOT",
      "COMPANY:DRAFT:holding",
      "COMPANY:DRAFT:operating",
      "PERSON:DRAFT:owner",
    ]);
    expect(subjects[0]?.roles).toStrictEqual(["CLIENT", "OWNER"]);
    expect(
      subjects.find((subject) => subject.subjectKey.includes("holding"))?.roles
    ).toStrictEqual(["GROUP_COMPANY", "OWNER"]);
    expect(
      subjects.find((subject) => subject.subjectKey.includes("owner"))?.roles
    ).toStrictEqual(["BENEFICIAL_OWNER", "DIRECTOR"]);
  });

  it("produces the same fingerprint for the same normalized subjects", () => {
    const subjects = buildAmlSubjects({ nameEn: "Example Limited" });
    expect(fingerprintAmlSubjects(subjects)).toBe(
      fingerprintAmlSubjects(structuredClone(subjects))
    );
  });

  it("counts a confirmed match as attention even when Didit originally approved the subject", () => {
    expect(
      deriveAmlAttentionCount({
        attentionCount: 0,
        subjects: [
          {
            status: "APPROVED",
            hits: [{ reviewStatus: "CONFIRMED_MATCH" }],
          },
        ],
      })
    ).toBe(1);
  });
});

describe(CmpAmlService, () => {
  it("records missing configuration as non-throwing subject errors", async () => {
    const fixture = serviceFixture({ configured: false, enabled: false });

    const result = await fixture.service.run(
      "acceptance-1",
      { force: false },
      manager
    );

    expect(fixture.didit.screen).not.toHaveBeenCalled();
    expect(fixture.prisma.cmpAmlScreeningSubject.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "ERROR",
        errorCode: "DIDIT_DISABLED",
      }),
    });
    expect(fixture.prisma.cmpAmlScreeningBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: expect.objectContaining({
        status: "FAILED",
        attentionCount: 0,
        errorCount: 1,
      }),
    });
    expect(result.batch).toBeNull();
  });

  it("reuses an ordinary batch but creates a new batch for a forced rerun", async () => {
    const ordinary = serviceFixture({ configured: true, enabled: true });
    ordinary.prisma.cmpAmlScreeningBatch.findUnique.mockResolvedValue({
      id: "existing-batch",
      status: "COMPLETED",
      updatedAt: new Date(),
      subjects: [],
    });

    await ordinary.service.run("acceptance-1", { force: false }, manager);

    expect(ordinary.prisma.cmpAmlScreeningBatch.create).not.toHaveBeenCalled();
    expect(ordinary.didit.screen).not.toHaveBeenCalled();

    const forced = serviceFixture({ configured: false, enabled: false });
    forced.prisma.cmpAmlScreeningBatch.findUnique.mockResolvedValue({
      id: "existing-batch",
    });
    await forced.service.run("acceptance-1", { force: true }, manager);

    expect(
      forced.prisma.cmpAmlScreeningBatch.findUnique
    ).not.toHaveBeenCalled();
    expect(forced.prisma.cmpAmlScreeningBatch.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ forceRun: true }),
      select: { id: true },
    });
  });

  it("screens only explicitly selected current subjects and rejects stale keys", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAcceptanceRequest.findUnique.mockResolvedValue({
      id: "acceptance-1",
      type: "CLIENT",
      clientPayload: {
        nameEn: "Example Limited",
        relatedEntities: [
          {
            draftKey: "group",
            kind: "COMPANY",
            displayName: "Selected Group Limited",
            nameEn: "Selected Group Limited",
            status: "ACTIVE",
          },
          {
            draftKey: "owner",
            kind: "PERSON",
            displayName: "Alex Owner",
            nameEn: "Alex Owner",
            status: "ACTIVE",
          },
        ],
        relatedRelationships: [
          {
            draftKey: "root-group",
            fromRef: { type: "ROOT" },
            toRef: { type: "DRAFT", draftKey: "group" },
            type: "OWNS",
          },
          {
            draftKey: "owner-group",
            fromRef: { type: "DRAFT", draftKey: "owner" },
            toRef: { type: "DRAFT", draftKey: "group" },
            type: "BENEFICIAL_OWNER_OF",
          },
        ],
      },
      targetClientId: null,
      submittedById: manager.id,
      micApproverId: manager.id,
      picApproverId: null,
      itApproverId: null,
      draftAssigneeId: null,
    });
    fixture.didit.screen.mockResolvedValue({
      request_id: "didit-group-request",
      aml: {
        status: "Approved",
        total_hits: 0,
        score: 0,
        hits: [],
        warnings: [],
      },
    });

    await fixture.service.run(
      "acceptance-1",
      { force: false, subjectKeys: ["COMPANY:DRAFT:group"] },
      manager
    );

    expect(fixture.didit.screen).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ full_name: "Selected Group Limited" }),
      expect.stringMatching(/^pw-aml-/)
    );
    await expect(
      fixture.service.run(
        "acceptance-1",
        { force: false, subjectKeys: ["PERSON:DRAFT:removed"] },
        manager
      )
    ).rejects.toThrow("no longer available");
  });

  it("resumes an interrupted RUNNING batch with its original idempotency key", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAmlScreeningBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "RUNNING",
      updatedAt: new Date(0),
      subjects: [],
    });
    fixture.didit.screen.mockResolvedValue({
      request_id: "didit-resumed-request",
      aml: {
        status: "Approved",
        total_hits: 0,
        score: 0,
        hits: [],
        warnings: [],
      },
    });

    await fixture.service.run("acceptance-1", { force: false }, manager);

    expect(fixture.prisma.cmpAmlScreeningBatch.create).not.toHaveBeenCalled();
    expect(fixture.didit.screen).toHaveBeenCalledWith(
      expect.any(Object),
      expect.stringMatching(/^pw-aml-/)
    );
    expect(fixture.prisma.cmpAmlScreeningBatch.update).toHaveBeenCalledWith({
      where: { id: "batch-1" },
      data: expect.objectContaining({ status: "COMPLETED", errorCount: 0 }),
    });
  });

  it("does not race a RUNNING batch that is still within the provider timeout window", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAmlScreeningBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "RUNNING",
      updatedAt: new Date(),
      subjects: [],
    });

    await fixture.service.run("acceptance-1", { force: false }, manager);

    expect(fixture.didit.screen).not.toHaveBeenCalled();
    expect(fixture.prisma.cmpAmlScreeningBatch.update).not.toHaveBeenCalled();
  });

  it("lets only the request that atomically claims a stale RUNNING batch resume it", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAmlScreeningBatch.findUnique.mockResolvedValue({
      id: "batch-1",
      status: "RUNNING",
      updatedAt: new Date(0),
      subjects: [],
    });
    fixture.prisma.cmpAmlScreeningBatch.updateMany.mockResolvedValue({
      count: 0,
    });

    await fixture.service.run("acceptance-1", { force: false }, manager);

    expect(fixture.prisma.cmpAmlScreeningBatch.updateMany).toHaveBeenCalledWith(
      {
        where: {
          id: "batch-1",
          status: "RUNNING",
          updatedAt: new Date(0),
        },
        data: { updatedAt: expect.any(Date) },
      }
    );
    expect(fixture.didit.screen).not.toHaveBeenCalled();
    expect(fixture.prisma.cmpAmlScreeningBatch.update).not.toHaveBeenCalled();
  });

  it.each([
    ["In Review", "IN_REVIEW"],
    ["Declined", "DECLINED"],
  ] as const)(
    "persists Didit %s as advisory attention without failing the batch",
    async (diditStatus, localStatus) => {
      const fixture = serviceFixture({ configured: true, enabled: true });
      fixture.didit.screen.mockResolvedValue({
        request_id: `didit-${localStatus.toLowerCase()}`,
        aml: {
          status: diditStatus,
          total_hits: 1,
          score: 0.91,
          hits: [{ id: "hit-1", review_status: "Unreviewed" }],
          warnings: [],
        },
      });

      await expect(
        fixture.service.run("acceptance-1", { force: false }, manager)
      ).resolves.toBeDefined();

      expect(fixture.prisma.cmpAmlScreeningSubject.create).toHaveBeenCalledWith(
        {
          data: expect.objectContaining({
            status: localStatus,
            totalHits: 1,
          }),
        }
      );
      expect(fixture.prisma.cmpAmlScreeningBatch.update).toHaveBeenCalledWith({
        where: { id: "batch-1" },
        data: expect.objectContaining({
          status: "COMPLETED",
          attentionCount: 1,
          errorCount: 0,
        }),
      });
    }
  );

  it("allows Manager review and updates local state only after Didit succeeds", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAmlHit.findUnique.mockResolvedValue(hitFixture());
    fixture.prisma.cmpAmlHit.update.mockResolvedValue({
      ...hitFixture(),
      reviewStatus: "CONFIRMED_MATCH",
      reviewComment: "Confirmed",
      reviewedBy: { id: manager.id, name: manager.name },
      reviewedAt: new Date("2026-09-01T04:00:00.000Z"),
    });

    await fixture.service.reviewHit(
      "screening-1",
      "hit-1",
      { reviewStatus: "CONFIRMED_MATCH", comment: "Confirmed" },
      manager
    );

    expect(fixture.didit.updateHitStatus).toHaveBeenCalledWith(
      "didit-request-1",
      "didit-hit-1",
      "Confirmed Match"
    );
    expect(fixture.prisma.cmpAmlHit.update).toHaveBeenCalledOnce();

    const failed = serviceFixture({ configured: true, enabled: true });
    failed.prisma.cmpAmlHit.findUnique.mockResolvedValue(hitFixture());
    failed.didit.updateHitStatus.mockRejectedValue(new Error("Didit failed"));
    await expect(
      failed.service.reviewHit(
        "screening-1",
        "hit-1",
        { reviewStatus: "FALSE_POSITIVE" },
        manager
      )
    ).rejects.toThrow("Didit failed");
    expect(failed.prisma.cmpAmlHit.update).not.toHaveBeenCalled();
  });

  it("keeps non-manager roles read-only", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });

    await expect(
      fixture.service.reviewHit(
        "screening-1",
        "hit-1",
        { reviewStatus: "INCONCLUSIVE" },
        staff
      )
    ).rejects.toThrow("Manager or above");
    expect(fixture.prisma.cmpAmlHit.findUnique).not.toHaveBeenCalled();
    expect(fixture.didit.updateHitStatus).not.toHaveBeenCalled();
  });

  it("deduplicates remote cleanup and does not throw when a Didit delete fails", async () => {
    const fixture = serviceFixture({ configured: true, enabled: true });
    fixture.prisma.cmpAmlScreeningSubject.findMany.mockResolvedValue([
      { diditRequestId: "didit-session-1" },
      { diditRequestId: "didit-session-1" },
      { diditRequestId: "didit-session-2" },
    ]);
    fixture.didit.deleteSession.mockImplementation((sessionId: string) =>
      sessionId === "didit-session-2"
        ? Promise.reject(new Error("remote unavailable"))
        : Promise.resolve(null)
    );

    await expect(
      fixture.service.deleteRemoteSessionsForAcceptance("acceptance-1", manager)
    ).resolves.toBeUndefined();

    expect(fixture.didit.deleteSession).toHaveBeenCalledTimes(2);
    expect(fixture.auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "CMP_AML_REMOTE_SESSION_DELETE_FAILED",
        targetId: "acceptance-1",
        description: "Didit AML session cleanup: 1 deleted, 1 failed",
      })
    );
  });
});

function serviceFixture({
  configured,
  enabled,
}: {
  configured: boolean;
  enabled: boolean;
}) {
  const acceptance = {
    id: "acceptance-1",
    type: "CLIENT",
    clientPayload: { nameEn: "Example Limited" },
    targetClientId: null,
    submittedById: manager.id,
    micApproverId: manager.id,
    picApproverId: null,
    itApproverId: null,
    draftAssigneeId: null,
  };
  const prisma = {
    cmpAcceptanceRequest: {
      findUnique: vi.fn().mockResolvedValue(acceptance),
    },
    cmpAmlScreeningBatch: {
      findUnique: vi.fn().mockResolvedValue(null),
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: "batch-1" }),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    cmpAmlScreeningSubject: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    cmpAmlHit: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    },
  };
  const auditLogs = { log: vi.fn().mockResolvedValue({}) };
  const didit = {
    configured,
    enabled,
    screen: vi.fn(),
    updateHitStatus: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue(null),
  };
  return {
    prisma,
    didit,
    auditLogs,
    service: new CmpAmlService(
      prisma as never,
      auditLogs as never,
      didit as never
    ),
  };
}

function hitFixture() {
  return {
    id: "hit-1",
    screeningId: "screening-1",
    diditHitId: "didit-hit-1",
    reviewStatus: "UNREVIEWED",
    matchScore: 0.9,
    riskScore: 0.8,
    detailsJson: { name: "Listed Person" },
    reviewedById: null,
    reviewedBy: null,
    reviewedAt: null,
    reviewComment: null,
    createdAt: new Date("2026-09-01T03:00:00.000Z"),
    screening: {
      diditRequestId: "didit-request-1",
      batch: { acceptanceRequestId: "acceptance-1" },
    },
  };
}
