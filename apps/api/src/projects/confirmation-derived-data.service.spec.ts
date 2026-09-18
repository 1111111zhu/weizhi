import { ConfirmationDerivedDataService } from "./confirmation-derived-data.service";

const prisma = {
  project: {
    findUnique: vi.fn(),
  },
};
const submitter = {
  id: "user-1",
  email: "untrusted@example.test",
  name: "Untrusted Name",
  globalRole: "EMPLOYEE",
} as const;

function project(overrides: Record<string, unknown> = {}) {
  return {
    id: "project-1",
    projectCode: "AUD-2026-0003",
    name: "Orchid Audit 2026",
    yearEndDate: new Date("2026-12-31T00:00:00.000Z"),
    cmpClient: {
      clientCode: "C-ORC",
      nameZh: "兰花控股",
      nameEn: "Orchid Holdings",
      clientPartnerPic: "Client Partner",
    },
    cmpEngagement: {
      pic: "Engagement PIC",
      yearEndDate: new Date("2026-11-30T00:00:00.000Z"),
    },
    members: [
      {
        userId: "partner-1",
        inChargeRole: "PARTNER_IN_CHARGE",
        user: { name: "Member PIC", email: "partner@example.test" },
      },
      {
        userId: "user-1",
        inChargeRole: null,
        user: { name: "Authenticated Member", email: "member@example.test" },
      },
    ],
    ...overrides,
  };
}

describe(ConfirmationDerivedDataService, () => {
  beforeEach(() => vi.clearAllMocks());

  it("resolves all authoritative values with one project query", async () => {
    prisma.project.findUnique.mockResolvedValue(project());
    const service = new ConfirmationDerivedDataService(prisma as never);

    await expect(
      service.resolve("project-1", submitter as never, "AUD-2026-0003-YH-001")
    ).resolves.toStrictEqual({
      clientCode: "C-ORC",
      clientName: "兰花控股",
      projectCode: "AUD-2026-0003",
      projectName: "Orchid Audit 2026",
      picName: "Engagement PIC",
      fiscalYear: 2026,
      balanceSheetDate: "2026-11-30",
      contactUserId: "user-1",
      contactName: "Authenticated Member",
      contactEmail: "member@example.test",
      confirmationCode: "AUD-2026-0003-YH-001",
    });

    expect(prisma.project.findUnique).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        where: { id: "project-1" },
        select: expect.objectContaining({
          cmpClient: expect.any(Object),
          cmpEngagement: expect.any(Object),
          members: expect.objectContaining({
            where: expect.objectContaining({
              status: "ACTIVE",
              OR: [{ inChargeRole: "PARTNER_IN_CHARGE" }, { userId: "user-1" }],
            }),
          }),
        }),
      })
    );
  });

  it("resolves preview contacts for a super admin without project membership", async () => {
    prisma.project.findUnique.mockResolvedValue(
      project({
        members: [
          {
            userId: "partner-1",
            inChargeRole: "PARTNER_IN_CHARGE",
            user: { name: "Member PIC", email: "partner@example.test" },
          },
        ],
      })
    );
    const superAdmin = {
      id: "admin-1",
      email: "admin@example.test",
      name: "System Admin",
      globalRole: "SUPER_ADMIN",
    } as const;

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        superAdmin as never,
        "AUD-2026-0003-YH-001"
      )
    ).resolves.toMatchObject({
      contactUserId: "admin-1",
      contactName: "System Admin",
      contactEmail: "admin@example.test",
    });
  });

  it("uses English client name when the Chinese name is blank", async () => {
    prisma.project.findUnique.mockResolvedValue(
      project({
        cmpClient: {
          clientCode: "C-ORC",
          nameZh: " ",
          nameEn: "Orchid Holdings",
          clientPartnerPic: "Client Partner",
        },
      })
    );

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        submitter as never,
        "AUD-2026-0003-YH-001"
      )
    ).resolves.toMatchObject({ clientName: "Orchid Holdings" });
  });

  it("keeps confirmation operations available without a CMP client or engagement", async () => {
    prisma.project.findUnique.mockResolvedValue(
      project({ cmpClient: null, cmpEngagement: null })
    );

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        submitter as never,
        "AUD-2026-0003-YH-001"
      )
    ).resolves.toMatchObject({
      clientCode: "AUD-2026-0003",
      clientName: "Orchid Audit 2026",
      picName: "Member PIC",
      balanceSheetDate: "2026-12-31",
    });
  });

  it.each([
    [
      "client partner",
      { cmpEngagement: { pic: " ", yearEndDate: null } },
      "Client Partner",
    ],
    [
      "active partner member",
      {
        cmpEngagement: { pic: null, yearEndDate: null },
        cmpClient: {
          clientCode: "C-ORC",
          nameZh: "兰花控股",
          nameEn: "Orchid Holdings",
          clientPartnerPic: " ",
        },
      },
      "Member PIC",
    ],
  ])("falls back to the %s for PIC", async (_label, overrides, expected) => {
    prisma.project.findUnique.mockResolvedValue(project(overrides));

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        submitter as never,
        "AUD-2026-0003-YH-001"
      )
    ).resolves.toMatchObject({ picName: expected });
  });

  it("falls back to the project year-end date", async () => {
    prisma.project.findUnique.mockResolvedValue(
      project({ cmpEngagement: { pic: "Engagement PIC", yearEndDate: null } })
    );

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        submitter as never,
        "AUD-2026-0003-YH-001"
      )
    ).resolves.toMatchObject({
      balanceSheetDate: "2026-12-31",
      fiscalYear: 2026,
    });
  });

  it.each([
    ["PROJECT_REQUIRED", null],
    ["PROJECT_CODE_REQUIRED", project({ projectCode: " " })],
    ["PROJECT_NAME_REQUIRED", project({ name: " " })],
    [
      "BALANCE_SHEET_DATE_REQUIRED",
      project({
        yearEndDate: null,
        cmpEngagement: { pic: "Engagement PIC", yearEndDate: null },
      }),
    ],
    [
      "PROJECT_MEMBER_REQUIRED",
      project({
        members: [
          {
            userId: "partner-1",
            inChargeRole: "PARTNER_IN_CHARGE",
            user: { name: "Member PIC", email: "partner@example.test" },
          },
        ],
      }),
    ],
    [
      "CONTACT_NAME_REQUIRED",
      project({
        members: [
          {
            userId: "partner-1",
            inChargeRole: "PARTNER_IN_CHARGE",
            user: { name: "Member PIC", email: "partner@example.test" },
          },
          {
            userId: "user-1",
            inChargeRole: null,
            user: { name: " ", email: "member@example.test" },
          },
        ],
      }),
    ],
    [
      "CONTACT_EMAIL_REQUIRED",
      project({
        members: [
          {
            userId: "partner-1",
            inChargeRole: "PARTNER_IN_CHARGE",
            user: { name: "Member PIC", email: "partner@example.test" },
          },
          {
            userId: "user-1",
            inChargeRole: null,
            user: { name: "Member", email: " " },
          },
        ],
      }),
    ],
    ["CONFIRMATION_CODE_REQUIRED", project()],
  ])("throws stable field code %s", async (code, resolvedProject) => {
    prisma.project.findUnique.mockResolvedValue(resolvedProject);
    const confirmationCode =
      code === "CONFIRMATION_CODE_REQUIRED" ? " " : "AUD-2026-0003-YH-001";

    await expect(
      new ConfirmationDerivedDataService(prisma as never).resolve(
        "project-1",
        submitter as never,
        confirmationCode
      )
    ).rejects.toMatchObject({ response: expect.objectContaining({ code }) });
  });
});
