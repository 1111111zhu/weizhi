import { DeclarationsService } from "./declarations.service";

const prisma = {
  independenceDeclaration: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
};
const auditLogs = {
  log: vi.fn(),
};
const access = {
  requireProjectMember: vi.fn(),
};

describe(DeclarationsService, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    access.requireProjectMember.mockResolvedValue({
      joinedAt: new Date("2026-06-01T00:00:00Z"),
    });
  });

  it("returns project declaration status for the current project member", async () => {
    prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await expect(
      service.status(
        { id: "user-1", globalRole: "STAFF" } as never,
        "project-1"
      )
    ).resolves.toStrictEqual({
      accepted: false,
      acceptedAt: null,
    });

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.independenceDeclaration.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        projectId: "project-1",
        declarationVersion: "v1",
        acceptedAt: { gte: new Date("2026-06-01T00:00:00Z") },
      },
      orderBy: { acceptedAt: "desc" },
    });
  });

  it("does not create a project-participant declaration for a system administrator observer", async () => {
    access.requireProjectMember.mockResolvedValue({
      isVirtualSuperAdmin: true,
      joinedAt: new Date(0),
    });
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );
    await expect(
      service.acceptProject("admin", "project-1")
    ).rejects.toMatchObject({
      response: expect.objectContaining({ code: "FORBIDDEN" }),
    });
    expect(prisma.independenceDeclaration.create).not.toHaveBeenCalled();
  });

  it("requires a new project declaration after the member rejoins", async () => {
    access.requireProjectMember.mockResolvedValue({
      joinedAt: new Date("2026-06-06T03:38:50.000Z"),
    });
    prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await expect(
      service.status(
        { id: "user-1", globalRole: "STAFF" } as never,
        "project-1"
      )
    ).resolves.toStrictEqual({
      accepted: false,
      acceptedAt: null,
    });

    expect(prisma.independenceDeclaration.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        projectId: "project-1",
        declarationVersion: "v1",
        acceptedAt: { gte: new Date("2026-06-06T03:38:50.000Z") },
      },
      orderBy: { acceptedAt: "desc" },
    });
  });

  it("does not require project declarations from super administrators", async () => {
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await expect(
      service.status(
        { id: "admin-1", globalRole: "SUPER_ADMIN" } as never,
        "project-1"
      )
    ).resolves.toStrictEqual({
      accepted: true,
      acceptedAt: null,
    });

    expect(access.requireProjectMember).not.toHaveBeenCalled();
    expect(prisma.independenceDeclaration.findFirst).not.toHaveBeenCalled();
  });

  it("lets confirmation officers open the global confirmation workspace without project membership", async () => {
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await expect(
      service.status(
        {
          id: "confirmation-officer-1",
          globalRole: "CONFIRMATION_OFFICER",
        } as never,
        "project-1"
      )
    ).resolves.toStrictEqual({ accepted: true, acceptedAt: null });

    expect(access.requireProjectMember).not.toHaveBeenCalled();
    expect(prisma.independenceDeclaration.findFirst).not.toHaveBeenCalled();
  });

  it("accepts an independence declaration for one project only", async () => {
    prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
    prisma.independenceDeclaration.create.mockResolvedValue({
      id: "declaration-1",
      userId: "user-1",
      projectId: "project-1",
      declarationVersion: "v1",
      acceptedAt: new Date("2026-06-01T00:00:00Z"),
      source: "web",
    });
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await service.acceptProject("user-1", "project-1");

    expect(access.requireProjectMember).toHaveBeenCalledWith(
      "project-1",
      "user-1"
    );
    expect(prisma.independenceDeclaration.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        projectId: "project-1",
        declarationVersion: "v1",
        source: "web",
      },
    });
    expect(auditLogs.log).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: "user-1",
        projectId: "project-1",
        action: "DECLARATION_ACCEPTED",
        targetId: "declaration-1",
      })
    );
  });

  it("creates a fresh project declaration when the prior one predates rejoin", async () => {
    access.requireProjectMember.mockResolvedValue({
      joinedAt: new Date("2026-06-06T03:38:50.000Z"),
    });
    prisma.independenceDeclaration.findFirst.mockResolvedValue(null);
    prisma.independenceDeclaration.create.mockResolvedValue({
      id: "declaration-2",
      userId: "user-1",
      projectId: "project-1",
      declarationVersion: "v1",
      acceptedAt: new Date("2026-06-06T03:39:00Z"),
      source: "web",
    });
    const service = new DeclarationsService(
      prisma as never,
      auditLogs as never,
      access as never
    );

    await service.acceptProject("user-1", "project-1");

    expect(prisma.independenceDeclaration.findFirst).toHaveBeenCalledWith({
      where: {
        userId: "user-1",
        projectId: "project-1",
        declarationVersion: "v1",
        acceptedAt: { gte: new Date("2026-06-06T03:38:50.000Z") },
      },
      orderBy: { acceptedAt: "desc" },
    });
    expect(prisma.independenceDeclaration.create).toHaveBeenCalledWith({
      data: {
        userId: "user-1",
        projectId: "project-1",
        declarationVersion: "v1",
        source: "web",
      },
    });
  });
});
